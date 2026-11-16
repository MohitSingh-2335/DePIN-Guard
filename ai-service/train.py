import os
import json
import time
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import precision_recall_fscore_support, accuracy_score

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_SENSORS = os.path.join(ROOT_DIR, "data", "sensor_data.csv")
DATA_PLC = os.path.join(ROOT_DIR, "data", "plc_industrial_control_dataset (1).csv")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "lstm_autoencoder.pth")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler.save")
THRESHOLD_PATH = os.path.join(os.path.dirname(__file__), "threshold.txt")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "metrics.json")

SEQ_LENGTH = 30
FEATURES = 6
EPOCHS = 30
LR = 0.001


class LSTMAutoencoder(nn.Module):
    def __init__(self, input_dim: int = 6, hidden_dim: int = 64):
        super().__init__()
        self.encoder = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, input_dim, batch_first=True)

    def forward(self, x):
        encoded, _ = self.encoder(x)
        decoded, _ = self.decoder(encoded)
        return decoded


def load_dataset():
    print(f"Loading sensor dataset: {DATA_SENSORS}")
    df_sensors = pd.read_csv(DATA_SENSORS)
    pivoted = df_sensors.pivot_table(index="timestamp", columns="sensor", values="value").reset_index()

    if "is_anomaly" in df_sensors.columns:
        anom = df_sensors.groupby("timestamp")["is_anomaly"].max().reset_index()
        pivoted["is_anomaly"] = anom["is_anomaly"]
    else:
        pivoted["is_anomaly"] = 0

    print(f"Loading PLC dataset: {DATA_PLC}")
    df_plc = pd.read_csv(DATA_PLC, nrows=len(pivoted))

    current_cols = [c for c in ["Current_1", "Current_2", "Current_3"] if c in pivoted.columns]
    current_avg = pivoted[current_cols].mean(axis=1).round(3) if current_cols else pd.Series(0.12, index=pivoted.index)

    voltage_cols = [c for c in ["Phase_1_Voltage", "Phase_2_Voltage", "Phase_3_Voltage"] if c in pivoted.columns]
    voltage_avg = pivoted[voltage_cols].mean(axis=1).round(2) if voltage_cols else pd.Series(217.5, index=pivoted.index)

    emergency_stop = df_plc["emergency_stop"].astype(bool) if "emergency_stop" in df_plc.columns else pd.Series(False, index=pivoted.index)
    combined_anomaly = (pivoted["is_anomaly"] == 1) | emergency_stop

    fused = pd.DataFrame({
        "temperature": pivoted["Temperature"].round(2),
        "vibration": pivoted["Vibration"].round(2),
        "power_usage": pivoted["Energy_Consumption"].round(2),
        "current_avg": current_avg,
        "voltage_avg": voltage_avg,
        "pressure": df_plc["hydraulic_pressure"].round(2),
        "is_anomaly": combined_anomaly.astype(int)
    })

    return fused


def train():
    fused_df = load_dataset()
    feature_cols = ["temperature", "vibration", "power_usage", "current_avg", "voltage_avg", "pressure"]

    # Split train (80%) and held-out validation (20%)
    split_idx = int(len(fused_df) * 0.8)
    train_df = fused_df.iloc[:split_idx]
    val_df = fused_df.iloc[split_idx:]

    # Unsupervised: fit scaler and train LSTM solely on normal baseline operation
    normal_train = train_df[train_df["is_anomaly"] == 0][feature_cols]
    print(f"Total dataset records: {len(fused_df)} | Normal training records: {len(normal_train)}")

    scaler = MinMaxScaler()
    scaled_train = scaler.fit_transform(normal_train.values)
    joblib.dump(scaler, SCALER_PATH)
    print(f"Saved 6-feature scaler to: {SCALER_PATH}")
    print(f"Scaler min: {scaler.data_min_} | max: {scaler.data_max_}")

    # Build temporal sliding sequences
    sequences = [scaled_train[i : i + SEQ_LENGTH] for i in range(len(scaled_train) - SEQ_LENGTH)]
    X_train = torch.tensor(np.array(sequences), dtype=torch.float32)
    print(f"Training sequences shape: {X_train.shape}")

    # Model, loss, optimizer
    model = LSTMAutoencoder(input_dim=FEATURES, hidden_dim=64)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"Training LSTM Autoencoder for {EPOCHS} epochs...")
    start_time = time.time()
    model.train()
    for epoch in range(EPOCHS):
        optimizer.zero_grad()
        output = model(X_train)
        loss = criterion(output, X_train)
        loss.backward()
        optimizer.step()

        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"Epoch [{epoch + 1:2d}/{EPOCHS}] - Reconstruction MSE: {loss.item():.6f}")

    duration = time.time() - start_time
    print(f"Training completed in {duration:.2f} seconds.")

    # Calculate 95th percentile reconstruction threshold on training sequences (final timestep)
    model.eval()
    with torch.no_grad():
        reconstructions = model(X_train)
        errors = torch.mean((X_train[:, -1, :] - reconstructions[:, -1, :]) ** 2, dim=1).numpy()

    threshold = float(np.percentile(errors, 95))
    with open(THRESHOLD_PATH, "w", encoding="utf-8") as f:
        f.write(f"{threshold:.6f}\n")

    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Saved model weights to: {MODEL_PATH}")
    print(f"Calculated 95th percentile threshold: {threshold:.6f} -> saved to {THRESHOLD_PATH}")

    # Evaluation on held-out validation set (normal + anomalies)
    scaled_val = scaler.transform(val_df[feature_cols].values)
    val_sequences = [scaled_val[i : i + SEQ_LENGTH] for i in range(len(scaled_val) - SEQ_LENGTH)]
    val_labels = [int(val_df["is_anomaly"].iloc[i + SEQ_LENGTH - 1]) for i in range(len(scaled_val) - SEQ_LENGTH)]

    X_val = torch.tensor(np.array(val_sequences), dtype=torch.float32)
    with torch.no_grad():
        val_recon = model(X_val)
        val_errors = torch.mean((X_val[:, -1, :] - val_recon[:, -1, :]) ** 2, dim=1).numpy()

    val_last_steps = X_val[:, -1, :].numpy()
    max_devs = np.max(np.maximum(0.0, np.maximum(-val_last_steps, val_last_steps - 1.0)), axis=1)
    combined_val_errors = val_errors + (max_devs * threshold * 2.0)

    val_preds = (combined_val_errors > threshold).astype(int)
    val_labels = np.array(val_labels)

    acc = float(accuracy_score(val_labels, val_preds))
    prec, rec, f1, _ = precision_recall_fscore_support(val_labels, val_preds, average="binary", zero_division=0)

    print("\nHeld-Out Validation Evaluation:")
    print(f"  Accuracy:  {acc * 100:.2f}%")
    print(f"  Precision: {prec * 100:.2f}%")
    print(f"  Recall:    {rec * 100:.2f}%")
    print(f"  F1-Score:  {f1 * 100:.2f}%")

    metrics = {}
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                metrics = json.load(f)
        except Exception:
            metrics = {}

    metrics.update({
        "model_name": "PyTorch 6-Channel Temporal LSTM Autoencoder",
        "threshold": round(threshold, 6),
        "accuracy": round(acc * 100, 2),
        "lstm_accuracy": round(acc * 100, 2),
        "precision": round(prec * 100, 2),
        "recall": round(rec * 100, 2),
        "f1_score": round(f1 * 100, 2),
        "epochs": EPOCHS,
        "input_features": feature_cols,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
    })

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to: {METRICS_PATH}")


if __name__ == "__main__":
    train()

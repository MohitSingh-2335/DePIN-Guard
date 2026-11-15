import os
import joblib
import torch
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_SENSORS = os.path.join(ROOT_DIR, "data", "sensor_data.csv")
DATA_PLC = os.path.join(ROOT_DIR, "data", "plc_industrial_control_dataset (1).csv")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "lstm_autoencoder.pth")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler.save")
THRESHOLD_PATH = os.path.join(os.path.dirname(__file__), "threshold.txt")

SEQ_LENGTH = 30
FEATURES = 4


class LSTMAutoencoder(torch.nn.Module):
    def __init__(self, input_dim: int = 4, hidden_dim: int = 64):
        super().__init__()
        self.encoder = torch.nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.decoder = torch.nn.LSTM(hidden_dim, input_dim, batch_first=True)

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

    fused = pd.DataFrame({
        "temperature": pivoted["Temperature"].round(2),
        "vibration": pivoted["Vibration"].round(2),
        "power_usage": (pivoted["Energy_Consumption"] * 10.0).round(2),
        "pressure": df_plc["hydraulic_pressure"].round(2),
        "is_anomaly": pivoted["is_anomaly"]
    })

    return fused


def validate():
    print("=" * 60)
    print("VALIDATING LSTM AUTOENCODER MODEL")
    print("=" * 60)

    fused_df = load_dataset()
    scaler = joblib.load(SCALER_PATH)

    with open(THRESHOLD_PATH, "r") as f:
        threshold = float(f.read().strip())

    print(f"Loaded threshold: {threshold:.6f}")

    model = LSTMAutoencoder(input_dim=FEATURES, hidden_dim=64)
    model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
    model.eval()

    feature_cols = ["temperature", "vibration", "power_usage", "pressure"]
    scaled_data = scaler.transform(fused_df[feature_cols].values)

    sequences = [scaled_data[i : i + SEQ_LENGTH] for i in range(len(scaled_data) - SEQ_LENGTH)]
    y_true = np.array([fused_df["is_anomaly"].iloc[i + SEQ_LENGTH - 1] for i in range(len(scaled_data) - SEQ_LENGTH)])

    X_tensor = torch.tensor(np.array(sequences), dtype=torch.float32)

    with torch.no_grad():
        reconstructed = model(X_tensor)
        losses = torch.mean((X_tensor - reconstructed) ** 2, dim=(1, 2)).numpy()

    predictions = (losses > threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(y_true, predictions).ravel()
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, predictions, average="binary", zero_division=0)
    accuracy = (tp + tn) / len(y_true)

    print("\nModel Performance Metrics:")
    print(f"  Total Test Sequences: {len(y_true)}")
    print(f"  Accuracy:             {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"  Precision:            {precision:.4f}")
    print(f"  Recall:               {recall:.4f}")
    print(f"  F1 Score:             {f1:.4f}")
    print(f"\nConfusion Matrix:")
    print(f"  True Positives (TP):  {tp}")
    print(f"  True Negatives (TN):  {tn}")
    print(f"  False Positives (FP): {fp}")
    print(f"  False Negatives (FN): {fn}")
    print(f"\nReconstruction Loss Analysis:")
    print(f"  Normal Sequences Mean Loss:  {losses[y_true == 0].mean():.6f}")
    print(f"  Anomaly Sequences Mean Loss: {losses[y_true == 1].mean():.6f}")
    print("=" * 60)


if __name__ == "__main__":
    validate()

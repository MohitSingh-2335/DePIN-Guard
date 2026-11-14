import os
import time
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import MinMaxScaler

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_SENSORS = os.path.join(ROOT_DIR, "data", "sensor_data.csv")
DATA_PLC = os.path.join(ROOT_DIR, "data", "plc_industrial_control_dataset (1).csv")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "lstm_autoencoder.pth")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "scaler.save")
THRESHOLD_PATH = os.path.join(os.path.dirname(__file__), "threshold.txt")

SEQ_LENGTH = 30
FEATURES = 4
EPOCHS = 30
LR = 0.001


class LSTMAutoencoder(nn.Module):
    def __init__(self, input_dim: int = 4, hidden_dim: int = 64):
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

    fused = pd.DataFrame({
        "temperature": pivoted["Temperature"].round(2),
        "vibration": pivoted["Vibration"].round(2),
        "power_usage": (pivoted["Energy_Consumption"] * 100.0).round(2),
        "pressure": df_plc["hydraulic_pressure"].round(2),
        "is_anomaly": pivoted["is_anomaly"]
    })

    return fused


def train():
    fused_df = load_dataset()
    feature_cols = ["temperature", "vibration", "power_usage", "pressure"]

    # Filter normal baseline data (unsupervised anomaly detection)
    normal_df = fused_df[fused_df["is_anomaly"] == 0][feature_cols]
    print(f"Total dataset records: {len(fused_df)} | Normal baseline records: {len(normal_df)}")

    # Fit MinMaxScaler
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(normal_df.values)
    joblib.dump(scaler, SCALER_PATH)
    print(f"Saved 4-feature scaler to: {SCALER_PATH}")
    print(f"Scaler min: {scaler.data_min_} | max: {scaler.data_max_}")

    # Build temporal sliding sequences
    sequences = [scaled_data[i : i + SEQ_LENGTH] for i in range(len(scaled_data) - SEQ_LENGTH)]
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

    # Calculate 95th percentile reconstruction threshold
    model.eval()
    with torch.no_grad():
        reconstructions = model(X_train)
        errors = torch.mean((X_train - reconstructions) ** 2, dim=(1, 2)).numpy()

    threshold = float(np.percentile(errors, 95))
    with open(THRESHOLD_PATH, "w", encoding="utf-8") as f:
        f.write(f"{threshold:.6f}\n")

    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Saved model weights to: {MODEL_PATH}")
    print(f"Calculated 95th percentile threshold: {threshold:.6f} -> saved to {THRESHOLD_PATH}")


if __name__ == "__main__":
    train()

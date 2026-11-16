import os
from collections import defaultdict, deque
import joblib
import numpy as np
import torch
import torch.nn as nn


def resolve_ai_service_dir() -> str:
    candidates = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai-service")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "ai-service")),
        "/app/ai-service",
        "ai-service",
    ]
    for p in candidates:
        if os.path.isdir(p):
            return p
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai-service"))


class LSTMAutoencoder(nn.Module):
    def __init__(self, input_dim: int = 6, hidden_dim: int = 64):
        super().__init__()
        self.encoder = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, input_dim, batch_first=True)

    def forward(self, x):
        encoded, _ = self.encoder(x)
        decoded, _ = self.decoder(encoded)
        return decoded


class AnomalyDetector:
    def __init__(self, model_path: str = None, scaler_path: str = None, threshold_path: str = None):
        base_dir = resolve_ai_service_dir()
        self.model_path = model_path or os.path.join(base_dir, "lstm_autoencoder.pth")
        self.scaler_path = scaler_path or os.path.join(base_dir, "scaler.save")
        self.threshold_path = threshold_path or os.path.join(base_dir, "threshold.txt")

        self.model = LSTMAutoencoder(input_dim=6, hidden_dim=64)
        if os.path.exists(self.model_path):
            self.model.load_state_dict(torch.load(self.model_path, map_location=torch.device("cpu")))
        self.model.eval()

        if os.path.exists(self.scaler_path):
            self.scaler = joblib.load(self.scaler_path)
        else:
            self.scaler = None

        self.threshold = 0.205
        if os.path.exists(self.threshold_path):
            try:
                with open(self.threshold_path, "r", encoding="utf-8") as f:
                    self.threshold = float(f.read().strip())
            except Exception:
                self.threshold = 0.205

        self.buffers = defaultdict(lambda: deque(maxlen=30))
        self.channel_names = ["temperature", "vibration", "power_usage", "current_avg", "voltage_avg", "pressure"]

    def predict(
        self,
        device_id: str,
        temperature: float,
        vibration: float,
        power_usage: float,
        pressure: float = 0.0,
        current_avg: float = 0.12,
        voltage_avg: float = 217.5
    ) -> dict:
        raw_reading = np.array([[
            float(temperature),
            float(vibration),
            float(power_usage),
            float(current_avg),
            float(voltage_avg),
            float(pressure)
        ]])

        if self.scaler is not None:
            scaled_reading = self.scaler.transform(raw_reading)[0]
        else:
            scaled_reading = np.array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])

        device_buf = self.buffers[device_id]
        device_buf.append(scaled_reading)

        seq = list(device_buf)
        while len(seq) < 30:
            seq.insert(0, seq[0])

        tensor_seq = torch.tensor(np.array(seq), dtype=torch.float32).unsqueeze(0)

        with torch.no_grad():
            reconstruction = self.model(tensor_seq)
            # Evaluate reconstruction loss specifically on the latest incoming reading
            step_loss = torch.mean((tensor_seq[:, -1, :] - reconstruction[:, -1, :]) ** 2).item()

        # Check deviations outside nominal training bounds [0.0, 1.0]
        devs = np.maximum(0.0, np.maximum(-scaled_reading, scaled_reading - 1.0))
        max_dev = float(np.max(devs))
        combined_loss = round(step_loss + (max_dev * self.threshold * 2.0), 6)

        is_anomaly = bool((combined_loss > self.threshold) or (max_dev > 0.0))

        if is_anomaly:
            ratio = combined_loss / self.threshold if self.threshold > 0 else 1.5
            raw_conf = 50.0 + 49.5 * (1.0 - np.exp(-0.65 * max(0.0, ratio - 1.0)))
            confidence = round(float(raw_conf), 2)

            if ratio >= 2.0 or max_dev >= 0.5:
                severity = "critical"
            elif ratio >= 1.3 or max_dev > 0.0:
                severity = "high"
            else:
                severity = "medium"

            # Identify primary deviating channels
            deviating = []
            if max_dev > 0.0:
                for idx, dev_val in enumerate(devs):
                    if dev_val > 0.0:
                        deviating.append(self.channel_names[idx])
            if not deviating:
                # Use channel-level reconstruction error
                with torch.no_grad():
                    channel_errs = ((tensor_seq[0, -1, :] - reconstruction[0, -1, :]) ** 2).numpy()
                top_idx = int(np.argmax(channel_errs))
                deviating.append(self.channel_names[top_idx])

            ch_str = ", ".join(deviating)
            description = f"Physical anomaly detected on {device_id} ({ch_str} exceeding nominal baseline)."
            recommendation = f"Inspect machine calibration and physical mechanical load on {ch_str}."
        else:
            severity = "low"
            ratio = combined_loss / self.threshold if self.threshold > 0 else 0.5
            confidence = round(float(max(60.0, min(99.0, (1.0 - ratio) * 100.0))), 2)
            description = f"Nominal baseline operation on {device_id}."
            recommendation = "Machine operating within safe nominal parameters."

        return {
            "device_id": device_id,
            "is_anomaly": is_anomaly,
            "loss": combined_loss,
            "threshold": round(self.threshold, 6),
            "severity": severity,
            "confidence": confidence,
            "description": description,
            "recommendation": recommendation,
            "channels": {
                "temperature": float(temperature),
                "vibration": float(vibration),
                "power_usage": float(power_usage),
                "current_avg": float(current_avg),
                "voltage_avg": float(voltage_avg),
                "pressure": float(pressure),
            }
        }

    def get_node_features(self, device_ids: list) -> np.ndarray:
        features = []
        for dev in device_ids:
            buf = self.buffers.get(dev)
            if buf and len(buf) > 0:
                features.append(buf[-1])
            else:
                features.append(np.array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]))
        return np.array(features, dtype=np.float32)

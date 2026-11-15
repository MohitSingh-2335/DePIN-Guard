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
    def __init__(self, input_dim: int = 4, hidden_dim: int = 64):
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

        self.model = LSTMAutoencoder(input_dim=4, hidden_dim=64)
        if os.path.exists(self.model_path):
            self.model.load_state_dict(torch.load(self.model_path, map_location=torch.device("cpu")))
        self.model.eval()

        if os.path.exists(self.scaler_path):
            self.scaler = joblib.load(self.scaler_path)
        else:
            self.scaler = None

        self.threshold = 0.155
        if os.path.exists(self.threshold_path):
            try:
                with open(self.threshold_path, "r", encoding="utf-8") as f:
                    self.threshold = float(f.read().strip())
            except Exception:
                self.threshold = 0.155

        self.buffers = defaultdict(lambda: deque(maxlen=30))

    def predict(self, device_id: str, temperature: float, vibration: float, power_usage: float, pressure: float = 0.0) -> dict:
        raw_reading = np.array([[float(temperature), float(vibration), float(power_usage), float(pressure)]])

        if self.scaler is not None:
            scaled_reading = self.scaler.transform(raw_reading)[0]
        else:
            scaled_reading = np.array([0.5, 0.5, 0.5, 0.5])

        device_buf = self.buffers[device_id]
        device_buf.append(scaled_reading)

        seq = list(device_buf)
        while len(seq) < 30:
            seq.insert(0, seq[0])

        tensor_seq = torch.tensor(np.array(seq), dtype=torch.float32).unsqueeze(0)

        with torch.no_grad():
            reconstruction = self.model(tensor_seq)
            loss = torch.mean((tensor_seq - reconstruction) ** 2).item()

        # Dynamic physical bounds from training scaler min/max
        is_out_of_bounds = False
        if self.scaler is not None and hasattr(self.scaler, "data_min_") and hasattr(self.scaler, "data_max_"):
            d_min = self.scaler.data_min_
            d_max = self.scaler.data_max_
            for idx, val in enumerate(raw_reading[0]):
                if val < d_min[idx] or val > d_max[idx]:
                    is_out_of_bounds = True
                    break

        is_anomaly = bool((loss > self.threshold) or is_out_of_bounds)

        if is_anomaly:
            ratio = loss / self.threshold if self.threshold > 0 else 1.5
            confidence = min(0.99, max(0.70, round(0.70 + (ratio - 1.0) * 0.15, 2)))
            severity = "critical" if ratio > 1.5 or is_out_of_bounds else "high"
            recommendation = "Reconstruction anomaly detected. Inspect machine calibration and mechanical load."
        else:
            severity = "low"
            ratio = loss / self.threshold if self.threshold > 0 else 0.5
            confidence = max(0.75, round(1.0 - (ratio * 0.25), 2))
            recommendation = "Machine operating within safe nominal parameters."

        return {
            "device_id": device_id,
            "is_anomaly": is_anomaly,
            "loss": round(loss, 6),
            "threshold": round(self.threshold, 6),
            "severity": severity,
            "confidence": round(confidence, 2),
            "recommendation": recommendation
        }

    def get_node_features(self, device_ids: list) -> np.ndarray:
        features = []
        for dev in device_ids:
            buf = self.buffers.get(dev)
            if buf and len(buf) > 0:
                features.append(buf[-1])
            else:
                features.append(np.array([0.5, 0.5, 0.5, 0.5]))
        return np.array(features, dtype=np.float32)

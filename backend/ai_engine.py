import os
from collections import defaultdict, deque
import joblib
import numpy as np
import torch
import torch.nn as nn


class LSTMAutoencoder(nn.Module):
    def __init__(self, input_dim: int = 3, hidden_dim: int = 64):
        super().__init__()
        self.encoder = nn.LSTM(input_dim, hidden_dim, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, input_dim, batch_first=True)

    def forward(self, x):
        encoded, _ = self.encoder(x)
        decoded, _ = self.decoder(encoded)
        return decoded


class AnomalyDetector:
    def __init__(self, model_path: str = None, scaler_path: str = None, threshold_path: str = None):
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai-service"))
        self.model_path = model_path or os.path.join(base_dir, "lstm_autoencoder.pth")
        self.scaler_path = scaler_path or os.path.join(base_dir, "scaler.save")
        self.threshold_path = threshold_path or os.path.join(base_dir, "threshold.txt")

        self.model = LSTMAutoencoder(input_dim=3, hidden_dim=64)
        self.model.load_state_dict(torch.load(self.model_path, map_location=torch.device("cpu")))
        self.model.eval()

        self.scaler = joblib.load(self.scaler_path)

        with open(self.threshold_path, "r", encoding="utf-8") as f:
            self.threshold = float(f.read().strip())

        self.buffers = defaultdict(lambda: deque(maxlen=30))

    def predict(self, device_id: str, temperature: float, vibration: float, power_usage: float) -> dict:
        raw_reading = np.array([[float(temperature), float(vibration), float(power_usage)]])
        scaled_reading = self.scaler.transform(raw_reading)[0]

        device_buf = self.buffers[device_id]
        device_buf.append(scaled_reading)

        seq = list(device_buf)
        while len(seq) < 30:
            seq.insert(0, seq[0])

        tensor_seq = torch.tensor(np.array(seq), dtype=torch.float32).unsqueeze(0)

        with torch.no_grad():
            reconstruction = self.model(tensor_seq)
            loss = torch.mean((tensor_seq - reconstruction) ** 2).item()

        is_anomaly = loss > self.threshold

        if is_anomaly:
            ratio = loss / self.threshold if self.threshold > 0 else 1.0
            if ratio > 2.0:
                severity = "critical"
                confidence = min(0.95, 0.5 + (ratio * 0.1))
            elif ratio > 1.5:
                severity = "high"
                confidence = min(0.90, 0.4 + (ratio * 0.1))
            else:
                severity = "medium"
                confidence = min(0.85, 0.3 + (ratio * 0.1))
            recommendation = "Anomaly pattern detected. Inspect machine operation and calibration."
        else:
            severity = "low"
            confidence = max(0.1, 1.0 - (loss / self.threshold * 0.5)) if self.threshold > 0 else 0.05
            recommendation = "Machine operating within normal parameters."

        return {
            "device_id": device_id,
            "is_anomaly": is_anomaly,
            "loss": round(loss, 6),
            "threshold": round(self.threshold, 6),
            "severity": severity,
            "confidence": round(confidence, 2),
            "recommendation": recommendation
        }

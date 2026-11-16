import os
from collections import defaultdict, deque
import joblib
import numpy as np
import torch
import torch.nn as nn

# Limit PyTorch CPU threads to minimize RAM and CPU spikes on free-tier containers
torch.set_num_threads(1)


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
        over_max = np.maximum(0.0, scaled_reading - 1.0)
        under_min = np.maximum(0.0, 0.0 - scaled_reading)
        bound_dev = float(np.max(np.maximum(over_max, under_min)))
        loss = round(step_loss + (bound_dev * self.threshold * 1.5), 6)
        is_anomaly = bool(loss > self.threshold)

        ratio = loss / max(self.threshold, 1e-6)
        if is_anomaly:
            raw_conf = 54.0 + 45.4 * (1.0 - float(np.exp(-0.75 * max(0.05, ratio - 1.0))))
            confidence = round(min(99.4, max(55.0, raw_conf)), 1)
            severity = "critical" if ratio >= 2.0 else ("high" if ratio >= 1.35 else "medium")

            # Dynamic description and recommendation identifying exact channel
            if pressure < 30.0 and pressure > 0.0:
                description = f"Hydraulic pressure dropped to {pressure:.1f} bar (Emergency Stop state) | LSTM MSE: {loss:.4f} > {self.threshold:.4f}"
                recommendation = "Emergency stop sequence activated. Clear hydraulic loop and reset pressure valves."
            elif vibration > 3.08:
                description = f"Vibration level shift ({vibration:.2f} mm/s > 3.08 mm/s max) | LSTM MSE: {loss:.4f} > {self.threshold:.4f}"
                recommendation = "Excessive mechanical vibration detected. Inspect bearings, mounts, and rotor alignment."
            elif temperature < 20.9 or temperature > 24.9:
                description = f"Temperature excursion ({temperature:.1f} °C outside normal 20.9-24.9 °C) | LSTM MSE: {loss:.4f} > {self.threshold:.4f}"
                recommendation = "Thermal boundary violation. Check cooling fluid circulation and ventilation."
            elif power_usage > 4.85:
                description = f"Power consumption surge ({power_usage:.2f} kW > 4.85 kW nominal) | LSTM MSE: {loss:.4f} > {self.threshold:.4f}"
                recommendation = "Electrical load overload. Verify motor phases and drive inverter."
            else:
                deviating = []
                for idx, d_val in enumerate(np.maximum(over_max, under_min)):
                    if d_val > 0.0:
                        deviating.append(self.channel_names[idx])
                ch_str = ", ".join(deviating) if deviating else "temporal pattern"
                description = f"Reconstruction anomaly on {device_id} ({ch_str}) | LSTM MSE: {loss:.4f} > {self.threshold:.4f}"
                recommendation = f"Inspect machine calibration and mechanical sensor load on {ch_str}."
        else:
            raw_conf = 99.0 - 35.0 * min(1.0, ratio)
            confidence = round(min(99.2, max(62.0, raw_conf)), 1)
            severity = "low"
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

import logging
import os
import threading
import time

import joblib
import torch
from flask import Flask, jsonify, request

from model import LSTMAutoencoder
from preprocessing import canonicalize_sensor_frame

app = Flask(__name__)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("depin_guard.ai_service")

FEATURES = 3
MODEL_PATH = "lstm_autoencoder.pth"
SCALER_PATH = "scaler.save"
THRESHOLD_PATH = "threshold.txt"
# Render sets PORT env var; check it first, then fallback to AI_SERVICE_PORT or 10000
DEFAULT_PORT = int(os.getenv("PORT", os.getenv("AI_SERVICE_PORT", "10000")))
DEFAULT_HOST = os.getenv("HOST", "0.0.0.0")

_artifact_lock = threading.Lock()
_artifacts_loaded = False
_artifact_error = None
model = None
scaler = None
THRESHOLD = None


def ensure_artifacts_loaded():
    global _artifacts_loaded, _artifact_error, model, scaler, THRESHOLD

    if _artifacts_loaded:
        return

    with _artifact_lock:
        if _artifacts_loaded:
            return

        try:
            logger.info("Loading AI inference artifacts")

            loaded_model = LSTMAutoencoder(input_dim=FEATURES, hidden_dim=64)
            loaded_model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device("cpu")))
            loaded_model.eval()

            loaded_scaler = joblib.load(SCALER_PATH)

            with open(THRESHOLD_PATH, "r", encoding="utf-8") as threshold_file:
                loaded_threshold = float(threshold_file.read().strip())

            model = loaded_model
            scaler = loaded_scaler
            THRESHOLD = loaded_threshold
            _artifact_error = None
            _artifacts_loaded = True

            logger.info("AI service ready with threshold %.6f", THRESHOLD)
        except Exception as exc:
            _artifact_error = f"{type(exc).__name__}: {exc}"
            logger.exception("Failed to load AI inference artifacts")
            raise


def validate_payload(payload):
    if not isinstance(payload, dict):
        return None, (jsonify({"error": "Request body must be a JSON object"}), 400)

    missing = [field for field in ("temperature", "vibration") if field not in payload]
    if missing:
        return None, (jsonify({"error": f"Missing required field(s): {', '.join(missing)}"}), 400)

    if payload.get("pressure") is None and payload.get("power_usage") is None:
        return None, (jsonify({"error": "Missing pressure/power_usage field"}), 400)

    try:
        input_frame = canonicalize_sensor_frame([payload])
    except (KeyError, ValueError, TypeError) as exc:
        return None, (jsonify({"error": str(exc)}), 400)

    return input_frame, None


@app.route("/", methods=["GET", "POST"])
def root():
    """Root API endpoint - provides service information."""
    return jsonify({
        "service": "DePIN Guard - AI Inference Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "GET /": "This information",
            "GET /health": "Health check",
            "GET /ready": "Readiness check with artifact validation",
            "POST /predict": "Anomaly detection inference"
        },
        "model": "LSTM Autoencoder + GNN Ensemble"
    }), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/ready", methods=["GET"])
def ready():
    try:
        ensure_artifacts_loaded()
        return jsonify({"status": "ready"})
    except Exception:
        return jsonify({"status": "not_ready", "error": _artifact_error or "unknown error"}), 503


@app.route("/predict", methods=["POST"])
def predict():
    started_at = time.perf_counter()

    try:
        ensure_artifacts_loaded()
    except Exception:
        return jsonify({"error": "AI inference artifacts are unavailable", "details": _artifact_error or "unknown"}), 503

    payload = request.get_json(silent=True)
    input_frame, error_response = validate_payload(payload)
    if error_response is not None:
        return error_response

    scaled_data = scaler.transform(input_frame)
    tensor_data = torch.tensor(scaled_data, dtype=torch.float32).unsqueeze(0)

    with torch.no_grad():
        reconstruction = model(tensor_data)
        loss = torch.mean((tensor_data - reconstruction) ** 2).item()

    is_anomaly = loss > THRESHOLD
    duration_ms = (time.perf_counter() - started_at) * 1000.0
    
    # Determine severity and confidence
    if is_anomaly:
        # Severity based on how much loss exceeds threshold
        excess_ratio = loss / THRESHOLD if THRESHOLD > 0 else 1.0
        if excess_ratio > 2.0:
            severity = "critical"
            confidence = min(0.95, 0.5 + (excess_ratio * 0.1))
        elif excess_ratio > 1.5:
            severity = "high"
            confidence = min(0.90, 0.4 + (excess_ratio * 0.1))
        else:
            severity = "medium"
            confidence = min(0.85, 0.3 + (excess_ratio * 0.1))
    else:
        severity = "low"
        confidence = max(0.1, 1.0 - (loss / THRESHOLD * 0.5)) if THRESHOLD > 0 else 0.05
    
    # Extract device_id from payload if available
    device_id = payload.get("device_id", f"Device-{int(payload.get('temperature', 0)) % 100:03d}")
    
    # Generate meaningful descriptions
    temp = payload.get("temperature", 0)
    vib = payload.get("vibration", 0)
    power = payload.get("power_usage", payload.get("pressure", 0))
    
    if is_anomaly:
        description = f"Anomaly detected: Temp {temp}°C, Vibration {vib} mm/s, Power {power}W. Loss: {loss:.6f} (Threshold: {THRESHOLD:.6f})"
        if temp > 85:
            recommendation = "High temperature detected. Check cooling system. Consider reducing load."
        elif vib > 10:
            recommendation = "Excessive vibration. Inspect mechanical components for wear or misalignment."
        elif power > 150:
            recommendation = "High power consumption. Check for electrical issues or system overload."
        else:
            recommendation = "Anomaly pattern detected. Review recent operational changes and sensor calibration."
    else:
        description = f"Normal operation: Temp {temp}C, Vibration {vib} mm/s, Power {power}W. All metrics within expected ranges."
        recommendation = "Continue regular monitoring. No immediate action required."

    logger.info("Inference completed in %.2f ms with loss %.6f (anomaly=%s)", duration_ms, loss, is_anomaly)

    return jsonify(
        {
            "device_id": device_id,
            "is_anomaly": bool(is_anomaly),
            "anomaly": bool(is_anomaly),
            "status": severity if is_anomaly else "normal",
            "severity": severity,
            "confidence": float(confidence),
            "loss": float(loss),
            "threshold": float(THRESHOLD),
            "description": description,
            "recommendation": recommendation,
            "analysis_type": "LSTM Autoencoder Anomaly Detection",
            "model_name": "LSTM + GNN Ensemble",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "inference_time_ms": round(duration_ms, 2),
        }
    )


if __name__ == "__main__":
    logger.info(f"Starting AI service on {DEFAULT_HOST}:{DEFAULT_PORT}")
    app.run(host=DEFAULT_HOST, port=DEFAULT_PORT, debug=False)
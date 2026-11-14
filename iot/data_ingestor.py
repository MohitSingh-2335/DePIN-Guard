import hashlib
import hmac
import os
import random
import time
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

# Load central environment configuration from root .env
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/") + "/api/process_data"
API_KEY = os.getenv("DEPIN_API_KEY", "")
STREAM_DELAY = float(os.getenv("STREAM_DELAY_SECONDS", "1.0"))
CONTINUOUS_LOOP = os.getenv("CONTINUOUS_LOOP", "true").lower() in ("true", "1", "yes")

if not API_KEY:
    raise RuntimeError("DEPIN_API_KEY is required in root .env file")

# 33 industrial machines
DEVICES = [f"Device-{i:03d}" for i in range(33)]

MACHINE_NAMES = {
    "Device-000": "Injection Molder", "Device-001": "Mixer", "Device-002": "Pick & Place",
    "Device-003": "Vision System", "Device-004": "Shuttle System", "Device-005": "Labeler",
    "Device-006": "Automated Screwdriver", "Device-007": "Shrink Wrapper", "Device-008": "Laser Cutter",
    "Device-009": "CMM", "Device-010": "CNC Lathe", "Device-011": "Dryer", "Device-012": "Valve Controller",
    "Device-013": "Furnace", "Device-014": "Carton Former", "Device-015": "Hydraulic Press",
    "Device-016": "Compressor", "Device-017": "AGV", "Device-018": "Robot Arm",
    "Device-019": "Conveyor Belt", "Device-020": "Forklift", "Device-021": "Press Brake",
    "Device-022": "Boiler", "Device-023": "Vacuum Packer", "Device-024": "XRay Inspector",
    "Device-025": "Crane", "Device-026": "3D Printer", "Device-027": "Palletizer",
    "Device-028": "Grinder", "Device-029": "CNC Mill", "Device-030": "Chiller",
    "Device-031": "Heat Exchanger", "Device-032": "Pump"
}


def sign_payload(payload: dict) -> str:
    message = f"{payload['device_id']}|{payload['temperature']}|{payload['vibration']}|{payload['power_usage']}|{payload['timestamp']}"
    return hmac.new(
        API_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def format_status(device_id: str, temp: float, vib: float, power: float) -> dict:
    machine_name = MACHINE_NAMES.get(device_id, "Industrial Machine")
    is_hot = temp > 85.0
    is_shaking = vib > 8.0
    is_high_power = power > 100.0

    concerns = sum([is_hot, is_shaking, is_high_power])
    if concerns >= 2:
        alert_level = "CRITICAL"
        short_status = "Machine in critical condition"
        recommendations = ["Stop machine immediately", "Inspect cooling and motor", "Contact maintenance"]
    elif concerns == 1:
        alert_level = "WARNING"
        short_status = "Machine showing abnormal readings"
        recommendations = ["Increase monitoring frequency", "Check lubrication", "Log reading"]
    else:
        alert_level = "NORMAL"
        short_status = "Machine operating within safe parameters"
        recommendations = ["Continue standard operation"]

    return {
        "machine_name": machine_name,
        "alert_level": alert_level,
        "status_short": short_status,
        "recommendations": recommendations
    }


def load_industrial_datasets():
    path_sensors = os.path.join(ROOT_DIR, "data", "sensor_data.csv")
    path_plc = os.path.join(ROOT_DIR, "data", "plc_industrial_control_dataset (1).csv")

    if not os.path.exists(path_sensors):
        print(f"Dataset not found at {path_sensors}. Using synthetic stream.")
        return []

    print(f"Loading industrial datasets: {path_sensors} and {path_plc}...")
    try:
        import pandas as pd
        df_sensors = pd.read_csv(path_sensors)
        pivoted = df_sensors.pivot_table(index="timestamp", columns="sensor", values="value").reset_index()

        if "is_anomaly" in df_sensors.columns:
            anom = df_sensors.groupby("timestamp")["is_anomaly"].max().reset_index()
            pivoted["is_anomaly"] = anom["is_anomaly"]
        else:
            pivoted["is_anomaly"] = 0

        # Load second dataset (PLC industrial control) if present
        df_plc = None
        if os.path.exists(path_plc):
            df_plc = pd.read_csv(path_plc, nrows=len(pivoted))

        records = []
        for i, row in pivoted.iterrows():
            temp = round(float(row.get("Temperature", 25.0)), 2)
            vib = round(float(row.get("Vibration", 0.5)), 2)
            power = round(float(row.get("Energy_Consumption", 0.3)) * 100.0, 2)
            anom_flag = int(row.get("is_anomaly", 0))

            plc_pressure = 0.0
            plc_valve = "NORMAL"
            plc_estop = False

            if df_plc is not None and i < len(df_plc):
                plc_pressure = round(float(df_plc.iloc[i].get("hydraulic_pressure", 0.0)), 2)
                plc_valve = str(df_plc.iloc[i].get("valve_status", "NORMAL"))
                plc_estop = bool(df_plc.iloc[i].get("emergency_stop", False))

            records.append({
                "temperature": temp,
                "vibration": vib,
                "power_usage": power,
                "pressure": plc_pressure,
                "valve_status": plc_valve,
                "emergency_stop": plc_estop,
                "ground_truth_anomaly": anom_flag
            })

        print(f"Successfully loaded and fused {len(records)} records from both datasets.")
        return records
    except Exception as exc:
        print(f"Error loading datasets ({exc}). Falling back to synthetic stream.")
        return []


def generate_synthetic_record():
    is_anomaly = random.random() < 0.20
    if is_anomaly:
        temp = round(random.uniform(90.0, 120.0), 2)
        vib = round(random.uniform(5.0, 15.0), 2)
        power = round(random.uniform(100.0, 150.0), 2)
    else:
        temp = round(random.uniform(20.0, 60.0), 2)
        vib = round(random.uniform(0.1, 2.0), 2)
        power = round(random.uniform(10.0, 50.0), 2)

    return {
        "temperature": temp,
        "vibration": vib,
        "power_usage": power,
        "pressure": round(random.uniform(1.0, 10.0), 2),
        "valve_status": "OPEN",
        "emergency_stop": False,
        "ground_truth_anomaly": int(is_anomaly)
    }


def stream_data(max_records: int = None):
    records = load_industrial_datasets()
    use_synthetic = len(records) == 0

    target_limit = max_records or (int(os.getenv("MAX_RECORDS")) if os.getenv("MAX_RECORDS") else None)

    print("Starting DePIN-Guard IoT Data Streamer...")
    print(f"Target URL: {BACKEND_URL}")
    print(f"Mode: {'Synthetic' if use_synthetic else 'Real Combined Industrial Datasets'}")
    print(f"Devices count: {len(DEVICES)}")
    print(f"Stream delay: {STREAM_DELAY}s | Continuous 24/7 loop: {CONTINUOUS_LOOP}")

    total_sent = 0
    successful_sent = 0
    error_count = 0
    device_idx = 0
    record_idx = 0

    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }

    try:
        while True:
            if target_limit and total_sent >= target_limit:
                print(f"Reached specified limit of {target_limit} records. Exiting.")
                break

            device_id = DEVICES[device_idx % len(DEVICES)]
            device_idx += 1

            if use_synthetic:
                rec = generate_synthetic_record()
            else:
                rec = records[record_idx]
                record_idx += 1
                if record_idx >= len(records):
                    if not CONTINUOUS_LOOP:
                        print("Reached end of dataset. Exiting.")
                        break
                    record_idx = 0

            timestamp_utc = datetime.now(timezone.utc).isoformat()
            meta = format_status(device_id, rec["temperature"], rec["vibration"], rec["power_usage"])

            payload = {
                "device_id": device_id,
                "temperature": rec["temperature"],
                "vibration": rec["vibration"],
                "power_usage": rec["power_usage"],
                "pressure": rec.get("pressure", 0.0),
                "timestamp": timestamp_utc,
                "machine_name": meta["machine_name"],
                "alert_level": meta["alert_level"],
                "status_short": meta["status_short"],
                "recommendations": meta["recommendations"],
            }
            payload["signature"] = sign_payload(payload)

            try:
                resp = requests.post(BACKEND_URL, json=payload, headers=headers, timeout=10)
                total_sent += 1
                if resp.status_code == 200:
                    successful_sent += 1
                else:
                    error_count += 1
                    if error_count == 1:
                        print(f"Backend returned HTTP status {resp.status_code}: {resp.text[:120]}")
            except requests.exceptions.ConnectionError:
                error_count += 1
                if error_count == 1:
                    print(f"Connection error to {BACKEND_URL}. Backend may be offline.")
            except Exception as exc:
                error_count += 1
                if error_count == 1:
                    print(f"Request error: {exc}")

            if total_sent > 0 and total_sent % 20 == 0:
                print(f"[Telemetry] Sent: {total_sent} | Success: {successful_sent} | Errors: {error_count} | Last Device: {device_id}")

            time.sleep(STREAM_DELAY)

    except KeyboardInterrupt:
        print("\nStreamer stopped by user.")
        print(f"Final Stats - Sent: {total_sent}, Success: {successful_sent}, Errors: {error_count}")


if __name__ == "__main__":
    stream_data()

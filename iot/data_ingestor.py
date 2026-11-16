import csv
import hashlib
import hmac
import os
import time
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

# Load central environment configuration from root .env
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/") + "/api/process_data"
API_KEY = os.getenv("DEPIN_API_KEY", "")
STREAM_DELAY = float(os.getenv("STREAM_DELAY_SECONDS", "5.0"))
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


def find_data_file(filename: str) -> str:
    candidates = [
        os.path.join(ROOT_DIR, "data", filename),
        os.path.join(ROOT_DIR, "..", "data", filename),
        os.path.join("/app", "data", filename),
        os.path.join("data", filename),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return os.path.join(ROOT_DIR, "data", filename)


def sign_payload(payload: dict) -> str:
    message = f"{payload['device_id']}|{payload['temperature']}|{payload['vibration']}|{payload['power_usage']}|{payload['timestamp']}"
    return hmac.new(
        API_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def format_status(device_id: str, temp: float, vib: float, power: float, pressure: float = 0.0, fault_type: str = "none") -> dict:
    machine_name = MACHINE_NAMES.get(device_id, "Industrial Machine")

    # Dynamic operating bounds grounded in real sensor_data.csv / plc dataset distributions
    is_temp_anom = temp < 20.5 or temp > 25.0
    is_vib_anom = vib > 3.10
    is_power_anom = power > 4.90
    is_press_anom = pressure > 185.0 or (pressure < 30.0 and pressure > 0)
    is_fault = (fault_type and fault_type != "none") or (fault_type == "emergency_stop")

    concerns = sum([is_temp_anom, is_vib_anom, is_power_anom, is_press_anom, is_fault])
    if concerns >= 2 or is_fault:
        alert_level = "CRITICAL"
        short_status = f"Abnormal condition detected ({fault_type if fault_type != 'none' else 'multi-sensor excursion'})"
        recommendations = ["Stop machine immediately", "Inspect cooling and motor", "Contact maintenance"]
    elif concerns == 1:
        alert_level = "WARNING"
        short_status = "Machine showing parameter elevation"
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


def load_industrial_datasets(start_ts_offset: int = 275, max_timestamps: int = 1200):
    path_sensors = find_data_file("sensor_data.csv")
    path_plc = find_data_file("plc_industrial_control_dataset (1).csv")

    timestamps = {}
    seen_ts_order = []

    if os.path.exists(path_sensors):
        try:
            with open(path_sensors, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                current_ts = None
                ts_idx = -1
                for row in reader:
                    ts = row.get("timestamp", "")
                    if ts != current_ts:
                        current_ts = ts
                        ts_idx += 1
                        if ts_idx >= start_ts_offset + max_timestamps:
                            break
                    if ts_idx < start_ts_offset:
                        continue

                    if ts not in timestamps:
                        timestamps[ts] = {
                            "temp": 22.5,
                            "vib": 0.25,
                            "pwr": 2.5,
                            "currents": [],
                            "voltages": [],
                            "fault_type": "none",
                            "is_anom": 0,
                        }
                        seen_ts_order.append(ts)

                    sensor = row.get("sensor", "")
                    try:
                        val = float(row.get("value", 0.0))
                    except (ValueError, TypeError):
                        val = 0.0

                    if sensor == "Temperature":
                        timestamps[ts]["temp"] = round(val, 2)
                    elif sensor == "Vibration":
                        timestamps[ts]["vib"] = round(val, 2)
                    elif sensor == "Energy_Consumption":
                        timestamps[ts]["pwr"] = round(val, 2)
                    elif sensor in ("Current_1", "Current_2", "Current_3"):
                        timestamps[ts]["currents"].append(val)
                    elif sensor in ("Phase_1_Voltage", "Phase_2_Voltage", "Phase_3_Voltage"):
                        timestamps[ts]["voltages"].append(val)

                    row_fault = row.get("fault_type", "").strip()
                    if row_fault and row_fault != "none":
                        timestamps[ts]["fault_type"] = row_fault

                    if str(row.get("is_anomaly", "0")) == "1":
                        timestamps[ts]["is_anom"] = 1
        except Exception as exc:
            print(f"[DatasetLoader] Notice loading sensors ({exc})")

    plc_rows = []
    if os.path.exists(path_plc):
        try:
            with open(path_plc, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader):
                    if idx < start_ts_offset:
                        continue
                    if len(plc_rows) >= max_timestamps:
                        break
                    try:
                        p = round(float(row.get("hydraulic_pressure", 0.0)), 2)
                    except (ValueError, TypeError):
                        p = 0.0
                    plc_rows.append({
                        "pressure": p,
                        "valve_status": str(row.get("valve_status", "NORMAL")),
                        "emergency_stop": str(row.get("emergency_stop", "False")).lower() in ("true", "1"),
                    })
        except Exception as exc:
            print(f"[DatasetLoader] Notice loading PLC ({exc})")

    records = []
    for idx, ts in enumerate(seen_ts_order):
        vals = timestamps[ts]
        plc = plc_rows[idx] if idx < len(plc_rows) else {"pressure": 0.0, "valve_status": "NORMAL", "emergency_stop": False}
        fault = "emergency_stop" if plc["emergency_stop"] else vals["fault_type"]
        cur_avg = round(sum(vals["currents"]) / len(vals["currents"]), 2) if vals["currents"] else 0.12
        volt_avg = round(sum(vals["voltages"]) / len(vals["voltages"]), 2) if vals["voltages"] else 217.5
        records.append({
            "temperature": vals["temp"],
            "vibration": vals["vib"],
            "power_usage": vals["pwr"],
            "current_avg": cur_avg,
            "voltage_avg": volt_avg,
            "pressure": plc["pressure"],
            "valve_status": plc["valve_status"],
            "emergency_stop": plc["emergency_stop"],
            "fault_type": fault,
            "is_anomaly": 1 if (vals["is_anom"] or plc["emergency_stop"]) else 0,
        })

    if not records:
        raise RuntimeError("No records loaded from industrial datasets. Verify data files exist in data/.")

    print(f"[DatasetLoader] Successfully loaded {len(records)} fused industrial records (offset={start_ts_offset}).")
    return records


def stream_data(max_records: int = None):
    records = load_industrial_datasets()
    target_limit = max_records or (int(os.getenv("MAX_RECORDS")) if os.getenv("MAX_RECORDS") else None)

    print("Starting DePIN-Guard IoT Data Streamer...")
    print(f"Target URL: {BACKEND_URL}")
    print(f"Dataset Size: {len(records)} continuous synchronized records")
    print(f"Devices count: {len(DEVICES)}")
    print(f"Stream delay: {STREAM_DELAY}s | Continuous loop: {CONTINUOUS_LOOP}")

    total_sent = 0
    successful_sent = 0
    error_count = 0
    device_idx = 0

    # Start at beginning of fused anomaly slice
    device_offsets = {dev: (i * 2) % len(records) for i, dev in enumerate(DEVICES)}

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

            # Get chronological next reading for this specific device
            rec_idx = device_offsets[device_id]
            rec = records[rec_idx]
            device_offsets[device_id] = (rec_idx + 1) % len(records)

            timestamp_utc = datetime.now(timezone.utc).isoformat()
            meta = format_status(
                device_id,
                rec["temperature"],
                rec["vibration"],
                rec["power_usage"],
                rec["pressure"],
                rec.get("fault_type", "none")
            )

            payload = {
                "device_id": device_id,
                "temperature": rec["temperature"],
                "vibration": rec["vibration"],
                "power_usage": rec["power_usage"],
                "pressure": rec["pressure"],
                "current_avg": rec.get("current_avg", 0.12),
                "voltage_avg": rec.get("voltage_avg", 217.5),
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

            if total_sent > 0 and total_sent % 30 == 0:
                print(f"[Telemetry] Sent: {total_sent} | Success: {successful_sent} | Errors: {error_count} | Last Device: {device_id}")

            time.sleep(STREAM_DELAY)

    except KeyboardInterrupt:
        print("\nStreamer stopped by user.")
        print(f"Final Stats - Sent: {total_sent}, Success: {successful_sent}, Errors: {error_count}")


if __name__ == "__main__":
    stream_data()

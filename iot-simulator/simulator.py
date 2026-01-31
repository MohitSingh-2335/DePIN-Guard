import requests
import time
import random
import json
from datetime import datetime

# --- CONFIGURATION ---
BACKEND_URL = "http://localhost:8000/api/process_data"
DEVICES = ["Device-001", "Device-002", "Device-003", "Device-004", "Device-005"]

def generate_sensor_data(device_id):
    """
    Generates synthetic IoT data.
    Most of the time it generates 'Normal' data.
    Sometimes (10% chance) it generates 'Anomaly' data to trigger the AI.
    """
    is_anomaly = random.random() < 0.75  # 10% chance of attack/anomaly

    if is_anomaly:
        print(f"⚠️ GENERATING ATTACK for {device_id}!")
        # Anomaly: High Temp, High Vibration, High Power
        temperature = round(random.uniform(95.0, 120.0), 2)  # Overheating
        vibration = round(random.uniform(5.0, 15.0), 2)      # Heavy shaking
        power_usage = round(random.uniform(100.0, 150.0), 2) # Power spike
    else:
        # Normal: Safe Temp, Low Vibration, Normal Power
        temperature = round(random.uniform(20.0, 60.0), 2)
        vibration = round(random.uniform(0.1, 2.0), 2)
        power_usage = round(random.uniform(10.0, 50.0), 2)

    return {
        "device_id": device_id,
        "temperature": temperature,
        "vibration": vibration,
        "power_usage": power_usage,  # <--- NEW FIELD ADDED
        "timestamp": datetime.now().isoformat()
    }

def run_simulator():
    print(f"🚀 DePIN-Guard IoT Simulator Started...")
    print(f"📡 Sending data to: {BACKEND_URL}")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            for device in DEVICES:
                data = generate_sensor_data(device)
                
                try:
                    # Send data to Backend
                    response = requests.post(BACKEND_URL, json=data, timeout=2)
                    
                    if response.status_code == 200:
                        result = response.json()
                        status_icon = "🔴" if result.get("anomaly") else "🟢"
                        print(f"{status_icon} Sent {device}: {data['temperature']}°C, {data['power_usage']}W -> {response.status_code}")
                    else:
                        print(f"❌ Error {response.status_code}: {response.text}")

                except requests.exceptions.ConnectionError:
                    print(f"❌ Connection Failed: Is the Backend running?")
                except Exception as e:
                    print(f"⚠️ Error: {e}")

                time.sleep(1) # Small delay between devices to look like a real stream
            
            time.sleep(2) # Wait 2 seconds before next batch scan

    except KeyboardInterrupt:
        print("\n🛑 Simulator Stopped.")

if __name__ == "__main__":
    run_simulator()
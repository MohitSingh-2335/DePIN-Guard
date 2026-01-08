import requests
import time
import random

# The URL of your running Flask API
url = 'http://localhost:5000/predict'

print("--- Starting Client Simulation ---")
print("Goal: Fill the server's buffer (30 points) and check for anomalies.")

# We will send 50 requests. 
# The first 29 should say "initializing".
# The rest should say "active".
for i in range(50):
    # Simulate "Normal" Data (similar to what we trained on)
    # Temp around 25, Vibration sin wave-ish
    payload = {
        "temperature": 25.0 + random.uniform(-0.5, 0.5),
        "vibration": 0.5 + random.uniform(-0.1, 0.1)
    }
    
    try:
        response = requests.post(url, json=payload)
        data = response.json()
        
        status = data.get("status", "unknown")
        anomaly = data.get("is_anomaly", "N/A")
        
        print(f"Req {i+1}: Status={status} | Anomaly={anomaly}")
        
        # If we hit an error, stop
        if response.status_code != 200:
            print("Error:", response.text)
            break
            
    except Exception as e:
        print(f"Connection Failed: {e}")
        break
        
    # Sleep a tiny bit to simulate real time (optional)
    time.sleep(0.1)

print("--- Simulation Complete ---")
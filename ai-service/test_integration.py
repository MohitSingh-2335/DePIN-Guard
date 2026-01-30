import requests
import time
import random

# Use localhost because we are testing from outside the container (your Windows PC)
url = "http://localhost:5000/predict"

print("--- Starting Integration Test (Simulating Backend) ---")

# We will send 35 requests to test the transition from "initializing" to "active"
for i in range(1, 36):
    # Simulate data similar to what the IoT sensors will send
    data = {
        "temperature": random.uniform(20, 30), 
        "vibration": random.uniform(0.1, 0.5)
    }
    
    try:
        response = requests.post(url, json=data)
        result = response.json()
        
        status = result.get("status", "unknown")
        print(f"Request {i}: Status = {status}")
        
        # Validation Logic
        if i < 30 and status != "initializing":
            print("   [!] ERROR: Buffer logic failed. Should be initializing.")
        elif i >= 30 and status != "active":
            print("   [!] ERROR: Activation logic failed. Should be active.")
            
    except Exception as e:
        print(f"Connection failed: {e}")
        break
        
    # fast simulation
    time.sleep(0.05) 

print("\n--- Test Complete ---")
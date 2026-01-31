from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import os
import hashlib
import json
from datetime import datetime

try:
    from fabric_manager import fabric_client
    BLOCKCHAIN_ACTIVE = True
except ImportError:
    BLOCKCHAIN_ACTIVE = False
    print("Fabric Manager not found. Blockchain integration disabled.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://depin_ai_service:5000/predict")

system_state = {
    "dashboard": {
        "active_devices": set(),
        "total_scans": 0,
        "anomalies": 0,
        "uptime": 100.0
    },
    "blockchain": {
        "total_blocks": 0,
        "transactions": 0,
        "recent_blocks": []
    },
    "ai": {
        "total_analyses": 0,
        "anomalies_found": 0,
        "recent_results": []
    },
    "history": [] 
}

class SensorData(BaseModel):
    device_id: str
    temperature: float
    vibration: float
    power_usage: float
    timestamp: str

@app.get("/")
def read_root():
    return {"status": "Backend is Live", "blockchain_active": BLOCKCHAIN_ACTIVE}

@app.get("/api/dashboard")
def get_dashboard():
    return {
        "stats": {
            "active": len(system_state["dashboard"]["active_devices"]),
            "scans": system_state["dashboard"]["total_scans"],
            "anomalies": system_state["dashboard"]["anomalies"],
            "uptime": system_state["dashboard"]["uptime"]
        },
        "recent_data": system_state["history"][-5:]
    }

@app.get("/api/blockchain")
def get_blockchain():
    return system_state["blockchain"]

@app.get("/api/ai-analysis")
def get_ai_analysis():
    return system_state["ai"]

@app.get("/api/history")
def get_history():
    return system_state["history"]

@app.post("/api/process_data")
def process_data(data: SensorData):
    try:
        # A. AI ANALYSIS & HYBRID CHECK
        is_anomaly = False
        recommendation = "Normal Operation"
        
        try:
            # 1. Ask the AI Model
            response = requests.post(AI_SERVICE_URL, json=data.dict(), timeout=2)
            ai_result = response.json()
            ai_says_anomaly = ai_result.get("anomaly", False)
            
            # 2. Apply Hybrid Logic (AI + Hard Rules)
            # If Temp > 100, we FORCE an anomaly (Physics Override)
            if ai_says_anomaly or data.temperature > 100.0:
                is_anomaly = True
            
            # 3. Set Recommendation
            if is_anomaly:
                if data.temperature > 100:
                    recommendation = "CRITICAL: Overheating Detected. Cooling Fan Failure likely."
                elif data.vibration > 10:
                    recommendation = "WARNING: Severe Mechanical Vibration. Check mounting."
                else:
                    recommendation = "ALERT: AI Detected Unknown Anomaly Pattern."

        except Exception as e:
            print(f"⚠️ AI Connection Warning: {e}")
            # Even if AI is dead, if Temp is high, catch it!
            if data.temperature > 100.0:
                is_anomaly = True
                recommendation = "CRITICAL: Overheating (AI Offline)"
            else:
                is_anomaly = False

        system_state["dashboard"]["total_scans"] += 1
        system_state["dashboard"]["active_devices"].add(data.device_id)
        system_state["ai"]["total_analyses"] += 1
        
        status_label = "normal"

        if is_anomaly:
            status_label = "critical"
            system_state["dashboard"]["anomalies"] += 1
            system_state["ai"]["anomalies_found"] += 1
            system_state["blockchain"]["total_blocks"] += 1
            system_state["blockchain"]["transactions"] += 1
            
            data_string = json.dumps(data.dict(), sort_keys=True)
            tx_hash = hashlib.sha256(data_string.encode()).hexdigest()
            
            block_record = {
                "id": system_state["blockchain"]["total_blocks"],
                "hash": tx_hash,
                "prev_hash": "0000000000000000",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "Confirmed"
            }
            system_state["blockchain"]["recent_blocks"].insert(0, block_record)
            system_state["blockchain"]["recent_blocks"] = system_state["blockchain"]["recent_blocks"][:10]

            ai_record = {
                "device": data.device_id,
                "confidence": 95.0,
                "recommendation": recommendation,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "severity": "high"
            }
            system_state["ai"]["recent_results"].insert(0, ai_record)
            system_state["ai"]["recent_results"] = system_state["ai"]["recent_results"][:10]
            
            if BLOCKCHAIN_ACTIVE:
                try:
                    fabric_client.submit_transaction("CreateAsset", [tx_hash, "ANOMALY", "CRITICAL", "AI", str(data.temperature)])
                    print(f"Ledger Updated: {tx_hash}")
                except Exception as e:
                    print(f"Ledger Write Failed: {e}")

        history_record = {
            "id": system_state["dashboard"]["total_scans"],
            "device": data.device_id,
            "hash": tx_hash if is_anomaly else "---",
            "value": f"{data.temperature}C",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": status_label,
            "temp": data.temperature,
            "vib": data.vibration,
            "pwr": data.power_usage
        }
        system_state["history"].append(history_record)
        
        if len(system_state["history"]) > 100:
            system_state["history"].pop(0)

        return {"status": "Processed", "anomaly": is_anomaly}

    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
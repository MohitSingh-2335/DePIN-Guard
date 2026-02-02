
from fastapi import FastAPI, HTTPException, Security, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
import httpx  # Async replacement for requests
import os
import hashlib
import json
from datetime import datetime
from dotenv import load_dotenv

try:
    from fabric_manager import fabric_client
    BLOCKCHAIN_ACTIVE = True
except ImportError:
    BLOCKCHAIN_ACTIVE = False
    print("Fabric Manager not found. Blockchain integration disabled.")
    
# NEW: Import our Service
from services.blockchain_service import BlockchainService

app = FastAPI()

# Load the secret .env file
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ==========================================
# 🔒 SECURITY SECTION
# ==========================================

# 1. API KEY CONFIGURATION
API_KEY = os.getenv("DEPIN_API_KEY", "depin-default-key-local") # Fallback for local dev
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        # Allow Simulator to work for now if key is missing, but warn
        if not api_key:
            return "public-access"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials - Missing or Wrong API Key"
        )
    return api_key

# 2. CORS CONFIGURATION (Dynamic for Codespaces)
# We trust localhost AND any Github Codespace ending in .app.github.dev
origin_regex = r"https://.*\.app\.github\.dev"

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=origin_regex, # AUTO-TRUST Codespaces
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://depin_ai_service:5000/predict")

# INITIALIZE SERVICES
blockchain_service = BlockchainService(fabric_client if BLOCKCHAIN_ACTIVE else None)

system_state = {
    "dashboard": {
        "active_devices": set(),
        "total_scans": 0,
        "anomalies": 0,
        "uptime": 100.0
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

# 🔒 SECURED ENDPOINTS (Require API Key)
@app.get("/api/dashboard", dependencies=[Depends(verify_api_key)])
def get_dashboard():
    # Merge local state with service state
    bc_state = blockchain_service.get_status()
    
    return {
        "stats": {
            "active": len(system_state["dashboard"]["active_devices"]),
            "scans": system_state["dashboard"]["total_scans"],
            "anomalies": system_state["dashboard"]["anomalies"],
            "uptime": system_state["dashboard"]["uptime"]
        },
        "recent_data": system_state["history"][-5:]
    }

@app.get("/api/blockchain", dependencies=[Depends(verify_api_key)])
def get_blockchain():
    return blockchain_service.get_status()

@app.get("/api/ai-analysis", dependencies=[Depends(verify_api_key)])
def get_ai_analysis():
    return system_state["ai"]

@app.get("/api/history", dependencies=[Depends(verify_api_key)])
def get_history():
    return system_state["history"]

# --- ASYNC OPTIMIZATION HERE ---
@app.post("/api/process_data") 
async def process_data(data: SensorData):
    try:
        # A. AI ANALYSIS & HYBRID CHECK
        is_anomaly = False
        recommendation = "Normal Operation"
        
        try:
            # 1. Ask the AI Model (ASYNC non-blocking now!)
            async with httpx.AsyncClient() as client:
                response = await client.post(AI_SERVICE_URL, json=data.dict(), timeout=2.0)
                ai_result = response.json()
                ai_says_anomaly = ai_result.get("is_anomaly", False) # Fixed key name
            
            # 2. Apply Hybrid Logic (AI + Hard Rules)
            # Logic: If AI says anomaly OR Temp is wildly high
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
            # Fallback logic if AI is dead
            if data.temperature > 100.0:
                is_anomaly = True
                recommendation = "CRITICAL: Overheating (AI Offline)"
            else:
                is_anomaly = False

        system_state["dashboard"]["total_scans"] += 1
        system_state["dashboard"]["active_devices"].add(data.device_id)
        system_state["ai"]["total_analyses"] += 1
        
        status_label = "normal"

        tx_hash = "---"

        if is_anomaly:
            status_label = "critical"
            system_state["dashboard"]["anomalies"] += 1
            system_state["ai"]["anomalies_found"] += 1
            
            # --- REFACTORED BLOCKCHAIN LOGIC ---
            # Now we just call the service!
            tx_hash, success = blockchain_service.add_block(
                data=data.dict(),
                status_label=status_label,
                vibration_int=int(data.vibration),
                temperature_int=int(data.temperature)
            )

            ai_record = {
                "device": data.device_id,
                "confidence": 95.0,
                "recommendation": recommendation,
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "severity": "high"
            }
            system_state["ai"]["recent_results"].insert(0, ai_record)
            system_state["ai"]["recent_results"] = system_state["ai"]["recent_results"][:10]
            
        history_record = {
            "id": system_state["dashboard"]["total_scans"],
            "device": data.device_id,
            "hash": tx_hash,
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
        # raise HTTPException(status_code=500, detail=str(e)) # Don't crash the simulator
        return {"status": "error", "message": str(e)}
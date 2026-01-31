from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import os
import hashlib
import json
# Import the CLI wrapper we created
from fabric_manager import fabric_client

app = FastAPI()

# --- Use environment variable if available, else default ---
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://depin_ai_service:5000/predict")

class SensorData(BaseModel):
    device_id: str
    temperature: float
    vibration: float
    timestamp: str = "2024-01-01T00:00:00Z" # Default if not provided

@app.get("/")
def read_root():
    return {"status": "Backend is Live", "environment": "Docker/Codespaces"}

# --- WEEK 3: INTEGRATION WITH AI SERVICE & BLOCKCHAIN ---
@app.post("/api/process_data")
def process_data(data: SensorData):
    """
    Receives sensor data from Simulator, sends to AI Service, 
    and records anomalies on the Blockchain.
    """
    try:
        # 1. Call AI Service
        # Note: We use 'def' (not async) so this blocking call runs in a thread
        response = requests.post(AI_SERVICE_URL, json=data.dict(), timeout=5)
        response.raise_for_status()
        ai_result = response.json()
        
        # 2. Handle "initializing" state
        if ai_result.get("status") == "initializing":
            return {
                "verdict": "BUFFERING",
                "message": "AI system initializing. Data collected but not analyzed yet.",
                "data": data.dict()
            }

        # 3. Handle "active" state
        is_anomaly = ai_result.get("anomaly", False)

        # 4. Blockchain Integration
        if is_anomaly:
            print(f"⚠️ ANOMALY DETECTED: {data.temperature}°C. Recording to Ledger...")
            
            # Create a unique hash of the data to store on-chain
            data_string = json.dumps(data.dict(), sort_keys=True)
            data_hash = hashlib.sha256(data_string.encode()).hexdigest()
            
            # Record the hash on the blockchain using our CLI Wrapper
            # The 'basic' chaincode CreateAsset requires 5 args: ID, Color, Size, Owner, Value
            # We map them to: [Hash, Type, Severity, Source, Value]
            result = fabric_client.submit_transaction(
                "CreateAsset", 
                [
                    data_hash,          # Asset ID (The Hash)
                    "ANOMALY",          # Color -> Type
                    "CRITICAL",         # Size -> Severity
                    "AI_SERVICE",       # Owner -> Source
                    str(data.temperature) # Value -> Sensor Reading
                ]
            )
            
            if result["status"] == "error":
                print(f"❌ Blockchain Error: {result['error']}")
                # We log the error but don't crash the API response
            else:
                print(f"✅ Blockchain: Recorded anomaly hash {data_hash}")

        return {
            "verdict": "ANOMALY" if is_anomaly else "NORMAL",
            "ai_analysis": ai_result,
            "blockchain_status": "Recorded" if is_anomaly else "Skipped"
        }

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504, 
            detail=f"AI Service timed out. Could not process data at {AI_SERVICE_URL}"
        )
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503, 
            detail=f"Cannot reach AI Service at {AI_SERVICE_URL}. Is it running?"
        )
    except requests.exceptions.HTTPError as e:
        raise HTTPException(
            status_code=response.status_code, 
            detail=f"AI Service returned HTTP error: {str(e)}"
        )
    except Exception as e:
        print(f"Server Error: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Unexpected error: {str(e)}"
        )

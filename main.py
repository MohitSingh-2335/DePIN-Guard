import subprocess
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import os
import json

app = FastAPI()

# --- AI SERVICE URL ---
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://depin_ai_service:5000/predict")

# --- SENSOR DATA MODEL ---
class SensorData(BaseModel):
    device_id: str
    temperature: float
    vibration: float
    timestamp: str = "2024-01-01T00:00:00Z"

# --- ROOT ENDPOINT ---
@app.get("/")
def read_root():
    return {"status": "Backend is Live", "environment": "Docker/Codespaces"}

# --- HEALTH CHECK ---
@app.get("/health")
def health_check():
    return {"status": "backend ready"}

# --- FABRIC PING ---
@app.get("/fabric/ping")
def fabric_ping():
    result = subprocess.run(
        ["docker", "ps"],
        capture_output=True,
        text=True
    )
    return {
        "success": True,
        "output": result.stdout
    }

# --- PROCESS SENSOR DATA ---
@app.post("/api/process_data")
def process_data(data: SensorData):
    """
    1. Calls AI service to detect anomaly
    2. If anomaly, writes data to Fabric blockchain
    3. Queries all assets from blockchain
    """
    # --- 1. Call AI service ---
    try:
        response = requests.post(AI_SERVICE_URL, json=data.dict(), timeout=5)
        ai_result = response.json()
    except requests.exceptions.RequestException:
        raise HTTPException(
            status_code=503,
            detail="Cannot reach AI Service. Is 'depin_ai_service' running?"
        )

    # --- 2. Decide action ---
    is_anomaly = ai_result.get("anomaly", False)
    verdict = "ANOMALY" if is_anomaly else "NORMAL"

    # --- 3. If anomaly, write to Fabric ---
    if is_anomaly:
        args = [
            "docker", "exec",
            "-e", "CORE_PEER_LOCALMSPID=Org1MSP",
            "-e", "CORE_PEER_TLS_ENABLED=true",
            "-e", "CORE_PEER_ADDRESS=peer0.org1.example.com:7051",
            "-e", "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp",
            "-e", "CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
            "peer0.org1.example.com",
            "peer", "chaincode", "invoke",
            "-C", "mychannel",
            "-n", "asset-transfer-basic",
            "-c", json.dumps({
                "Args": [
                    "CreateAsset",
                    data.device_id,
                    str(data.temperature),
                    str(data.vibration),
                    verdict,
                    data.timestamp
                ]
            }),
            "--waitForEvent"
        ]
        result = subprocess.run(args, capture_output=True, text=True)
        fabric_success = result.returncode == 0
        fabric_output = result.stdout if result.stdout else result.stderr
    else:
        fabric_success = False
        fabric_output = "No blockchain write needed"

    # --- 4. Query all assets from Fabric ---
    query_result = subprocess.run(
        [
            "docker", "exec",
            "-e", "CORE_PEER_LOCALMSPID=Org1MSP",
            "-e", "CORE_PEER_TLS_ENABLED=true",
            "-e", "CORE_PEER_ADDRESS=peer0.org1.example.com:7051",
            "-e", "CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp",
            "-e", "CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt",
            "peer0.org1.example.com",
            "peer", "chaincode", "query",
            "-C", "mychannel",
            "-n", "asset-transfer-basic",
            "-c", '{"Args":["GetAllAssets"]}'
        ],
        capture_output=True,
        text=True
    )

    return {
        "ai_verdict": verdict,
        "ai_result": ai_result,
        "fabric_write_success": fabric_success,
        "fabric_write_output": fabric_output,
        "all_assets": query_result.stdout if query_result.stdout else query_result.stderr
    }

import subprocess
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {
        "project": "DePIN-Guard",
        "status": "Backend is Live",
        "team_lead": "Priyanshu"
    }

@app.get("/health")
def health_check():
    return {"status": "backend ready"}

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

@app.get("/fabric/query")
def fabric_query():
    """
    Query the deployed chaincode using docker exec on peer0.org1
    """
    result = subprocess.run(
        [
            "docker", "exec", "-e", "CORE_PEER_LOCALMSPID=Org1MSP",
            "-e", f"CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp",
            "-e", "CORE_PEER_ADDRESS=peer0.org1.example.com:7051",
            "peer0.org1.example.com",
            "peer", "chaincode", "query",
            "-C", "mychannel",  # channel name
            "-n", "asset-transfer-basic",  # chaincode name
            "-c", '{"Args":["GetAllAssets"]}'  # function to call
        ],
        capture_output=True,
        text=True
    )
    return {
        "success": True if result.returncode == 0 else False,
        "output": result.stdout if result.stdout else result.stderr
    }

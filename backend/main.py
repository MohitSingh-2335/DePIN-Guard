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
    TLS ENABLED (mandatory for Fabric)
    """
    result = subprocess.run(
        [
            "docker", "exec",

            # ---- FABRIC ENV VARIABLES ----
            "-e", "CORE_PEER_LOCALMSPID=Org1MSP",
            "-e", "CORE_PEER_TLS_ENABLED=true",
            "-e", "CORE_PEER_ADDRESS=peer0.org1.example.com:7051",

            "-e",
            "CORE_PEER_MSPCONFIGPATH="
            "/opt/gopath/src/github.com/hyperledger/fabric/peer/"
            "crypto/peerOrganizations/org1.example.com/users/"
            "Admin@org1.example.com/msp",

            "-e",
            "CORE_PEER_TLS_ROOTCERT_FILE="
            "/opt/gopath/src/github.com/hyperledger/fabric/peer/"
            "crypto/peerOrganizations/org1.example.com/peers/"
            "peer0.org1.example.com/tls/ca.crt",

            # ---- CONTAINER ----
            "peer0.org1.example.com",

            # ---- CHAINCODE QUERY ----
            "peer", "chaincode", "query",
            "-C", "mychannel",
            "-n", "asset-transfer-basic",
            "-c", '{"Args":["GetAllAssets"]}'
        ],
        capture_output=True,
        text=True
    )

    return {
        "success": result.returncode == 0,
        "output": result.stdout if result.stdout else result.stderr
    }

import subprocess
import os
import json
import shutil

# --- 1. CONFIGURATION ---
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLOCKCHAIN_DIR = os.path.join(REPO_ROOT, "blockchain/fabric-samples/test-network")
# POINT TO THE REAL BINARY LOCATION
BIN_DIR = os.path.join(REPO_ROOT, "blockchain/fabric-samples/bin") 
CONFIG_DIR = os.path.join(REPO_ROOT, "blockchain/fabric-samples/config")

# Set up Environment Variables
env = os.environ.copy()
env["PATH"] = f"{BIN_DIR}:{env['PATH']}"
env["FABRIC_CFG_PATH"] = CONFIG_DIR
env["CORE_PEER_TLS_ENABLED"] = "true"
env["CORE_PEER_LOCALMSPID"] = "Org1MSP"

# --- CERTIFICATE PATHS (FOR ORG 1 AND ORG 2) ---
ORG1_TLS_ROOT = os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt")
ORG1_MSP_DIR = os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp")

# NEW: Org 2 Certificates
ORG2_TLS_ROOT = os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt")

env["CORE_PEER_TLS_ROOTCERT_FILE"] = ORG1_TLS_ROOT
env["CORE_PEER_MSPCONFIGPATH"] = ORG1_MSP_DIR

# --- CRITICAL FIX: Detect if running in Docker ---
if os.environ.get("CORE_PEER_ADDRESS"): 
    ORDERER_ADDRESS = "host.docker.internal:7050"
    PEER1_ADDRESS = "host.docker.internal:7051"
    PEER2_ADDRESS = "host.docker.internal:9051" # <--- Added Org2
else:
    ORDERER_ADDRESS = "localhost:7050"
    PEER1_ADDRESS = "localhost:7051"
    PEER2_ADDRESS = "localhost:9051" # <--- Added Org2

class FabricManager:
    def __init__(self):
        self.peer_executable = shutil.which("peer")
        
        # Check explicit paths if not in PATH
        if not self.peer_executable and os.path.exists(os.path.join(BIN_DIR, "peer")):
            self.peer_executable = os.path.join(BIN_DIR, "peer")
        
        if self.peer_executable:
            print(f"✅ Hyperledger Fabric found at: {self.peer_executable}")
            print(f"🔗 Targeted Peers: {PEER1_ADDRESS} (Org1) & {PEER2_ADDRESS} (Org2)")
        else:
            print("⚠️ 'peer' binary not found. Running in SIMULATION MODE.")

    def submit_transaction(self, function_name, args_list):
        print(f"⚡ BLOCKCHAIN: Submitting '{function_name}' with {args_list}")

        if not self.peer_executable:
            return {"status": "simulated"}

        cmd_args = {"Args": [function_name] + args_list}
        cmd_args_json = json.dumps(cmd_args)

        try:
            # WE NOW TARGET BOTH PEERS (Org1 AND Org2) to satisfy the policy
            command = [
                self.peer_executable, "chaincode", "invoke",
                "-o", ORDERER_ADDRESS,
                "--ordererTLSHostnameOverride", "orderer.example.com",
                "--tls",
                "--cafile", os.path.join(BLOCKCHAIN_DIR, "organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"),
                "-C", "mychannel",
                "-n", "basic",
                
                # PEER 1 (Org 1)
                "--peerAddresses", PEER1_ADDRESS,
                "--tlsRootCertFiles", ORG1_TLS_ROOT,
                
                # PEER 2 (Org 2) - THE FIX IS HERE!
                "--peerAddresses", PEER2_ADDRESS,
                "--tlsRootCertFiles", ORG2_TLS_ROOT,
                
                "-c", cmd_args_json
            ]

            result = subprocess.run(
                command, 
                env=env, 
                capture_output=True, 
                text=True
            )

            if result.returncode == 0:
                print("✅ Transaction Successful (Endorsed by Org1 & Org2)")
                return {"status": "success", "output": result.stdout}
            else:
                print(f"❌ Transaction Failed: {result.stderr}")
                return {"status": "error", "error": result.stderr}

        except Exception as e:
            print(f"❌ Execution Error: {e}")
            return {"status": "error", "error": str(e)}

    def query_transaction(self, function_name, arg):
        # Queries only need ONE peer, so we keep this simple
        if not self.peer_executable: return [] 

        print(f"🔍 BLOCKCHAIN: Querying '{function_name}' for {arg}")
        cmd_args = {"Args": [function_name, arg]}
        cmd_args_json = json.dumps(cmd_args)

        try:
            command = [
                self.peer_executable, "chaincode", "query",
                "-C", "mychannel",
                "-n", "basic",
                "-c", cmd_args_json
            ]
            
            result = subprocess.run(command, env=env, capture_output=True, text=True)

            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                return []

        except Exception as e:
            print(f"❌ Query Error: {e}")
            return []

fabric_client = FabricManager()
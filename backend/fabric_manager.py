import subprocess
import os
import json
import shutil

# --- 1. CONFIGURATION ---
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLOCKCHAIN_DIR = os.path.join(REPO_ROOT, "blockchain/fabric-samples/test-network")
BIN_DIR = os.path.join(REPO_ROOT, "blockchain/bin")
CONFIG_DIR = os.path.join(REPO_ROOT, "blockchain/config")

# Set up Environment Variables
env = os.environ.copy()
env["PATH"] = f"{BIN_DIR}:{env['PATH']}"
env["FABRIC_CFG_PATH"] = CONFIG_DIR
env["CORE_PEER_TLS_ENABLED"] = "true"
env["CORE_PEER_LOCALMSPID"] = "Org1MSP"
env["CORE_PEER_TLS_ROOTCERT_FILE"] = os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt")
env["CORE_PEER_MSPCONFIGPATH"] = os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp")

# --- CRITICAL FIX: Detect if running in Docker ---
# If we are in Docker (ENV variable exists), use 'host.docker.internal'
# If we are local, use 'localhost'
if os.environ.get("CORE_PEER_ADDRESS"): 
    ORDERER_ADDRESS = "host.docker.internal:7050"
    PEER_ADDRESS = "host.docker.internal:7051"
else:
    ORDERER_ADDRESS = "localhost:7050"
    PEER_ADDRESS = "localhost:7051"

class FabricManager:
    def __init__(self):
        # 1. Check system PATH for 'peer'
        self.peer_executable = shutil.which("peer")
        
        # 2. If not found, check the BIN_DIR explicitly (Local fallback)
        if not self.peer_executable and os.path.exists(os.path.join(BIN_DIR, "peer")):
            self.peer_executable = os.path.join(BIN_DIR, "peer")
            
        # 3. If still not found, check /usr/local/bin (Docker Mount location)
        if not self.peer_executable and os.path.exists("/usr/local/bin/peer"):
            self.peer_executable = "/usr/local/bin/peer"

        if self.peer_executable:
            print(f"✅ Hyperledger Fabric found at: {self.peer_executable}")
            print(f"🔗 Connecting to Peer at: {PEER_ADDRESS}")
        else:
            print("⚠️ 'peer' binary not found. Running in SIMULATION MODE.")

    def submit_transaction(self, function_name, args_list):
        print(f"⚡ BLOCKCHAIN: Submitting '{function_name}' with {args_list}")

        # --- A. SIMULATION MODE (Safeguard) ---
        if not self.peer_executable:
            return {
                "status": "success", 
                "message": "Transaction simulated (Peer binary missing)",
                "txid": "sim_tx_" + str(os.urandom(4).hex())
            }

        # --- B. REAL MODE ---
        cmd_args = {"Args": [function_name] + args_list}
        cmd_args_json = json.dumps(cmd_args)

        try:
            command = [
                self.peer_executable, "chaincode", "invoke",
                "-o", ORDERER_ADDRESS,  # <--- Uses the smart address
                "--ordererTLSHostnameOverride", "orderer.example.com",
                "--tls",
                "--cafile", os.path.join(BLOCKCHAIN_DIR, "organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"),
                "-C", "mychannel",
                "-n", "basic",
                "--peerAddresses", PEER_ADDRESS, # <--- Uses the smart address
                "--tlsRootCertFiles", os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"),
                "-c", cmd_args_json
            ]

            result = subprocess.run(
                command, 
                env=env, 
                capture_output=True, 
                text=True
            )

            if result.returncode == 0:
                print("✅ Transaction Successful")
                return {"status": "success", "txid": "See logs", "output": result.stdout}
            else:
                print(f"❌ Transaction Failed: {result.stderr}")
                return {"status": "error", "error": result.stderr}

        except Exception as e:
            print(f"❌ Execution Error: {e}")
            return {"status": "error", "error": str(e)}

    def query_transaction(self, function_name, arg):
        # --- A. SIMULATION MODE ---
        if not self.peer_executable:
            return [] 

        # --- B. REAL MODE ---
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
            
            # Note: Queries don't strictly need peer addresses arg in some versions,
            # but usually rely on CORE_PEER_ADDRESS env var.
            
            result = subprocess.run(
                command, 
                env=env, 
                capture_output=True, 
                text=True
            )

            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                return []

        except Exception as e:
            print(f"❌ Query Error: {e}")
            return []

# Create the singleton instance
fabric_client = FabricManager()
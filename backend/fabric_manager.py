import subprocess
import os
import json

# --- CONFIGURATION ---
# We point to the binaries and config we downloaded in Week 2
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLOCKCHAIN_DIR = os.path.join(REPO_ROOT, "blockchain/fabric-samples/test-network")
BIN_DIR = os.path.join(REPO_ROOT, "blockchain/bin")
CONFIG_DIR = os.path.join(REPO_ROOT, "blockchain/config")

# Set up the Environment Variables needed for Fabric
env = os.environ.copy()
env["PATH"] = f"{BIN_DIR}:{env['PATH']}"
env["FABRIC_CFG_PATH"] = CONFIG_DIR
env["CORE_PEER_TLS_ENABLED"] = "true"
env["CORE_PEER_LOCALMSPID"] = "Org1MSP"
env["CORE_PEER_TLS_ROOTCERT_FILE"] = os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt")
env["CORE_PEER_MSPCONFIGPATH"] = os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp")
env["CORE_PEER_ADDRESS"] = "localhost:7051"

class FabricManager:
    def submit_transaction(self, function_name, args_list):
        """
        Executes: peer chaincode invoke ...
        """
        print(f"⚡ BLOCKCHAIN: Submitting '{function_name}' with {args_list}")
        
        # Format arguments for the command line: '{"Args":["Func","Arg1","Arg2"]}'
        # We need to be careful with JSON formatting for the CLI
        cmd_args = {"Args": [function_name] + args_list}
        cmd_args_json = json.dumps(cmd_args)

        try:
            # Construct the shell command
            command = [
                "peer", "chaincode", "invoke",
                "-o", "localhost:7050",
                "--ordererTLSHostnameOverride", "orderer.example.com",
                "--tls",
                "--cafile", os.path.join(BLOCKCHAIN_DIR, "organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"),
                "-C", "mychannel",
                "-n", "basic",
                "--peerAddresses", "localhost:7051",
                "--tlsRootCertFiles", os.path.join(BLOCKCHAIN_DIR, "organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"),
                "-c", cmd_args_json
            ]

            # Run it
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
        """
        Executes: peer chaincode query ...
        """
        print(f"🔍 BLOCKCHAIN: Querying '{function_name}' for {arg}")
        
        cmd_args = {"Args": [function_name, arg]}
        cmd_args_json = json.dumps(cmd_args)

        try:
            command = [
                "peer", "chaincode", "query",
                "-C", "mychannel",
                "-n", "basic",
                "-c", cmd_args_json
            ]

            result = subprocess.run(
                command, 
                env=env, 
                capture_output=True, 
                text=True
            )

            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                print(f"❌ Query Failed: {result.stderr}")
                return []

        except Exception as e:
            print(f"❌ Query Error: {e}")
            return []

# Singleton
fabric_client = FabricManager()
import subprocess
import os
import json
import shutil
import socket
from typing import Any, Dict, List

REPO_ROOT      = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLOCKCHAIN_DIR = os.path.join(REPO_ROOT, "blockchain")
BIN_DIR        = os.path.join(BLOCKCHAIN_DIR, "fabric-samples", "bin")
CONFIG_DIR     = os.path.join(BLOCKCHAIN_DIR, "fabric-samples", "config")

ORDERER_ADDRESS = os.getenv("FABRIC_ORDERER_ADDRESS", "127.0.0.1:7050")
PEER1_ADDRESS   = os.getenv("FABRIC_PEER1_ADDRESS",   "127.0.0.1:7051")
PEER2_ADDRESS   = os.getenv("FABRIC_PEER2_ADDRESS",   "127.0.0.1:9051")
FABRIC_GATEWAY_URL = os.getenv("FABRIC_GATEWAY_URL", "").rstrip("/")

# Certificate paths — custom network (manufacturer + maintenance orgs)
MFR_TLS = os.path.join(
    BLOCKCHAIN_DIR, "organizations", "peerOrganizations",
    "manufacturer.example.com", "peers",
    "peer0.manufacturer.example.com", "tls", "ca.crt"
)
MFR_MSP = os.path.join(
    BLOCKCHAIN_DIR, "organizations", "peerOrganizations",
    "manufacturer.example.com", "users",
    "Admin@manufacturer.example.com", "msp"
)
MNT_TLS = os.path.join(
    BLOCKCHAIN_DIR, "organizations", "peerOrganizations",
    "maintenance.example.com", "peers",
    "peer0.maintenance.example.com", "tls", "ca.crt"
)
# FIX: orderer FQDN is orderer.orderer.example.com (hostname=orderer, domain=orderer.example.com)
ORDERER_CA = os.path.join(
    BLOCKCHAIN_DIR, "organizations", "ordererOrganizations",
    "orderer.example.com", "orderers",
    "orderer.orderer.example.com", "msp", "tlscacerts",
    "tlsca.orderer.example.com-cert.pem"
)

env = os.environ.copy()
env["PATH"]                          = f"{BIN_DIR}{os.pathsep}{env.get('PATH', '')}"
env["FABRIC_CFG_PATH"]               = CONFIG_DIR
env["CORE_PEER_TLS_ENABLED"]         = "true"
env["CORE_PEER_LOCALMSPID"]          = "ManufacturerMSP"
env["CORE_PEER_TLS_ROOTCERT_FILE"]   = MFR_TLS
env["CORE_PEER_MSPCONFIGPATH"]       = MFR_MSP
env["CORE_PEER_ADDRESS"]             = PEER1_ADDRESS


def _is_tcp_reachable(address: str, timeout_seconds: float = 1.2) -> bool:
    try:
        host, port_text = address.rsplit(":", 1)
        port = int(port_text)
    except ValueError:
        return False
    try:
        with socket.create_connection((host, port), timeout=timeout_seconds):
            return True
    except OSError:
        return False


class FabricManager:
    def __init__(self):
        self.peer_executable = (
            os.path.join(BIN_DIR, "peer")
            if os.path.exists(os.path.join(BIN_DIR, "peer"))
            else shutil.which("peer")
        )

        if self.peer_executable:
            print(f"Hyperledger Fabric found at: {self.peer_executable}")
            print(f"Peers: {PEER1_ADDRESS} (Manufacturer) | {PEER2_ADDRESS} (Maintenance)")
        else:
            print("Hyperledger peer binary not found - running in simulation mode")

    def network_status(self) -> Dict[str, Any]:
        if FABRIC_GATEWAY_URL:
            try:
                import requests
                res = requests.get(f"{FABRIC_GATEWAY_URL}/health", timeout=3)
                if res.status_code == 200:
                    return {
                        "ready": True,
                        "mode": "cloud_gateway",
                        "url": FABRIC_GATEWAY_URL,
                        "checks": {"gateway": True},
                        "addresses": {"gateway": FABRIC_GATEWAY_URL}
                    }
            except Exception:
                pass

        checks = {
            "orderer": _is_tcp_reachable(ORDERER_ADDRESS),
            "peer1":   _is_tcp_reachable(PEER1_ADDRESS),
            "peer2":   _is_tcp_reachable(PEER2_ADDRESS),
        }
        return {
            "ready": all(checks.values()),
            "addresses": {
                "orderer": ORDERER_ADDRESS,
                "peer1":   PEER1_ADDRESS,
                "peer2":   PEER2_ADDRESS,
            },
            "checks": checks,
        }

    def submit_transaction(self, function_name: str, args_list: List[str]) -> Dict[str, Any]:
        print(f"Blockchain: Submitting '{function_name}' with args {args_list}")

        if FABRIC_GATEWAY_URL:
            try:
                import requests
                from datetime import datetime, timezone
                if function_name == "RecordSensorData" and len(args_list) >= 4:
                    payload = {
                        "device_id": args_list[0],
                        "asset_type": args_list[1] if len(args_list) > 1 else "Industrial Machine",
                        "data_hash": args_list[2] if len(args_list) > 2 else "hash",
                        "is_anomaly": bool(args_list[3]) if len(args_list) > 3 else False,
                        "anomaly_score": float(args_list[4]) if len(args_list) > 4 else 0.0,
                        "threshold": float(args_list[5]) if len(args_list) > 5 else 0.18,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    res = requests.post(f"{FABRIC_GATEWAY_URL}/api/record-sensor", json=payload, timeout=5)
                    if res.status_code == 200:
                        return res.json()
                elif function_name == "RecordFraudFlag" and len(args_list) >= 2:
                    payload = {
                        "asset_id": args_list[0],
                        "fraud_type": args_list[1],
                        "confidence": 0.95,
                        "evidence_hash": args_list[2] if len(args_list) > 2 else "evidence"
                    }
                    res = requests.post(f"{FABRIC_GATEWAY_URL}/api/record-fraud", json=payload, timeout=5)
                    if res.status_code == 200:
                        return res.json()
            except Exception as e:
                print(f"Cloud Fabric Gateway exception: {e}")

        if not self.peer_executable:
            return {"status": "simulated"}

        status = self.network_status()
        if not status["ready"]:
            msg = (
                f"Fabric network unreachable — "
                f"checks={status['checks']} addresses={status['addresses']}"
            )
            print(f"Transaction skipped: {msg}")
            return {"status": "error", "error": msg, "network": status}

        cmd_args_json = json.dumps({"Args": [function_name] + args_list})

        try:
            command = [
                self.peer_executable, "chaincode", "invoke",
                "-o", ORDERER_ADDRESS,
                "--ordererTLSHostnameOverride", "orderer.orderer.example.com",
                "--tls", "--cafile", ORDERER_CA,
                "-C", "mychannel",
                "-n", "depin_cc",
                "--peerAddresses", PEER1_ADDRESS,
                "--tlsRootCertFiles", MFR_TLS,
                "--peerAddresses", PEER2_ADDRESS,
                "--tlsRootCertFiles", MNT_TLS,
                "-c", cmd_args_json,
                "--waitForEvent",
            ]

            result = subprocess.run(
                command, env=env, capture_output=True, text=True, timeout=30
            )

            if result.returncode == 0:
                print("Transaction committed successfully")
                return {"status": "success", "output": result.stdout}

            stderr = (result.stderr or "").strip()
            hint   = ""
            lowered = stderr.lower()
            if "connection refused" in lowered or "broken pipe" in lowered:
                hint = (
                    " — ensure Fabric containers are running and ports 7050/7051/9051 are reachable"
                )
            if "does not exist" in lowered or "not found" in lowered:
                hint = " — chaincode may not be deployed yet; run deploy_chaincode.sh first"
            print(f"Transaction failed: {stderr}{hint}")
            return {"status": "error", "error": f"{stderr}{hint}"}

        except subprocess.TimeoutExpired:
            msg = "Fabric invoke timed out after 30s"
            print(f"Timeout: {msg}")
            return {"status": "error", "error": msg}

        except Exception as exc:
            print(f"Execution error: {exc}")
            return {"status": "error", "error": str(exc)}

    def query_transaction(self, function_name: str, arg: str) -> list:
        if not self.peer_executable:
            return []

        print(f"Blockchain: Querying '{function_name}' for '{arg}'")
        cmd_args_json = json.dumps({"Args": [function_name, arg]})

        try:
            command = [
                self.peer_executable, "chaincode", "query",
                "-C", "mychannel",
                "-n", "depin_cc",
                "-c", cmd_args_json,
            ]
            result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=15)
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout)
            print(f"Query returned no data: {result.stderr.strip()}")
            return []
        except json.JSONDecodeError:
            print(f"Query response is not valid JSON: {result.stdout[:200]}")
            return []
        except Exception as exc:
            print(f"Query error: {exc}")
            return []


fabric_client = FabricManager()
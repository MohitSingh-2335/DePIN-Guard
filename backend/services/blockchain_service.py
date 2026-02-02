
import hashlib
from datetime import datetime

class BlockchainService:
    def __init__(self, fabric_client):
        self.fabric_client = fabric_client
        self.state = {
            "total_blocks": 0,
            "transactions": 0,
            "recent_blocks": []
        }

    def get_status(self):
        return self.state

    def add_block(self, data: dict, status_label: str, vibration_int: int, temperature_int: int):
        """
        Creates a new block locally and submits it to Hyperledger Fabric.
        """
        # 1. Update Counters
        self.state["total_blocks"] += 1
        self.state["transactions"] += 1

        # 2. Calculate Hash
        import json
        data_string = json.dumps(data, sort_keys=True)
        tx_hash = hashlib.sha256(data_string.encode()).hexdigest()

        # 3. Find Previous Hash
        previous_hash = "0000000000000000"
        if len(self.state["recent_blocks"]) > 0:
            previous_hash = self.state["recent_blocks"][0]["hash"]

        # 4. Create Block Record
        block_record = {
            "id": self.state["total_blocks"],
            "hash": tx_hash,
            "prev_hash": previous_hash,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "Confirmed"
        }

        # 5. Add to Memory (Limit 10)
        self.state["recent_blocks"].insert(0, block_record)
        self.state["recent_blocks"] = self.state["recent_blocks"][:10]

        # 6. Submit to Fabric
        try:
            # Format: [ID, Status(Text), Vibration(Int), Source(Text), Temperature(Int)]
            self.fabric_client.submit_transaction("CreateAsset", [
                tx_hash, 
                "CRITICAL",           # Status
                str(vibration_int),   # Vibration
                "AI",                 # Owner/Source
                str(temperature_int)  # Temperature
            ])
            print(f"Ledger Updated: {tx_hash}")
            return tx_hash, True
        except Exception as e:
            print(f"Ledger Write Failed: {e}")
            return tx_hash, False

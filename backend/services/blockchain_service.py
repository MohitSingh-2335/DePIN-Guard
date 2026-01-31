import hashlib
from datetime import datetime

class BlockchainService:
    def __init__(self):
        self.chain = []
        self.current_transactions = []
        
    def create_block(self, proof, previous_hash=None):
        block = {
            'index': len(self.chain) + 1,
            'timestamp': datetime.now().isoformat(),
            'transactions': self.current_transactions,
            'proof': proof,
            'previous_hash': previous_hash or self.hash(self.chain[-1]) if self.chain else '0',
        }
        
        self.current_transactions = []
        self.chain.append(block)
        return block
    
    @staticmethod
    def hash(block):
        import json
        block_string = json.dumps(block, sort_keys=True).encode()
        return hashlib.sha256(block_string).hexdigest()
    
    def add_transaction(self, device_id, data_hash):
        self.current_transactions.append({
            'device_id': device_id,
            'data_hash': data_hash,
            'timestamp': datetime.now().isoformat()
        })
        return len(self.chain) + 1

blockchain = BlockchainService()

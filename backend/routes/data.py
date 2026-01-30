from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter()

class DataPoint(BaseModel):
    device_id: str
    value: float
    timestamp: Optional[str] = None

class DataResponse(BaseModel):
    success: bool
    hash: str
    block_height: int

@router.post("/", response_model=DataResponse)
async def create_data(data: DataPoint):
    # Mock blockchain storage
    import hashlib
    import random
    
    data_str = f"{data.device_id}{data.value}{datetime.now()}"
    hash_value = hashlib.sha256(data_str.encode()).hexdigest()
    
    return DataResponse(
        success=True,
        hash=f"0x{hash_value[:64]}",
        block_height=random.randint(10000, 15000)
    )

@router.get("/history")
async def get_history():
    return {
        "data": [
            {"id": 1, "device": "Sensor-01", "value": 23.5, "timestamp": "2024-01-29 15:30:00", "hash": "0x7a8f...3e2d"},
            {"id": 2, "device": "Sensor-02", "value": 65.2, "timestamp": "2024-01-29 15:29:00", "hash": "0x9b4c...7f1a"},
        ]
    }

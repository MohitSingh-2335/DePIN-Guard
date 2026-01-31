from fastapi import APIRouter
from typing import List
from pydantic import BaseModel

router = APIRouter()

class Device(BaseModel):
    id: str
    name: str
    type: str
    status: str
    lastSeen: str

@router.get("/", response_model=List[Device])
async def get_devices():
    return [
        Device(id="1", name="Sensor-01", type="Temperature", status="online", lastSeen="2024-01-29 15:30:00"),
        Device(id="2", name="Sensor-02", type="Humidity", status="online", lastSeen="2024-01-29 15:29:45"),
        Device(id="3", name="Sensor-03", type="Pressure", status="warning", lastSeen="2024-01-29 15:28:30"),
        Device(id="4", name="Sensor-04", type="Temperature", status="online", lastSeen="2024-01-29 15:27:15"),
    ]

@router.get("/{device_id}")
async def get_device(device_id: str):
    return {
        "id": device_id,
        "name": f"Sensor-{device_id}",
        "type": "Temperature",
        "status": "online",
        "lastSeen": "2024-01-29 15:30:00",
        "data": {"temperature": 23.5, "unit": "°C"}
    }

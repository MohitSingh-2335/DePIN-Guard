from pydantic import BaseModel
from typing import Optional

class Device(BaseModel):
    id: Optional[str] = None
    name: str
    type: str
    status: str
    location: Optional[str] = None
    last_seen: Optional[str] = None

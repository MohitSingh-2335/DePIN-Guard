from pydantic import BaseModel, EmailStr
from typing import Optional

class User(BaseModel):
    id: Optional[str] = None
    email: EmailStr
    fullName: str
    password: str
    created_at: Optional[str] = None

class UserInDB(User):
    hashed_password: str

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    fullName: str
    email: str
    password: str

class AuthResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    # Mock authentication - replace with real auth
    if request.email and request.password:
        return AuthResponse(
            success=True,
            message="Login successful",
            token="mock_jwt_token_12345",
            user={"email": request.email, "name": "User"}
        )
    raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    # Mock signup - replace with real user creation
    return AuthResponse(
        success=True,
        message="Signup successful",
        token="mock_jwt_token_12345",
        user={"email": request.email, "name": request.fullName}
    )

@router.post("/logout")
async def logout():
    return {"success": True, "message": "Logged out successfully"}

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import bcrypt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))
load_dotenv()

try:
    import database as db_module
except ImportError:
    from backend import database as db_module

router = APIRouter(tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=True)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY must be set in .env")

ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_HOURS = 24

fallback_users = {}


class UserSignup(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    alert_notifications: Optional[bool] = None
    auto_refresh: Optional[bool] = None
    refresh_interval: Optional[str] = None
    data_retention: Optional[str] = None
    theme: Optional[str] = None
    language: Optional[str] = None


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if isinstance(password_hash, str):
        password_hash_bytes = password_hash.encode("utf-8")
    else:
        password_hash_bytes = password_hash
    return bcrypt.checkpw(password.encode("utf-8"), password_hash_bytes)


def create_access_token(email: str, expires_delta: Optional[timedelta] = None) -> str:
    delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + delta
    payload = {"sub": email, "type": "access", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def create_refresh_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=REFRESH_TOKEN_EXPIRE_HOURS)
    payload = {"sub": email, "type": "refresh", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_jwt_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/signup")
@router.post("/register")
async def signup(user: UserSignup):
    if "@" not in user.email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email_clean = user.email.lower().strip()
    full_name = user.full_name or email_clean.split("@")[0]
    hashed = hash_password(user.password)

    mongo_db = db_module.db
    if mongo_db is not None:
        existing = await mongo_db["users"].find_one({"email": email_clean})
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        new_user = {
            "email": email_clean,
            "password_hash": hashed,
            "full_name": full_name,
            "phone": user.phone,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None,
            "settings": {}
        }
        res = await mongo_db["users"].insert_one(new_user)
        user_id = str(res.inserted_id)
    else:
        if email_clean in fallback_users:
            raise HTTPException(status_code=409, detail="Email already registered")
        fallback_users[email_clean] = {
            "email": email_clean,
            "password_hash": hashed,
            "full_name": full_name,
            "phone": user.phone,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": None,
            "settings": {}
        }
        user_id = email_clean

    return {
        "message": f"Account created successfully for {full_name}",
        "email": email_clean,
        "user_id": user_id
    }


@router.post("/login")
async def login(user: UserLogin):
    email_clean = user.email.lower().strip()

    mongo_db = db_module.db
    if mongo_db is not None:
        db_user = await mongo_db["users"].find_one({"email": email_clean})
    else:
        db_user = fallback_users.get(email_clean)

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    raw_hash = db_user.get("password_hash", "")
    if isinstance(raw_hash, bytes):
        raw_hash = raw_hash.decode("utf-8", errors="ignore")
    if not verify_password(user.password, raw_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    now_iso = datetime.now(timezone.utc).isoformat()
    if mongo_db is not None:
        await mongo_db["users"].update_one({"_id": db_user["_id"]}, {"$set": {"last_login": now_iso}})
    else:
        db_user["last_login"] = now_iso

    access_token = create_access_token(email_clean)
    refresh_token = create_refresh_token(email_clean)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_email": email_clean,
        "full_name": db_user.get("full_name") or email_clean
    }


@router.get("/profile")
async def get_profile(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    email = verify_jwt_token(credentials.credentials)

    mongo_db = db_module.db
    if mongo_db is not None:
        db_user = await mongo_db["users"].find_one({"email": email})
    else:
        db_user = fallback_users.get(email)

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "profile": {
            "email": db_user["email"],
            "full_name": db_user.get("full_name"),
            "phone": db_user.get("phone"),
            "created_at": db_user.get("created_at"),
            "last_login": db_user.get("last_login"),
            "settings": db_user.get("settings", {})
        }
    }


@router.post("/profile")
async def update_profile(update_data: ProfileUpdate, credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    email = verify_jwt_token(credentials.credentials)

    mongo_db = db_module.db
    if mongo_db is not None:
        db_user = await mongo_db["users"].find_one({"email": email})
    else:
        db_user = fallback_users.get(email)

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if update_data.full_name is not None:
        updates["full_name"] = update_data.full_name
    if update_data.phone is not None:
        updates["phone"] = update_data.phone

    settings_updates = {}
    for field in ["email_notifications", "sms_notifications", "alert_notifications",
                  "auto_refresh", "refresh_interval", "data_retention", "theme", "language"]:
        val = getattr(update_data, field)
        if val is not None:
            settings_updates[field] = val

    if settings_updates:
        current_settings = db_user.get("settings", {})
        current_settings.update(settings_updates)
        updates["settings"] = current_settings

    if updates:
        if mongo_db is not None:
            await mongo_db["users"].update_one({"_id": db_user["_id"]}, {"$set": updates})
        else:
            db_user.update(updates)

    return {"message": "Profile updated successfully"}


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
@router.post("/api/change-password")
async def change_password(data: ChangePassword, credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    email = verify_jwt_token(credentials.credentials)
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    mongo_db = db_module.db
    if mongo_db is not None:
        db_user = await mongo_db["users"].find_one({"email": email})
    else:
        db_user = fallback_users.get(email)

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    raw_hash = db_user.get("password_hash", "")
    if isinstance(raw_hash, bytes):
        raw_hash = raw_hash.decode("utf-8", errors="ignore")
    if not verify_password(data.current_password, raw_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash = hash_password(data.new_password)
    if mongo_db is not None:
        await mongo_db["users"].update_one({"_id": db_user["_id"]}, {"$set": {"password_hash": new_hash}})
    else:
        db_user["password_hash"] = new_hash

    return {"status": "success", "message": "Password updated successfully"}

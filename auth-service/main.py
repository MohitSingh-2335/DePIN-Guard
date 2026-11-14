import os
import random
import smtplib
import certifi
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from contextlib import asynccontextmanager
from typing import Optional

import jwt
import bcrypt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient as AsyncClient

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is required in root .env file")

ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_HOURS = 24

EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/depin_guard")
mongodb_client = None
db = None

# In-memory user fallback if MongoDB is temporarily unreachable
fallback_users = {}
fallback_revoked = set()


async def connect_to_mongo():
    global mongodb_client, db
    try:
        if MONGODB_URI and "mongodb+srv://" in MONGODB_URI:
            mongodb_client = AsyncClient(
                MONGODB_URI,
                tls=True,
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=3000,
            )
        else:
            mongodb_client = AsyncClient(MONGODB_URI, serverSelectionTimeoutMS=2000)

        await mongodb_client.admin.command('ping')
        db = mongodb_client["depin_guard"]

        users_col = db["users"]
        await users_col.create_index("email", unique=True)
        await users_col.create_index("created_at")

        revoked_col = db["revoked_tokens"]
        await revoked_col.create_index("revoked_at", expireAfterSeconds=86400)

        print("Connected to MongoDB Auth Service.")
    except Exception as exc:
        db = None
        print(f"MongoDB connection notice ({exc}). Operating with local in-memory fallback.")


async def close_mongo_connection():
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
        print("MongoDB connection closed.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


class UserSignup(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_email: str
    full_name: Optional[str] = None


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


def create_access_token(email: str, expires_delta: Optional[timedelta] = None):
    delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + delta
    payload = {"sub": email, "type": "access", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def create_refresh_token(email: str):
    expire = datetime.utcnow() + timedelta(hours=REFRESH_TOKEN_EXPIRE_HOURS)
    payload = {"sub": email, "type": "refresh", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def hash_password(password: str) -> bytes:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt)


def verify_password(password: str, password_hash: bytes) -> bool:
    if isinstance(password_hash, str):
        password_hash = password_hash.encode('utf-8')
    return bcrypt.checkpw(password.encode('utf-8'), password_hash)


def send_email(to_email: str, subject: str, body: str) -> bool:
    if not EMAIL_USER or not EMAIL_PASS:
        return True
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = EMAIL_USER
        msg["To"] = to_email
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)
        return True
    except Exception as exc:
        print(f"Email delivery notice: {exc}")
        return False


app = FastAPI(title="DePIN Auth Service", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=True)


@app.get("/")
async def root():
    return {
        "service": "DePIN-Guard Auth Service",
        "version": "2.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "auth-service",
        "database": "mongodb" if db is not None else "in_memory_fallback"
    }


@app.post("/signup")
async def signup(user: UserSignup):
    if "@" not in user.email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(user.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email_clean = user.email.lower().strip()
    full_name = user.full_name or email_clean.split("@")[0]
    hashed = hash_password(user.password)

    if db is not None:
        existing = await db["users"].find_one({"email": email_clean})
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        new_user = {
            "email": email_clean,
            "password_hash": hashed,
            "full_name": full_name,
            "phone": user.phone,
            "created_at": datetime.utcnow().isoformat(),
            "last_login": None,
            "settings": {}
        }
        res = await db["users"].insert_one(new_user)
        user_id = str(res.inserted_id)
    else:
        if email_clean in fallback_users:
            raise HTTPException(status_code=409, detail="Email already registered")
        fallback_users[email_clean] = {
            "email": email_clean,
            "password_hash": hashed,
            "full_name": full_name,
            "phone": user.phone,
            "created_at": datetime.utcnow().isoformat(),
            "last_login": None,
            "settings": {}
        }
        user_id = email_clean

    send_email(
        email_clean,
        "Welcome to DePIN-Guard",
        f"Welcome {full_name}! Your account has been created successfully."
    )

    return {
        "message": f"Account created successfully for {full_name}",
        "email": email_clean,
        "user_id": user_id
    }


@app.post("/login")
async def login(user: UserLogin):
    email_clean = user.email.lower().strip()

    if db is not None:
        db_user = await db["users"].find_one({"email": email_clean})
    else:
        db_user = fallback_users.get(email_clean)

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    now_iso = datetime.utcnow().isoformat()
    if db is not None:
        await db["users"].update_one({"_id": db_user["_id"]}, {"$set": {"last_login": now_iso}})
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
        "full_name": db_user.get("full_name")
    }


@app.get("/profile")
async def get_profile(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    email = verify_token(credentials.credentials)

    if db is not None:
        db_user = await db["users"].find_one({"email": email})
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


@app.post("/profile")
async def update_profile(update_data: ProfileUpdate, credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    email = verify_token(credentials.credentials)

    if db is not None:
        db_user = await db["users"].find_one({"email": email})
    else:
        db_user = fallback_users.get(email)

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    update_fields = {"updated_at": datetime.utcnow().isoformat()}
    if update_data.full_name is not None:
        update_fields["full_name"] = update_data.full_name
    if update_data.phone is not None:
        update_fields["phone"] = update_data.phone

    settings = db_user.get("settings", {})
    if update_data.email_notifications is not None:
        settings["email_notifications"] = update_data.email_notifications
    if update_data.sms_notifications is not None:
        settings["sms_notifications"] = update_data.sms_notifications
    if update_data.alert_notifications is not None:
        settings["alert_notifications"] = update_data.alert_notifications
    if update_data.auto_refresh is not None:
        settings["auto_refresh"] = update_data.auto_refresh
    if update_data.refresh_interval is not None:
        settings["refresh_interval"] = update_data.refresh_interval
    if update_data.data_retention is not None:
        settings["data_retention"] = update_data.data_retention
    if update_data.theme is not None:
        settings["theme"] = update_data.theme
    if update_data.language is not None:
        settings["language"] = update_data.language

    update_fields["settings"] = settings

    if db is not None:
        await db["users"].update_one({"_id": db_user["_id"]}, {"$set": update_fields})
        updated = await db["users"].find_one({"_id": db_user["_id"]})
    else:
        db_user.update(update_fields)
        updated = db_user

    return {
        "message": "Profile updated successfully",
        "profile": {
            "email": updated["email"],
            "full_name": updated.get("full_name"),
            "phone": updated.get("phone"),
            "created_at": updated.get("created_at"),
            "updated_at": updated.get("updated_at"),
            "settings": updated.get("settings", {})
        }
    }


@app.post("/verify")
async def verify_token_endpoint(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = credentials.credentials

    if db is not None:
        revoked = await db["revoked_tokens"].find_one({"token": token})
    else:
        revoked = token in fallback_revoked

    if revoked:
        raise HTTPException(status_code=401, detail="Token has been revoked")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return {
            "valid": True,
            "user": payload.get("sub"),
            "type": "access"
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@app.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = credentials.credentials
    now_iso = datetime.utcnow().isoformat()

    if db is not None:
        await db["revoked_tokens"].insert_one({"token": token, "revoked_at": now_iso})
    else:
        fallback_revoked.add(token)

    return {"message": "Logged out successfully"}


@app.post("/refresh")
async def refresh_token_endpoint(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = credentials.credentials

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        email = payload.get("sub")
        new_access_token = create_access_token(email)

        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired - please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("AUTH_PORT", 8001)))

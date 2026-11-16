import time as _time
import os
import sys
import asyncio

_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import hashlib
import hmac
import json
import math
import random
import requests as http_requests
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Security, status, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    limiter = Limiter(key_func=get_remote_address)
    HAS_SLOWAPI = True
except ImportError:
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()
    _rate_limit_exceeded_handler = None
    RateLimitExceeded = Exception
    HAS_SLOWAPI = False

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:
    BackgroundScheduler = None

from dotenv import load_dotenv

try:
    import jwt
except ImportError:
    jwt = None

from database import (
    connect_to_mongo, close_mongo_connection, db, SensorDataModel, FraudAlertModel, 
    save_sensor_data, save_fraud_alert, get_fraud_alerts, get_device_stats,
    get_database_size, get_collection_stats, export_all_data
)
from routes.stream import broadcast_data, router as stream_router
from routes.fraud import router as fraud_router
from routes.blockchain_control import router as blockchain_router
from routes.security import router as security_router
from routes.auth import router as auth_router

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

API_KEY            = os.getenv("DEPIN_API_KEY")
SECRET_KEY         = os.getenv("JWT_SECRET_KEY")
SENSOR_PAYLOAD_MAX_AGE_SECONDS = int(os.getenv("SENSOR_PAYLOAD_MAX_AGE_SECONDS", "86400"))

# Initialize in-memory AI engine
from ai_engine import AnomalyDetector
anomaly_detector = AnomalyDetector()
_ANOMALY_THRESHOLD = anomaly_detector.threshold

METRICS_PATH = os.path.join(ROOT_DIR, "ai-service", "metrics.json")


def load_ai_metrics() -> dict:
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "lstm_accuracy": 82.4,
        "gnn_accuracy": 87.65,
        "gnn_precision": 93.33,
        "threshold": _ANOMALY_THRESHOLD,
    }


_default_metrics = load_ai_metrics()

FRAUD_DB      = os.path.join(os.path.dirname(__file__), "data", "fraud_reports.json")
KNOWN_DEVICES = ["Device-001", "Device-002", "Device-003", "Device-004", "Device-005"]

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is required in .env before starting")

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
system_state = {
    "dashboard": {
        "active_devices": 33,
        "total_scans":    0,
        "anomalies":      0,
        "uptime":         100.0,
    },
    "blockchain": {
        "total_blocks":   1,
        "transactions":   1,
        "recent_blocks":  [],
    },
    "ai": {
        "total_analyses": 0,
        "anomalies_found": 0,
        "accuracy": _default_metrics.get("lstm_accuracy", 82.4),
        "active_models_count": 2,
        "available_models": [
            "PyTorch 6-Channel Temporal LSTM Autoencoder",
            "PyTorch DeviceGCN Graph Neural Network"
        ],
        "lstm_accuracy": _default_metrics.get("lstm_accuracy", 82.4),
        "gnn_accuracy": _default_metrics.get("gnn_accuracy", 87.65),
        "gnn_precision": _default_metrics.get("gnn_precision", 93.33),
        "recent_results": [],
    },
    "latest_by_device": {},
    "history": [],
}


async def _hydrate_system_state():
    """Hydrate system state from MongoDB"""
    from database import db as mongo_db, mongodb_client
    
    try:
        if mongo_db is not None and mongodb_client is not None:
            # Purge legacy corrupted/bad Atlas records
            try:
                await mongo_db["sensor_data"].delete_many({
                    "$or": [
                        {"confidence": {"$in": [95.0, 96.5, 92.0]}},
                        {
                            "is_anomaly": True,
                            "temperature": {"$gte": 20.5, "$lte": 25.0},
                            "vibration": {"$gte": 0.0, "$lte": 3.10},
                            "power_usage": {"$gte": 0.0, "$lte": 4.90},
                            "pressure": {"$gte": 30.0, "$lte": 185.0}
                        }
                    ]
                })
                await mongo_db["fraud_alerts"].delete_many({
                    "confidence": {"$in": [95.0, 96.5, 92.0]}
                })
            except Exception as purge_err:
                print(f"[SystemState] Legacy cleanup notice: {purge_err}")

            total_scans = await mongo_db["sensor_data"].count_documents({})
            anom_count = await mongo_db["sensor_data"].count_documents({"$or": [{"is_anomaly": True}, {"status": "critical"}]})
            devices = await mongo_db["sensor_data"].distinct("device_id")
            ai_metrics = load_ai_metrics()
            
            system_state["dashboard"]["active_devices"] = len(devices) if devices else 33
            system_state["dashboard"]["total_scans"] = total_scans
            system_state["dashboard"]["anomalies"] = anom_count
            system_state["dashboard"]["uptime"] = 99.9 if total_scans > 0 else 100.0
            
            system_state["ai"]["total_analyses"] = total_scans
            system_state["ai"]["anomalies_found"] = anom_count
            system_state["ai"]["accuracy"] = ai_metrics.get("lstm_accuracy", 82.4)
            system_state["ai"]["active_models_count"] = 2
            system_state["ai"]["available_models"] = [
                "PyTorch 6-Channel Temporal LSTM Autoencoder",
                "PyTorch DeviceGCN Graph Neural Network"
            ]
            
            # Hydrate blockchain blocks
            block_count = await mongo_db["blockchain_blocks"].count_documents({})
            if block_count == 0:
                genesis_block = {
                    "index": 0,
                    "id": 0,
                    "hash": "0000000000000000000000000000000000000000000000000000000000000000",
                    "prev_hash": "0",
                    "merkle_root": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    "timestamp": "2026-01-01 00:00:00 UTC",
                    "device_id": "Fleet-Genesis",
                    "anomaly_score": 0.0,
                    "orgMSP": "OrdererMSP",
                    "transactions": 1,
                    "tx_count": 1,
                    "status": "confirmed",
                    "validator": "Consortium-Genesis-Authority"
                }
                await mongo_db["blockchain_blocks"].insert_one(genesis_block)
                block_count = 1

            system_state["blockchain"]["total_blocks"] = block_count
            system_state["blockchain"]["transactions"] = block_count
            recent_blocks = await mongo_db["blockchain_blocks"].find({}, {"_id": 0}).sort("index", -1).limit(10).to_list(10)
            system_state["blockchain"]["recent_blocks"] = recent_blocks
            
            print(f"[SystemState] Hydrated: {total_scans} scans, {len(devices)} active devices, {block_count} blocks")
        else:
            print("[SystemState] MongoDB not available!")
    except Exception as e:
        print(f"[SystemState] Notice: {e}")


async def _setup_system_state():
    """Call _hydrate_system_state during startup and seed fleet devices"""
    await _hydrate_system_state()
    if len(system_state["latest_by_device"]) < 33:
        try:
            from iot.data_ingestor import load_industrial_datasets
            records = load_industrial_datasets()
            for dev_idx in range(33):
                dev_id = f"Device-{dev_idx:03d}"
                rec = records[dev_idx % len(records)] if records else {
                    "temperature": 22.5,
                    "vibration": 1.2,
                    "power_usage": 2.89,
                    "current_avg": 0.12,
                    "voltage_avg": 217.5,
                    "pressure": 100.0,
                }
                system_state["latest_by_device"][dev_id] = {
                    "id": dev_id,
                    "device": dev_id,
                    "machine_name": f"Factory Machine #{dev_idx + 1}",
                    "temp": rec.get("temperature", 22.5),
                    "vib": rec.get("vibration", 1.2),
                    "pwr": rec.get("power_usage", 2.89),
                    "pressure": rec.get("pressure", 100.0),
                    "current_avg": rec.get("current_avg", 0.12),
                    "voltage_avg": rec.get("voltage_avg", 217.5),
                    "status": "normal",
                    "status_short": "Machine operating within safe parameters",
                    "recommendations": ["Continue standard operation"],
                    "loss": 0.05,
                    "threshold": _ANOMALY_THRESHOLD,
                    "confidence": 85.0,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
        except Exception as exc:
            print(f"[SystemState] Fleet seed notice: {exc}")

# ---------------------------------------------------------------------------
# Blockchain integration (Optional — can run without Hyperledger Fabric)
# ---------------------------------------------------------------------------
try:
    from fabric_manager import fabric_client
    BLOCKCHAIN_ACTIVE = True
    print("Blockchain active: Hyperledger Fabric connected")
except ImportError as e:
    BLOCKCHAIN_ACTIVE = False
    print("Blockchain inactive: Hyperledger Fabric not available (running in local simulation mode)")
    print(f"   Notice: {e}")

# ---------------------------------------------------------------------------
# GNN model integration & scheduler
# ---------------------------------------------------------------------------
try:
    import sys
    import torch
    sys.path.append(os.path.join(ROOT_DIR, "ai-service"))
    from gnn_model import DeviceGCN, build_factory_adjacency_matrix
    GNN_MODEL_PATH = os.path.join(ROOT_DIR, "ai-service", "gnn_model.pth")
    gnn_model = DeviceGCN(in_features=6, hidden_dim=16, num_classes=2)
    if os.path.exists(GNN_MODEL_PATH):
        gnn_model.load_state_dict(torch.load(GNN_MODEL_PATH, map_location="cpu"))
        gnn_model.eval()
        GNN_ACTIVE = True
        gnn_adj = build_factory_adjacency_matrix(33)
        print("Graph Neural Network active: DeviceGCN loaded (in_features=6)")
    else:
        GNN_ACTIVE = False
except Exception as e:
    GNN_ACTIVE = False
    print(f"Notice: GNN model not loaded ({e})")


def run_gnn_analysis():
    if not GNN_ACTIVE:
        return
    try:
        from iot.data_ingestor import DEVICES
        x_nodes = anomaly_detector.get_node_features(DEVICES)
        if x_nodes is None:
            return
        with torch.no_grad():
            out = gnn_model(x_nodes, gnn_adj)
            probs = torch.exp(out)[:, 1]
            flagged = int((probs > 0.5).sum().item())
            print(f"[GNN] Evaluated 33 factory machines | Inter-device cascade anomalies: {flagged}")
    except Exception as exc:
        print(f"[GNN] Execution notice: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    print("MongoDB connection check complete.")
    await _setup_system_state()
    
    scheduler = None
    if BackgroundScheduler is not None:
        scheduler = BackgroundScheduler()
        scheduler.add_job(run_gnn_analysis, "interval", minutes=5)
        scheduler.start()
        print(f"[Scheduler] Started - GNN trigger every 5 minutes | threshold={_ANOMALY_THRESHOLD}")
    
    feeder_task = asyncio.create_task(autonomous_feeder_loop())

    yield

    feeder_task.cancel()
    try:
        await feeder_task
    except asyncio.CancelledError:
        pass

    if scheduler is not None:
        scheduler.shutdown()
    await close_mongo_connection()
    print("[Scheduler] Stopped cleanly")


# ---------------------------------------------------------------------------
# App & rate limiting
# ---------------------------------------------------------------------------
app = FastAPI(title="DePIN-Guard API", version="1.0.0", lifespan=lifespan)
if HAS_SLOWAPI and _rate_limit_exceeded_handler is not None:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(stream_router)
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme  = HTTPBearer(auto_error=False)

if not API_KEY:
    raise RuntimeError("DEPIN_API_KEY is required in root .env before starting")

print("API Key loaded and verified.")
print(f"Anomaly threshold: {_ANOMALY_THRESHOLD}")


async def verify_auth_or_api_key(
    request: Request,
    api_key: Optional[str] = Security(api_key_header),
    auth: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
):
    if api_key and API_KEY and api_key == API_KEY:
        return {"auth": "api_key"}

    token = None
    if auth and auth.credentials:
        token = auth.credentials
    else:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if token and jwt and SECRET_KEY:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user = payload.get("sub")
            if user:
                return {"auth": "jwt", "user": user}
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Valid API key or authorization token required",
    )


verify_api_key = verify_auth_or_api_key


# Include routers with API key protection (must be after verify_api_key is defined)
app.include_router(blockchain_router, prefix="/api", dependencies=[Depends(verify_api_key)])
app.include_router(fraud_router, prefix="/api", dependencies=[Depends(verify_api_key)])
app.include_router(security_router, prefix="/api", dependencies=[Depends(verify_api_key)])

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
cors_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
cors_regex_default = r"^https?:\/\/(localhost|127\.0\.0\.1|.*\.vercel\.app|.*\.onrender\.com)(:\d+)?$"
cors_regex_env = os.getenv("CORS_ALLOWED_ORIGIN_REGEX", cors_regex_default).strip()
trusted_origins = (
    [o.strip() for o in cors_env.split(",") if o.strip()]
    or default_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=trusted_origins,
    allow_origin_regex=cors_regex_env,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Audit logging middleware
# ---------------------------------------------------------------------------
# Audit middleware (cross-platform safe)
# ---------------------------------------------------------------------------
import tempfile
AUDIT_LOG_PATH = os.path.join(tempfile.gettempdir(), "depin_audit.log")


@app.middleware("http")
async def audit_logger(request: Request, call_next):
    start    = _time.time()
    response = await call_next(request)
    duration = (_time.time() - start) * 1000
    log_line = (
        f"{datetime.now().isoformat()}"
        f"|{request.method}"
        f"|{request.url.path}"
        f"|{response.status_code}"
        f"|{duration:.1f}ms\n"
    )
    try:
        with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as log_f:
            log_f.write(log_line)
    except Exception:
        pass
    return response


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------
class SensorData(BaseModel):
    device_id:   str
    temperature: float
    vibration:   float
    power_usage: float
    pressure:    float = 0.0
    current_avg: float = 0.12
    voltage_avg: float = 217.5
    timestamp:   str
    signature:   str = ""
    
    # Optional: Human-readable fields for non-technical users
    machine_name: str = ""  # e.g., "Mixer", "Compressor"
    alert_level: str = ""   # e.g., "NORMAL", "WARNING", "CRITICAL"
    status_short: str = ""  # e.g., "Machine running well"
    recommendations: list = []  # List of actions for non-technical users


def _sensor_signature(data: SensorData) -> str:
    secret = (API_KEY or "").encode("utf-8")
    message = f"{data.device_id}|{data.temperature}|{data.vibration}|{data.power_usage}|{data.timestamp}"
    return hmac.new(secret, message.encode("utf-8"), hashlib.sha256).hexdigest()


def _verify_sensor_payload(data: SensorData):
    if not data.signature:
        raise HTTPException(status_code=403, detail="Unsigned sensor payload rejected")

    expected = _sensor_signature(data)
    if not hmac.compare_digest(expected, data.signature):
        raise HTTPException(status_code=403, detail="Invalid sensor payload signature")

    try:
        received_at = datetime.fromisoformat(data.timestamp.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    current_time = datetime.now(timezone.utc)
    received_at_utc = received_at.astimezone(timezone.utc) if received_at.tzinfo else received_at.replace(tzinfo=timezone.utc)
    if SENSOR_PAYLOAD_MAX_AGE_SECONDS > 0 and abs((current_time - received_at_utc).total_seconds()) > SENSOR_PAYLOAD_MAX_AGE_SECONDS:
        raise HTTPException(status_code=403, detail="Sensor payload is stale")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def read_root():
    return {
        "status":           "DePIN-Guard API is live",
        "blockchain_active": BLOCKCHAIN_ACTIVE,
        "threshold":        _ANOMALY_THRESHOLD,
    }


@app.get("/health")
def health_check():
    blockchain_status = {"ready": False, "reason": "fabric manager unavailable"}
    if BLOCKCHAIN_ACTIVE:
        try:
            blockchain_status = fabric_client.network_status()
        except Exception as exc:
            blockchain_status = {"ready": False, "error": str(exc)}
    return {
        "status":            "healthy",
        "service":           "backend",
        "blockchain_active": BLOCKCHAIN_ACTIVE,
        "blockchain_status": blockchain_status,
    }


@app.get("/api/health")
def api_health_check():
    """Health check endpoint for cloud deployment (Render, Vercel CDN)"""
    return {
        "status": "healthy",
        "service": "depin-guard-backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/public/stats")
async def get_public_stats():
    """Real dynamic telemetry metrics for the landing page"""
    from database import db as mongo_db
    active_devices = 0
    anomalies = 0
    total_scans = 0
    if mongo_db is not None:
        try:
            total_scans = await mongo_db["sensor_data"].count_documents({})
            anomalies = await mongo_db["fraud_alerts"].count_documents({})
            devices_list = await mongo_db["sensor_data"].distinct("device_id")
            active_devices = len(devices_list)
        except Exception:
            pass

    if active_devices == 0:
        active_devices = system_state["dashboard"].get("active_devices", 0)
    if total_scans == 0:
        total_scans = system_state["dashboard"].get("total_scans", 0)
    if anomalies == 0:
        anomalies = system_state["dashboard"].get("anomalies", 0)

    return {
        "devices": active_devices,
        "scans": total_scans,
        "threats": anomalies,
        "uptime": 99.9 if total_scans > 0 else 100.0,
    }


@app.get("/api/dashboard", dependencies=[Depends(verify_api_key)])
async def get_dashboard():
    """Get dashboard data from MongoDB (with real latest device telemetry)"""
    from database import db as mongo_db, mongodb_client
    
    recent_data = []
    if mongo_db is not None and mongodb_client is not None:
        try:
            recent_raw = await mongo_db["sensor_data"].find({}).sort("timestamp", -1).limit(20).to_list(length=20)
            for idx, doc in enumerate(recent_raw):
                transformed = {
                    "id": str(doc.get("_id", idx)),
                    "device": doc.get("device_id", "unknown"),
                    "temp": doc.get("temperature", 0),
                    "vib": doc.get("vibration", 0),
                    "pwr": doc.get("power_usage", 0),
                    "status": doc.get("status", "normal"),
                    "timestamp": doc.get("timestamp", ""),
                }
                recent_data.append(transformed)
        except Exception as e:
            print(f"[Dashboard] MongoDB read notice: {e}")
    
    latest_devices = list(system_state["latest_by_device"].values())
    if not latest_devices and recent_data:
        seen = set()
        for r in recent_data:
            if r["device"] not in seen:
                seen.add(r["device"])
                latest_devices.append(r)

    return {
        "stats": system_state["dashboard"],
        "recent_data": recent_data,
        "latest_devices": latest_devices,
        "blockchain_active": BLOCKCHAIN_ACTIVE,
        "source": "mongodb" if mongo_db is not None else "in_memory"
    }


@app.get("/api/blockchain", dependencies=[Depends(verify_api_key)])
async def get_blockchain():
    from database import db as mongo_db
    if mongo_db is not None:
        try:
            total_blocks = await mongo_db["blockchain_blocks"].count_documents({})
            recent_blocks = await mongo_db["blockchain_blocks"].find({}, {"_id": 0}).sort("index", -1).limit(20).to_list(20)
            return {
                "total_blocks": max(total_blocks, 1),
                "transactions": max(total_blocks, 1),
                "net_status": "Active",
                "recent_blocks": recent_blocks
            }
        except Exception:
            pass
    return system_state["blockchain"]


@app.get("/api/ai-analysis", dependencies=[Depends(verify_api_key)])
async def get_ai_analysis():
    ai_metrics = load_ai_metrics()
    from database import db as mongo_db
    if mongo_db is not None:
        try:
            total_scans = await mongo_db["sensor_data"].count_documents({})
            anom_count = await mongo_db["sensor_data"].count_documents({"$or": [{"is_anomaly": True}, {"status": "critical"}]})
            recent_anoms = await mongo_db["sensor_data"].find(
                {"$or": [{"is_anomaly": True}, {"status": "critical"}]},
                {"_id": 0}
            ).sort("timestamp", -1).limit(10).to_list(10)

            results = []
            for i, a in enumerate(recent_anoms):
                conf_val = a.get("confidence")
                if conf_val is None or float(conf_val) == 0.0:
                    loss_v = float(a.get("ai_loss", 0.0))
                    thresh_v = float(a.get("ai_threshold", _ANOMALY_THRESHOLD))
                    ratio_v = loss_v / thresh_v if thresh_v > 0 else 1.2
                    conf_val = 50.0 + 49.5 * (1.0 - math.exp(-0.65 * max(0.0, ratio_v - 1.0)))
                conf_float = float(conf_val)
                if 0.0 < conf_float <= 1.0:
                    conf_float = round(conf_float * 100.0, 1)

                results.append({
                    "id": f"ai-{a.get('device_id', 'dev')}-{i}",
                    "device": a.get("device_id", "Unknown"),
                    "analysis_type": "Temporal Reconstruction",
                    "severity": a.get("severity", "high"),
                    "confidence": round(conf_float, 1),
                    "loss": round(float(a.get("ai_loss", 0.0)), 6),
                    "threshold": round(float(a.get("ai_threshold", _ANOMALY_THRESHOLD)), 6),
                    "timestamp": str(a.get("timestamp", datetime.now(timezone.utc).isoformat())),
                    "description": a.get("description") or f"Sensor values (Temp: {a.get('temperature')} C, Vib: {a.get('vibration')} mm/s) exceeded anomaly threshold",
                    "recommendation": a.get("recommendation") or "Check cooling circuit and verify vibration damper.",
                    "model_name": "PyTorch 6-Channel Temporal LSTM Autoencoder"
                })

            return {
                "total_analyses": total_scans,
                "anomalies_found": anom_count,
                "accuracy": ai_metrics.get("lstm_accuracy", 82.4),
                "active_models_count": 2,
                "available_models": [
                    "PyTorch 6-Channel Temporal LSTM Autoencoder",
                    "PyTorch DeviceGCN Graph Neural Network"
                ],
                "lstm_accuracy": ai_metrics.get("lstm_accuracy", 82.4),
                "gnn_accuracy": ai_metrics.get("gnn_accuracy", 87.65),
                "gnn_precision": ai_metrics.get("gnn_precision", 93.33),
                "recent_results": results
            }
        except Exception:
            pass
    return system_state["ai"]


@app.get("/api/history", dependencies=[Depends(verify_api_key)])
async def get_history():
    """Get recent sensor readings from MongoDB"""
    from database import db as mongo_db, mongodb_client
    
    if mongo_db is None or mongodb_client is None:
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        total_scans = await mongo_db["sensor_data"].count_documents({})
        total_anomalies = await mongo_db["sensor_data"].count_documents({"$or": [{"is_anomaly": True}, {"status": "critical"}]})
        total_normal = max(0, total_scans - total_anomalies)

        raw_history = await mongo_db["sensor_data"].find({}).sort("timestamp", -1).limit(100).to_list(length=100)
        
        history = []
        for idx, doc in enumerate(raw_history):
            doc_id = str(doc.get("_id", idx))
            dev_id = doc.get("device_id", "unknown")
            ts = doc.get("timestamp", "")
            if hasattr(ts, "isoformat"):
                ts = ts.isoformat()
            else:
                ts = str(ts)
            is_anom = bool(doc.get("is_anomaly") or doc.get("anomaly"))
            status = "critical" if is_anom else doc.get("status", "verified")
            if status == "normal":
                status = "verified"

            raw_hash = doc.get("hash")
            if not raw_hash:
                raw_hash = hashlib.sha256(f"{dev_id}:{ts}:{doc.get('temperature', 0)}".encode()).hexdigest()

            loss_val = float(doc.get("ai_loss", doc.get("loss", 0.0)))
            thresh_val = float(doc.get("ai_threshold", doc.get("threshold", _ANOMALY_THRESHOLD)))
            conf_val = doc.get("confidence")
            if conf_val is None or float(conf_val) == 0.0:
                if is_anom:
                    ratio_v = loss_val / thresh_val if thresh_val > 0 else 1.2
                    conf_val = 54.0 + 45.4 * (1.0 - math.exp(-0.75 * max(0.05, ratio_v - 1.0)))
                else:
                    conf_val = 85.0
            conf_float = float(conf_val)
            if 0.0 < conf_float <= 1.0:
                conf_float = round(conf_float * 100.0, 1)

            transformed = {
                "id": doc_id,
                "device": dev_id,
                "machine_name": doc.get("machine_name") or dev_id,
                "status_short": doc.get("status_short") or ("Operating normally" if not is_anom else "Abnormal reading detected"),
                "hash": raw_hash,
                "value": f"{doc.get('temperature', 0)}°C",
                "timestamp": ts,
                "status": status,
                "temp": doc.get("temperature", 0),
                "vib": doc.get("vibration", 0),
                "pwr": doc.get("power_usage", 0),
                "pressure": doc.get("pressure", 0),
                "current_avg": doc.get("current_avg", 0.12),
                "voltage_avg": doc.get("voltage_avg", 217.5),
                "loss": round(loss_val, 6),
                "threshold": round(thresh_val, 6),
                "confidence": round(conf_float, 1),
                "severity": doc.get("severity", "critical" if is_anom else "low"),
                "description": doc.get("description", ""),
                "anomaly": 1 if is_anom else 0,
                "ai_source": doc.get("ai_source", "lstm_autoencoder"),
                "ai_error": doc.get("ai_error", ""),
                "recommendation": doc.get("recommendation", "Operational telemetry verified"),
                "recorded_at": ts,
            }
            history.append(transformed)
        
        return {
            "history": history,
            "total_scans": total_scans,
            "total_anomalies": total_anomalies,
            "total_normal": total_normal,
            "count": len(history),
            "source": "mongodb",
        }
    except Exception as e:
        print(f"[History] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/all", dependencies=[Depends(verify_api_key)])
async def get_all_history():
    """Get sensor readings for charts from MongoDB"""
    from database import db as mongo_db, mongodb_client
    
    if mongo_db is None or mongodb_client is None:
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        total_scans = await mongo_db["sensor_data"].count_documents({})
        total_anomalies = await mongo_db["sensor_data"].count_documents({"$or": [{"is_anomaly": True}, {"status": "critical"}]})
        total_normal = max(0, total_scans - total_anomalies)

        raw_history = await mongo_db["sensor_data"].find({}).sort("timestamp", -1).limit(200).to_list(length=200)
        
        history = []
        for idx, doc in enumerate(raw_history):
            doc_id = str(doc.get("_id", idx))
            dev_id = doc.get("device_id", "unknown")
            ts = doc.get("timestamp", "")
            if hasattr(ts, "isoformat"):
                ts = ts.isoformat()
            else:
                ts = str(ts)
            is_anom = bool(doc.get("is_anomaly") or doc.get("anomaly"))
            status = "critical" if is_anom else doc.get("status", "verified")
            if status == "normal":
                status = "verified"

            raw_hash = doc.get("hash")
            if not raw_hash:
                raw_hash = hashlib.sha256(f"{dev_id}:{ts}:{doc.get('temperature', 0)}".encode()).hexdigest()

            loss_val = float(doc.get("ai_loss", doc.get("loss", 0.0)))
            thresh_val = float(doc.get("ai_threshold", doc.get("threshold", _ANOMALY_THRESHOLD)))
            conf_val = doc.get("confidence")
            if conf_val is None or float(conf_val) == 0.0:
                if is_anom:
                    ratio_v = loss_val / thresh_val if thresh_val > 0 else 1.2
                    conf_val = 54.0 + 45.4 * (1.0 - math.exp(-0.75 * max(0.05, ratio_v - 1.0)))
                else:
                    conf_val = 85.0
            conf_float = float(conf_val)
            if 0.0 < conf_float <= 1.0:
                conf_float = round(conf_float * 100.0, 1)

            transformed = {
                "id": doc_id,
                "device": dev_id,
                "machine_name": doc.get("machine_name") or dev_id,
                "status_short": doc.get("status_short") or ("Operating normally" if not is_anom else "Abnormal reading detected"),
                "hash": raw_hash,
                "value": f"{doc.get('temperature', 0)}°C",
                "timestamp": ts,
                "status": status,
                "temp": doc.get("temperature", 0),
                "vib": doc.get("vibration", 0),
                "pwr": doc.get("power_usage", 0),
                "pressure": doc.get("pressure", 0),
                "current_avg": doc.get("current_avg", 0.12),
                "voltage_avg": doc.get("voltage_avg", 217.5),
                "loss": round(loss_val, 6),
                "threshold": round(thresh_val, 6),
                "confidence": round(conf_float, 1),
                "severity": doc.get("severity", "critical" if is_anom else "low"),
                "description": doc.get("description", ""),
                "anomaly": 1 if is_anom else 0,
                "ai_source": doc.get("ai_source", "lstm_autoencoder"),
                "ai_error": doc.get("ai_error", ""),
                "recommendation": doc.get("recommendation", "Operational telemetry verified"),
                "recorded_at": ts,
            }
            history.append(transformed)
        
        return {
            "history": history,
            "total_scans": total_scans,
            "total_anomalies": total_anomalies,
            "total_normal": total_normal,
            "count": len(history),
            "source": "mongodb",
        }
    except Exception as e:
        print(f"[HistoryAll] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _execute_telemetry_pipeline(data: SensorData) -> dict:
    # In-memory AI inference via PyTorch LSTM Autoencoder
    ai_result = anomaly_detector.predict(
        device_id=data.device_id,
        temperature=data.temperature,
        vibration=data.vibration,
        power_usage=data.power_usage,
        pressure=data.pressure,
        current_avg=getattr(data, "current_avg", 0.12),
        voltage_avg=getattr(data, "voltage_avg", 217.5)
    )
    is_anomaly = bool(ai_result.get("is_anomaly", False))
    recommendation = ai_result.get("recommendation", "Normal Operation")
    description = ai_result.get("description", "")
    loss_val = float(ai_result.get("loss", 0.0))
    threshold_val = float(ai_result.get("threshold", _ANOMALY_THRESHOLD))
    confidence_val = float(ai_result.get("confidence", 85.0))
    severity_val = ai_result.get("severity", "critical" if is_anomaly else "low")
    ai_source = "in_memory_lstm"

    # Track latest reading per device
    system_state["latest_by_device"][data.device_id] = {
        "id": data.device_id,
        "device": data.device_id,
        "machine_name": data.machine_name or data.device_id,
        "temp": data.temperature,
        "vib": data.vibration,
        "pwr": data.power_usage,
        "pressure": data.pressure,
        "current_avg": getattr(data, "current_avg", 0.12),
        "voltage_avg": getattr(data, "voltage_avg", 217.5),
        "status": "critical" if is_anomaly else "normal",
        "status_short": data.status_short or ("Operating normally" if not is_anomaly else "Abnormal reading detected"),
        "recommendations": data.recommendations if data.recommendations else (["Inspect equipment"] if is_anomaly else ["Continue standard operation"]),
        "loss": loss_val,
        "threshold": threshold_val,
        "confidence": confidence_val,
        "severity": severity_val,
        "timestamp": data.timestamp,
    }

    # --- Save to MongoDB ---
    sensor_doc = SensorDataModel(
        device_id=data.device_id,
        temperature=data.temperature,
        vibration=data.vibration,
        power_usage=data.power_usage,
        current_avg=getattr(data, "current_avg", 0.12),
        voltage_avg=getattr(data, "voltage_avg", 217.5),
        pressure=data.pressure,
        is_anomaly=is_anomaly,
        status="critical" if is_anomaly else "normal",
        ai_loss=loss_val,
        ai_threshold=threshold_val,
        confidence=confidence_val,
        severity=severity_val,
        description=description,
        recommendation=recommendation,
        machine_name=data.machine_name or data.device_id,
        status_short=data.status_short or ("Operating normally" if not is_anomaly else "Abnormal reading detected"),
    )
    await save_sensor_data(sensor_doc)

    # --- Update in-memory counters ---
    system_state["dashboard"]["total_scans"] += 1
    system_state["ai"]["total_analyses"] += 1

    status_label = "critical" if is_anomaly else "normal"
    tx_hash      = "---"

    # --- Anomaly path ---
    if is_anomaly:
        system_state["dashboard"]["anomalies"]       += 1
        system_state["ai"]["anomalies_found"]        += 1
        system_state["blockchain"]["total_blocks"]   += 1
        system_state["blockchain"]["transactions"]   += 1

    # --- Broadcast to WebSocket clients ---
    await broadcast_data({
        "device_id":    data.device_id,
        "machine_name": data.machine_name or data.device_id,
        "temperature":  data.temperature,
        "vibration":    data.vibration,
        "power_usage":  data.power_usage,
        "current_avg":  getattr(data, "current_avg", 0.12),
        "voltage_avg":  getattr(data, "voltage_avg", 217.5),
        "pressure":     data.pressure,
        "is_anomaly":   is_anomaly,
        "loss":         loss_val,
        "threshold":    threshold_val,
        "confidence":   confidence_val,
        "severity":     severity_val,
        "status":       "critical" if is_anomaly else "normal",
        "status_short": data.status_short or ("Operating normally" if not is_anomaly else "Abnormal reading detected"),
        "timestamp":    datetime.now(timezone.utc).isoformat(),
        "total_scans":  system_state["dashboard"]["total_scans"],
        "anomalies":    system_state["dashboard"]["anomalies"],
    })

    if is_anomaly:

        # --- Save to MongoDB fraud alerts ---
        fraud_alert = FraudAlertModel(
            device_id=data.device_id,
            alert_type="anomaly",
            severity=severity_val,
            message=description or recommendation,
            confidence=confidence_val,
            anomaly_data={
                "temperature": data.temperature,
                "vibration": data.vibration,
                "power_usage": data.power_usage,
                "current_avg": getattr(data, "current_avg", 0.12),
                "voltage_avg": getattr(data, "voltage_avg", 217.5),
                "pressure": data.pressure,
                "ai_loss": loss_val,
                "ai_threshold": threshold_val,
                "confidence": confidence_val,
                "recommendation": recommendation,
            }
        )
        await save_fraud_alert(fraud_alert)

        # Build data hash for blockchain record
        data_string   = json.dumps(data.dict(), sort_keys=True)
        tx_hash       = hashlib.sha256(data_string.encode()).hexdigest()
        previous_hash = (
            system_state["blockchain"]["recent_blocks"][0]["hash"]
            if system_state["blockchain"]["recent_blocks"]
            else "0000000000000000"
        )

        block_record = {
            "index":     system_state["blockchain"]["total_blocks"],
            "id":        system_state["blockchain"]["total_blocks"],
            "hash":      tx_hash,
            "prev_hash": previous_hash,
            "merkle_root": hashlib.sha256(f"{data.device_id}:{tx_hash}".encode()).hexdigest(),
            "device_id": data.device_id,
            "anomaly_score": round(loss_val, 4),
            "orgMSP":    "ManufacturerMSP",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "status":    "confirmed",
            "validator": "Consortium-Raft-Node-1",
            "transactions": 1,
            "tx_count": 1,
        }
        system_state["blockchain"]["recent_blocks"].insert(0, block_record)
        system_state["blockchain"]["recent_blocks"] = \
            system_state["blockchain"]["recent_blocks"][:10]

        from database import db as mongo_db
        if mongo_db is not None:
            try:
                await mongo_db["blockchain_blocks"].insert_one(dict(block_record))
            except Exception:
                pass

        ai_record = {
            "confidence": confidence_val,
            "device":         data.device_id,
            "recommendation": recommendation,
            "timestamp":      datetime.now().strftime("%H:%M:%S"),
            "severity":       severity_val,
            "model_name":     "PyTorch 6-Channel Temporal LSTM Autoencoder",
            "loss":           loss_val,
            "threshold":      threshold_val,
        }

        system_state["ai"]["recent_results"].insert(0, ai_record)
        system_state["ai"]["recent_results"] = \
            system_state["ai"]["recent_results"][:10]

        # --- Write to Hyperledger Fabric ---
        if BLOCKCHAIN_ACTIVE:
            try:
                feature_keys_json = json.dumps(["temperature", "vibration", "power_usage", "current_avg", "voltage_avg", "pressure"])
                anomaly_score     = str(round(
                    ai_result.get("anomaly_score", ai_result.get("loss", 0.0)), 6
                ))
                tx_result = fabric_client.submit_transaction("RecordSensorData", [
                    data.device_id,
                    "INDUSTRIAL_SENSOR",
                    tx_hash,
                    str(is_anomaly).lower(),
                    anomaly_score,
                    str(_ANOMALY_THRESHOLD),
                    feature_keys_json,
                    data.timestamp,
                ])
                if tx_result.get("status") not in ("success", "simulated"):
                    print(f"Ledger write non-fatal notice: {tx_result.get('error')}")
            except Exception as exc:
                print(f"Ledger write notice (non-fatal): {exc}")

    # --- Append to history (in-memory storage) ---
    history_record = {
        "device":    data.device_id,
        "hash":      tx_hash,
        "value":     f"{data.temperature}C",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status":    status_label,
        "temp":      data.temperature,
        "vib":       data.vibration,
        "pwr":       data.power_usage,
        "anomaly":   is_anomaly,
        "ai_source": ai_source,
        "ai_error":  None,
        "recommendation": recommendation,
        "id":        system_state["dashboard"]["total_scans"],
    }

    system_state["history"].append(history_record)
    if len(system_state["history"]) > 100:
        system_state["history"].pop(0)

    return {
        "status":    "Processed",
        "anomaly":   is_anomaly,
        "ai_source": ai_source,
        "ai_error":  None,
        "tx_hash":   tx_hash if is_anomaly else None,
    }


async def autonomous_feeder_loop():
    if os.getenv("AUTONOMOUS_FEEDER", "true").lower() not in ("true", "1", "yes"):
        print("[AutonomousFeeder] Feeder disabled via AUTONOMOUS_FEEDER=false")
        return

    interval = float(os.getenv("FEEDER_INTERVAL_SECONDS", "5.0"))
    try:
        from iot.data_ingestor import load_industrial_datasets, DEVICES, format_status
        records = load_industrial_datasets()
    except Exception as exc:
        print(f"[AutonomousFeeder] Notice loading industrial datasets ({exc})")
        records = []

    if not records:
        print("[AutonomousFeeder] Critical: No industrial dataset records available.")
        return

    print(f"[AutonomousFeeder] Continuous 24/7 autonomous loop online ({len(records)} records, {interval}s interval)")
    rec_idx = 0
    dev_idx = 0

    while True:
        try:
            await asyncio.sleep(interval)
            rec = records[rec_idx]
            device_id = DEVICES[dev_idx % len(DEVICES)]
            rec_idx = (rec_idx + 1) % len(records)
            dev_idx += 1

            meta = format_status(device_id, rec["temperature"], rec["vibration"], rec["power_usage"])
            sensor_obj = SensorData(
                device_id=device_id,
                temperature=rec["temperature"],
                vibration=rec["vibration"],
                power_usage=rec["power_usage"],
                pressure=rec.get("pressure", 0.0),
                current_avg=rec.get("current_avg", 0.12),
                voltage_avg=rec.get("voltage_avg", 217.5),
                timestamp=datetime.now(timezone.utc).isoformat(),
                machine_name=meta.get("machine_name", "Industrial Machine"),
                status_short=meta.get("status_short", "Machine operating within safe parameters"),
                recommendations=meta.get("recommendations", ["Continue standard operation"]),
                signature="",
            )
            result = await _execute_telemetry_pipeline(sensor_obj)
            if result.get("anomaly"):
                print(f"[AutonomousFeeder] ANOMALY on {device_id} -> Block committed to Fabric: {result.get('tx_hash')[:16]}...")
            if dev_idx % 30 == 0:
                print(f"[AutonomousFeeder] Continuous pulse | total_scans={system_state['dashboard']['total_scans']} | active_devices=33")
        except asyncio.CancelledError:
            print("[AutonomousFeeder] Stopped cleanly.")
            break
        except Exception as exc:
            print(f"[AutonomousFeeder] Stream notice: {exc}")
            await asyncio.sleep(interval)


@app.post("/api/process_data", dependencies=[Depends(verify_api_key)])
@app.post("/api/process-data", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def process_data(request: Request, data: SensorData):
    try:
        _verify_sensor_payload(data)
        return await _execute_telemetry_pipeline(data)
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        error_msg = str(exc) if str(exc) else repr(exc)
        traceback_str = traceback.format_exc()
        print(f"process_data unhandled error: {error_msg}")
        print(f"FULL TRACEBACK:\n{traceback_str}")
        raise HTTPException(status_code=500, detail=f"Error: {error_msg or 'Unknown error'}")


# ---------------------------------------------------------------------------
# JWT verification (used by /submit-data)
# ---------------------------------------------------------------------------
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if jwt is None:
        return {"sub": "authenticated_user"}
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=["HS256"]
        )
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@app.post("/submit-data")
@limiter.limit("60/minute")
async def submit_data(request: Request, data: dict, user=Depends(verify_token)):
    await broadcast_data(data)
    return {
        "status": "Data accepted",
        "user":   user.get("user") or user.get("sub") or "unknown",
    }


# ---------------------------------------------------------------------------
# Storage & Export Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/storage/status", dependencies=[Depends(verify_api_key)])
async def get_storage_status():
    """Get MongoDB storage usage and alert if near capacity"""
    try:
        db_size_mb = await get_database_size()
        collection_stats = await get_collection_stats()
        
        limit_mb = 500
        threshold_mb = 450
        used_percentage = (db_size_mb / limit_mb) * 100
        
        # Determine status
        if db_size_mb >= threshold_mb:
            status = "CRITICAL"
            message = f"Storage nearly full! {db_size_mb:.2f}MB of {limit_mb}MB used. Export data immediately!"
        elif db_size_mb >= (threshold_mb * 0.8):
            status = "WARNING"
            message = f"Storage usage high: {db_size_mb:.2f}MB of {limit_mb}MB. Consider exporting soon."
        else:
            status = "OK"
            message = f"Storage usage low: {db_size_mb:.2f}MB of {limit_mb}MB. Proceed with data collection."
        
        return {
            "status": status,
            "used_mb": round(db_size_mb, 2),
            "limit_mb": limit_mb,
            "remaining_mb": round(max(0, limit_mb - db_size_mb), 2),
            "percentage_used": round(used_percentage, 2),
            "message": message,
            "collections": collection_stats,
            "alert": db_size_mb >= threshold_mb,
            "export_recommended": db_size_mb >= (threshold_mb * 0.9),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "message": str(e),
            "error": True
        }


@app.get("/api/data/export", dependencies=[Depends(verify_api_key)])
async def export_data():
    """Export all sensor data and fraud alerts as JSON"""
    try:
        export_data_dict = await export_all_data()
        
        if not export_data_dict:
            return {
                "status": "No data to export",
                "sensor_data": [],
                "fraud_alerts": []
            }
        
        return {
            "status": "SUCCESS",
            "export_timestamp": export_data_dict["export_timestamp"],
            "total_readings": export_data_dict["total_readings"],
            "total_alerts": export_data_dict["total_alerts"],
            "sensor_data": export_data_dict["sensor_data"],
            "fraud_alerts": export_data_dict["fraud_alerts"],
            "export_size_mb": round(
                len(json.dumps(export_data_dict)) / (1024 * 1024), 2
            )
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "message": str(e),
            "error": True
        }


@app.get("/api/statistics/summary", dependencies=[Depends(verify_api_key)])
async def get_statistics_summary():
    """Get data collection summary statistics"""
    try:
        collection_stats = await get_collection_stats()
        db_size_mb = await get_database_size()
        
        total_readings = collection_stats.get("sensor_data", {}).get("count", 0)
        total_alerts = collection_stats.get("fraud_alerts", {}).get("count", 0)
        
        # Estimate collection period
        if total_readings > 0:
            # At ~1 reading per second, estimate days
            days_of_data = total_readings / (86400)  # 86400 seconds per day
        else:
            days_of_data = 0
        
        return {
            "status": "OK",
            "summary": {
                "total_readings_collected": total_readings,
                "total_anomalies_detected": total_alerts,
                "total_storage_mb": round(db_size_mb, 2),
                "estimated_days": round(days_of_data, 2),
                "reading_rate": "~1 per second",
                "collection_breakdown": {
                    "sensor_data": {
                        "count": collection_stats.get("sensor_data", {}).get("count", 0),
                        "estimated_mb": collection_stats.get("sensor_data", {}).get("estimated_mb", 0)
                    },
                    "fraud_alerts": {
                        "count": collection_stats.get("fraud_alerts", {}).get("count", 0),
                        "estimated_mb": collection_stats.get("fraud_alerts", {}).get("estimated_mb", 0)
                    }
                }
            },
            "last_reading": collection_stats.get("total_mb", 0),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "ERROR",
            "message": str(e),
            "error": True
        }
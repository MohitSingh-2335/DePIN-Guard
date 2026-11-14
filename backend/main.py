import time as _time
import os
import hashlib
import hmac
import json
import random
import requests as http_requests
from contextlib import asynccontextmanager
from datetime import datetime, timezone

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

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

API_KEY            = os.getenv("DEPIN_API_KEY")
SECRET_KEY         = os.getenv("JWT_SECRET_KEY")
SENSOR_PAYLOAD_MAX_AGE_SECONDS = int(os.getenv("SENSOR_PAYLOAD_MAX_AGE_SECONDS", "86400"))

# Initialize in-memory AI engine
from ai_engine import AnomalyDetector
anomaly_detector = AnomalyDetector()
_ANOMALY_THRESHOLD = anomaly_detector.threshold

FRAUD_DB      = os.path.join(os.path.dirname(__file__), "data", "fraud_reports.json")
KNOWN_DEVICES = ["Device-001", "Device-002", "Device-003", "Device-004", "Device-005"]

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is required in .env before starting")

# ---------------------------------------------------------------------------
# In-memory state
# ---------------------------------------------------------------------------
system_state = {
    "dashboard": {
        "active_devices": 0,
        "total_scans":    0,
        "anomalies":      0,
        "uptime":         100.0,
    },
    "blockchain": {
        "total_blocks":   0,
        "transactions":   0,
        "recent_blocks":  [],
    },
    "ai": {
        "total_analyses": 0,
        "anomalies_found": 0,
        "recent_results": [],
    },
    "history": [],
}


async def _hydrate_system_state():
    """Hydrate system state from MongoDB"""
    from database import db as mongo_db, mongodb_client
    
    try:
        if mongo_db is not None and mongodb_client is not None:
            # Get data from MongoDB
            all_data = await mongo_db["sensor_data"].find({}).sort("timestamp", -1).to_list(length=None)
            critical_data = [d for d in all_data if d.get("status") == "critical"]
            
            # Get unique device count
            active_devices = set()
            for record in all_data:
                device_id = record.get("device_id")
                if device_id:
                    active_devices.add(device_id)
            
            system_state["dashboard"]["active_devices"] = len(active_devices)
            system_state["dashboard"]["total_scans"] = len(all_data)
            system_state["dashboard"]["anomalies"] = len(critical_data)
            system_state["dashboard"]["uptime"] = "100.0%"
            
            system_state["ai"]["total_analyses"] = len(all_data)
            system_state["ai"]["anomalies_found"] = len(critical_data)
            
            # Blockchain block count
            system_state["blockchain"]["total_blocks"] = max(len(critical_data), 1)
            system_state["blockchain"]["transactions"] = len(critical_data)
            
            print(f"[SystemState] Loaded {len(all_data)} records from MongoDB - {len(active_devices)} active devices")
        else:
            print("[SystemState] MongoDB not available!")
    except Exception as e:
        print(f"[SystemState] Error: {e}")
        raise


async def _setup_system_state():
    """Call _hydrate_system_state during startup"""
    await _hydrate_system_state()

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
# GNN scheduler — MongoDB-only
# ---------------------------------------------------------------------------
def run_gnn_analysis():
    try:
        print("[GNN] Scheduler triggered - analysis pending...")
    except Exception as e:
        print(f"[GNN] Error: {e}")


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
    
    yield
    
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

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer_scheme  = HTTPBearer(auto_error=True)

if not API_KEY:
    raise RuntimeError("DEPIN_API_KEY is required in root .env before starting")

print("API Key loaded and verified.")
print(f"Anomaly threshold: {_ANOMALY_THRESHOLD}")


async def verify_api_key(api_key: str = Security(api_key_header)):
    if not API_KEY or api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key",
        )
    return api_key


# Include routers with API key protection (must be after verify_api_key is defined)
app.include_router(blockchain_router, prefix="/api", dependencies=[Depends(verify_api_key)])
app.include_router(fraud_router, prefix="/api", dependencies=[Depends(verify_api_key)])

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]
cors_env       = os.getenv("CORS_ALLOWED_ORIGINS", "")
cors_regex_env = os.getenv("CORS_ALLOWED_ORIGIN_REGEX", "").strip()
trusted_origins = (
    [o.strip() for o in cors_env.split(",") if o.strip()]
    or default_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=trusted_origins,
    allow_origin_regex=cors_regex_env or None,
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


@app.get("/api/dashboard", dependencies=[Depends(verify_api_key)])
async def get_dashboard():
    """Get dashboard data from MongoDB (MongoDB-only, no fallback)"""
    from database import db as mongo_db, mongodb_client
    
    if mongo_db is None or mongodb_client is None:
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        # Fetch recent data from MongoDB
        recent_raw = await mongo_db["sensor_data"].find({}).sort("timestamp", -1).limit(5).to_list(length=5)
        recent_data = []
        for idx, doc in enumerate(recent_raw):
            transformed = {
                "id": idx,
                "device": doc.get("device_id", "unknown"),
                "temp": doc.get("temperature", 0),
                "vib": doc.get("vibration", 0),
                "pwr": doc.get("power_usage", 0),
                "status": doc.get("status", "normal"),
                "timestamp": doc.get("timestamp", ""),
            }
            recent_data.append(transformed)
        
        # Get metrics from system state
        return {
            "stats": system_state["dashboard"],
            "recent_data": recent_data,
            "source": "mongodb"
        }
    except Exception as e:
        print(f"[Dashboard] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/blockchain", dependencies=[Depends(verify_api_key)])
def get_blockchain():
    return system_state["blockchain"]


@app.get("/api/ai-analysis", dependencies=[Depends(verify_api_key)])
def get_ai_analysis():
    return system_state["ai"]


@app.get("/api/history", dependencies=[Depends(verify_api_key)])
async def get_history():
    """Get all sensor readings from MongoDB (MongoDB-only, no fallback)"""
    from database import db as mongo_db, mongodb_client
    
    if mongo_db is None or mongodb_client is None:
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        # Fetch ALL records from MongoDB with no limit
        raw_history = await mongo_db["sensor_data"].find({}).sort("timestamp", -1).to_list(length=None)
        
        # Transform MongoDB documents
        history = []
        for idx, doc in enumerate(raw_history):
            transformed = {
                "id": idx,
                "device": doc.get("device_id", "unknown"),
                "hash": "",
                "value": "",
                "timestamp": doc.get("timestamp", ""),
                "status": doc.get("status", "normal"),
                "temp": doc.get("temperature", 0),
                "vib": doc.get("vibration", 0),
                "pwr": doc.get("power_usage", 0),
                "anomaly": 1 if doc.get("is_anomaly") or doc.get("anomaly") else 0,
                "ai_source": doc.get("ai_source", "model"),
                "ai_error": doc.get("ai_error", ""),
                "recommendation": doc.get("recommendation", ""),
                "recorded_at": doc.get("timestamp", ""),
            }
            history.append(transformed)
        
        print(f"[History] Retrieved {len(history)} records from MongoDB")
        return {
            "history": history,
            "count": len(history),
            "source": "mongodb",
        }
    except Exception as e:
        print(f"[History] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/all", dependencies=[Depends(verify_api_key)])
async def get_all_history():
    """Get all sensor readings from MongoDB (MongoDB-only, no fallback)"""
    from database import db as mongo_db, mongodb_client
    
    if mongo_db is None or mongodb_client is None:
        raise HTTPException(status_code=503, detail="MongoDB not available")
    
    try:
        # Fetch ALL records from MongoDB with no limit
        raw_history = await mongo_db["sensor_data"].find({}).sort("timestamp", -1).to_list(length=None)
        
        # Transform MongoDB documents
        history = []
        for idx, doc in enumerate(raw_history):
            transformed = {
                "id": idx,
                "device": doc.get("device_id", "unknown"),
                "hash": "",
                "value": "",
                "timestamp": doc.get("timestamp", ""),
                "status": doc.get("status", "normal"),
                "temp": doc.get("temperature", 0),
                "vib": doc.get("vibration", 0),
                "pwr": doc.get("power_usage", 0),
                "anomaly": 1 if doc.get("is_anomaly") or doc.get("anomaly") else 0,
                "ai_source": doc.get("ai_source", "model"),
                "ai_error": doc.get("ai_error", ""),
                "recommendation": doc.get("recommendation", ""),
                "recorded_at": doc.get("timestamp", ""),
            }
            history.append(transformed)
        
        print(f"[HistoryAll] Retrieved {len(history)} records from MongoDB")
        return {
            "history": history,
            "count": len(history),
            "source": "mongodb",
        }
    except Exception as e:
        print(f"[HistoryAll] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process_data", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def process_data(request: Request, data: SensorData):
    try:
        _verify_sensor_payload(data)
        is_anomaly     = False
        recommendation = "Normal Operation"
        ai_source      = "model"
        # In-memory AI inference via PyTorch LSTM Autoencoder
        ai_result = anomaly_detector.predict(
            device_id=data.device_id,
            temperature=data.temperature,
            vibration=data.vibration,
            power_usage=data.power_usage
        )
        is_anomaly = ai_result.get("is_anomaly", False)
        ai_source  = "in_memory_lstm"

        # --- Save to MongoDB ---
        sensor_doc = SensorDataModel(
            device_id=data.device_id,
            temperature=data.temperature,
            vibration=data.vibration,
            power_usage=data.power_usage,
        )
        await save_sensor_data(sensor_doc)

        # --- Broadcast to WebSocket clients ---
        await broadcast_data({
            "device_id":   data.device_id,
            "temperature": data.temperature,
            "vibration":   data.vibration,
            "power_usage": data.power_usage,
            "is_anomaly":  is_anomaly,
            "timestamp":   datetime.now().isoformat(),
        })

        # --- Update in-memory counters ---
        system_state["dashboard"]["total_scans"] += 1
        system_state["ai"]["total_analyses"] += 1

        status_label = "normal"
        tx_hash      = "---"

        # --- Anomaly path ---
        if is_anomaly:
            if data.temperature > 100:
                recommendation = "CRITICAL: Overheating detected. Check cooling system."
            elif data.vibration > 10:
                recommendation = "WARNING: Severe mechanical vibration. Check mounting."
            else:
                recommendation = "ALERT: AI model detected anomaly pattern."

            status_label = "critical"
            system_state["dashboard"]["anomalies"]       += 1
            system_state["ai"]["anomalies_found"]        += 1
            system_state["blockchain"]["total_blocks"]   += 1
            system_state["blockchain"]["transactions"]   += 1

            # --- Save to MongoDB fraud alerts ---
            fraud_alert = FraudAlertModel(
                device_id=data.device_id,
                alert_type="anomaly",
                severity="high",
                message=recommendation,
                anomaly_data={
                    "temperature": data.temperature,
                    "vibration": data.vibration,
                    "power_usage": data.power_usage,
                    "ai_loss": ai_result.get("loss"),
                    "ai_threshold": ai_result.get("threshold"),
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
                "id":        system_state["blockchain"]["total_blocks"],
                "hash":      tx_hash,
                "prev_hash": previous_hash,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status":    "Confirmed",
            }
            system_state["blockchain"]["recent_blocks"].insert(0, block_record)
            system_state["blockchain"]["recent_blocks"] = \
                system_state["blockchain"]["recent_blocks"][:10]

            ai_record = {
                "confidence": 95.0,
                "device":         data.device_id,
                "recommendation": recommendation,
                "timestamp":      datetime.now().strftime("%H:%M:%S"),
                "severity":       "high",
            }

            confidence_raw = ai_result.get("anomaly_score")
            if confidence_raw is None:
                confidence_raw = ai_result.get("loss", 0.95)
            try:
                confidence_value = float(confidence_raw)
                if confidence_value <= 1.0:
                    confidence_value *= 100.0
                ai_record["confidence"] = round(max(0.0, min(confidence_value, 100.0)), 2)
            except Exception:
                pass

            system_state["ai"]["recent_results"].insert(0, ai_record)
            system_state["ai"]["recent_results"] = \
                system_state["ai"]["recent_results"][:10]

            # --- Write to Hyperledger Fabric ---
            if BLOCKCHAIN_ACTIVE:
                try:
                    # FIX: was "CreateAsset" which does not exist in custom chaincode.
                    # Correct function is "RecordSensorData" from smartcontract.go.
                    # Signature: RecordSensorData(deviceID, assetType, dataHash,
                    #             isAnomaly, anomalyScore, threshold,
                    #             featureKeysJSON, timestamp)
                    feature_keys_json = json.dumps(["temperature", "vibration", "power_usage"])
                    anomaly_score     = str(round(
                        ai_result.get("anomaly_score", ai_result.get("loss", 0.0)), 6
                    ))
                    tx_result = fabric_client.submit_transaction("RecordSensorData", [
                        data.device_id,
                        "INDUSTRIAL_SENSOR",
                        tx_hash,
                        str(is_anomaly).lower(),   # "true" or "false"
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
            "ai_error":  ai_error,
            "tx_hash":   tx_hash if is_anomaly else None,
        }

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
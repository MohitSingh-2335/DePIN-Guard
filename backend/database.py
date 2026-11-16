import os
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field


def utc_now():
    return datetime.now(timezone.utc)


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

try:
    from motor.motor_asyncio import AsyncIOMotorClient as AsyncClient, AsyncIOMotorDatabase as AsyncDatabase
    import certifi
except ImportError:
    AsyncClient = None
    AsyncDatabase = None
    certifi = None

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/depin_guard")
mongodb_client: Optional[AsyncClient] = None
db: Optional[AsyncDatabase] = None


async def connect_to_mongo():
    global mongodb_client, db
    if AsyncClient is None:
        db = None
        print("MongoDB driver not installed. Running with local in-memory fallback.")
        return

    try:
        if "mongodb+srv://" in MONGODB_URI:
            mongodb_client = AsyncClient(
                MONGODB_URI,
                tls=True,
                tlsCAFile=certifi.where() if certifi else None,
                tlsAllowInvalidCertificates=False,
                retryWrites=True,
                w="majority",
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=5000,
            )
        else:
            mongodb_client = AsyncClient(MONGODB_URI, serverSelectionTimeoutMS=2000)

        await mongodb_client.admin.command("ping")
        db = mongodb_client["depin_guard"]
        print("Connected to MongoDB database.")
        await create_indexes()
    except Exception as exc:
        db = None
        print(f"MongoDB not reachable ({exc}). Running with local in-memory fallback.")


async def close_mongo_connection():
    global mongodb_client
    if mongodb_client is not None:
        mongodb_client.close()
        print("MongoDB connection closed.")


async def create_indexes():
    if db is None:
        return
    try:
        sensor_data_col = db["sensor_data"]
        await sensor_data_col.create_index("device_id")
        await sensor_data_col.create_index("timestamp")
        await sensor_data_col.create_index([("timestamp", -1)])
        await sensor_data_col.create_index("is_anomaly")

        fraud_alerts_col = db["fraud_alerts"]
        await fraud_alerts_col.create_index("device_id")
        await fraud_alerts_col.create_index("timestamp")
        await fraud_alerts_col.create_index([("timestamp", -1)])
        await fraud_alerts_col.create_index("resolved")

        blocks_col = db["blockchain_blocks"]
        await blocks_col.create_index([("index", -1)])
    except Exception as exc:
        print(f"Index creation notice: {exc}")


class SensorDataModel(BaseModel):
    device_id: str
    machine_name: str = ""
    status_short: str = ""
    temperature: float
    vibration: float
    power_usage: float
    current_avg: float = 0.12
    voltage_avg: float = 217.5
    pressure: Optional[float] = None
    is_anomaly: bool = False
    status: str = "normal"
    ai_loss: float = 0.0
    ai_threshold: float = 0.0
    confidence: float = 0.0
    severity: str = "low"
    description: str = ""
    recommendation: str = ""
    resolved: bool = False
    hash: str = ""
    timestamp: datetime = Field(default_factory=utc_now)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class AnomalyResultModel(BaseModel):
    device_id: str
    is_anomaly: bool
    anomaly: bool
    status: str
    loss: float
    threshold: float
    confidence: float = 0.0
    timestamp: datetime = Field(default_factory=utc_now)


class FraudAlertModel(BaseModel):
    device_id: str
    alert_type: str
    severity: str
    message: str
    recommendation: str = "Inspect physical equipment and verify sensor calibration."
    confidence: float = 0.0
    resolved: bool = False
    sensor_doc_id: Optional[str] = None
    anomaly_data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=utc_now)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


async def get_canonical_stats(fallback_state: Optional[dict] = None) -> dict:
    """
    Single Source of Truth for all telemetry, anomaly, fraud, and blockchain counters.
    Queries MongoDB directly so Dashboard, AI Analysis, History, Fraud Alerts,
    Blockchain Explorer, and Landing Page always return identical persistent numbers.
    """
    anom_filter = {"$or": [{"is_anomaly": True}, {"status": "critical"}]}
    if db is not None and mongodb_client is not None:
        try:
            total_scans = await db["sensor_data"].count_documents({})
            anomalies = await db["sensor_data"].count_documents(anom_filter)
            critical_anomalies = await db["sensor_data"].count_documents({
                "$and": [
                    anom_filter,
                    {"$or": [{"severity": {"$in": ["critical", "high"]}}, {"confidence": {"$gte": 80.0}}]}
                ]
            })
            resolved_alerts = await db["fraud_alerts"].count_documents({"resolved": True})
            if resolved_alerts == 0:
                resolved_alerts = await db["sensor_data"].count_documents({
                    "$and": [anom_filter, {"resolved": True}]
                })
            resolved_alerts = min(anomalies, resolved_alerts)
            pending_alerts = max(0, anomalies - resolved_alerts)
            normal_scans = max(0, total_scans - anomalies)
            total_blocks = await db["blockchain_blocks"].count_documents({})
            total_blocks = max(1, total_blocks)
            return {
                "active_devices": 33,
                "total_scans": total_scans,
                "anomalies": anomalies,
                "normal_scans": normal_scans,
                "critical_anomalies": critical_anomalies if critical_anomalies > 0 else anomalies,
                "resolved_alerts": resolved_alerts,
                "pending_alerts": pending_alerts,
                "total_blocks": total_blocks,
                "transactions": total_blocks,
                "uptime": 99.9 if total_scans > 0 else 100.0,
                "source": "mongodb",
            }
        except Exception as exc:
            print(f"[CanonicalStats] MongoDB query notice: {exc}")

    dash = (fallback_state or {}).get("dashboard", {})
    chain = (fallback_state or {}).get("blockchain", {})
    total_scans = int(dash.get("total_scans", 0))
    anomalies = int(dash.get("anomalies", 0))
    total_blocks = max(1, int(chain.get("total_blocks", 1)))
    return {
        "active_devices": 33,
        "total_scans": total_scans,
        "anomalies": anomalies,
        "normal_scans": max(0, total_scans - anomalies),
        "critical_anomalies": anomalies,
        "resolved_alerts": 0,
        "pending_alerts": anomalies,
        "total_blocks": total_blocks,
        "transactions": total_blocks,
        "uptime": 99.9 if total_scans > 0 else 100.0,
        "source": "in_memory",
    }


async def save_sensor_data(data: SensorDataModel):
    if db is None:
        return None
    try:
        doc = data.model_dump() if hasattr(data, "model_dump") else data.dict()
        result = await db["sensor_data"].insert_one(doc)
        return str(result.inserted_id)
    except Exception as exc:
        print(f"Error saving sensor data to MongoDB: {exc}")
        return None


async def save_fraud_alert(alert: FraudAlertModel):
    if db is None:
        return None
    try:
        doc = alert.model_dump() if hasattr(alert, "model_dump") else alert.dict()
        result = await db["fraud_alerts"].insert_one(doc)
        return str(result.inserted_id)
    except Exception as exc:
        print(f"Error saving fraud alert to MongoDB: {exc}")
        return None


async def get_recent_sensor_data(device_id: str, limit: int = 100):
    if db is None:
        return []
    try:
        data = await db["sensor_data"].find(
            {"device_id": device_id}
        ).sort("timestamp", -1).limit(limit).to_list(length=limit)
        return data
    except Exception as exc:
        print(f"Error retrieving sensor data: {exc}")
        return []


async def get_fraud_alerts(device_id: Optional[str] = None, limit: int = 50):
    if db is None:
        return []
    try:
        query = {} if not device_id else {"device_id": device_id}
        alerts = await db["fraud_alerts"].find(query).sort("timestamp", -1).limit(limit).to_list(length=limit)
        return alerts
    except Exception as exc:
        print(f"Error retrieving fraud alerts: {exc}")
        return []


async def get_device_stats(device_id: str):
    if db is None:
        return {}
    try:
        total_readings = await db["sensor_data"].count_documents({"device_id": device_id})
        anomaly_count = await db["sensor_data"].count_documents({
            "device_id": device_id,
            "$or": [{"is_anomaly": True}, {"status": "critical"}]
        })
        recent = await db["sensor_data"].find_one(
            {"device_id": device_id},
            sort=[("timestamp", -1)]
        )
        return {
            "device_id": device_id,
            "total_readings": total_readings,
            "anomalies_detected": anomaly_count,
            "last_reading": recent["timestamp"] if recent else None
        }
    except Exception as exc:
        print(f"Error getting device stats: {exc}")
        return {}


async def get_database_size():
    if db is None:
        return 0
    try:
        stats = await db.command("dbStats")
        size_bytes = stats.get("dataSize", 0)
        return size_bytes / (1024 * 1024)
    except Exception:
        return 0


async def get_collection_stats():
    if db is None:
        return {}
    try:
        collections = await db.list_collection_names()
        stats = {}
        for col_name in collections:
            col_stats = await db.command("collStats", col_name)
            stats[col_name] = {
                "count": col_stats.get("count", 0),
                "size_mb": col_stats.get("size", 0) / (1024 * 1024),
                "storage_size_mb": col_stats.get("storageSize", 0) / (1024 * 1024),
            }
        return stats
    except Exception:
        return {}


async def export_all_data():
    if db is None:
        return {
            "export_timestamp": utc_now().isoformat(),
            "total_readings": 0,
            "total_alerts": 0,
            "sensor_data": [],
            "fraud_alerts": [],
        }
    try:
        sensors = await db["sensor_data"].find({}, {"_id": 0}).sort("timestamp", -1).limit(1000).to_list(length=1000)
        alerts = await db["fraud_alerts"].find({}, {"_id": 0}).sort("timestamp", -1).limit(1000).to_list(length=1000)
        for s in sensors:
            if hasattr(s.get("timestamp"), "isoformat"):
                s["timestamp"] = s["timestamp"].isoformat()
        for a in alerts:
            if hasattr(a.get("timestamp"), "isoformat"):
                a["timestamp"] = a["timestamp"].isoformat()
        return {
            "export_timestamp": utc_now().isoformat(),
            "total_readings": len(sensors),
            "total_alerts": len(alerts),
            "sensor_data": sensors,
            "fraud_alerts": alerts,
        }
    except Exception:
        return {
            "export_timestamp": utc_now().isoformat(),
            "total_readings": 0,
            "total_alerts": 0,
            "sensor_data": [],
            "fraud_alerts": [],
        }

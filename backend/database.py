import os
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field

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

        await mongodb_client.admin.command('ping')
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

        fraud_alerts_col = db["fraud_alerts"]
        await fraud_alerts_col.create_index("device_id")
        await fraud_alerts_col.create_index("timestamp")
        await fraud_alerts_col.create_index([("timestamp", -1)])
    except Exception as exc:
        print(f"Index creation notice: {exc}")


class SensorDataModel(BaseModel):
    device_id: str
    temperature: float
    vibration: float
    power_usage: float
    pressure: Optional[float] = None
    is_anomaly: bool = False
    status: str = "normal"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class AnomalyResultModel(BaseModel):
    device_id: str
    is_anomaly: bool
    anomaly: bool
    status: str
    loss: float
    threshold: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FraudAlertModel(BaseModel):
    device_id: str
    alert_type: str
    severity: str
    message: str
    anomaly_data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


async def save_sensor_data(data: SensorDataModel):
    if db is None:
        return None
    try:
        result = await db["sensor_data"].insert_one(data.dict())
        return str(result.inserted_id)
    except Exception as exc:
        print(f"Error saving sensor data to MongoDB: {exc}")
        return None


async def save_fraud_alert(alert: FraudAlertModel):
    if db is None:
        return None
    try:
        result = await db["fraud_alerts"].insert_one(alert.dict())
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
        anomaly_count = await db["fraud_alerts"].count_documents({
            "device_id": device_id,
            "alert_type": "anomaly"
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
        return {"sensor_data": [], "fraud_alerts": []}
    try:
        sensors = await db["sensor_data"].find().to_list(length=1000)
        alerts = await db["fraud_alerts"].find().to_list(length=1000)
        return {"sensor_data": sensors, "fraud_alerts": alerts}
    except Exception:
        return {"sensor_data": [], "fraud_alerts": []}

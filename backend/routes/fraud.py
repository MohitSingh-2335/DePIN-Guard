import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from database import db

router = APIRouter()


class FraudAlert(BaseModel):
    device_id: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    confidence: Optional[float] = None
    anomaly_data: Optional[dict] = None


@router.post("/report-fraud")
async def report_fraud(alert: FraudAlert):
    if db is None:
        return {"status": "error", "message": "Database not connected"}
    try:
        doc = {
            "device_id": alert.device_id or "unknown",
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message,
            "confidence": alert.confidence or 0.95,
            "anomaly_data": alert.anomaly_data or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        res = await db["fraud_alerts"].insert_one(doc)
        return {"status": "saved", "id": str(res.inserted_id)}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/fraud-alerts")
async def get_all_fraud_alerts(device_id: Optional[str] = None, limit: int = 50):
    if db is None:
        return {"alerts": [], "count": 0, "source": "none"}

    try:
        query = {"device_id": device_id} if device_id else {}
        cursor = db["fraud_alerts"].find(query).sort("timestamp", -1).limit(limit)
        raw_alerts = await cursor.to_list(length=limit)

        formatted_alerts = []
        for doc in raw_alerts:
            formatted_alerts.append({
                "id": str(doc.get("_id", "")),
                "type": doc.get("alert_type", "anomaly"),
                "asset_id": doc.get("device_id", "Unknown"),
                "confidence": float(doc.get("confidence", 0.95)),
                "timestamp": str(doc.get("timestamp", datetime.utcnow().isoformat())),
                "severity": doc.get("severity", "high"),
                "message": doc.get("message", "Sensor reading exceeded anomaly reconstruction threshold"),
                "recommendation": "Check machine calibration and sensor circuit."
            })

        # If fraud_alerts is empty, fallback to anomaly records from sensor_data
        if not formatted_alerts:
            s_query = {"$or": [{"is_anomaly": True}, {"status": "critical"}]}
            if device_id:
                s_query = {"$and": [{"device_id": device_id}, s_query]}
            sensor_anoms = await db["sensor_data"].find(s_query).sort("timestamp", -1).limit(limit).to_list(length=limit)
            for idx, sdoc in enumerate(sensor_anoms):
                formatted_alerts.append({
                    "id": str(sdoc.get("_id", f"anom-{idx}")),
                    "type": "anomaly_spike",
                    "asset_id": sdoc.get("device_id", "Unknown"),
                    "confidence": 0.92,
                    "timestamp": str(sdoc.get("timestamp", datetime.utcnow().isoformat())),
                    "severity": "high",
                    "message": f"Sensor values (Temp: {sdoc.get('temperature')} C, Vib: {sdoc.get('vibration')}) exceeded normal bounds",
                    "recommendation": "Inspect physical equipment and verify hydraulic pressure."
                })

        return {"alerts": formatted_alerts, "count": len(formatted_alerts), "source": "mongodb"}
    except Exception as exc:
        return {"alerts": [], "count": 0, "error": str(exc)}

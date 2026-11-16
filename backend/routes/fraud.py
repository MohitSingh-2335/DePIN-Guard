import os
import math
from datetime import datetime, timezone
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
        conf_val = float(alert.confidence) if alert.confidence is not None else 80.0
        if 0.0 < conf_val <= 1.0:
            conf_val = round(conf_val * 100.0, 1)

        doc = {
            "device_id": alert.device_id or "unknown",
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message,
            "confidence": conf_val,
            "anomaly_data": alert.anomaly_data or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
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
            conf = doc.get("confidence")
            if conf is None:
                conf = doc.get("anomaly_data", {}).get("confidence", 80.0)
            conf_val = float(conf)
            if 0.0 < conf_val <= 1.0:
                conf_val = round(conf_val * 100.0, 1)

            formatted_alerts.append({
                "id": str(doc.get("_id", "")),
                "type": doc.get("alert_type", "anomaly"),
                "asset_id": doc.get("device_id", "Unknown"),
                "confidence": round(conf_val, 1),
                "timestamp": str(doc.get("timestamp", datetime.now(timezone.utc).isoformat())),
                "severity": doc.get("severity", "high"),
                "resolved": bool(doc.get("resolved", False)),
                "message": doc.get("message", "Sensor reading exceeded anomaly reconstruction threshold"),
                "recommendation": doc.get("recommendation", "Check machine calibration and sensor circuit.")
            })

        # If fraud_alerts is empty, fallback to anomaly records from sensor_data
        if not formatted_alerts:
            s_query = {"$or": [{"is_anomaly": True}, {"status": "critical"}]}
            if device_id:
                s_query = {"$and": [{"device_id": device_id}, s_query]}
            sensor_anoms = await db["sensor_data"].find(s_query).sort("timestamp", -1).limit(limit).to_list(length=limit)
            for idx, sdoc in enumerate(sensor_anoms):
                conf = sdoc.get("confidence")
                if conf is None or float(conf) == 0.0:
                    loss = float(sdoc.get("ai_loss", 0.0))
                    thresh = float(sdoc.get("ai_threshold", 0.205))
                    ratio = loss / thresh if thresh > 0 else 1.2
                    conf = 50.0 + 49.5 * (1.0 - math.exp(-0.65 * max(0.0, ratio - 1.0)))
                conf_val = float(conf)
                if 0.0 < conf_val <= 1.0:
                    conf_val = round(conf_val * 100.0, 1)

                formatted_alerts.append({
                    "id": str(sdoc.get("_id", f"anom-{idx}")),
                    "type": "anomaly_spike",
                    "asset_id": sdoc.get("device_id", "Unknown"),
                    "confidence": round(conf_val, 1),
                    "timestamp": str(sdoc.get("timestamp", datetime.now(timezone.utc).isoformat())),
                    "severity": sdoc.get("severity", "high"),
                    "message": sdoc.get("description", f"Sensor values (Temp: {sdoc.get('temperature')} C, Vib: {sdoc.get('vibration')}) exceeded normal bounds"),
                    "recommendation": sdoc.get("recommendation", "Inspect physical equipment and verify hydraulic pressure.")
                })

        return {"alerts": formatted_alerts, "count": len(formatted_alerts), "source": "mongodb"}
    except Exception as exc:
        return {"alerts": [], "count": 0, "error": str(exc)}


@router.post("/fraud-alerts/{alert_id}/resolve")
@router.post("/api/fraud-alerts/{alert_id}/resolve")
async def resolve_fraud_alert(alert_id: str):
    if db is None:
        return {"status": "error", "message": "Database not connected"}
    try:
        from bson import ObjectId
        query = {"_id": ObjectId(alert_id)} if ObjectId.is_valid(alert_id) else {"_id": alert_id}
        result = await db["fraud_alerts"].update_one(query, {"$set": {"resolved": True}})
        if result.matched_count == 0:
            result = await db["fraud_alerts"].update_one({"id": alert_id}, {"$set": {"resolved": True}})
        return {"status": "success", "resolved": True, "alert_id": alert_id}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}

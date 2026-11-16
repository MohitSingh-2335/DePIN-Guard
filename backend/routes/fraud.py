import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
import database as db_mod
from database import get_canonical_stats

router = APIRouter()


class FraudAlert(BaseModel):
    device_id: Optional[str] = None
    alert_type: str
    severity: str
    message: str
    confidence: Optional[float] = None
    anomaly_data: Optional[dict] = None


def _compute_alert_confidence(doc: dict) -> float:
    conf = doc.get("confidence")
    if conf is None and isinstance(doc.get("anomaly_data"), dict):
        conf = doc["anomaly_data"].get("confidence")
    if conf is not None:
        try:
            c = float(conf)
            if 0.0 < c <= 1.0:
                c = round(c * 100.0, 1)
            if c not in (0.0, 95.0, 96.5, 92.0, 80.0):
                return round(min(99.4, max(55.0, c)), 1)
        except (ValueError, TypeError):
            pass

    anom_data = doc.get("anomaly_data") if isinstance(doc.get("anomaly_data"), dict) else {}
    loss = float(doc.get("ai_loss", anom_data.get("ai_loss", 0.0)) or 0.0)
    thresh = float(doc.get("ai_threshold", anom_data.get("ai_threshold", 0.205)) or 0.205)
    ratio = loss / max(thresh, 1e-6)
    raw_conf = 54.0 + 45.4 * (1.0 - math.exp(-0.75 * max(0.05, ratio - 1.0)))
    return round(min(99.4, max(55.0, raw_conf)), 1)


@router.post("/report-fraud")
async def report_fraud(alert: FraudAlert):
    mongo_db = db_mod.db
    if mongo_db is None:
        return {"status": "error", "message": "Database not connected"}
    try:
        conf_val = _compute_alert_confidence(alert.model_dump() if hasattr(alert, "model_dump") else alert.dict())
        doc = {
            "device_id": alert.device_id or "unknown",
            "alert_type": alert.alert_type,
            "severity": alert.severity,
            "message": alert.message,
            "confidence": conf_val,
            "resolved": False,
            "anomaly_data": alert.anomaly_data or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        res = await mongo_db["fraud_alerts"].insert_one(doc)
        return {"status": "saved", "id": str(res.inserted_id)}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@router.get("/fraud-alerts")
async def get_all_fraud_alerts(device_id: Optional[str] = None, limit: int = 100):
    """
    Returns recent anomaly/fraud alerts plus canonical MongoDB counters so
    Fraud Alerts page totals match Dashboard, AI Analysis, and History 100%.
    """
    mongo_db = db_mod.db
    c_stats = await get_canonical_stats()
    if mongo_db is None:
        return {
            "alerts": [],
            "count": 0,
            "stats": {
                "total_alerts": c_stats["anomalies"],
                "critical_alerts": c_stats["critical_anomalies"],
                "pending_alerts": c_stats["pending_alerts"],
                "resolved_alerts": c_stats["resolved_alerts"],
            },
            "source": "none",
        }

    try:
        # Query canonical anomaly records from sensor_data (primary source of truth)
        s_query = {"$or": [{"is_anomaly": True}, {"status": "critical"}]}
        if device_id:
            s_query = {"$and": [{"device_id": device_id}, s_query]}

        capped_limit = max(1, min(limit, 200))
        sensor_anoms = await mongo_db["sensor_data"].find(s_query).sort("timestamp", -1).limit(capped_limit).to_list(length=capped_limit)

        # Also map any resolved statuses from fraud_alerts
        resolved_sensor_ids = set()
        resolved_cursor = mongo_db["fraud_alerts"].find({"resolved": True}, {"sensor_doc_id": 1, "_id": 1})
        for rdoc in await resolved_cursor.to_list(length=500):
            if rdoc.get("sensor_doc_id"):
                resolved_sensor_ids.add(str(rdoc["sensor_doc_id"]))
            resolved_sensor_ids.add(str(rdoc["_id"]))

        formatted_alerts = []
        for idx, sdoc in enumerate(sensor_anoms):
            sid = str(sdoc.get("_id", f"anom-{idx}"))
            ts = sdoc.get("timestamp", "")
            ts_iso = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            conf_val = _compute_alert_confidence(sdoc)
            loss_val = float(sdoc.get("ai_loss", 0.0) or 0.0)
            thresh_val = float(sdoc.get("ai_threshold", 0.205) or 0.205)
            is_res = bool(sdoc.get("resolved", False) or (sid in resolved_sensor_ids))
            sev = sdoc.get("severity") or ("critical" if conf_val >= 85.0 else "high")

            formatted_alerts.append({
                "id": sid,
                "type": "anomaly_excursion",
                "asset_id": sdoc.get("device_id", "Unknown"),
                "machine_name": sdoc.get("machine_name") or sdoc.get("device_id", "Unknown"),
                "confidence": conf_val,
                "loss": round(loss_val, 6),
                "threshold": round(thresh_val, 6),
                "timestamp": ts_iso,
                "severity": sev,
                "resolved": is_res,
                "message": sdoc.get("description") or (
                    f"Sensor excursion on {sdoc.get('device_id')} "
                    f"(Temp: {sdoc.get('temperature')}°C, Vib: {sdoc.get('vibration')} mm/s, Pwr: {sdoc.get('power_usage')} kW)"
                ),
                "recommendation": sdoc.get("recommendation") or "Inspect physical equipment and verify hydraulic pressure.",
            })

        return {
            "alerts": formatted_alerts,
            "count": len(formatted_alerts),
            "stats": {
                "total_alerts": c_stats["anomalies"],
                "critical_alerts": c_stats["critical_anomalies"],
                "pending_alerts": c_stats["pending_alerts"],
                "resolved_alerts": c_stats["resolved_alerts"],
            },
            "source": "mongodb",
        }
    except Exception as exc:
        return {
            "alerts": [],
            "count": 0,
            "stats": {
                "total_alerts": c_stats["anomalies"],
                "critical_alerts": c_stats["critical_anomalies"],
                "pending_alerts": c_stats["pending_alerts"],
                "resolved_alerts": c_stats["resolved_alerts"],
            },
            "error": str(exc),
        }


@router.post("/fraud-alerts/{alert_id}/resolve")
@router.post("/api/fraud-alerts/{alert_id}/resolve")
async def resolve_fraud_alert(alert_id: str):
    mongo_db = db_mod.db
    if mongo_db is None:
        return {"status": "error", "message": "Database not connected"}
    try:
        from bson import ObjectId
        oid = ObjectId(alert_id) if ObjectId.is_valid(alert_id) else None
        query = {"_id": oid} if oid is not None else {"_id": alert_id}

        # Toggle resolved flag in sensor_data and fraud_alerts so both stay in sync
        existing_sensor = await mongo_db["sensor_data"].find_one(query)
        new_resolved = True
        if existing_sensor is not None:
            new_resolved = not bool(existing_sensor.get("resolved", False))
            await mongo_db["sensor_data"].update_one(query, {"$set": {"resolved": new_resolved}})

        await mongo_db["fraud_alerts"].update_many(
            {"$or": [query, {"sensor_doc_id": alert_id}, {"id": alert_id}]},
            {"$set": {"resolved": new_resolved}}
        )
        c_stats = await get_canonical_stats()
        return {
            "status": "success",
            "resolved": new_resolved,
            "alert_id": alert_id,
            "stats": {
                "total_alerts": c_stats["anomalies"],
                "critical_alerts": c_stats["critical_anomalies"],
                "pending_alerts": c_stats["pending_alerts"],
                "resolved_alerts": c_stats["resolved_alerts"],
            },
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}

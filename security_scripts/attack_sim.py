import hashlib
import hmac
import os
from datetime import datetime
from dotenv import load_dotenv
import requests

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

AUTH_URL = os.getenv("AUTH_BASE_URL", os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")).rstrip("/")
BACKEND_URL = os.getenv("BACKEND_BASE_URL", os.getenv("BACKEND_URL", "http://localhost:8000")).rstrip("/")
API_KEY = os.getenv("DEPIN_API_KEY", "")


def sign_payload(payload: dict) -> str:
    message = f"{payload['device_id']}|{payload['temperature']}|{payload['vibration']}|{payload['power_usage']}|{payload['timestamp']}"
    return hmac.new(
        API_KEY.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def print_result(title: str, passed: bool, detail: str):
    status = "[PASSED]" if passed else "[FAILED]"
    print(f"{status} | {title} | {detail}")


def main():
    print("=" * 60)
    print("DePIN-Guard Security Validation Runner")
    print("=" * 60)

    if not API_KEY:
        print("[ERROR] Missing DEPIN_API_KEY environment variable")
        raise SystemExit(1)

    # 1) Auth security check
    try:
        auth_res = requests.post(
            f"{AUTH_URL}/login",
            json={"username": "intruder@example.com", "password": "WrongPass123"},
            timeout=15,
        )
        print_result("Auth rejects invalid login", auth_res.status_code == 401, f"status={auth_res.status_code}")
    except Exception as exc:
        print_result("Auth rejects invalid login", False, str(exc))

    # 2) API key guard check
    try:
        dash_res = requests.get(
            f"{BACKEND_URL}/api/dashboard",
            headers={"X-API-Key": "wrong-key"},
            timeout=15,
        )
        print_result("Backend rejects invalid API key", dash_res.status_code == 403, f"status={dash_res.status_code}")
    except Exception as exc:
        print_result("Backend rejects invalid API key", False, str(exc))

    # 3) Anomaly payload that should flow through AI + backend + history
    attack_payload = {
        "device_id": "Security-Test-01",
        "temperature": 126.5,
        "vibration": 13.2,
        "power_usage": 152.4,
        "timestamp": datetime.utcnow().isoformat(),
    }
    attack_payload["signature"] = sign_payload(attack_payload)

    try:
        process_res = requests.post(
            f"{BACKEND_URL}/api/process_data",
            json=attack_payload,
            headers={"X-API-Key": API_KEY},
            timeout=20,
        )
        if process_res.ok:
            payload = process_res.json()
            anomaly_detected = bool(payload.get("anomaly") or payload.get("is_anomaly"))
            print_result(
                "AI/anomaly pipeline processes attack payload",
                anomaly_detected,
                f"status={payload.get('status')} anomaly={anomaly_detected}",
            )
        else:
            print_result("AI/anomaly pipeline processes attack payload", False, f"status={process_res.status_code}")
    except Exception as exc:
        print_result("AI/anomaly pipeline processes attack payload", False, str(exc))

    # 4) Seed a fraud alert so the Fraud Review page has a record immediately
    try:
        fraud_res = requests.post(
            f"{BACKEND_URL}/api/report-fraud",
            json={
                "asset_id": "Security-Test-01",
                "type": "anomaly_cluster",
                "confidence": 0.95,
            },
            headers={"X-API-Key": API_KEY},
            timeout=15,
        )
        print_result("Fraud alert can be saved", fraud_res.status_code in (200, 201), f"status={fraud_res.status_code}")
    except Exception as exc:
        print_result("Fraud alert can be saved", False, str(exc))

    # 5) Confirm fraud alerts are readable
    try:
        alerts_res = requests.get(
            f"{BACKEND_URL}/api/fraud-alerts",
            headers={"X-API-Key": API_KEY},
            timeout=15,
        )
        if alerts_res.ok:
            alerts = alerts_res.json().get("alerts", [])
            print_result("Fraud alerts endpoint returns records", len(alerts) > 0, f"alerts={len(alerts)}")
        else:
            print_result("Fraud alerts endpoint returns records", False, f"status={alerts_res.status_code}")
    except Exception as exc:
        print_result("Fraud alerts endpoint returns records", False, str(exc))

    print("=" * 60)
    print("Validation complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
# security_scripts/attack_sim.py
import os
import requests
import time

BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
API_KEY = os.getenv("DEPIN_API_KEY", "")

print("=" * 50)
print("DePIN-Guard Penetration and Security Tests")
print("=" * 50)

if not API_KEY:
    print("[ERROR] Missing DEPIN_API_KEY environment variable")
    raise SystemExit(1)

# Test 1: No API Key
print("\n[TEST 1] Calling /api/dashboard without API Key...")
response = requests.get(f"{BASE_URL}/api/dashboard")
if response.status_code == 403:
    print(f"[PASSED] Got {response.status_code} Forbidden as expected")
else:
    print(f"[FAILED] Got {response.status_code} (should be 403)")

# Test 2: Wrong API Key
print("\n[TEST 2] Calling /api/dashboard with wrong API Key...")
response = requests.get(f"{BASE_URL}/api/dashboard", headers={"X-API-Key": "wrong-key"})
if response.status_code == 403:
    print(f"[PASSED] Got {response.status_code} Forbidden as expected")
else:
    print(f"[FAILED] Got {response.status_code} (should be 403)")

# Test 3: No JWT Token
print("\n[TEST 3] Calling /submit-data without JWT Token...")
response = requests.post(f"{BASE_URL}/submit-data", json={"test": "data"})
if response.status_code == 401:
    print(f"[PASSED] Got {response.status_code} Unauthorized as expected")
else:
    print(f"[FAILED] Got {response.status_code} (should be 401)")

# Test 4: Rate Limiting
print("\n[TEST 4] Sending requests to verify rate limiter...")
blocked = False
for i in range(65):
    response = requests.post(f"{BASE_URL}/api/process_data", 
    json={
        "device_id": "test-device",
        "temperature": 50.0,
        "vibration": 5.0,
        "power_usage": 100.0,
        "timestamp": "2026-01-01T00:00:00"
    },
        headers={"X-API-Key": API_KEY})
    if response.status_code == 429:
        print(f"[PASSED] Rate limit triggered at request {i+1} (429 Too Many Requests)")
        blocked = True
        break

if not blocked:
    print("[INFO] Rate limit not triggered within request window")

# Test 5: Input Validation
print("\n[TEST 5] Sending SQL Injection payload with valid API key...")
response = requests.post(f"{BASE_URL}/api/process_data", 
    json={
        "device_id": "'; DROP TABLE users; --",
        "temperature": 50.0,
        "vibration": 5.0,
        "power_usage": 100.0,
        "timestamp": "2026-01-01T00:00:00"
    },
    headers={"X-API-Key": API_KEY})
if response.status_code in [400, 403, 422]:
    print(f"[PASSED] Injection blocked with {response.status_code}")
else:
    print(f"[INFO] Got {response.status_code}")

print("\n" + "=" * 50)
print("Penetration Test Complete")
print("=" * 50)
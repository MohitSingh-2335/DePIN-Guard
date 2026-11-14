import os
import signal
import subprocess
import sys
import time
import urllib.request
from dotenv import load_dotenv

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

PYTHON_EXE = sys.executable


def wait_for_service(url: str, name: str, timeout: int = 15) -> bool:
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    print(f"Service {name} is active at {url}")
                    return True
        except Exception:
            time.sleep(1)
    print(f"Warning: Service {name} did not respond within {timeout} seconds.")
    return False


def main():
    print("==================================================")
    print("Starting DePIN-Guard Unified Autonomous Pipeline")
    print("==================================================")

    processes = []

    try:
        # 1. Start Auth Service (port 8001)
        print("Starting Auth Service on port 8001...")
        auth_proc = subprocess.Popen(
            [PYTHON_EXE, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"],
            cwd=os.path.join(ROOT_DIR, "auth-service"),
        )
        processes.append(auth_proc)

        # 2. Start Backend Service (port 8000)
        print("Starting Backend Service with in-memory AI engine on port 8000...")
        backend_proc = subprocess.Popen(
            [PYTHON_EXE, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=os.path.join(ROOT_DIR, "backend"),
        )
        processes.append(backend_proc)

        # 3. Wait for services to become healthy
        wait_for_service("http://127.0.0.1:8001/health", "Auth Service")
        wait_for_service("http://127.0.0.1:8000/api/health", "Backend Service")

        # 4. Start IoT Data Ingestion Streamer (continuous 24/7 dual dataset streamer)
        print("Starting IoT Industrial Data Ingestion Streamer...")
        env = os.environ.copy()
        env["CONTINUOUS_LOOP"] = "true"
        iot_proc = subprocess.Popen(
            [PYTHON_EXE, "data_ingestor.py"],
            cwd=os.path.join(ROOT_DIR, "iot"),
            env=env,
        )
        processes.append(iot_proc)

        print("\nAll DePIN-Guard services are running.")
        print("- Auth API:    http://localhost:8001")
        print("- Backend API: http://localhost:8000")
        print("- IoT Stream:  Active (continuous 24/7 mode)")
        print("Press Ctrl+C to stop all services.\n")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nStopping all DePIN-Guard services...")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        for p in processes:
            try:
                p.wait(timeout=3)
            except Exception:
                pass
        print("All services stopped.")


if __name__ == "__main__":
    main()

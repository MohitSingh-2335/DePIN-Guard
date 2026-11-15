import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from dotenv import load_dotenv

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

PYTHON_EXE = sys.executable


def ensure_models_trained():
    model_path = os.path.join(ROOT_DIR, "ai-service", "lstm_autoencoder.pth")
    scaler_path = os.path.join(ROOT_DIR, "ai-service", "scaler.save")
    metrics_path = os.path.join(ROOT_DIR, "ai-service", "metrics.json")

    if not (os.path.exists(model_path) and os.path.exists(scaler_path) and os.path.exists(metrics_path)):
        print("Model artifacts missing. Training LSTM Autoencoder on industrial dataset...")
        subprocess.run([PYTHON_EXE, "train.py"], cwd=os.path.join(ROOT_DIR, "ai-service"), check=True)
        print("LSTM Autoencoder trained successfully.")


def wait_for_service(url: str, name: str, timeout: int = 20) -> bool:
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
    print("Starting DePIN-Guard Unified Autonomous Stack")
    print("==================================================")

    ensure_models_trained()

    processes = []

    try:
        # 1. Start Backend Service (port 8000)
        print("Starting Backend Service (FastAPI + AI Engine + Auth) on port 8000...")
        backend_env = os.environ.copy()
        backend_env["AUTONOMOUS_FEEDER"] = "false"
        backend_proc = subprocess.Popen(
            [PYTHON_EXE, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=os.path.join(ROOT_DIR, "backend"),
            env=backend_env,
        )
        processes.append(backend_proc)

        # 2. Wait for Backend Service to become healthy
        wait_for_service("http://127.0.0.1:8000/api/health", "Backend Service")

        # 3. Start IoT Data Ingestion Streamer
        print("Starting IoT Industrial Data Ingestion Streamer...")
        iot_env = os.environ.copy()
        iot_env["CONTINUOUS_LOOP"] = "true"
        iot_proc = subprocess.Popen(
            [PYTHON_EXE, "data_ingestor.py"],
            cwd=os.path.join(ROOT_DIR, "iot"),
            env=iot_env,
        )
        processes.append(iot_proc)

        # 4. Start Frontend dev server if npm is installed
        npm_cmd = shutil.which("npm.cmd") or shutil.which("npm")
        if npm_cmd and os.path.exists(os.path.join(ROOT_DIR, "frontend", "package.json")):
            print("Starting React Frontend dev server on port 5173...")
            frontend_proc = subprocess.Popen(
                [npm_cmd, "run", "dev"],
                cwd=os.path.join(ROOT_DIR, "frontend"),
            )
            processes.append(frontend_proc)

        print("\nAll DePIN-Guard services are active.")
        print("- Backend API & Auth: http://localhost:8000")
        print("- Frontend Dashboard: http://localhost:5173")
        print("- IoT Streamer:       Active (continuous 24/7 dual dataset mode)")
        print("Press Ctrl+C to stop all services cleanly.\n")

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

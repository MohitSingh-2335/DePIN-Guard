# DePIN-Guard

Real-time Industrial IoT anomaly detection and tamper-proof audit framework using PyTorch LSTM autoencoders and Hyperledger Fabric blockchain.

Industrial IoT sensors face data tampering and silent mechanical failures across distributed facilities. DePIN-Guard captures multi-sensor telemetry, flags real-time equipment anomalies using an unsupervised PyTorch LSTM autoencoder, and logs cryptographic audit trails to a Hyperledger Fabric ledger. The model reconstructs normal sensor behavior and flags deviations exceeding an auto-calibrated 95th-percentile MSE threshold of 0.099316.

**Live Demo:** https://depin-guard-frontend.vercel.app/

## Verified Results

| Metric | Value | Dataset and Size | How It Was Measured | Source File |
|---|---|---|---|---|
| Reconstruction Error Threshold | 0.099316 | 10,000 normal synthetic readings | 95th percentile MSE loss on 30-step validation sequences | `ai-service/threshold.txt` |
| Input Features | 3 channels (temp, vib, power) | 10,000 synthetic readings | Scaled with MinMaxScaler across operational ranges | `ai-service/preprocessing.py` |
| Autoencoder Latent Dimension | 64 hidden units | 30-timestep sequences | Single-layer LSTM encoder and decoder | `ai-service/model.py` |
| Sequence Window Length | 30 timesteps | 10,000 normal synthetic readings | Sliding chronological window across sensor stream | `ai-service/train.py` |
| Training Iterations | 50 epochs | 10,000 rows (lr=0.001) | Adam optimizer minimizing MSE reconstruction loss | `ai-service/train.py` |
| Ingestion Rate Limit | 60 req / min | Per-client IP stream | SlowAPI rate limiter on sensor ingestion endpoints | `backend/main.py` |
| Inference API Verification | 35 requests passed (100%) | Synthetic test stream | Validates status 200, boolean flag, and numeric loss | `ai-service/test_integration.py` |

## How It Works

1. **Telemetry Generation:** Sensors generate readings (`temperature`, `vibration`, `power_usage`) with 25% synthetic anomaly injection.
2. **Backend Ingestion:** FastAPI validates payloads via Pydantic, checks API keys, and enforces 60 req/min rate limits.
3. **AI Inference:** The Flask AI service scales features with MinMaxScaler and computes PyTorch LSTM reconstruction MSE loss.
4. **Anomaly Evaluation:** Loss exceeding 0.099316 triggers an anomaly flag; if the AI service fails, backend falls back to rule limits (`temp > 100°C` or `vib > 10.0`).
5. **Ledger & Dashboard:** Verified events generate SHA-256 hashes submitted to Hyperledger Fabric, and WebSocket streams broadcast alerts to React.

An unsupervised LSTM autoencoder was selected over static thresholds because fixed bounds miss equipment-specific rhythmic variations, while autoencoders learn baseline operational dynamics without requiring labelled attack data.

## Features

- **Unsupervised Anomaly Detection:** PyTorch LSTM autoencoder reconstructs multi-channel sensor streams and flags deviations exceeding calibrated MSE bounds.
- **Microservice Architecture:** Decoupled FastAPI backend, Flask AI service, JWT/bcrypt auth service, and React 18 dashboard.
- **Fail-Safe Fallback:** Heuristic fallback (`temp > 100°C`, `vib > 10.0`) processes telemetry if the AI inference service is unreachable.
- **Immutable Ledger Logging:** Fabric manager submits SHA-256 anomaly transaction records to Hyperledger Fabric with in-memory simulation fallback.
- **Real-Time Streaming:** Live WebSocket updates deliver millisecond alerts and telemetry metrics directly to the dashboard.

## Tech Stack

Python, PyTorch, Flask, FastAPI, Pydantic, SlowAPI, APScheduler, Motor (MongoDB), React 18, Vite, Docker, Hyperledger Fabric.

## Run Locally

```bash
# 1. Clone repository
git clone https://github.com/MohitSingh-2335/DePIN-Guard.git
cd DePIN-Guard

# 2. Run AI Inference Service
cd ai-service
pip install -r requirements.txt
python app.py

# 3. Run Frontend Dashboard (in a second terminal)
cd ../frontend
npm install
npm run dev
```

## Tests

The repository contains 3 test files and 2 dedicated test functions:
- `ai-service/test_api.py`: 2 test functions (`test_predict`, `test_invalid_payload`) checking HTTP 200/400 responses and payload types.
- `ai-service/test_integration.py`: Integration smoke test sending 35 sequential POST requests to `/predict`.
- `iot/test_startup.py`: Startup validation script verifying environment variables, dependencies, and CSV parsing.

```bash
# Run AI inference API tests (requires AI service running on :10000)
python ai-service/test_api.py
python ai-service/test_integration.py

# Run IoT ingestor startup test
python iot/test_startup.py
```

## Project Structure

- `ai-service/`: PyTorch LSTM autoencoder, GNN prototype, and Flask inference service
- `auth-service/`: FastAPI authentication microservice with JWT and bcrypt
- `backend/`: FastAPI application, SlowAPI rate limiting, and Fabric manager
- `blockchain/`: Hyperledger Fabric network configurations and Go chaincode
- `docker/`: Container configurations and Mosquitto broker setup
- `docs/`: Deployment runbooks and implementation security audit
- `frontend/`: React 18 dashboard with Vite and real-time WebSocket client
- `iot/`: Sensor data ingestor, simulator, and human-readable formatter
- `scripts/`: Deployment verification and Docker blockchain initialization
- `security_scripts/`: Security audit scripts and attack simulation tools

## Limitations

- Mixed authentication model (API key on backend routes vs JWT on submit-data) increases configuration complexity (`docs/Security_Audit.md`).
- Rate limiting state is memory-bound with SlowAPI and resets on process restart (`docs/Security_Audit.md`).
- GNN fraud detection scheduled job in backend is currently a pending stub awaiting MongoDB transaction graph pipeline (`backend/main.py`).
- Online microservice evaluates readings point-by-point (`seq_length=1`) rather than the 30-timestep sliding window used in offline training (`ai-service/app.py`).

---

Mohit Singh | GitHub: https://github.com/MohitSingh-2335 | LinkedIn: https://www.linkedin.com/in/mohit-singh-172548253/ | Portfolio: https://mohitsingh-2335.github.io/

<div align="center">

# 🛡️ DePIN-Guard

### Decentralized Physical Infrastructure Network — AI-Powered IIoT Security Framework

[![Hyperledger Fabric](https://img.shields.io/badge/Hyperledger_Fabric-2.x-2F3134?style=flat-square&logo=hyperledger&logoColor=white)](https://www.hyperledger.org/projects/fabric)
[![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**Final Year Project · B.Tech CSE · Babu Banarasi Das University · Team of 4**

</div>

---

## 🔍 The Problem

Industrial IoT deployments face a **"trust deficit"** — thousands of sensors spread across factories, with no way to verify the data they send is genuine. A single compromised sensor can silently cause equipment failures, safety incidents, or financial fraud while logs show everything is normal.

**DePIN-Guard answers two questions:**
1. *How do you detect when a sensor is sending fake or anomalous data — in real time?*
2. *How do you prove, permanently and tamper-proof, that it happened?*

**Answer: Blockchain + AI.**

---

## 🏗️ Architecture

```
  5 IoT Devices (Simulated · 1 reading/sec · 25% anomaly rate)
         │
         ▼
  ┌─────────────────────────────────┐
  │    FastAPI Backend (:8000)      │  ← API Key auth · Rate limit 60 req/min
  │    Pydantic validation          │  ← Input sanitization
  └────────┬───────────────┬────────┘
           │               │
           ▼               ▼
  ┌──────────────┐  ┌───────────────────┐
  │  AI Service  │  │ Hyperledger Fabric│
  │  Flask :5000 │  │  Blockchain Ledger│
  │              │  │                   │
  │ LSTM         │  │ Anomaly → Block   │
  │ Autoencoder  │  │ (tamper-proof)    │
  └──────┬───────┘  └───────────────────┘
         │  is_anomaly?
         ▼
  ┌──────────────────────┐    every 5 min
  │  GNN Fraud Detector  │ ◄──────────────── APScheduler
  │  (Graph Conv. Net)   │  scans blockchain
  └──────────────────────┘  for collusion patterns
         │
         ▼
  ┌─────────────────────────────────┐
  │  React Dashboard (:5173)        │  ← Live WebSocket alerts
  │  Blockchain Explorer            │  ← Block hash chain viewer
  │  AI Analysis page               │  ← Anomaly confidence scores
  └─────────────────────────────────┘
```

---

## 🧠 My Role — AI Specialist

> *This was a 4-person team. I owned the entire AI layer.*

### LSTM Autoencoder (Real-Time Anomaly Detection)
- Built an **LSTM Autoencoder** (PyTorch) trained on **10,000 rows** of normal IoT sensor data
- Architecture: Encoder → Latent space (dim 64) → Decoder · input features: temperature, vibration, power usage
- Detection method: **Reconstruction error (MSE)** — if the model can't reconstruct a reading accurately, it's anomalous
- Threshold auto-calibrated on a validation set and saved to `threshold.txt` — no hardcoding
- Served as a **Flask microservice** at `/predict` — returns `is_anomaly`, `loss`, and `threshold` per reading
- Fault-tolerant: backend has `try/except` fallback to threshold rules if AI service goes offline

### GNN Fraud Detector (Systemic Pattern Analysis)
- Built a **Graph Convolutional Network** (PyTorch Geometric) that runs **every 5 minutes** via APScheduler
- Fetches full blockchain history → builds a transaction graph → identifies anomaly clusters and collusion rings
- Catches coordinated fraud that per-sensor LSTM analysis would miss (e.g., multiple sensors compromised by same attacker)

### Why LSTM over a simple threshold?
> A rule like "alert if temp > 80°C" misses context. A temperature of 75°C might be safe for Device-001 but critical for Device-003. The LSTM learns each device's **temporal rhythm** over a 30-point sliding window and flags anything that breaks that pattern — **no labelled attack data needed** (unsupervised).

---

## 📊 Key Metrics

| Metric | Value |
|--------|-------|
| Training data size | 10,000 rows of normal sensor data |
| Devices simulated | 5 (Device-001 to Device-005) |
| Anomaly injection rate | 25% (every ~4th reading is an attack) |
| Normal temp range | 20–60°C · Anomaly: 95–120°C |
| Backend rate limit | 60 requests/minute per IP (SlowAPI) |
| GNN scan interval | Every 5 minutes (APScheduler) |
| Auth layers | API Key + JWT + bcrypt + TLS MQTT |

---

## ✨ Features

| Feature | What It Does |
|---------|-------------|
| 🧠 **LSTM Autoencoder** | Unsupervised real-time anomaly detection via MSE reconstruction error |
| 🕸️ **GNN Fraud Detection** | Scheduled blockchain graph scan for collusion and coordinated attack patterns |
| 🔗 **Hyperledger Fabric** | Tamper-proof, cryptographically immutable audit trail for every anomaly event |
| ⚡ **Live WebSocket Stream** | React dashboard receives alerts the millisecond an anomaly is detected |
| 🔐 **Defense-in-Depth** | API Key · JWT · Rate limiting · TLS MQTT · Pydantic validation · Audit logging |
| 🐳 **One-Command Deploy** | Full 4-service stack via `docker-compose up --build` |
| 🔁 **Fault Tolerance** | AI crash → backend falls back to threshold rules. Fabric unavailable → in-memory chain simulation |

---

## 🏗️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| AI/ML | PyTorch · LSTM Autoencoder · GCN (PyTorch Geometric) | Industry standard, CUDA-ready |
| Blockchain | Hyperledger Fabric 2.x · Go Chaincode | Permissioned, enterprise-grade, no gas fees |
| Backend | FastAPI · Python · SlowAPI · APScheduler | Async, auto-docs, background scheduling |
| AI Service | Flask · Python | Lightweight inference microservice |
| Frontend | React 18 · Vite · WebSocket | Fast, component-based, real-time |
| Auth | JWT · bcrypt · API Key | Multi-layer security |
| IoT | MQTT · TLS (port 8883) · Python Simulator | Industry standard encrypted IoT messaging |
| Infrastructure | Docker · Docker Compose · SQLite | One-command deployment |

---

## 👥 Team Roles

| Member | Role | Responsibilities |
|--------|------|-----------------|
| **Mohit** *(me)* | AI Specialist | LSTM Autoencoder, GNN fraud detector, training pipeline, AI microservice |
| Priyanshu | Backend + Blockchain | FastAPI backend, Hyperledger Fabric, Go chaincode, Docker orchestration |
| Prateek | Security | Auth service, TLS certificates, rate limiting, penetration testing |
| Vineet | Frontend + IoT | React dashboard, WebSocket client, IoT simulator |

---

## 🚀 Quick Start

```bash
git clone https://github.com/MohitSingh-2335/DePIN-Guard.git
cd DePIN-Guard
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| API + Docs | http://localhost:8000/docs |
| AI Service | http://localhost:5000 |

---

## 📂 Project Structure

```
DePIN-Guard/
├── ai-service/       # 🧠 LSTM Autoencoder + GNN (Mohit's work)
├── auth-service/     # JWT + bcrypt authentication microservice
├── backend/          # FastAPI · WebSocket · APScheduler · SQLite
├── blockchain/       # Hyperledger Fabric network + Go chaincode
├── frontend/         # React 18 dashboard · Live charts · Block explorer
├── iot-simulator/    # 5-device sensor simulator · 25% anomaly injection
└── docker-compose.yml
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

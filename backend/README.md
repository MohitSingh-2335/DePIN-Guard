DePIN-Guard

A decentralized framework for secure Industrial IoT (IIoT) monitoring and anomaly detection, built with Blockchain, AI, and a Full-Stack application. This is a final year project developed by a team of four.

About The Project

DePIN-Guard addresses the "trust deficit" and security vulnerabilities in traditional, centralized IIoT systems. By integrating Hyperledger Fabric, Artificial Intelligence, and IoT, this project creates a verifiable, tamper-proof, and intelligent monitoring platform. It is designed to be the foundational trust layer for a future Decentralized Physical Infrastructure Network (DePIN).

Our system captures sensor data, anchors its integrity on a blockchain, and uses a sophisticated dual-AI engine to detect threats in real-time.

Key Features

Immutable Ledger: Uses Hyperledger Fabric to create a tamper-proof, immutable audit trail for all sensor data, preventing unauthorized manipulation.

Dual AI Engine:

LSTM Autoencoder: A real-time model for detecting operational anomalies in live sensor data (e.g., equipment malfunction).

Graph Neural Network (GNN): An advanced model for detecting systemic, long-term fraud by analyzing patterns in the blockchain's transaction graph.

Full-Stack Dashboard: A real-time monitoring dashboard built with a FastAPI backend and React frontend, featuring live alerts, data visualization, and a verifiable history for every asset.

End-to-End Security: Implements a defense-in-depth security model using TLS for encrypted communication, JWT for user authentication, and Fabric policies for on-chain governance.

Technology Stack

Blockchain: Hyperledger Fabric, Go (Chaincode)

AI: PyTorch (LSTM, GNN), Scikit-learn, Pandas

Backend: FastAPI (Python), WebSockets

Frontend: React, TypeScript, Chakra UI, Recharts

IoT & Comms: Python (paho-mqtt), Mosquitto (MQTT Broker)

Infrastructure: Docker, Docker Compose

Our Team

Mohit: AI Specialist

Prateek: Cybersecurity Specialist

Priyanshu: Full-Stack (Backend & Blockchain)

Vineet: Full-Stack (Frontend & IoT)


Intial DATA CONTRACT

{
  "deviceID": "ASSET-001",
  "timestamp": "2025-10-26T10:00:00Z",
  "temperature": 45.5,
  "vibration": 30.2
}





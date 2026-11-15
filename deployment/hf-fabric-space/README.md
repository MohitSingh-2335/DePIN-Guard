---
title: DePIN-Guard Fabric Gateway
emoji: ⛓️
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
---

# DePIN-Guard Hyperledger Fabric Gateway & Explorer

This Hugging Face Space hosts the consortium blockchain state gateway for **DePIN-Guard**.

## Capabilities:
* **FastAPI Endpoints:**
  * `GET /health` (24/7 Uptime target)
  * `POST /api/record-sensor` (Commit sensor state hash)
  * `POST /api/record-fraud` (Commit immutable fraud flag)
  * `GET /api/blocks` (Query transaction ledger)
  * `GET /api/network-status` (Consortium node health)
* **Interactive UI:**
  * Real-time Block Explorer table powered by Gradio.

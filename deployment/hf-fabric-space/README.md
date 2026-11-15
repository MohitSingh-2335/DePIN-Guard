---
title: DePIN-Guard Hyperledger Fabric Ledger
emoji: ⛓️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# DePIN-Guard: Hyperledger Fabric 2.5 REST Gateway

Autonomous, 24/7 cloud ledger settlement node for DePIN-Guard IoT security network.

## Endpoints:
- `GET /health`: Uptime monitoring endpoint (ping every 5 mins with UptimeRobot for 24/7 uptime)
- `GET /api/network-status`: Query ledger height and consortium peer status
- `POST /api/record-sensor`: Commit immutable sensor hash records to Fabric block
- `POST /api/record-fraud`: Commit fraud/anomaly flags to Fabric block
- `GET /api/blocks`: Retrieve verified committed blocks from ledger

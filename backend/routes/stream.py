import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
active_connections = []
latest_telemetry = None


@router.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)

    # Send latest telemetry immediately upon connecting
    if latest_telemetry:
        try:
            await websocket.send_json(latest_telemetry)
        except Exception:
            pass

    try:
        while True:
            await asyncio.sleep(1)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)


async def broadcast_data(data: dict):
    global latest_telemetry
    latest_telemetry = data

    dead = []
    for connection in active_connections:
        try:
            await connection.send_json(data)
        except Exception:
            dead.append(connection)

    for conn in dead:
        if conn in active_connections:
            active_connections.remove(conn)

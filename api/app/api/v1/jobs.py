from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.infrastructure.repositories.pg_job_repo import PgJobRepository

router = APIRouter()
repo = PgJobRepository()


@router.get("/{project_id}")
async def list_jobs(project_id: UUID):
    return await repo.list_by_project(project_id)


@router.websocket("/ws/status")
async def job_status_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # Echo de status — implementar LISTEN/NOTIFY aqui
            await websocket.send_text(f"ack:{data}")
    except WebSocketDisconnect:
        pass

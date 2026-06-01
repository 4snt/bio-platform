from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.domain.sample.entities import Project
from app.domain.shared.value_objects import MarkerType, ProjectCode
from app.infrastructure.repositories.pg_project_repo import PgProjectRepository

router = APIRouter()
repo = PgProjectRepository()


class CreateProjectRequest(BaseModel):
    code: str
    name: str
    marker_type: MarkerType


@router.get("/")
async def list_projects():
    projects = await repo.get_all()
    return [
        {"id": str(p.id), "code": p.code, "name": p.name,
         "marker_type": p.marker_type, "status": p.status}
        for p in projects
    ]


@router.get("/{project_id}")
async def get_project(project_id: UUID):
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return {"id": str(project.id), "code": project.code, "name": project.name,
            "marker_type": project.marker_type, "status": project.status}


@router.post("/", status_code=201)
async def create_project(body: CreateProjectRequest):
    project = Project(
        code=ProjectCode(body.code),
        name=body.name,
        marker_type=body.marker_type,
    )
    await repo.save(project)
    return {"id": str(project.id)}

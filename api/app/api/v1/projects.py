from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth_deps import require_admin
from app.core.ncbi_entrez import list_sra_runs as ncbi_list_sra_runs
from app.domain.sample.entities import Project, ProjectAnalysis
from app.domain.shared.value_objects import MarkerType, ProjectCode
from app.infrastructure.repositories.pg_project_repo import PgProjectRepository

router = APIRouter()
repo = PgProjectRepository()


def _project_dict(p: Project) -> dict:
    return {
        "id":                   str(p.id),
        "code":                 p.code,
        "name":                 p.name,
        "description":          p.description,
        "marker_type":          p.marker_type,
        "status":               p.status,
        "bioproject_accession": p.bioproject_accession,
        "author": {
            "name":       p.author_name,
            "avatar_url": p.author_avatar_url,
        } if p.author_name else None,
        "analyses": [
            {"analysis_type": a.analysis_type, "charts": a.charts}
            for a in p.analyses
        ],
    }


class AnalysisConfig(BaseModel):
    analysis_type: str
    charts: list[str] = []


class CreateProjectRequest(BaseModel):
    code: str
    name: str
    description: str = ""
    marker_type: MarkerType
    bioproject_accession: str | None = None
    analyses: list[AnalysisConfig] = []


@router.get("/")
async def list_projects():
    projects = await repo.get_all()
    return [_project_dict(p) for p in projects]


@router.get("/{project_id}")
async def get_project(project_id: UUID):
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return _project_dict(project)


@router.get("/{project_id}/sra-runs")
async def list_project_sra_runs(project_id: UUID):
    """Lista SRR runs do BioProject associado ao projeto."""
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if not project.bioproject_accession:
        return {"bioproject": None, "runs": []}
    try:
        runs = await ncbi_list_sra_runs(project.bioproject_accession)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar NCBI: {e}")
    return {"bioproject": project.bioproject_accession, "runs": runs}


@router.post("/", status_code=201)
async def create_project(
    body: CreateProjectRequest,
    _admin: dict = Depends(require_admin),
):
    project = Project(
        code=ProjectCode(body.code),
        name=body.name,
        description=body.description,
        marker_type=body.marker_type,
        bioproject_accession=body.bioproject_accession or None,
        created_by=UUID(_admin["user_id"]),
        analyses=[
            ProjectAnalysis(analysis_type=a.analysis_type, charts=a.charts)
            for a in body.analyses
        ],
    )
    await repo.save(project)
    return {"id": str(project.id)}

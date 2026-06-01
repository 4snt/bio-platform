import re
from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.minio import generate_presigned_upload, list_objects
from app.domain.sample.services import SampleParser
from app.domain.sample.entities import Sample
from app.infrastructure.repositories.pg_sample_repo import PgSampleRepository
from app.infrastructure.repositories.pg_project_repo import PgProjectRepository

router = APIRouter()
parser      = SampleParser()
sample_repo = PgSampleRepository()
project_repo = PgProjectRepository()


class PresignedPairRequest(BaseModel):
    r1_filename: str
    project_id: UUID


class ConfirmPairRequest(BaseModel):
    project_id: UUID
    r1_key: str
    r2_key: str
    r1_filename: str


@router.post("/presigned-pair")
async def get_presigned_pair(body: PresignedPairRequest):
    filename = body.r1_filename

    # Validação: deve ser um arquivo R1
    if not re.search(r'_R1[_.]', filename):
        raise HTTPException(
            status_code=422,
            detail="Arquivo deve ser o R1 do par (deve conter _R1_ no nome).",
        )

    # Parse do filename
    try:
        parsed = parser.parse(filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Busca projeto para validar marcador e obter code
    project = await project_repo.get_by_id(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    if parsed.marker_type != project.marker_type.value:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Marcador do arquivo ({parsed.marker_type}) não corresponde "
                f"ao projeto ({project.marker_type.value})."
            ),
        )

    # Deriva R2
    r2_filename = re.sub(r'_R1(_\d+\.fastq)', r'_R2\1', filename)
    if r2_filename == filename:
        r2_filename = re.sub(r'_R1(\.fastq)', r'_R2\1', filename)

    # Monta chaves no MinIO usando o code do projeto
    r1_key = f"{project.code}/{filename}"
    r2_key = f"{project.code}/{r2_filename}"

    return {
        "r1": {"upload_url": generate_presigned_upload("fastq-raw", r1_key), "key": r1_key},
        "r2": {"upload_url": generate_presigned_upload("fastq-raw", r2_key), "key": r2_key},
        "parsed": {
            "marker_type":     parsed.marker_type,
            "sample_number":   parsed.sample_number,
            "treatment_group": parsed.treatment_group,
            "replicate":       parsed.replicate,
            "read_pair":       parsed.read_pair,
        },
    }


@router.post("/confirm-pair")
async def confirm_pair(body: ConfirmPairRequest):
    try:
        parsed = parser.parse(body.r1_filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    sample = Sample(
        project_id=body.project_id,
        filename=body.r1_filename,
        treatment_group=parsed.treatment_group,
        replicate=parsed.replicate,
        fastq_r1_key=body.r1_key,
        fastq_r2_key=body.r2_key,
    )

    try:
        await sample_repo.save(sample)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar amostra: {e}")

    return {
        "sample_id":       str(sample.id),
        "treatment_group": sample.treatment_group,
        "replicate":       sample.replicate,
    }


@router.get("/{project_id}/artifacts")
async def list_artifacts(project_id: UUID):
    """Lista artefatos disponíveis no MinIO para o projeto (phyloseq.rds, etc.)."""
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    prefix = f"{project.code}/"
    keys   = list_objects("pipeline-artifacts", prefix)

    # Caminho padrão que o QIIME2 vai gerar
    default_key = f"pipeline-artifacts/{project.code}/phyloseq.rds"

    return {
        "default_key": default_key,
        "available":   [f"pipeline-artifacts/{k}" for k in keys],
        "project_code": str(project.code),
    }


@router.get("/{project_id}")
async def list_samples(project_id: UUID):
    samples = await sample_repo.list_by_project(project_id)
    result = []
    for s in samples:
        row = {}
        for k, v in s.items():
            if hasattr(v, 'isoformat'):
                row[k] = v.isoformat()
            else:
                row[k] = str(v) if not isinstance(v, (int, float, bool, type(None))) else v
        result.append(row)
    return result

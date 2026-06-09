import re
from uuid import UUID
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.core.pg_storage import upload_lo
from app.core.config import settings
from app.domain.sample.services import SampleParser
from app.domain.sample.entities import Sample
from app.infrastructure.repositories.pg_sample_repo import PgSampleRepository
from app.infrastructure.repositories.pg_project_repo import PgProjectRepository
from app.core.database import get_pool

router = APIRouter()
parser       = SampleParser()
sample_repo  = PgSampleRepository()
project_repo = PgProjectRepository()

_MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024


@router.post("/upload-pair")
async def upload_pair(
    r1: UploadFile = File(...),
    r2: UploadFile = File(...),
    project_id: UUID = Form(...),
):
    filename = r1.filename or ""

    if not re.search(r'_R1[_.]', filename):
        raise HTTPException(
            status_code=422,
            detail="Arquivo deve ser o R1 do par (deve conter _R1_ no nome).",
        )

    try:
        parsed = parser.parse(filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    project = await project_repo.get_by_id(project_id)
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

    r1_bytes = await r1.read()
    r2_bytes = await r2.read()

    if len(r1_bytes) > _MAX_BYTES or len(r2_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo excede o limite de {settings.max_upload_size_mb} MB.",
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            r1_oid = await conn.fetchval("SELECT lo_create(0)")
            await conn.execute("SELECT lo_put($1, 0, $2)", r1_oid, r1_bytes)
            r2_oid = await conn.fetchval("SELECT lo_create(0)")
            await conn.execute("SELECT lo_put($1, 0, $2)", r2_oid, r2_bytes)

            sample = Sample(
                project_id=project_id,
                filename=filename,
                treatment_group=parsed.treatment_group,
                replicate=parsed.replicate,
                fastq_r1_oid=r1_oid,
                fastq_r2_oid=r2_oid,
            )
            await conn.execute(
                """
                INSERT INTO samples
                  (id, project_id, filename, treatment_group, replicate, fastq_r1_oid, fastq_r2_oid)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                sample.id,
                sample.project_id,
                sample.filename,
                sample.treatment_group,
                sample.replicate,
                sample.fastq_r1_oid,
                sample.fastq_r2_oid,
            )

    return {
        "sample_id":       str(sample.id),
        "treatment_group": sample.treatment_group,
        "replicate":       sample.replicate,
        "parsed": {
            "marker_type":     parsed.marker_type,
            "sample_number":   parsed.sample_number,
            "treatment_group": parsed.treatment_group,
            "replicate":       parsed.replicate,
            "read_pair":       parsed.read_pair,
        },
    }


@router.post("/artifact-upload")
async def artifact_upload(
    file: UploadFile = File(...),
    project_id: UUID = Form(...),
):
    if not (file.filename or "").endswith(".rds"):
        raise HTTPException(status_code=422, detail="Apenas arquivos .rds são aceitos.")

    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo excede o limite de {settings.max_upload_size_mb} MB.",
        )

    oid = await upload_lo(data)

    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE pipeline_jobs
            SET phyloseq_oid = $1
            WHERE project_id = $2
              AND status IN ('queued', 'done')
              AND id = (
                SELECT id FROM pipeline_jobs
                WHERE project_id = $2
                ORDER BY created_at DESC
                LIMIT 1
              )
            """,
            oid,
            project_id,
        )

    return {"oid": oid, "project_id": str(project_id)}


@router.get("/{project_id}/artifacts")
async def list_artifacts(project_id: UUID):
    project = await project_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado.")

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, phyloseq_oid, created_at
            FROM pipeline_jobs
            WHERE project_id = $1 AND phyloseq_oid IS NOT NULL
            ORDER BY created_at DESC
            """,
            project_id,
        )

    artifacts = [
        {
            "job_id":       str(r["id"]),
            "phyloseq_oid": r["phyloseq_oid"],
            "created_at":   r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]

    return {
        "available":    artifacts,
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

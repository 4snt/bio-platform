import re
from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.minio import generate_presigned_upload
from app.domain.sample.services import SampleParser
from app.domain.sample.entities import Sample
from app.infrastructure.repositories.pg_sample_repo import PgSampleRepository

router = APIRouter()
parser = SampleParser()
repo = PgSampleRepository()


class PresignedUploadRequest(BaseModel):
    filename: str
    project_id: UUID


class PresignedPairRequest(BaseModel):
    r1_filename: str
    project_id: UUID


class ConfirmPairRequest(BaseModel):
    project_id: UUID
    r1_key: str
    r2_key: str
    r1_filename: str


@router.post("/presigned-upload")
async def get_presigned_upload(body: PresignedUploadRequest):
    try:
        parsed = parser.parse(body.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    key = f"{parsed.project_code}/{body.filename}"
    url = generate_presigned_upload("fastq-raw", key)
    return {
        "upload_url": url,
        "key": key,
        "expires_in": 3600,
        "parsed": {
            "project_code": str(parsed.project_code),
            "treatment_group": parsed.treatment_group,
            "replicate": parsed.replicate,
            "read_pair": parsed.read_pair,
        },
    }


@router.post("/presigned-pair")
async def get_presigned_pair(body: PresignedPairRequest):
    filename = body.r1_filename
    # Validate that filename ends with _R1.fastq.gz or _R1.fastq
    if not re.search(r'_R1\.fastq(\.gz)?$', filename):
        raise HTTPException(
            status_code=422,
            detail="r1_filename deve terminar em _R1.fastq.gz ou _R1.fastq",
        )

    try:
        parsed = parser.parse(filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Derive R2 filename
    r2_filename = re.sub(r'_R1(\.fastq(?:\.gz)?)$', r'_R2\1', filename)

    r1_key = f"{parsed.project_code}/{filename}"
    r2_key = f"{parsed.project_code}/{r2_filename}"

    r1_url = generate_presigned_upload("fastq-raw", r1_key)
    r2_url = generate_presigned_upload("fastq-raw", r2_key)

    return {
        "r1": {"upload_url": r1_url, "key": r1_key},
        "r2": {"upload_url": r2_url, "key": r2_key},
        "parsed": {
            "project_code": str(parsed.project_code),
            "treatment_group": parsed.treatment_group,
            "replicate": parsed.replicate,
            "read_pair": parsed.read_pair,
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
        await repo.save(sample)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar amostra: {e}")

    return {
        "sample_id": str(sample.id),
        "treatment_group": sample.treatment_group,
        "replicate": sample.replicate,
    }


@router.get("/{project_id}")
async def list_samples(project_id: UUID):
    samples = await repo.list_by_project(project_id)
    # Serialize UUIDs and datetimes to strings
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

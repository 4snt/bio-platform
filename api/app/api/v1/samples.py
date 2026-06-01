from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.minio import generate_presigned_upload
from app.domain.sample.services import SampleParser

router = APIRouter()
parser = SampleParser()


class PresignedUploadRequest(BaseModel):
    filename: str
    project_id: UUID


@router.post("/presigned-upload")
async def get_presigned_upload(body: PresignedUploadRequest):
    try:
        parsed = parser.parse(body.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    key = f"{parsed.project_code}/{body.filename}"
    url = generate_presigned_upload("fastq-raw", key)
    return {"upload_url": url, "key": key, "parsed": {
        "project_code": parsed.project_code,
        "treatment_group": parsed.treatment_group,
        "read_pair": parsed.read_pair,
    }}

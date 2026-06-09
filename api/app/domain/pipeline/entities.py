from dataclasses import dataclass, field
from uuid import UUID, uuid4
from enum import Enum


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


@dataclass
class PipelineJob:
    project_id: UUID
    job_type: str
    payload: dict
    id: UUID = field(default_factory=uuid4)
    status: JobStatus = JobStatus.QUEUED
    phyloseq_oid: int | None = None
    error_msg: str | None = None

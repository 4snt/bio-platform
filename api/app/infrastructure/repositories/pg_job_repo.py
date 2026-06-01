from uuid import UUID
from app.core.database import get_pool
from app.domain.pipeline.entities import PipelineJob, JobStatus


class PgJobRepository:
    async def enqueue(self, job: PipelineJob) -> None:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO pipeline_jobs (id, project_id, job_type, status, payload)
                VALUES ($1, $2, $3, $4, $5)
                """,
                job.id, job.project_id, job.job_type,
                job.status.value, job.payload,
            )

    async def list_by_project(self, project_id: UUID) -> list[dict]:
        pool = get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM pipeline_jobs WHERE project_id = $1 ORDER BY created_at DESC",
                project_id,
            )
        return [dict(r) for r in rows]

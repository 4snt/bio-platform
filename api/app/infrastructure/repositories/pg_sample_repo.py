from uuid import UUID
from app.core.database import get_pool
from app.domain.sample.entities import Sample


class PgSampleRepository:
    async def save(self, sample: Sample) -> None:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO samples (id, project_id, filename, treatment_group, replicate, fastq_r1_key, fastq_r2_key)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                sample.id,
                sample.project_id,
                sample.filename,
                sample.treatment_group,
                sample.replicate,
                sample.fastq_r1_key,
                sample.fastq_r2_key,
            )

    async def list_by_project(self, project_id: UUID) -> list[dict]:
        pool = get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM samples WHERE project_id = $1 ORDER BY created_at DESC",
                project_id,
            )
        return [dict(r) for r in rows]

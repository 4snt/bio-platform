from uuid import UUID
from app.core.database import get_pool
from app.domain.sample.entities import Project
from app.domain.shared.value_objects import MarkerType, ProjectCode


class PgProjectRepository:
    async def get_all(self) -> list[Project]:
        pool = get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM projects ORDER BY created_at DESC")
        return [self._to_entity(r) for r in rows]

    async def get_by_id(self, project_id: UUID) -> Project | None:
        pool = get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM projects WHERE id = $1", project_id)
        return self._to_entity(row) if row else None

    async def save(self, project: Project) -> None:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO projects (id, code, name, marker_type, status)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO UPDATE
                SET name = EXCLUDED.name, status = EXCLUDED.status
                """,
                project.id, str(project.code), project.name,
                project.marker_type.value, project.status,
            )

    def _to_entity(self, row) -> Project:
        return Project(
            id=row["id"],
            code=ProjectCode(row["code"]),
            name=row["name"],
            marker_type=MarkerType(row["marker_type"]),
            status=row["status"],
        )

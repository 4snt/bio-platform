from uuid import UUID
from fastapi import APIRouter, HTTPException
from app.core.database import get_pool
from app.core.elasticsearch import get_es_client

router = APIRouter()


@router.get("/{job_id}/results")
async def get_analysis_results(job_id: UUID):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM analysis_results WHERE job_id = $1", job_id
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Resultados não encontrados")
    return [dict(r) for r in rows]


@router.get("/search/degs")
async def search_degs(q: str, project: str | None = None):
    es = get_es_client()
    must = [{"match": {"gene_id": q}}]
    if project:
        must.append({"term": {"project": project}})

    result = await es.search(index="degs", body={"query": {"bool": {"must": must}}})
    return [hit["_source"] for hit in result["hits"]["hits"]]

import json
from uuid import UUID
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.database import get_pool
from app.core.elasticsearch import get_es_client
from app.core.ncbi_taxonomy import batch_taxid_lookup

router = APIRouter()


def _serialize_row(row: dict) -> dict:
    result = {}
    for k, v in row.items():
        if k == 'result_data' and isinstance(v, str):
            v = json.loads(v)
        elif hasattr(v, 'isoformat'):
            v = v.isoformat()
        elif isinstance(v, UUID):
            v = str(v)
        result[k] = v
    return result


@router.get("/{job_id}/results")
async def get_analysis_results(job_id: UUID):
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM analysis_results WHERE job_id = $1", job_id
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Resultados não encontrados")
    return [_serialize_row(dict(r)) for r in rows]


class TaxonomyEnrichRequest(BaseModel):
    names: list[str]


@router.post("/taxonomy/enrich")
async def enrich_taxonomy(body: TaxonomyEnrichRequest):
    """
    Busca TaxID e lineage NCBI para lista de nomes taxonômicos.
    Aceita strings SILVA/UNITE com prefixos (k__, p__, etc.).
    Máximo de 50 nomes por chamada.
    """
    if not body.names:
        raise HTTPException(status_code=422, detail="Lista de nomes não pode ser vazia.")
    try:
        results = await batch_taxid_lookup(body.names)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar NCBI Taxonomy: {e}")
    return {"results": results, "total": len(results)}


@router.get("/search/degs")
async def search_degs(q: str, project: str | None = None):
    es = get_es_client()
    must = [{"match": {"gene_id": q}}]
    if project:
        must.append({"term": {"project": project}})
    result = await es.search(index="degs", body={"query": {"bool": {"must": must}}})
    return [hit["_source"] for hit in result["hits"]["hits"]]

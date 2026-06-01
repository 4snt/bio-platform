from elasticsearch import AsyncElasticsearch
from app.core.config import settings

_client: AsyncElasticsearch | None = None


async def init_es_client() -> None:
    global _client
    _client = AsyncElasticsearch(hosts=[settings.es_host])


async def close_es_client() -> None:
    global _client
    if _client:
        await _client.close()


def get_es_client() -> AsyncElasticsearch:
    if _client is None:
        raise RuntimeError("ES client not initialized")
    return _client

from app.core.database import get_pool


async def upload_lo(data: bytes) -> int:
    """Grava bytes como Large Object dentro de uma transação. Retorna OID."""
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            oid = await conn.fetchval("SELECT lo_create(0)")
            await conn.execute("SELECT lo_put($1, 0, $2)", oid, data)
            return oid


async def download_lo(oid: int) -> bytes:
    """Lê Large Object pelo OID. Retorna bytes."""
    pool = get_pool()
    async with pool.acquire() as conn:
        data = await conn.fetchval("SELECT lo_get($1)", oid)
        return data


async def delete_lo(oid: int) -> None:
    """Remove Large Object do catálogo pg_largeobject."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SELECT lo_unlink($1)", oid)

import asyncio
from xml.etree import ElementTree as ET
import httpx

_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

# NCBI permite 3 req/s sem API key; 0.35s de delay é seguro
_RATE_DELAY = 0.35
_MAX_NAMES   = 50


def _parse_silva_name(raw: str) -> str:
    """Extrai o nível mais específico de 'k__X;p__Y;c__Z;...' do SILVA/UNITE."""
    parts = [p.strip() for p in raw.split(";") if p.strip()]
    for part in reversed(parts):
        # remove prefixo k__, p__, c__, o__, f__, g__, s__
        clean = part[3:] if len(part) > 3 and part[1:3] == "__" else part
        clean = clean.strip()
        if clean and clean.lower() not in ("unclassified", "uncultured", "unknown", ""):
            return clean
    return parts[-1] if parts else raw


async def _taxid_search(client: httpx.AsyncClient, name: str) -> int | None:
    try:
        resp = await client.get(f"{_EUTILS}/esearch.fcgi", params={
            "db": "taxonomy", "term": f"{name}[Scientific Name]",
            "retmode": "json", "retmax": 1,
        })
        resp.raise_for_status()
        ids = resp.json().get("esearchresult", {}).get("idlist", [])
        return int(ids[0]) if ids else None
    except Exception:
        return None


async def _fetch_lineage(client: httpx.AsyncClient, taxid: int) -> dict:
    try:
        resp = await client.get(f"{_EUTILS}/efetch.fcgi", params={
            "db": "taxonomy", "id": str(taxid), "retmode": "xml",
        })
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        taxon = root.find("Taxon")
        if taxon is None:
            return {}
        lineage = "; ".join(
            n.findtext("ScientificName", "")
            for n in taxon.findall("LineageEx/Taxon")
        )
        return {
            "taxid":   taxid,
            "name":    taxon.findtext("ScientificName", ""),
            "rank":    taxon.findtext("Rank", ""),
            "lineage": lineage,
        }
    except Exception:
        return {"taxid": taxid}


async def batch_taxid_lookup(names: list[str]) -> list[dict]:
    """
    Busca TaxID + lineage para até MAX_NAMES nomes taxonômicos.
    Aceita strings SILVA/UNITE com prefixos (k__, p__, etc.).
    """
    results = []
    async with httpx.AsyncClient(timeout=20) as client:
        for raw in names[:_MAX_NAMES]:
            clean = _parse_silva_name(raw)
            await asyncio.sleep(_RATE_DELAY)
            taxid = await _taxid_search(client, clean)

            if taxid:
                await asyncio.sleep(_RATE_DELAY)
                info = await _fetch_lineage(client, taxid)
                info["query"] = raw
                results.append(info)
            else:
                results.append({
                    "query":   raw,
                    "taxid":   None,
                    "name":    clean,
                    "rank":    None,
                    "lineage": None,
                })
    return results

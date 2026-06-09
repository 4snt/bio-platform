"""
Acesso ao NCBI GEO via E-utilities.
Funções: busca de metadados GSM e mapeamento GSM → SRR via elink.
"""
import asyncio
import csv
import io

import httpx

_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
_DELAY = 0.35   # respeita limite de 3 req/s sem API key


async def fetch_geo_metadata(gsm: str) -> dict:
    """
    Retorna metadados de uma amostra GEO (accession GSM) via esummary.
    Lança ValueError se o accession não for encontrado.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{_EUTILS}/esearch.fcgi",
            params={"db": "gds", "term": f"{gsm}[ACCN]", "retmode": "json"},
        )
        r.raise_for_status()
        ids = r.json()["esearchresult"]["idlist"]

    if not ids:
        raise ValueError(f"Accession GEO '{gsm}' não encontrado no NCBI.")

    await asyncio.sleep(_DELAY)

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{_EUTILS}/esummary.fcgi",
            params={"db": "gds", "id": ids[0], "retmode": "json"},
        )
        r.raise_for_status()
        result = r.json().get("result", {})
        summary = result.get(ids[0], {})

    return {
        "gsm":      gsm,
        "title":    summary.get("title", ""),
        "organism": summary.get("taxon", ""),
        "gse":      summary.get("gse", ""),
        "type":     summary.get("entrytype", ""),
        "summary":  (summary.get("summary") or "")[:500],
    }


async def gsm_to_srr(gsm: str) -> str:
    """
    Mapeia um accession GSM para o primeiro SRR (ou ERR/DRR) vinculado via elink.
    Lança ValueError se não houver run associado ou se o run não for PAIRED.
    """
    # 1. esearch no db=gds para obter o UID interno
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{_EUTILS}/esearch.fcgi",
            params={"db": "gds", "term": f"{gsm}[ACCN]", "retmode": "json"},
        )
        r.raise_for_status()
        gds_ids = r.json()["esearchresult"]["idlist"]

    if not gds_ids:
        raise ValueError(f"GSM '{gsm}' não encontrado no NCBI GEO.")

    await asyncio.sleep(_DELAY)

    # 2. elink: gds → sra para obter UIDs SRA vinculados
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{_EUTILS}/elink.fcgi",
            params={"dbfrom": "gds", "db": "sra", "id": gds_ids[0], "retmode": "json"},
        )
        r.raise_for_status()
        link_data = r.json()

    sra_uids: list[str] = []
    for linkset in link_data.get("linksets", []):
        for lsdb in linkset.get("linksetdbs", []):
            if lsdb.get("dbto") == "sra":
                sra_uids.extend(str(uid) for uid in lsdb.get("links", []))

    if not sra_uids:
        raise ValueError(
            f"Nenhum run SRA vinculado a '{gsm}'. "
            "Verifique se este GSM possui dados de sequenciamento depositados no SRA."
        )

    await asyncio.sleep(_DELAY)

    # 3. efetch runinfo SRA → extrai o accession SRR/ERR/DRR
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"{_EUTILS}/efetch.fcgi",
            params={"db": "sra", "id": sra_uids[0], "rettype": "runinfo", "retmode": "csv"},
        )
        r.raise_for_status()
        text = r.text

    for row in csv.DictReader(io.StringIO(text)):
        srr = row.get("Run", "")
        if srr[:3] in ("SRR", "ERR", "DRR"):
            layout = row.get("LibraryLayout", "")
            if layout != "PAIRED":
                raise ValueError(
                    f"Run '{srr}' vinculado a '{gsm}' não é PAIRED (é {layout or 'desconhecido'}). "
                    "Apenas runs PAIRED são suportados."
                )
            return srr

    raise ValueError(f"Não foi possível extrair um accession SRR/ERR/DRR para '{gsm}'.")

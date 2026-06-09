import csv
import io
import httpx

_SRA_RUNINFO = "https://trace.ncbi.nlm.nih.gov/Traces/sra/sra.cgi"


async def list_sra_runs(bioproject: str) -> list[dict]:
    """Lista todos os SRR runs de um BioProject via NCBI SRA RunInfo."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(_SRA_RUNINFO, params={
            "save":    "efetch",
            "db":      "sra",
            "rettype": "runinfo",
            "term":    f"{bioproject}[BioProject]",
        })
        resp.raise_for_status()

    runs = []
    for row in csv.DictReader(io.StringIO(resp.text)):
        if not row.get("Run"):
            continue
        runs.append({
            "accession":        row["Run"],
            "sample_name":      row.get("SampleName", ""),
            "library_layout":   row.get("LibraryLayout", ""),
            "library_strategy": row.get("LibraryStrategy", ""),
            "spots":            row.get("spots", ""),
            "bases":            row.get("bases", ""),
            "biosample":        row.get("BioSample", ""),
        })
    return runs

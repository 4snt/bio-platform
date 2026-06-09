import csv
import io
import httpx

_SRA_RUNINFO = "https://trace.ncbi.nlm.nih.gov/Traces/sra/sra.cgi"
_ENA_PORTAL  = "https://www.ebi.ac.uk/ena/portal/api/filereport"


def _ftp_to_https(url: str) -> str:
    url = url.replace("ftp.sra.ebi.ac.uk", "ftp.ebi.ac.uk")
    if url.startswith("ftp://"):
        return "https://" + url[6:]
    if not url.startswith("http"):
        return "https://" + url
    return url


async def fetch_sra_metadata(accession: str) -> dict:
    """Retorna metadados do run via NCBI SRA RunInfo (CSV)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(_SRA_RUNINFO, params={
            "save": "efetch", "db": "sra",
            "rettype": "runinfo", "term": accession,
        })
        resp.raise_for_status()
    rows = [r for r in csv.DictReader(io.StringIO(resp.text)) if r.get("Run")]
    if not rows:
        raise ValueError(f"Accession '{accession}' não encontrado no SRA.")
    row = rows[0]
    if row.get("LibraryLayout") != "PAIRED":
        raise ValueError(
            f"Apenas runs PAIRED são suportados. Este run é {row.get('LibraryLayout', 'desconhecido')}."
        )
    return {
        "accession":        row["Run"],
        "sample_name":      row.get("SampleName", ""),
        "library_strategy": row.get("LibraryStrategy", ""),
        "library_layout":   row.get("LibraryLayout", ""),
        "spots":            row.get("spots", ""),
        "bases":            row.get("bases", ""),
        "bioproject":       row.get("BioProject", ""),
        "biosample":        row.get("BioSample", ""),
        "organism":         row.get("ScientificName", ""),
    }


async def get_fastq_urls(accession: str) -> tuple[str, str]:
    """Resolve URLs HTTPS dos FASTQs R1 e R2 via ENA Portal API."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(_ENA_PORTAL, params={
            "accession": accession,
            "result":    "read_run",
            "fields":    "fastq_ftp",
            "format":    "json",
        })
        resp.raise_for_status()
    data = resp.json()
    if not data:
        raise ValueError(f"FASTQs não encontrados no ENA para '{accession}'.")

    ftp_str = data[0].get("fastq_ftp", "")
    urls = [_ftp_to_https(u) for u in ftp_str.split(";") if u.strip()]

    r1 = next((u for u in urls if "_1.fastq" in u), None)
    r2 = next((u for u in urls if "_2.fastq" in u), None)
    if not r1 or not r2:
        raise ValueError(f"Par R1/R2 não encontrado no ENA para '{accession}'.")
    return r1, r2


async def download_fastq(url: str, max_bytes: int) -> bytes:
    """Baixa FASTQ via HTTPS. Lança ValueError se exceder max_bytes."""
    async with httpx.AsyncClient(timeout=600, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content = resp.content
    if len(content) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise ValueError(f"FASTQ excede o limite de {mb} MB ({len(content) // (1024*1024)} MB recebidos).")
    return content

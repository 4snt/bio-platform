from dataclasses import dataclass

from app.core.ncbi_geo import fetch_geo_metadata, gsm_to_srr
from app.core.ncbi_sra import get_fastq_urls, download_fastq
from app.core.ports import FastqPair


@dataclass
class GeoAdapter:
    """
    FastqSource adapter para NCBI GEO.
    Aceita accessions GSM (ex: GSM1234567).
    Resolve GSM → SRR via elink e delega o download ao ENA (igual ao SraAdapter).
    """
    label: str = "NCBI GEO"

    async def fetch_metadata(self, accession: str) -> dict:
        accession = accession.upper()
        if not accession.startswith("GSM"):
            raise ValueError(
                f"GeoAdapter aceita accessions GSM (ex: GSM1234567). Recebido: '{accession}'"
            )
        geo = await fetch_geo_metadata(accession)
        srr = await gsm_to_srr(accession)
        return {
            **geo,
            "srr_accession": srr,
            # campos compatíveis com SraMetadata para a UI renderizar o preview
            "accession":        srr,
            "sample_name":      geo.get("title", ""),
            "library_strategy": "RNA-Seq",
            "library_layout":   "PAIRED",
            "spots":            "",
            "bases":            "",
            "bioproject":       geo.get("gse", ""),
            "biosample":        accession,
            "organism":         geo.get("organism", ""),
        }

    async def download_pair(self, accession: str, max_bytes: int) -> FastqPair:
        accession = accession.upper()
        if not accession.startswith("GSM"):
            raise ValueError(
                f"GeoAdapter aceita accessions GSM. Recebido: '{accession}'"
            )
        geo = await fetch_geo_metadata(accession)
        srr = await gsm_to_srr(accession)

        r1_url, r2_url = await get_fastq_urls(srr)
        r1 = await download_fastq(r1_url, max_bytes)
        r2 = await download_fastq(r2_url, max_bytes)

        return FastqPair(
            r1=r1,
            r2=r2,
            filename_stem=srr,
            metadata={**geo, "srr_accession": srr, "gsm": accession},
        )

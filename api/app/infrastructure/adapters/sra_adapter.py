from dataclasses import dataclass

from app.core.ncbi_sra import fetch_sra_metadata, get_fastq_urls, download_fastq
from app.core.ports import FastqPair


@dataclass
class SraAdapter:
    label: str = "NCBI SRA / ENA"

    async def fetch_metadata(self, accession: str) -> dict:
        return await fetch_sra_metadata(accession)

    async def download_pair(self, accession: str, max_bytes: int) -> FastqPair:
        meta = await fetch_sra_metadata(accession)
        r1_url, r2_url = await get_fastq_urls(accession)
        r1 = await download_fastq(r1_url, max_bytes)
        r2 = await download_fastq(r2_url, max_bytes)
        return FastqPair(r1=r1, r2=r2, filename_stem=accession, metadata=meta)

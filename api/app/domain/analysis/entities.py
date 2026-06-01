from dataclasses import dataclass, field
from uuid import UUID, uuid4
from enum import Enum


class AnalysisType(str, Enum):
    DESEQ2 = "deseq2"
    ANCOMBC2 = "ancombc2"
    MAASLIN2 = "maaslin2"
    SPIECEASI = "spieceasi"
    RANDOM_FOREST = "random_forest"
    GSEA = "gsea"
    FUNGUILD = "funguild"
    PICRUST2 = "picrust2"


@dataclass
class AnalysisJob:
    pipeline_job_id: UUID
    analysis_type: AnalysisType
    id: UUID = field(default_factory=uuid4)
    status: str = "queued"
    result_data: dict | None = None
    es_index_key: str | None = None

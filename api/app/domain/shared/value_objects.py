from enum import Enum
from uuid import UUID


class MarkerType(str, Enum):
    S16 = "16S"
    ITS = "ITS"


class ProjectCode(str):
    pass


class AnalysisId(UUID):
    pass

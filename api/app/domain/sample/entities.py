from dataclasses import dataclass, field
from uuid import UUID, uuid4
from app.domain.shared.value_objects import MarkerType, ProjectCode


@dataclass
class ProjectAnalysis:
    analysis_type: str
    charts: list[str]


@dataclass
class Project:
    code: ProjectCode
    name: str
    marker_type: MarkerType
    id: UUID = field(default_factory=uuid4)
    status: str = "active"
    description: str = ""
    analyses: list[ProjectAnalysis] = field(default_factory=list)


@dataclass
class Sample:
    project_id: UUID
    filename: str
    treatment_group: str
    replicate: int
    fastq_r1_key: str
    fastq_r2_key: str
    id: UUID = field(default_factory=uuid4)

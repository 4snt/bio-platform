import re
from dataclasses import dataclass
from app.domain.shared.value_objects import ProjectCode, MarkerType


@dataclass
class ParsedSampleName:
    project_code: ProjectCode
    treatment_group: str
    replicate: int
    read_pair: str


class SampleParser:
    # e.g. INOVAHERB_T2B1_R1.fastq.gz
    _PATTERN = re.compile(
        r"^(?P<project>[A-Z0-9]+)_(?P<group>T\d+B\d+)_(?P<pair>R[12])(?:_\d+)?\.fastq(?:\.gz)?$"
    )

    def parse(self, filename: str) -> ParsedSampleName:
        m = self._PATTERN.match(filename)
        if not m:
            raise ValueError(f"Nome de arquivo não reconhecido: {filename}")
        return ParsedSampleName(
            project_code=ProjectCode(m.group("project")),
            treatment_group=m.group("group"),
            replicate=1,
            read_pair=m.group("pair"),
        )

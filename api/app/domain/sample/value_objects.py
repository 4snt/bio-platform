from dataclasses import dataclass
import re


@dataclass(frozen=True)
class FastqPair:
    r1_key: str
    r2_key: str


@dataclass(frozen=True)
class TreatmentGroup:
    raw: str

    def __post_init__(self):
        if not re.match(r"^T\d+B\d+$", self.raw):
            raise ValueError(f"TreatmentGroup inválido: {self.raw}")

    @property
    def treatment(self) -> int:
        return int(re.search(r"T(\d+)", self.raw).group(1))

    @property
    def block(self) -> int:
        return int(re.search(r"B(\d+)", self.raw).group(1))

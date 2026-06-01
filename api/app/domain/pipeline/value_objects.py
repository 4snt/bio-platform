from dataclasses import dataclass
from app.domain.shared.value_objects import MarkerType


@dataclass(frozen=True)
class MarkerConfig:
    marker_type: MarkerType
    trunc_len_f: int
    trunc_len_r: int
    classifier_key: str

    @classmethod
    def for_16s(cls) -> "MarkerConfig":
        return cls(
            marker_type=MarkerType.S16,
            trunc_len_f=230,
            trunc_len_r=180,
            classifier_key="references/silva-138-classifier.qza",
        )

    @classmethod
    def for_its(cls) -> "MarkerConfig":
        return cls(
            marker_type=MarkerType.ITS,
            trunc_len_f=0,
            trunc_len_r=0,
            classifier_key="references/unite-v10-classifier.qza",
        )

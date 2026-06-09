"""
FastqSource port — define o contrato que qualquer repositório de FASTQs deve cumprir.

Adapters concretos ficam em app/infrastructure/adapters/.
O registry é lazy para evitar import circular (infrastructure → core).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class FastqPair:
    r1: bytes
    r2: bytes
    filename_stem: str   # ex: "SRR9847653" — usado para montar o filename na DB
    metadata: dict = field(default_factory=dict)


@runtime_checkable
class FastqSource(Protocol):
    label: str  # nome legível exibido na UI, ex: "NCBI SRA / ENA"

    async def fetch_metadata(self, accession: str) -> dict:
        """Retorna metadados sem fazer download. Lança ValueError se inválido."""
        ...

    async def download_pair(self, accession: str, max_bytes: int) -> FastqPair:
        """Baixa o par R1/R2 e retorna FastqPair. Lança ValueError se exceder max_bytes."""
        ...


# ── Registry ────────────────────────────────────────────────────────────────

_registry: dict[str, FastqSource] | None = None


def _build_registry() -> dict[str, FastqSource]:
    from app.infrastructure.adapters.sra_adapter import SraAdapter
    from app.infrastructure.adapters.geo_adapter import GeoAdapter
    return {
        "sra": SraAdapter(),
        "geo": GeoAdapter(),
        # "arrayexpress": ArrayExpressAdapter(),
    }


def get_source(name: str) -> FastqSource:
    global _registry
    if _registry is None:
        _registry = _build_registry()
    source = _registry.get(name)
    if source is None:
        available = ", ".join(sorted(_registry.keys()))
        raise ValueError(f"Source '{name}' desconhecida. Disponíveis: {available}")
    return source


def list_sources() -> list[dict]:
    """Retorna lista de sources disponíveis com label, para a UI."""
    global _registry
    if _registry is None:
        _registry = _build_registry()
    return [{"key": k, "label": s.label} for k, s in sorted(_registry.items())]

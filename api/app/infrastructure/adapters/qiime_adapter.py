# ACL: traduz vocabulário QIIME2 → domínio interno
# Nomes como "artifact", "qza", "manifest" não saem daqui

from app.domain.pipeline.entities import PipelineJob
from app.domain.sample.entities import Sample


class QiimeAdapter:
    def build_manifest(self, samples: list[Sample]) -> dict:
        rows = []
        for s in samples:
            rows.append({
                "sample-id": f"{s.treatment_group}_rep{s.replicate}",
                "forward-absolute-filepath": s.fastq_r1_key,
                "reverse-absolute-filepath": s.fastq_r2_key,
            })
        return {"manifest": rows}

    def parse_feature_table(self, qiime_output: dict) -> dict:
        # Traduz output do QIIME2 para formato do domínio
        return {
            "taxa": qiime_output.get("taxonomy", []),
            "counts": qiime_output.get("feature_table", {}),
        }

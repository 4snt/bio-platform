# ACL: traduz vocabulário QIIME2 → domínio interno
# Nomes como "artifact", "qza", "manifest" não saem daqui

import tempfile
import os
from app.core.pg_storage import download_lo
from app.domain.pipeline.entities import PipelineJob
from app.domain.sample.entities import Sample


class QiimeAdapter:
    async def build_manifest(self, samples: list[Sample]) -> dict:
        rows = []
        for s in samples:
            r1_bytes = await download_lo(s.fastq_r1_oid)
            r2_bytes = await download_lo(s.fastq_r2_oid)

            r1_tmp = tempfile.NamedTemporaryFile(suffix=".fastq.gz", delete=False)
            r1_tmp.write(r1_bytes)
            r1_tmp.close()

            r2_tmp = tempfile.NamedTemporaryFile(suffix=".fastq.gz", delete=False)
            r2_tmp.write(r2_bytes)
            r2_tmp.close()

            rows.append({
                "sample-id": f"{s.treatment_group}_rep{s.replicate}",
                "forward-absolute-filepath": r1_tmp.name,
                "reverse-absolute-filepath": r2_tmp.name,
            })
        return {"manifest": rows}

    def parse_feature_table(self, qiime_output: dict) -> dict:
        return {
            "taxa":   qiime_output.get("taxonomy", []),
            "counts": qiime_output.get("feature_table", {}),
        }

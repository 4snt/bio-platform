# ACL: traduz vocabulário R/Bioconductor → domínio interno
# Nomes como "phyloseq", "DESeqDataSet", "SpiecEasi" não saem daqui

from uuid import UUID


class RBioconductorAdapter:
    def parse_deseq2_result(self, csv_rows: list[dict]) -> list[dict]:
        return [
            {
                "gene_id": row["gene_id"],
                "log2_fold_change": float(row["log2FoldChange"]),
                "p_adjusted": float(row["padj"]),
                "base_mean": float(row["baseMean"]),
            }
            for row in csv_rows
            if row.get("padj") not in (None, "NA")
        ]

    def parse_spieceasi_network(self, json_data: dict) -> dict:
        return {
            "nodes": json_data.get("nodes", []),
            "edges": json_data.get("edges", []),
            "keystone_taxa": [
                n for n in json_data.get("nodes", [])
                if n.get("keystone_score", 0) > 0.5
            ],
        }

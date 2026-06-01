run_gsea <- function(payload, con) {
  library(clusterProfiler)

  gene_list <- payload$gene_list
  organism  <- payload$organism %||% "Homo sapiens"

  ego <- enrichGO(
    gene         = gene_list,
    OrgDb        = org.Hs.eg.db::org.Hs.eg.db,
    keyType      = "SYMBOL",
    ont          = "BP",
    pAdjustMethod = "BH",
    pvalueCutoff  = 0.05
  )

  res <- as.data.frame(ego)
  list(
    pathways = lapply(seq_len(nrow(res)), function(i) list(
      go_id       = res$ID[i],
      description = res$Description[i],
      p_adjust    = res$p.adjust[i],
      gene_ratio  = res$GeneRatio[i]
    ))
  )
}

`%||%` <- function(a, b) if (!is.null(a)) a else b

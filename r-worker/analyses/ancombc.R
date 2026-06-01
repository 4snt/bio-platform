run_ancombc <- function(payload, con) {
  library(ANCOMBC)

  phyloseq_obj <- minio_download_rds(
    bucket     = "pipeline-artifacts",
    key        = payload$phyloseq_key,
    local_path = tempfile(fileext = ".rds")
  )

  output <- ancombc2(
    data      = phyloseq_obj,
    fix_formula = payload$formula %||% "treatment_group",
    p_adj_method = "BH",
    prv_cut   = 0.10
  )

  res <- output$res
  list(
    taxa = lapply(seq_len(nrow(res)), function(i) list(
      taxon   = res$taxon[i],
      lfc     = res$lfc_treatment_group[i],
      q_val   = res$q_treatment_group[i],
      diff_abn = res$diff_treatment_group[i]
    ))
  )
}

`%||%` <- function(a, b) if (!is.null(a)) a else b

run_maaslin2 <- function(payload, con) {
  library(Maaslin2)

  phyloseq_obj <- minio_download_rds(
    bucket     = "pipeline-artifacts",
    key        = payload$phyloseq_key,
    local_path = tempfile(fileext = ".rds")
  )

  features  <- as.data.frame(t(phyloseq::otu_table(phyloseq_obj)))
  metadata  <- as.data.frame(phyloseq::sample_data(phyloseq_obj))
  out_dir   <- tempdir()

  fit <- Maaslin2(
    input_data     = features,
    input_metadata = metadata,
    output         = out_dir,
    fixed_effects  = payload$fixed_effects %||% c("time_point"),
    normalization  = "TMM",
    transform      = "LOG"
  )

  res <- fit$results
  list(
    associations = lapply(seq_len(nrow(res)), function(i) list(
      feature  = res$feature[i],
      metadata = res$metadata[i],
      coef     = res$coef[i],
      qval     = res$qval[i]
    ))
  )
}

`%||%` <- function(a, b) if (!is.null(a)) a else b

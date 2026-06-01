run_random_forest <- function(payload, con) {
  library(randomForest)

  phyloseq_obj <- minio_download_rds(
    bucket     = "pipeline-artifacts",
    key        = payload$phyloseq_key,
    local_path = tempfile(fileext = ".rds")
  )

  x <- t(as.matrix(phyloseq::otu_table(phyloseq_obj)))
  y <- factor(phyloseq::sample_data(phyloseq_obj)$treatment_group)

  rf <- randomForest(x = x, y = y, ntree = 500, importance = TRUE)

  minio_upload_rds(
    obj    = rf,
    bucket = "results",
    key    = paste0("rf_models/", payload$job_id, "_rf.rds")
  )

  imp <- as.data.frame(importance(rf))
  imp$taxon <- rownames(imp)

  list(
    oob_error  = rf$err.rate[500, "OOB"],
    importance = lapply(seq_len(nrow(imp)), function(i) list(
      taxon      = imp$taxon[i],
      mean_decrease_gini = imp$MeanDecreaseGini[i]
    ))
  )
}

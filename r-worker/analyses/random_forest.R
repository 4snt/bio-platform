run_random_forest <- function(payload, con) {
  library(randomForest)

  phyloseq_obj <- pg_download_rds(con, payload$phyloseq_oid)

  x <- t(as.matrix(phyloseq::otu_table(phyloseq_obj)))
  y <- factor(phyloseq::sample_data(phyloseq_obj)$treatment_group)

  rf <- randomForest(x = x, y = y, ntree = 500, importance = TRUE)

  rf_oid <- pg_upload_rds(con, rf)

  # Salva o OID do modelo na coluna result_oid do job
  DBI::dbExecute(con,
    sprintf("UPDATE pipeline_jobs SET result_oid = %s WHERE id = '%s'",
            rf_oid, payload$job_id))

  imp <- as.data.frame(importance(rf))
  imp$taxon <- rownames(imp)

  list(
    rf_oid     = rf_oid,
    oob_error  = rf$err.rate[500, "OOB"],
    importance = lapply(seq_len(nrow(imp)), function(i) list(
      taxon              = imp$taxon[i],
      mean_decrease_gini = imp$MeanDecreaseGini[i]
    ))
  )
}

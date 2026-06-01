run_deseq2 <- function(payload, con) {
  library(DESeq2)

  phyloseq_obj <- minio_download_rds(
    bucket     = "pipeline-artifacts",
    key        = payload$phyloseq_key,
    local_path = tempfile(fileext = ".rds")
  )

  count_matrix <- phyloseq::otu_table(phyloseq_obj)
  col_data     <- data.frame(
    condition = phyloseq::sample_data(phyloseq_obj)$treatment_group,
    row.names = sample_names(phyloseq_obj)
  )

  dds <- DESeqDataSetFromMatrix(
    countData = count_matrix,
    colData   = col_data,
    design    = ~ condition
  )
  dds <- DESeq(dds)
  res <- results(dds, alpha = 0.05)

  df <- as.data.frame(res)
  df$gene_id <- rownames(df)
  df <- df[!is.na(df$padj), ]

  list(
    degs = lapply(seq_len(nrow(df)), function(i) list(
      gene_id          = df$gene_id[i],
      log2_fold_change = df$log2FoldChange[i],
      p_adjusted       = df$padj[i],
      base_mean        = df$baseMean[i]
    )),
    n_significant = sum(df$padj < 0.05, na.rm = TRUE)
  )
}

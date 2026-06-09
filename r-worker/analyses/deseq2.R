run_deseq2 <- function(payload, con) {
  library(DESeq2)
  library(phyloseq)

  ps <- pg_download_rds(con, payload$phyloseq_oid)

  count_matrix <- as(otu_table(ps), "matrix")
  if (!taxa_are_rows(ps)) count_matrix <- t(count_matrix)
  storage.mode(count_matrix) <- "integer"

  # Usa o treatment_group completo como condição
  condition <- factor(sample_data(ps)$treatment_group)

  # Se o design ficaria saturado (1 amostra por grupo), simplifica para
  # apenas o número do tratamento: T1B2 → T1, T5B2_A → T5
  n_per_group <- table(condition)
  if (all(n_per_group == 1)) {
    message("[deseq2] design saturado — simplificando condition para tratamento (sem bloco)")
    condition <- factor(sub("B\\d+.*$", "", as.character(condition)))
  }

  col_data <- data.frame(condition = condition, row.names = sample_names(ps))

  dds <- DESeqDataSetFromMatrix(
    countData = count_matrix,
    colData   = col_data,
    design    = ~ condition
  )
  dds <- dds[rowSums(counts(dds)) >= 10, ]
  dds <- DESeq(dds, quiet = TRUE)
  res <- results(dds, alpha = 0.05)

  df <- as.data.frame(res)
  df$gene_id <- rownames(df)
  df <- df[!is.na(df$padj), ]

  list(
    degs = lapply(seq_len(nrow(df)), function(i) list(
      gene_id          = df$gene_id[i],
      log2_fold_change = round(df$log2FoldChange[i], 6),
      p_adjusted       = round(df$padj[i], 10),
      base_mean        = round(df$baseMean[i], 4)
    )),
    n_significant = sum(df$padj < 0.05, na.rm = TRUE)
  )
}

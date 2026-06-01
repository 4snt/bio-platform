run_picrust2 <- function(payload, con) {
  # PICRUSt2 roda como processo externo (Python/conda)
  # R apenas coleta os resultados do CSV gerado

  output_path <- payload$picrust2_output_path

  if (!file.exists(output_path)) {
    stop(paste("Output PICRUSt2 não encontrado:", output_path))
  }

  res <- read.table(output_path, header = TRUE, sep = "\t", row.names = 1)

  list(
    pathways = lapply(rownames(res), function(pathway) list(
      pathway_id    = pathway,
      mean_abundance = mean(as.numeric(res[pathway, ]))
    ))
  )
}

library(clusterProfiler)

# Mapeamento organismo → pacote OrgDb (GO terms)
ORG_DB_MAP <- list(
  "Homo sapiens"            = "org.Hs.eg.db",
  "Mus musculus"            = "org.Mm.eg.db",
  "Rattus norvegicus"       = "org.Rn.eg.db",
  "Drosophila melanogaster" = "org.Dm.eg.db",
  "Danio rerio"             = "org.Dr.eg.db",
  "Caenorhabditis elegans"  = "org.Ce.eg.db",
  "Saccharomyces cerevisiae"= "org.Sc.sgd.db",
  "Arabidopsis thaliana"    = "org.At.tair.db"
)

# Mapeamento organismo → código KEGG (fallback para organismos sem OrgDb)
KEGG_ORG_MAP <- list(
  "Aspergillus niger"       = "ang",
  "Fusarium graminearum"    = "fgr",
  "Neurospora crassa"       = "ncr",
  "Trichoderma reesei"      = "tre",
  "Cryptococcus neoformans" = "cne",
  "Candida albicans"        = "cal",
  "Escherichia coli"        = "eco",
  "Bacillus subtilis"       = "bsu"
)

run_gsea <- function(payload, con) {
  gene_list <- payload$gene_list
  organism  <- payload$organism %||% "Homo sapiens"

  # Tenta OrgDb (GO)
  org_pkg <- ORG_DB_MAP[[organism]]
  if (!is.null(org_pkg)) {
    suppressPackageStartupMessages(library(package = org_pkg, character.only = TRUE))
    org_db <- get(org_pkg)
    ego <- enrichGO(
      gene          = gene_list,
      OrgDb         = org_db,
      keyType       = "SYMBOL",
      ont           = "BP",
      pAdjustMethod = "BH",
      pvalueCutoff  = 0.05
    )
    res    <- as.data.frame(ego)
    method <- "GO"
  } else {
    # Fallback: KEGG
    kegg_code <- KEGG_ORG_MAP[[organism]] %||% payload$kegg_organism %||% "sce"
    ek <- enrichKEGG(
      gene         = gene_list,
      organism     = kegg_code,
      pvalueCutoff = 0.05
    )
    res    <- as.data.frame(ek)
    method <- "KEGG"
  }

  if (nrow(res) == 0) {
    message(sprintf("[gsea] Nenhum pathway encontrado para '%s' (método: %s)", organism, method))
    return(list(organism = organism, method = method, pathways = list()))
  }

  list(
    organism = organism,
    method   = method,
    pathways = lapply(seq_len(nrow(res)), function(i) list(
      go_id       = res$ID[i],
      description = res$Description[i],
      p_adjust    = res$p.adjust[i],
      gene_ratio  = res$GeneRatio[i]
    ))
  )
}

`%||%` <- function(a, b) if (!is.null(a)) a else b

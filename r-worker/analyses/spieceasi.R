run_spieceasi <- function(payload, con) {
  library(SpiecEasi)

  phyloseq_obj <- minio_download_rds(
    bucket     = "pipeline-artifacts",
    key        = payload$phyloseq_key,
    local_path = tempfile(fileext = ".rds")
  )

  se <- spiec.easi(
    phyloseq_obj,
    method    = "mb",
    lambda.min.ratio = 1e-2,
    nlambda   = 20,
    pulsar.params = list(rep.num = 50, ncores = 2)
  )

  ig    <- SpiecEasi::adj2igraph(SpiecEasi::getRefit(se))
  nodes <- igraph::V(ig)$name
  edges <- igraph::as_data_frame(ig, what = "edges")

  degrees <- igraph::degree(ig)
  keystone_scores <- as.numeric(scale(degrees))

  list(
    nodes = lapply(seq_along(nodes), function(i) list(
      id             = nodes[i],
      degree         = degrees[i],
      keystone_score = keystone_scores[i]
    )),
    edges = lapply(seq_len(nrow(edges)), function(i) list(
      source = edges$from[i],
      target = edges$to[i],
      weight = as.numeric(edges$weight[i] %||% 1)
    ))
  )
}

`%||%` <- function(a, b) if (!is.null(a)) a else b

library(elastic)

es_connect <- function() {
  elastic::connect(
    host = Sys.getenv("ES_HOST", "localhost"),
    port = 9200,
    es_ver = "8"
  )
}

es_bulk_index <- function(index_name, docs) {
  con <- es_connect()
  batch_size <- 1000
  batches <- split(docs, ceiling(seq_along(docs) / batch_size))
  for (batch in batches) {
    elastic::docs_bulk(con, batch, index = index_name)
  }
}

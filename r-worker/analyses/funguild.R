run_funguild <- function(payload, con) {
  taxa_table <- payload$taxa_table

  guild_db_path <- tempfile(fileext = ".csv")
  download.file(
    "https://www.mycoportal.org/funguild/services/api/db_return.php?dbReturn=JSON&pp=1",
    guild_db_path,
    quiet = TRUE
  )
  guild_db <- read.csv(guild_db_path, stringsAsFactors = FALSE)

  results <- lapply(taxa_table, function(taxon) {
    match_row <- guild_db[grep(taxon$name, guild_db$taxon, ignore.case = TRUE), ]
    if (nrow(match_row) > 0) {
      list(
        taxon          = taxon$name,
        guild          = match_row$guild[1],
        trophic_mode   = match_row$trophicMode[1],
        confidence_ranking = match_row$confidenceRanking[1]
      )
    } else {
      list(taxon = taxon$name, guild = NA, trophic_mode = NA, confidence_ranking = NA)
    }
  })

  list(annotations = results)
}

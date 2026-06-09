library(httr)
library(jsonlite)
library(xml2)

NCBI_EUTILS <- "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

# Extrai o nível mais específico de "k__X;p__Y;g__Z" (formato SILVA/UNITE)
.parse_silva_name <- function(raw) {
  parts <- trimws(strsplit(raw, ";")[[1]])
  parts <- parts[nchar(parts) > 0]
  for (p in rev(parts)) {
    clean <- sub("^[a-z]__", "", p)
    clean <- trimws(clean)
    if (nchar(clean) > 0 && !tolower(clean) %in% c("unclassified", "uncultured", "unknown")) {
      return(clean)
    }
  }
  return(tail(parts, 1))
}

.ncbi_taxid_search <- function(name) {
  Sys.sleep(0.35)  # respeita rate limit NCBI (3 req/s sem API key)
  resp <- GET(paste0(NCBI_EUTILS, "/esearch.fcgi"),
    query = list(db = "taxonomy", term = paste0(name, "[Scientific Name]"),
                 retmode = "json", retmax = 1))
  if (http_error(resp)) return(NULL)
  data <- fromJSON(rawToChar(resp$content))
  ids  <- data$esearchresult$idlist
  if (length(ids) == 0) return(NULL)
  as.integer(ids[[1]])
}

.ncbi_fetch_lineage <- function(taxid) {
  Sys.sleep(0.35)
  resp <- GET(paste0(NCBI_EUTILS, "/efetch.fcgi"),
    query = list(db = "taxonomy", id = as.character(taxid), retmode = "xml"))
  if (http_error(resp)) return(list(taxid = taxid))
  doc <- read_xml(rawToChar(resp$content))
  name    <- xml_text(xml_find_first(doc, "//Taxon/ScientificName"))
  rank    <- xml_text(xml_find_first(doc, "//Taxon/Rank"))
  lineage <- paste(xml_text(xml_find_all(doc, "//LineageEx/Taxon/ScientificName")),
                   collapse = "; ")
  list(taxid = taxid, name = name, rank = rank, lineage = lineage)
}

# Enriquece vetor de nomes taxonômicos com TaxIDs e lineage NCBI.
# Limita a 50 nomes para controlar chamadas à API.
ncbi_enrich_taxa <- function(taxa_vector) {
  taxa_vector <- head(taxa_vector, 50)
  lapply(taxa_vector, function(raw) {
    clean <- .parse_silva_name(raw)
    taxid <- .ncbi_taxid_search(clean)
    if (!is.null(taxid)) {
      info        <- .ncbi_fetch_lineage(taxid)
      info$query  <- raw
      info
    } else {
      list(query = raw, taxid = NULL, name = clean, rank = NULL, lineage = NULL)
    }
  })
}

library(aws.s3)

minio_setup <- function() {
  Sys.setenv(
    AWS_ACCESS_KEY_ID     = Sys.getenv("MINIO_ACCESS_KEY", "minioadmin"),
    AWS_SECRET_ACCESS_KEY = Sys.getenv("MINIO_SECRET_KEY", "changeme"),
    AWS_DEFAULT_REGION    = ""
  )
}

.minio_host <- function() Sys.getenv("MINIO_ENDPOINT", "minio:9000")

minio_download_rds <- function(bucket, key, local_path) {
  minio_setup()
  # Remove prefixo do bucket se o caller passou o caminho completo (ex: "pipeline-artifacts/INOVAHERB/...")
  key <- sub(paste0("^", bucket, "/"), "", key)
  aws.s3::save_object(
    object     = key,
    bucket     = bucket,
    file       = local_path,
    base_url   = .minio_host(),
    use_https  = FALSE,
    region     = "",
    path_style = TRUE
  )
  readRDS(local_path)
}

minio_upload_rds <- function(obj, bucket, key) {
  minio_setup()
  key <- sub(paste0("^", bucket, "/"), "", key)
  tmp <- tempfile(fileext = ".rds")
  saveRDS(obj, tmp)
  on.exit(unlink(tmp))
  aws.s3::put_object(
    file       = tmp,
    object     = key,
    bucket     = bucket,
    base_url   = .minio_host(),
    use_https  = FALSE,
    region     = "",
    path_style = TRUE
  )
}

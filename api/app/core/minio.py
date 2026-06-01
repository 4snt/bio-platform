import boto3
from botocore.client import Config
from app.core.config import settings

_client = None


def get_minio_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"http{'s' if settings.minio_secure else ''}://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=Config(signature_version="s3v4"),
        )
    return _client


def _rewrite_to_public(url: str) -> str:
    """Substitui o hostname interno do MinIO pelo endpoint público (acessível pelo browser)."""
    internal = settings.minio_endpoint
    public   = settings.minio_public_endpoint
    if internal != public:
        url = url.replace(f"://{internal}/", f"://{public}/")
    return url


def generate_presigned_upload(bucket: str, key: str, expires: int = 3600) -> str:
    client = get_minio_client()
    url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )
    return _rewrite_to_public(url)


def generate_presigned_download(bucket: str, key: str, expires: int = 3600) -> str:
    client = get_minio_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )
    return _rewrite_to_public(url)


REQUIRED_BUCKETS = ["fastq-raw", "fastq-qc", "pipeline-artifacts", "results", "figures", "references"]


def ensure_buckets() -> None:
    """Cria buckets que ainda não existem no MinIO. Idempotente."""
    client = get_minio_client()
    for bucket in REQUIRED_BUCKETS:
        try:
            client.head_bucket(Bucket=bucket)
        except Exception:
            client.create_bucket(Bucket=bucket)

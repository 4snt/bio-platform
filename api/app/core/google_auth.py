"""Google OAuth token verification via the userinfo endpoint."""
import httpx

USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


async def verify_google_token(access_token: str, client_id: str) -> dict:
    """Validate a Google access_token and return user claims via the userinfo endpoint.

    Args:
        access_token: The access_token from the Google OAuth flow.
        client_id: Not used for userinfo validation, kept for API compatibility.

    Returns:
        A dict with at least: sub, email, name, email_verified.

    Raises:
        ValueError: If the request fails, the token is invalid, or the email
                    is not verified.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code != 200:
        raise ValueError(
            f"Google userinfo retornou status {response.status_code}: {response.text}"
        )

    claims: dict = response.json()

    if "error" in claims:
        raise ValueError(f"Google userinfo erro: {claims['error']}")

    email_verified = claims.get("email_verified", False)
    if not email_verified:
        raise ValueError("Email do Google não verificado.")

    return claims

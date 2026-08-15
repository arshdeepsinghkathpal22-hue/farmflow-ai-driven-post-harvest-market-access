"""
Authentication.

Deliberately minimal. This is a demonstration system, and a login wall is the
fastest way to lose a judge who has three minutes: the credentials are fixed,
printed at startup, and shown on the login screen itself.

The token is a signed, expiring string rather than a random value in a table,
so the API stays stateless and a restart does not log everybody out. Replace
this with phone-and-OTP before anyone real uses it - every route already reads
the farmer from `current_farmer`, so nothing above this layer changes.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Farmer

TOKEN_TTL_SECONDS = 60 * 60 * 12


def _secret() -> bytes:
    return get_settings().receipt_signing_key.encode()


def issue_token(farmer_id: str) -> str:
    """`farmer_id.expiry.signature` - readable, verifiable, no server state."""
    expires = int(time.time()) + TOKEN_TTL_SECONDS
    body = f"{farmer_id}.{expires}"
    signature = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{signature}"


def read_token(token: str) -> str | None:
    """Return the farmer id if the token is intact and unexpired."""
    parts = (token or "").split(".")
    if len(parts) != 3:
        return None

    farmer_id, expires, signature = parts
    body = f"{farmer_id}.{expires}"
    expected = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()[:32]

    # Constant-time compare: a timing oracle here would leak the signature.
    if not hmac.compare_digest(expected, signature):
        return None
    try:
        if int(expires) < int(time.time()):
            return None
    except ValueError:
        return None
    return farmer_id


def check_credentials(username: str, password: str) -> bool:
    settings = get_settings()
    return hmac.compare_digest(username.strip(), settings.demo_username) and hmac.compare_digest(
        password, settings.demo_password
    )


def current_farmer(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Farmer:
    """Resolve the caller, or refuse the request."""
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]

    farmer_id = read_token(token)
    if not farmer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    farmer = db.scalar(select(Farmer).where(Farmer.id == farmer_id))
    if farmer is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown account.")
    return farmer


def random_secret() -> str:
    return secrets.token_urlsafe(48)

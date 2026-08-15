"""
Warehouse receipts.

A receipt is only worth lending against if two things hold, and they are
different:

* **Integrity** - the contents have not changed since issue.
* **Authorship** - this facility issued it, and nobody else could have.

Receipts are signed with **Ed25519**. The private key stays on the server, the
public key is published at `/api/receipts/public-key`, and a buyer, lender or
gate clerk can verify a receipt without being able to issue one.
"""

from __future__ import annotations

import base64
import hashlib

from app import brand
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from app.config import get_settings

VERSION = brand.RECEIPT_PREFIX
ALGORITHM = "Ed25519"

# Field order is part of the format. Appending is safe; reordering or removing
# is a new version, because every receipt already issued must keep verifying.
FIELDS = (
    "version",
    "number",
    "booking_ref",
    "farmer_id",
    "facility_id",
    "crop_id",
    "weight_kg",
    "checkin_date",
    "expiry_date",
)


class ReceiptError(Exception):
    pass


@dataclass(frozen=True)
class Verdict:
    valid: bool
    reason: str | None = None
    fields: dict[str, str] | None = None


def _private_key() -> Ed25519PrivateKey:
    """
    Derive the signing key from the configured secret.

    Deriving rather than storing raw key bytes keeps secret handling identical
    to any other setting. Move this to a KMS-held key before real money moves;
    the verification path does not change when you do.
    """
    secret = get_settings().receipt_signing_key
    if not secret:
        raise ReceiptError("RECEIPT_SIGNING_KEY is not set.")
    return Ed25519PrivateKey.from_private_bytes(hashlib.sha256(secret.encode()).digest())


def public_key_b64() -> str:
    raw = _private_key().public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw
    )
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def canonical_payload(
    *,
    number: str,
    booking_ref: str,
    farmer_id: str,
    facility_id: str,
    crop_id: str,
    weight_kg: Decimal,
    checkin_date: date,
    expiry_date: date,
) -> str:
    """
    The exact string that gets signed.

    Weight is normalised to two decimals and dates to ISO, so the same receipt
    serialises identically on every machine that handles it.
    """
    values = [
        VERSION,
        number,
        booking_ref,
        str(farmer_id),
        str(facility_id),
        crop_id,
        f"{Decimal(weight_kg):.2f}",
        checkin_date.isoformat(),
        expiry_date.isoformat(),
    ]
    for value in values:
        if "|" in value or "#" in value:
            raise ReceiptError(f"Field would break the payload separator: {value!r}")
    return "|".join(values)


def sign(payload: str) -> str:
    return _b64(_private_key().sign(payload.encode()))


def encode(payload: str, signature: str) -> str:
    """What the QR carries: payload and signature, separated by `#`."""
    return f"{payload}#{signature}"


def short_code(signature: str) -> str:
    """Twelve characters a person can read out over a phone."""
    return hashlib.sha256(signature.encode()).hexdigest()[:12].upper()


def verify(raw: str, public_key_override: Ed25519PublicKey | None = None) -> Verdict:
    """Check a scanned or pasted receipt. Never raises on bad input."""
    text = (raw or "").strip()
    if not text:
        return Verdict(False, "Nothing to check.")

    cut = text.rfind("#")
    if cut < 1:
        return Verdict(False, f"Not a {brand.NAME} receipt - the signature is missing.")

    payload, signature = text[:cut], text[cut + 1 :]
    parts = payload.split("|")

    if len(parts) != len(FIELDS) or parts[0] != VERSION:
        return Verdict(False, "Unrecognised receipt format.")

    fields = dict(zip(FIELDS, parts, strict=True))
    key = public_key_override or _private_key().public_key()

    try:
        key.verify(_unb64(signature), payload.encode())
    except (InvalidSignature, ValueError, TypeError):
        return Verdict(
            False,
            "The signature does not match the contents. This receipt has been altered.",
            fields,
        )

    return Verdict(True, None, fields)

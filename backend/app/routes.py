"""HTTP API. One module - the surface is small enough to read in one sitting."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import brand
from app.auth import check_credentials, current_farmer, issue_token
from app.config import get_settings
from app.db import get_db
from app.models import (
    Booking,
    BookingSlot,
    Crop,
    Facility,
    Farmer,
    FreshnessScan,
    Receipt,
    Slot,
    utcnow,
)
from app.services import booking as B
from app.services import receipt as R

router = APIRouter(prefix="/api")


# ─────────────────────────────────────────────────────────────── schemas ──


class LoginRequest(BaseModel):
    username: str
    password: str


class FarmerOut(BaseModel):
    id: str
    name: str
    username: str
    village: str | None = None
    district: str | None = None
    language: str


class LoginResponse(BaseModel):
    token: str
    farmer: FarmerOut


class CropOut(BaseModel):
    id: str
    name: str
    name_hi: str | None
    name_pa: str | None
    shelf_life_days: int


class FacilityOut(BaseModel):
    id: str
    name: str
    distance_km: float
    price_paise_per_kg_day: int
    temp_min_c: float
    temp_max_c: float
    accepts_micro_slots: bool
    min_booking_kg: int
    slots_free: int
    verified: bool


class BookingCreate(BaseModel):
    facility_id: str
    crop_id: str
    quantity_kg: Decimal = Field(gt=0, le=100_000)
    expected_days: int = Field(default=6, ge=1, le=90)
    pooled: bool = False
    pickup_label: str = Field(default="Tomorrow", max_length=64)
    # Generated on the device, so an offline retry lands exactly once.
    client_key: str | None = Field(default=None, max_length=64)


class BookingOut(BaseModel):
    id: str
    reference: str
    client_key: str
    facility_id: str
    facility_name: str
    crop_id: str
    quantity_kg: float
    slots_held: int
    pooled: bool
    pickup_label: str
    status: str
    price_paise_per_kg_day: int
    expected_days: int
    created_at: str
    expiry_at: str | None = None
    estimated_cost_paise: int


class ReceiptOut(BaseModel):
    number: str
    payload: str
    signature: str
    qr: str
    short_code: str
    algorithm: str


class VerifyRequest(BaseModel):
    code: str = Field(max_length=2048)


class VerifyResponse(BaseModel):
    valid: bool
    reason: str | None = None
    algorithm: str = R.ALGORITHM
    fields: dict[str, str] | None = None


class ScanCreate(BaseModel):
    """The analysis runs in the browser; this records what it concluded."""

    predicted_crop_id: str | None = None
    crop_confidence: int = Field(default=0, ge=0, le=100)
    freshness_score: int = Field(ge=0, le=100)
    remaining_shelf_life_days: float = Field(ge=0, le=365)
    recommendation: str
    features: dict | None = None


class ScanOut(BaseModel):
    id: str
    predicted_crop_id: str | None
    crop_confidence: int
    freshness_score: int
    remaining_shelf_life_days: float
    recommendation: str
    created_at: str


# ───────────────────────────────────────────────────────────── helpers ──


def _booking_out(session: Session, b: Booking) -> BookingOut:
    facility = session.get(Facility, b.facility_id)
    return BookingOut(
        id=b.id,
        reference=b.reference,
        client_key=b.client_key,
        facility_id=b.facility_id,
        facility_name=facility.name if facility else "Unknown",
        crop_id=b.crop_id,
        quantity_kg=float(b.quantity_kg),
        slots_held=b.slots_held,
        pooled=b.pooled,
        pickup_label=b.pickup_label,
        status=b.status,
        price_paise_per_kg_day=b.price_paise_per_kg_day,
        expected_days=b.expected_days,
        created_at=b.created_at.isoformat() if b.created_at else utcnow().isoformat(),
        expiry_at=b.expiry_at.isoformat() if b.expiry_at else None,
        estimated_cost_paise=B.storage_cost_paise(b),
    )


# ────────────────────────────────────────────────────────────── routes ──


@router.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "environment": get_settings().environment}


@router.post("/auth/login", response_model=LoginResponse, tags=["auth"])
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    if not check_credentials(body.username, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong username or password."
        )

    farmer = db.scalar(select(Farmer).where(Farmer.username == get_settings().demo_username))
    if farmer is None:
        raise HTTPException(status_code=500, detail="Demo account is missing. Reseed the database.")

    return LoginResponse(token=issue_token(farmer.id), farmer=FarmerOut(**farmer.__dict__))


@router.get("/me", response_model=FarmerOut, tags=["auth"])
def me(farmer: Farmer = Depends(current_farmer)) -> FarmerOut:
    return FarmerOut(**farmer.__dict__)


@router.get("/crops", response_model=list[CropOut], tags=["catalog"])
def crops(db: Session = Depends(get_db)) -> list[CropOut]:
    return [CropOut(**c.__dict__) for c in db.scalars(select(Crop).order_by(Crop.name))]


@router.get("/facilities", response_model=list[FacilityOut], tags=["catalog"])
def facilities(db: Session = Depends(get_db)) -> list[FacilityOut]:
    rows = db.scalars(select(Facility).order_by(Facility.distance_km)).all()
    free_counts = dict(
        db.execute(
            select(Slot.facility_id, func.count())
            .where(Slot.status == "FREE")
            .group_by(Slot.facility_id)
        ).all()
    )
    return [
        FacilityOut(
            id=f.id,
            name=f.name,
            distance_km=float(f.distance_km),
            price_paise_per_kg_day=f.price_paise_per_kg_day,
            temp_min_c=float(f.temp_min_c),
            temp_max_c=float(f.temp_max_c),
            accepts_micro_slots=f.accepts_micro_slots,
            min_booking_kg=f.min_booking_kg,
            slots_free=free_counts.get(f.id, 0),
            verified=f.verified,
        )
        for f in rows
    ]


@router.get("/bookings", response_model=list[BookingOut], tags=["bookings"])
def list_bookings(
    farmer: Farmer = Depends(current_farmer), db: Session = Depends(get_db)
) -> list[BookingOut]:
    rows = db.scalars(
        select(Booking).where(Booking.farmer_id == farmer.id).order_by(Booking.created_at.desc())
    ).all()
    return [_booking_out(db, b) for b in rows]


@router.post(
    "/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED, tags=["bookings"]
)
def create_booking(
    body: BookingCreate,
    farmer: Farmer = Depends(current_farmer),
    db: Session = Depends(get_db),
) -> BookingOut:
    crop = db.get(Crop, body.crop_id)
    if crop is None:
        raise HTTPException(status_code=404, detail="Unknown crop.")

    try:
        b = B.reserve(
            db,
            B.ReservationRequest(
                farmer_id=farmer.id,
                facility_id=body.facility_id,
                crop_id=body.crop_id,
                quantity_kg=body.quantity_kg,
                expected_days=body.expected_days,
                pooled=body.pooled,
                pickup_label=body.pickup_label,
                client_key=body.client_key,
            ),
        )
    except B.FacilityRefusesLot as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except B.NotEnoughCapacity as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except B.BookingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # A booking made through the app is confirmed immediately; the PENDING hold
    # exists for flows where a farmer is still deciding.
    if b.status == "PENDING":
        B.transition(db, b, "CONFIRMED")
        b.checkin_at = utcnow()
        b.expiry_at = utcnow() + timedelta(days=crop.shelf_life_days)

    db.commit()
    return _booking_out(db, b)


@router.post("/bookings/{reference}/cancel", response_model=BookingOut, tags=["bookings"])
def cancel_booking(
    reference: str,
    farmer: Farmer = Depends(current_farmer),
    db: Session = Depends(get_db),
) -> BookingOut:
    b = db.scalar(
        select(Booking).where(Booking.reference == reference, Booking.farmer_id == farmer.id)
    )
    if b is None:
        raise HTTPException(status_code=404, detail="No such booking.")
    try:
        B.transition(db, b, "CANCELLED")
    except B.InvalidTransition as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    return _booking_out(db, b)


@router.get("/bookings/{reference}/receipt", response_model=ReceiptOut, tags=["receipts"])
def booking_receipt(
    reference: str,
    farmer: Farmer = Depends(current_farmer),
    db: Session = Depends(get_db),
) -> ReceiptOut:
    """Issue the receipt on first request, then always return the same one."""
    b = db.scalar(
        select(Booking).where(Booking.reference == reference, Booking.farmer_id == farmer.id)
    )
    if b is None:
        raise HTTPException(status_code=404, detail="No such booking.")

    existing = db.scalar(select(Receipt).where(Receipt.booking_id == b.id))
    if existing is None:
        checkin = (b.checkin_at or b.created_at or utcnow()).date()
        crop = db.get(Crop, b.crop_id)
        expiry = (b.expiry_at.date() if b.expiry_at else checkin + timedelta(days=crop.shelf_life_days))
        number = f"WR-{b.reference.removeprefix(brand.SHORT_CODE + '-')}"

        payload = R.canonical_payload(
            number=number,
            booking_ref=b.reference,
            farmer_id=b.farmer_id,
            facility_id=b.facility_id,
            crop_id=b.crop_id,
            weight_kg=Decimal(b.actual_weight_in_kg or b.quantity_kg),
            checkin_date=checkin,
            expiry_date=expiry,
        )
        existing = Receipt(
            booking_id=b.id,
            number=number,
            payload=payload,
            signature=R.sign(payload),
            algorithm=R.ALGORITHM,
        )
        db.add(existing)
        db.commit()

    return ReceiptOut(
        number=existing.number,
        payload=existing.payload,
        signature=existing.signature,
        qr=R.encode(existing.payload, existing.signature),
        short_code=R.short_code(existing.signature),
        algorithm=existing.algorithm,
    )


@router.post("/receipts/verify", response_model=VerifyResponse, tags=["receipts"])
def verify_receipt(body: VerifyRequest) -> VerifyResponse:
    """
    Deliberately unauthenticated: a receipt is only useful as collateral if the
    person deciding whether to lend against it can check it without an account.
    """
    v = R.verify(body.code)
    return VerifyResponse(valid=v.valid, reason=v.reason, fields=v.fields)


@router.get("/receipts/public-key", tags=["receipts"])
def public_key() -> dict:
    return {
        "algorithm": R.ALGORITHM,
        "public_key": R.public_key_b64(),
        "note": f"Verifies {brand.NAME} receipts. Cannot be used to issue them.",
    }


@router.get("/scans", response_model=list[ScanOut], tags=["freshness"])
def list_scans(
    farmer: Farmer = Depends(current_farmer), db: Session = Depends(get_db)
) -> list[ScanOut]:
    rows = db.scalars(
        select(FreshnessScan)
        .where(FreshnessScan.farmer_id == farmer.id)
        .order_by(FreshnessScan.created_at.desc())
        .limit(50)
    ).all()
    return [
        ScanOut(
            id=s.id,
            predicted_crop_id=s.predicted_crop_id,
            crop_confidence=s.crop_confidence,
            freshness_score=s.freshness_score,
            remaining_shelf_life_days=float(s.remaining_shelf_life_days),
            recommendation=s.recommendation,
            created_at=s.created_at.isoformat() if s.created_at else utcnow().isoformat(),
        )
        for s in rows
    ]


@router.post("/scans", response_model=ScanOut, status_code=status.HTTP_201_CREATED, tags=["freshness"])
def create_scan(
    body: ScanCreate,
    farmer: Farmer = Depends(current_farmer),
    db: Session = Depends(get_db),
) -> ScanOut:
    if body.recommendation not in {"COLD_STORE", "SELL_NOW", "SELL_URGENT"}:
        raise HTTPException(status_code=422, detail="Unknown recommendation.")
    if body.predicted_crop_id and db.get(Crop, body.predicted_crop_id) is None:
        raise HTTPException(status_code=404, detail="Unknown crop.")

    scan = FreshnessScan(
        farmer_id=farmer.id,
        predicted_crop_id=body.predicted_crop_id,
        crop_confidence=body.crop_confidence,
        freshness_score=body.freshness_score,
        remaining_shelf_life_days=Decimal(str(round(body.remaining_shelf_life_days, 1))),
        recommendation=body.recommendation,
        features=body.features,
    )
    db.add(scan)
    db.commit()

    return ScanOut(
        id=scan.id,
        predicted_crop_id=scan.predicted_crop_id,
        crop_confidence=scan.crop_confidence,
        freshness_score=scan.freshness_score,
        remaining_shelf_life_days=float(scan.remaining_shelf_life_days),
        recommendation=scan.recommendation,
        created_at=scan.created_at.isoformat() if scan.created_at else utcnow().isoformat(),
    )


class DemoResetOut(BaseModel):
    bookings_cleared: int
    receipts_cleared: int
    scans_cleared: int
    slots_freed: int


@router.post("/demo/reset", response_model=DemoResetOut, tags=["demo"])
def reset_demo(db: Session = Depends(get_db)) -> DemoResetOut:
    """Return the demonstration data to its opening state.

    A 450 kg lot takes eighteen of a facility's 180 micro-slots, so ten runs
    fill it and the eleventh is correctly refused. That refusal is the system
    working - but it is also a presenter discovering mid-demo that bookings have
    stopped, which is not a lesson anybody needs on stage.

    Only available in development. In any other environment this route does not
    exist at all, because an endpoint that deletes every booking is not
    something to leave reachable and merely guarded.
    """
    if get_settings().environment != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    # Children before parents: foreign keys are enforced.
    db.query(BookingSlot).delete(synchronize_session=False)
    receipts = db.query(Receipt).delete(synchronize_session=False)
    scans = db.query(FreshnessScan).delete(synchronize_session=False)
    bookings = db.query(Booking).delete(synchronize_session=False)

    # Free every slot that a booking was holding. Slots deliberately kept out of
    # service - the bulk-only facility's - stay that way.
    slots = (
        db.query(Slot)
        .filter(Slot.status == "HELD")
        .update({Slot.status: "FREE"}, synchronize_session=False)
    )
    db.commit()

    return DemoResetOut(
        bookings_cleared=bookings,
        receipts_cleared=receipts,
        scans_cleared=scans,
        slots_freed=slots,
    )

# ─────────────────────────────────────────────────────── live mandi prices ──


@router.get("/prices/live")
def live_mandi_prices(commodity: str, state: str = "Uttar Pradesh") -> dict:
    """Proxy the Agmarknet daily-price dataset on data.gov.in.

    Proxied server-side because the browser cannot call data.gov.in directly
    (no CORS), and because the API key belongs in the environment, not in a
    JavaScript bundle. Without a key this answers 503 with a plain reason and
    the app falls back to its modelled price series - the demo never breaks
    because a government API is slow, down, or keyless.
    """
    settings = get_settings()
    if not settings.mandi_api_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Live mandi prices are not configured. Set MANDI_API_KEY to a data.gov.in key.",
        )

    import json
    import urllib.parse
    import urllib.request

    query = urllib.parse.urlencode(
        {
            "api-key": settings.mandi_api_key,
            "format": "json",
            "limit": 12,
            "filters[commodity]": commodity,
            "filters[state]": state,
        }
    )
    url = f"https://api.data.gov.in/resource/{settings.mandi_resource_id}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=6) as response:  # noqa: S310 - fixed host
            payload = json.load(response)
    except Exception as error:  # pragma: no cover - network path
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Agmarknet did not answer: {error}") from error

    records = [
        {
            "market": r.get("market"),
            "district": r.get("district"),
            "commodity": r.get("commodity"),
            "arrival_date": r.get("arrival_date"),
            # Agmarknet publishes rupees per quintal; the app thinks per kg.
            "modal_price_per_kg": round(float(r.get("modal_price", 0) or 0) / 100, 2),
        }
        for r in payload.get("records", [])
    ]
    return {"source": "data.gov.in / Agmarknet", "records": records}


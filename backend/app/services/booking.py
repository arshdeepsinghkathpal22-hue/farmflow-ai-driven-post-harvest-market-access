"""
The booking core.

One invariant matters above everything else: **a micro-slot is never sold
twice**. On PostgreSQL that comes from `SELECT ... FOR UPDATE`; here it comes
from SQLite serialising writers, which `app/db.py` arranges by opening every
transaction with `BEGIN IMMEDIATE`. The write lock is taken before the free
slots are read, so a second reservation cannot interleave between the read and
the update - it waits, then sees the slots already taken.
"""

from __future__ import annotations

import math
import secrets
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import brand
from app.config import get_settings
from app.models import AuditLog, Booking, BookingSlot, Facility, Slot, new_id, utcnow


class BookingError(Exception):
    """A refusal the caller is expected to show to a user."""


class FacilityRefusesLot(BookingError):
    pass


class NotEnoughCapacity(BookingError):
    def __init__(self, requested: int, available: int) -> None:
        super().__init__(f"Needed {requested} slot(s), only {available} free.")
        self.requested = requested
        self.available = available


class InvalidTransition(BookingError):
    def __init__(self, current: str, attempted: str) -> None:
        super().__init__(f"Cannot move a booking from {current} to {attempted}.")
        self.current = current
        self.attempted = attempted


ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "PENDING": {"CONFIRMED", "CANCELLED", "EXPIRED"},
    "CONFIRMED": {"STORED", "CANCELLED"},
    "STORED": {"RELEASED"},
    "RELEASED": {"CLOSED"},
    "CLOSED": set(),
    "CANCELLED": set(),
    "EXPIRED": set(),
}

HOLDING_STATES = {"PENDING", "CONFIRMED", "STORED", "RELEASED"}


@dataclass(frozen=True)
class ReservationRequest:
    farmer_id: str
    facility_id: str
    crop_id: str
    quantity_kg: Decimal
    expected_days: int = 6
    pooled: bool = False
    pickup_label: str = "Tomorrow"
    client_key: str | None = None


def _reference() -> str:
    return f"{brand.SHORT_CODE}-{secrets.token_hex(3).upper()}"


def slots_needed(quantity_kg: Decimal, slot_size_kg: int) -> int:
    """A part-used slot is still a used slot, so always round up."""
    return max(1, math.ceil(Decimal(quantity_kg) / Decimal(slot_size_kg)))


def record(session: Session, **kwargs) -> None:
    """Append to the audit log on the caller's transaction, never its own."""
    session.add(AuditLog(**kwargs))


def reserve(session: Session, req: ReservationRequest) -> Booking:
    """
    Hold capacity for a booking.

    The caller owns the transaction, so the booking, its slots, the slot status
    change and the audit entry all land together or not at all.
    """
    settings = get_settings()

    # Offline retry: the same client key must never produce a second booking.
    if req.client_key:
        existing = session.scalar(select(Booking).where(Booking.client_key == req.client_key))
        if existing is not None:
            return existing

    facility = session.get(Facility, req.facility_id)
    if facility is None:
        raise BookingError("Unknown facility.")

    quantity = Decimal(req.quantity_kg)

    # The exclusion the product exists to remove, enforced here so a client that
    # simply does not render the warning cannot bypass it.
    if not facility.accepts_micro_slots and quantity < Decimal(facility.min_booking_kg):
        raise FacilityRefusesLot(
            f"{facility.name} takes bulk consignments only "
            f"(minimum {facility.min_booking_kg} kg)."
        )

    needed = slots_needed(quantity, facility.slot_size_kg)

    free_slot_ids = (
        session.execute(
            select(Slot.id)
            .where(Slot.facility_id == facility.id, Slot.status == "FREE")
            .order_by(Slot.id)
            .limit(needed)
        )
        .scalars()
        .all()
    )

    if len(free_slot_ids) < needed:
        raise NotEnoughCapacity(requested=needed, available=len(free_slot_ids))

    now = utcnow()
    booking = Booking(
        id=new_id(),
        reference=_reference(),
        client_key=req.client_key or new_id(),
        farmer_id=req.farmer_id,
        facility_id=facility.id,
        crop_id=req.crop_id,
        quantity_kg=quantity,
        slots_held=needed,
        pooled=req.pooled,
        pickup_label=req.pickup_label,
        status="PENDING",
        hold_expires_at=now + timedelta(minutes=settings.booking_confirm_window_minutes),
        price_paise_per_kg_day=facility.price_paise_per_kg_day,
        expected_days=req.expected_days,
    )
    session.add(booking)
    session.flush()

    session.execute(update(Slot).where(Slot.id.in_(free_slot_ids)).values(status="HELD"))
    session.add_all(
        BookingSlot(booking_id=booking.id, slot_id=sid) for sid in free_slot_ids
    )

    record(
        session,
        entity_type="booking",
        entity_id=booking.id,
        action="reserved",
        to_state="PENDING",
        detail={"slots": needed, "quantity_kg": str(quantity), "facility": facility.name},
    )
    return booking


def transition(session: Session, booking: Booking, to_state: str, detail: dict | None = None) -> Booking:
    """Move a booking through its state machine, refusing illegal jumps."""
    current = booking.status
    if to_state not in ALLOWED_TRANSITIONS.get(current, set()):
        raise InvalidTransition(current, to_state)

    booking.status = to_state

    if current in HOLDING_STATES and to_state not in HOLDING_STATES:
        release_slots(session, booking)

    if to_state == "CONFIRMED":
        booking.hold_expires_at = None

    record(
        session,
        entity_type="booking",
        entity_id=booking.id,
        action=f"transition:{to_state.lower()}",
        from_state=current,
        to_state=to_state,
        detail=detail,
    )
    return booking


def release_slots(session: Session, booking: Booking) -> int:
    slot_ids = (
        session.execute(select(BookingSlot.slot_id).where(BookingSlot.booking_id == booking.id))
        .scalars()
        .all()
    )
    if not slot_ids:
        return 0
    session.execute(
        update(Slot)
        .where(Slot.id.in_(slot_ids), Slot.status != "MAINTENANCE")
        .values(status="FREE")
    )
    return len(slot_ids)


def storage_cost_paise(booking: Booking, days: int | None = None) -> int:
    """Billed on the weight actually stored, never the quoted estimate."""
    weight = Decimal(booking.actual_weight_in_kg or booking.quantity_kg)
    billable = days if days is not None else booking.expected_days
    return int(
        (weight * Decimal(booking.price_paise_per_kg_day) * Decimal(billable)).to_integral_value()
    )


def expire_stale_holds(session: Session, limit: int = 200) -> list[Booking]:
    """
    Release bookings that were never confirmed.

    Without this a handful of abandoned bookings quietly strand capacity and the
    facility looks full when it is not, which is the fastest way to lose an
    owner's trust in the platform.
    """
    stale = (
        session.execute(
            select(Booking)
            .where(
                Booking.status == "PENDING",
                Booking.hold_expires_at.is_not(None),
                Booking.hold_expires_at < utcnow(),
            )
            .order_by(Booking.hold_expires_at)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    for booking in stale:
        transition(session, booking, "EXPIRED", {"reason": "confirmation window elapsed"})
    return stale

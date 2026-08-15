"""Booking lifecycle: refusals, state machine, expiry, billing."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import AuditLog, Booking, Slot, utcnow
from app.services.booking import (
    FacilityRefusesLot,
    InvalidTransition,
    NotEnoughCapacity,
    ReservationRequest,
    expire_stale_holds,
    reserve,
    storage_cost_paise,
    transition,
)

from tests.conftest import build_farmer


def _reserve(db, facility, farmer, tomato, qty="100.00", **kw):
    b = reserve(
        db,
        ReservationRequest(
            farmer_id=farmer.id,
            facility_id=facility.id,
            crop_id=tomato.id,
            quantity_kg=Decimal(qty),
            **kw,
        ),
    )
    db.commit()
    return b


def test_bulk_only_facility_refuses_a_small_lot(db, facility_with_slots, farmer, tomato):
    """The exact exclusion the product exists to remove, enforced server side."""
    facility = facility_with_slots(
        slots=40, accepts_micro_slots=False, min_booking_kg=450, name="Rampur Agro Hub"
    )

    with pytest.raises(FacilityRefusesLot) as exc:
        _reserve(db, facility, farmer, tomato, qty="120.00")

    assert "bulk" in str(exc.value).lower()
    assert db.scalar(select(func.count()).select_from(Booking)) == 0
    # A refusal must not leave capacity stranded.
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "FREE")) == 40


def test_same_facility_accepts_once_micro_slots_are_on(db, facility_with_slots, farmer, tomato):
    facility = facility_with_slots(slots=40, accepts_micro_slots=True)
    b = _reserve(db, facility, farmer, tomato, qty="120.00")
    assert b.status == "PENDING"
    assert b.slots_held == 5


def test_refuses_when_capacity_runs_out(db, facility_with_slots, farmer, tomato):
    facility = facility_with_slots(slots=2)

    with pytest.raises(NotEnoughCapacity) as exc:
        _reserve(db, facility, farmer, tomato, qty="200.00")  # needs 8

    assert exc.value.requested == 8
    assert exc.value.available == 2


def test_price_is_snapshot_at_reservation(db, facility_with_slots, farmer, tomato):
    """Repricing the facility must not silently reprice existing bookings."""
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="50.00")

    facility.price_paise_per_kg_day = 99
    db.commit()
    db.refresh(b)

    assert b.price_paise_per_kg_day == 6


def test_happy_path_through_the_state_machine(db, facility_with_slots, farmer, tomato):
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="100.00")

    transition(db, b, "CONFIRMED")
    db.commit()
    assert b.hold_expires_at is None

    transition(db, b, "STORED")
    transition(db, b, "RELEASED")
    transition(db, b, "CLOSED")
    db.commit()

    assert b.status == "CLOSED"
    # Closing hands the capacity back.
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "FREE")) == 10


def test_illegal_transitions_are_refused(db, facility_with_slots, farmer, tomato):
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="50.00")

    # A booking cannot be stored before it is confirmed.
    with pytest.raises(InvalidTransition):
        transition(db, b, "STORED")

    transition(db, b, "CANCELLED")
    db.commit()

    # And a cancelled booking is final.
    with pytest.raises(InvalidTransition):
        transition(db, b, "CONFIRMED")


def test_cancelling_returns_capacity(db, facility_with_slots, farmer, tomato):
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="100.00")
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "HELD")) == 4

    transition(db, b, "CANCELLED")
    db.commit()

    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "FREE")) == 10


def test_unconfirmed_holds_expire(db, facility_with_slots, farmer, tomato):
    """Abandoned bookings must not quietly make a facility look full."""
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="100.00")

    b.hold_expires_at = utcnow() - timedelta(minutes=1)
    db.commit()

    expired = expire_stale_holds(db)
    db.commit()

    assert [x.id for x in expired] == [b.id]
    assert b.status == "EXPIRED"
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "FREE")) == 10


def test_confirmed_bookings_are_never_expired(db, facility_with_slots, farmer, tomato):
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="50.00")
    transition(db, b, "CONFIRMED")
    b.hold_expires_at = utcnow() - timedelta(hours=5)  # stale, but confirmed
    db.commit()

    assert expire_stale_holds(db) == []


def test_storage_is_billed_on_actual_weight(db, facility_with_slots, farmer, tomato):
    """A farmer who brings 97.5 kg is billed for 97.5, not the 100 they quoted."""
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="100.00")
    b.actual_weight_in_kg = Decimal("97.50")
    db.commit()

    # 97.50 kg x 6 paise x 6 days = 3510 paise
    assert storage_cost_paise(b, days=6) == 3510


def test_every_transition_is_audited(db, facility_with_slots, farmer, tomato):
    facility = facility_with_slots(slots=10)
    b = _reserve(db, facility, farmer, tomato, qty="50.00")
    transition(db, b, "CONFIRMED")
    transition(db, b, "CANCELLED")
    db.commit()

    actions = db.scalars(
        select(AuditLog.action).where(AuditLog.entity_id == b.id).order_by(AuditLog.id)
    ).all()
    assert actions == ["reserved", "transition:confirmed", "transition:cancelled"]


def test_repeat_client_key_returns_the_same_booking(db, facility_with_slots, tomato):
    facility = facility_with_slots(slots=10)
    farmer = build_farmer(db)

    first = _reserve(db, facility, farmer, tomato, qty="50.00", client_key="k1")
    second = _reserve(db, facility, farmer, tomato, qty="50.00", client_key="k1")

    assert first.id == second.id
    assert db.scalar(select(func.count()).select_from(Booking)) == 1

"""
The test this whole system is built around.

If two farmers can be sold the same micro-slot, one of them arrives at a
warehouse gate with produce that is already losing value and nowhere to put it.
Everything else is recoverable; that is not.

On PostgreSQL the guarantee comes from `SELECT ... FOR UPDATE`. On SQLite it
comes from serialised writers - every transaction opens with `BEGIN IMMEDIATE`,
so the write lock is taken before the free slots are read. These tests open real
concurrent connections and check the guarantee actually holds.
"""

from __future__ import annotations

import threading
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import Booking, Slot
from app.services.booking import NotEnoughCapacity, ReservationRequest, reserve

from tests.conftest import build_farmer


def _race(make_session, *, workers: int, attempt):
    """
    Run `attempt` on `workers` threads, all released at the same instant.

    A barrier rather than a plain start: without it the first thread routinely
    finishes before the last has opened its connection, and the race under test
    never actually happens.
    """
    barrier = threading.Barrier(workers)
    successes: list = []
    failures: list = []
    lock = threading.Lock()

    def run(index: int) -> None:
        session = make_session()
        try:
            barrier.wait(timeout=30)
            result = attempt(session, index)
            session.commit()
            with lock:
                successes.append(result)
        except Exception as exc:  # noqa: BLE001 - the failure mode is the assertion
            session.rollback()
            with lock:
                failures.append(exc)
        finally:
            session.close()

    threads = [threading.Thread(target=run, args=(i,)) for i in range(workers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=90)

    return successes, failures


def test_last_slot_goes_to_exactly_one_farmer(db, make_session, facility_with_slots, tomato):
    """Twenty farmers, one free slot. Exactly one booking may exist afterwards."""
    facility = facility_with_slots(slots=1)
    farmers = [build_farmer(db, name=f"Farmer {i}") for i in range(20)]

    def attempt(session, index):
        return reserve(
            session,
            ReservationRequest(
                farmer_id=farmers[index].id,
                facility_id=facility.id,
                crop_id=tomato.id,
                quantity_kg=Decimal("20.00"),
            ),
        ).reference

    successes, failures = _race(make_session, workers=20, attempt=attempt)

    assert len(successes) == 1, f"{len(successes)} farmers were sold the same slot"
    assert all(isinstance(f, NotEnoughCapacity) for f in failures), (
        "losers should be told the facility is full, not hit an internal error: "
        f"{ {type(f).__name__ for f in failures} }"
    )
    assert db.scalar(select(func.count()).select_from(Booking)) == 1
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "HELD")) == 1
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "FREE")) == 0


def test_everyone_gets_capacity_when_there_is_enough(db, make_session, facility_with_slots, tomato):
    """Ten free slots, ten farmers wanting one each - all ten should succeed."""
    facility = facility_with_slots(slots=10)
    farmers = [build_farmer(db, name=f"Farmer {i}") for i in range(10)]

    def attempt(session, index):
        return reserve(
            session,
            ReservationRequest(
                farmer_id=farmers[index].id,
                facility_id=facility.id,
                crop_id=tomato.id,
                quantity_kg=Decimal("25.00"),
            ),
        ).reference

    successes, failures = _race(make_session, workers=10, attempt=attempt)

    assert len(successes) == 10, f"only {len(successes)} of 10 got capacity: {failures}"
    assert len(set(successes)) == 10, "booking references must be unique"
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "FREE")) == 0


def test_multi_slot_reservations_do_not_oversell(db, make_session, facility_with_slots, tomato):
    """
    Five slots, twelve farmers each needing two.

    Two can be satisfied and one slot is left over, because a lot needing two
    slots cannot be squeezed into one.
    """
    facility = facility_with_slots(slots=5)
    farmers = [build_farmer(db, name=f"Farmer {i}") for i in range(12)]

    def attempt(session, index):
        return reserve(
            session,
            ReservationRequest(
                farmer_id=farmers[index].id,
                facility_id=facility.id,
                crop_id=tomato.id,
                quantity_kg=Decimal("40.00"),  # 40 kg over 25 kg slots -> 2 slots
            ),
        ).reference

    successes, failures = _race(make_session, workers=12, attempt=attempt)

    held = db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "HELD"))
    free = db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "FREE"))

    assert len(successes) == 2
    assert len(failures) == 10
    assert held == 4
    assert free == 1
    # Never more slots handed out than exist.
    assert held + free == 5


def test_offline_retry_creates_one_booking(db, make_session, facility_with_slots, tomato):
    """
    The same client key, sent ten times at once.

    A phone that booked with no signal retries on reconnect, and a flaky
    connection can retry several times before one response gets through. All of
    them must collapse into a single booking holding a single slot.
    """
    facility = facility_with_slots(slots=10)
    farmer = build_farmer(db)
    client_key = "offline-retry-key"

    def attempt(session, index):
        return reserve(
            session,
            ReservationRequest(
                farmer_id=farmer.id,
                facility_id=facility.id,
                crop_id=tomato.id,
                quantity_kg=Decimal("20.00"),
                client_key=client_key,
            ),
        ).reference

    successes, failures = _race(make_session, workers=10, attempt=attempt)

    assert successes, f"every retry failed: {failures}"
    bookings = db.scalars(select(Booking).where(Booking.client_key == client_key)).all()
    assert len(bookings) == 1, f"offline retry created {len(bookings)} bookings"
    assert bookings[0].slots_held == 1
    assert db.scalar(select(func.count()).select_from(Slot).where(Slot.status == "HELD")) == 1


@pytest.mark.parametrize(
    "quantity,expected_slots", [("1.00", 1), ("25.00", 1), ("26.00", 2), ("120.00", 5)]
)
def test_slot_rounding(db, facility_with_slots, tomato, quantity, expected_slots):
    """A part-used slot is still a used slot."""
    facility = facility_with_slots(slots=20)
    farmer = build_farmer(db)

    booking = reserve(
        db,
        ReservationRequest(
            farmer_id=farmer.id,
            facility_id=facility.id,
            crop_id=tomato.id,
            quantity_kg=Decimal(quantity),
        ),
    )
    db.commit()
    assert booking.slots_held == expected_slots

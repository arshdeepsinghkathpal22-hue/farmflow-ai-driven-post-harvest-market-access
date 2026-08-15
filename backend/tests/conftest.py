"""
Test fixtures.

Every test gets a fresh SQLite file rather than an in-memory database: the
concurrency tests open several real connections at once, and `:memory:` gives
each connection its own private database, which would make the race under test
impossible to observe.
"""

from __future__ import annotations

import os
import tempfile
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db import Base, build_engine
from app.models import Crop, Facility, Farmer, Slot

import app.models  # noqa: F401  - registers the mappers


@pytest.fixture
def db_path(tmp_path: Path) -> str:
    return (tmp_path / "test.db").as_posix()


@pytest.fixture
def engine(db_path: str):
    eng = build_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def make_session(engine) -> sessionmaker[Session]:
    """Factory, so concurrency tests can open genuinely independent sessions."""
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


@pytest.fixture
def db(make_session) -> Session:
    session = make_session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def tomato(db: Session) -> Crop:
    crop = Crop(
        id="tomato",
        name="Tomato",
        name_hi="टमाटर",
        name_pa="ਟਮਾਟਰ",
        shelf_life_days=9,
        ideal_temp_min_c=Decimal(2),
        ideal_temp_max_c=Decimal(4),
    )
    db.add(crop)
    db.commit()
    return crop


def build_facility(
    db: Session,
    *,
    slots: int,
    slot_size_kg: int = 25,
    accepts_micro_slots: bool = True,
    min_booking_kg: int = 50,
    name: str = "Kisan Cold Storage",
) -> Facility:
    facility = Facility(
        name=name,
        district="Rampur",
        distance_km=Decimal("2.4"),
        capacity_kg=max(1, slots * slot_size_kg),
        slot_size_kg=slot_size_kg,
        price_paise_per_kg_day=6,
        temp_min_c=Decimal(2),
        temp_max_c=Decimal(4),
        accepts_micro_slots=accepts_micro_slots,
        min_booking_kg=min_booking_kg,
    )
    db.add(facility)
    db.flush()
    db.add_all(
        Slot(facility_id=facility.id, index=i, capacity_kg=slot_size_kg, status="FREE")
        for i in range(slots)
    )
    db.commit()
    return facility


def build_farmer(db: Session, *, username: str | None = None, name: str = "Rajesh Kumar") -> Farmer:
    farmer = Farmer(
        username=username or f"farmer-{os.urandom(4).hex()}",
        name=name,
        village="Rampur",
        district="Rampur",
        language="hi",
    )
    db.add(farmer)
    db.commit()
    return farmer


@pytest.fixture
def facility_with_slots(db: Session, tomato):
    def _make(slots: int, **kwargs) -> Facility:
        return build_facility(db, slots=slots, **kwargs)

    return _make


@pytest.fixture
def farmer(db: Session) -> Farmer:
    return build_farmer(db)


@pytest.fixture
def api_client(db_path: str, monkeypatch):
    """A TestClient wired to a throwaway database, already signed in."""
    from fastapi.testclient import TestClient

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    get_settings.cache_clear()

    import app.db as appdb

    appdb._engine = None
    appdb._SessionLocal = None

    from app.main import app as fastapi_app

    with TestClient(fastapi_app) as client:
        settings = get_settings()
        response = client.post(
            "/api/auth/login",
            json={"username": settings.demo_username, "password": settings.demo_password},
        )
        assert response.status_code == 200, response.text
        client.headers["Authorization"] = f"Bearer {response.json()['token']}"
        yield client

    appdb._engine = None
    appdb._SessionLocal = None
    get_settings.cache_clear()

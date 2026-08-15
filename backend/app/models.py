"""
Schema.

Two conventions throughout:

* **Money is integer paise.** Never a float - a rounding error in a farmer's
  settlement is not a rounding error to the farmer.
* **Weights are Numeric(10, 2) kilograms.** A weighbridge reads 113.40 kg, and
  quoted-versus-actual is the most likely source of a dispute.

Identifiers are strings rather than a native UUID column so the same models run
unchanged on SQLite here and on PostgreSQL later.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


SLOT_STATUSES = ("FREE", "HELD", "OCCUPIED", "MAINTENANCE")
BOOKING_STATUSES = (
    "PENDING",
    "CONFIRMED",
    "STORED",
    "RELEASED",
    "CLOSED",
    "CANCELLED",
    "EXPIRED",
)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Farmer(Base, TimestampMixin):
    __tablename__ = "farmers"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    village: Mapped[str | None] = mapped_column(String(120))
    district: Mapped[str | None] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(4), default="hi", nullable=False)


class Crop(Base):
    __tablename__ = "crops"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    name_hi: Mapped[str | None] = mapped_column(String(80))
    name_pa: Mapped[str | None] = mapped_column(String(80))
    shelf_life_days: Mapped[int] = mapped_column(Integer, nullable=False)
    ideal_temp_min_c: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    ideal_temp_max_c: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)


class Facility(Base, TimestampMixin):
    __tablename__ = "facilities"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    district: Mapped[str | None] = mapped_column(String(120))
    distance_km: Mapped[float] = mapped_column(Numeric(5, 1), default=0, nullable=False)

    capacity_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    slot_size_kg: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    price_paise_per_kg_day: Mapped[int] = mapped_column(Integer, nullable=False)

    temp_min_c: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    temp_max_c: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)

    # The switch the whole product exists to flip.
    accepts_micro_slots: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    min_booking_kg: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    slots: Mapped[list[Slot]] = relationship(
        back_populates="facility", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("capacity_kg > 0", name="ck_facility_capacity"),
        CheckConstraint("slot_size_kg > 0", name="ck_facility_slot_size"),
    )


class Slot(Base):
    """One addressable unit of capacity."""

    __tablename__ = "slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    facility_id: Mapped[str] = mapped_column(
        ForeignKey("facilities.id", ondelete="CASCADE"), nullable=False
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    capacity_kg: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="FREE", nullable=False)

    facility: Mapped[Facility] = relationship(back_populates="slots")

    __table_args__ = (
        UniqueConstraint("facility_id", "index", name="uq_slot_facility_index"),
        Index("ix_slot_facility_status", "facility_id", "status"),
        CheckConstraint(
            "status IN ('FREE','HELD','OCCUPIED','MAINTENANCE')", name="ck_slot_status"
        ),
    )


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    reference: Mapped[str] = mapped_column(String(24), unique=True, nullable=False)

    # Generated on the device before the request leaves it, so a booking made
    # offline and retried on reconnect lands exactly once.
    client_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)

    farmer_id: Mapped[str] = mapped_column(ForeignKey("farmers.id"), nullable=False)
    facility_id: Mapped[str] = mapped_column(ForeignKey("facilities.id"), nullable=False)
    crop_id: Mapped[str] = mapped_column(ForeignKey("crops.id"), nullable=False)

    quantity_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    slots_held: Mapped[int] = mapped_column(Integer, nullable=False)
    pooled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pickup_label: Mapped[str] = mapped_column(String(64), default="Tomorrow", nullable=False)

    status: Mapped[str] = mapped_column(String(16), default="PENDING", nullable=False)
    hold_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Snapshot: the facility may reprice tomorrow, but this booking is billed
    # at the rate quoted when it was made.
    price_paise_per_kg_day: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_days: Mapped[int] = mapped_column(Integer, default=6, nullable=False)

    checkin_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expiry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_weight_in_kg: Mapped[float | None] = mapped_column(Numeric(10, 2))

    slot_links: Mapped[list[BookingSlot]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )
    receipt: Mapped[Receipt | None] = relationship(
        back_populates="booking", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("quantity_kg > 0", name="ck_booking_quantity"),
        CheckConstraint("slots_held > 0", name="ck_booking_slots"),
        Index("ix_booking_farmer_status", "farmer_id", "status"),
        Index("ix_booking_hold_expiry", "status", "hold_expires_at"),
    )


class BookingSlot(Base):
    __tablename__ = "booking_slots"

    booking_id: Mapped[str] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), primary_key=True
    )
    slot_id: Mapped[int] = mapped_column(
        ForeignKey("slots.id", ondelete="CASCADE"), primary_key=True
    )

    booking: Mapped[Booking] = relationship(back_populates="slot_links")


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    booking_id: Mapped[str] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)

    # The exact bytes that were signed, kept verbatim. Re-deriving them from the
    # booking later would break the moment a field is renamed.
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    signature: Mapped[str] = mapped_column(String(128), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(32), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    booking: Mapped[Booking] = relationship(back_populates="receipt")


class FreshnessScan(Base):
    """A photo the farmer checked, and what the analyser made of it."""

    __tablename__ = "freshness_scans"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    farmer_id: Mapped[str] = mapped_column(ForeignKey("farmers.id"), nullable=False)
    predicted_crop_id: Mapped[str | None] = mapped_column(ForeignKey("crops.id"))
    crop_confidence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    freshness_score: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining_shelf_life_days: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    recommendation: Mapped[str] = mapped_column(String(16), nullable=False)
    features: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "recommendation IN ('COLD_STORE','SELL_NOW','SELL_URGENT')",
            name="ck_scan_recommendation",
        ),
    )


class AuditLog(Base):
    """Append-only record of every state transition."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(48), nullable=False)
    from_state: Mapped[str | None] = mapped_column(String(32))
    to_state: Mapped[str | None] = mapped_column(String(32))
    detail: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)

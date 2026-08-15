"""
Seed data.

Mirrors the Rampur pilot cluster the prototype shows, so the app looks the same
whether it is running standalone or against this backend. Seeding is idempotent
- it is safe to call on every startup.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Crop, Facility, Farmer, Slot

CROPS = [
    # id, en, hi, pa, shelf life (days), ideal temp band
    ("tomato", "Tomato", "टमाटर", "ਟਮਾਟਰ", 9, 2, 4),
    ("potato", "Potato", "आलू", "ਆਲੂ", 21, 2, 4),
    ("onion", "Onion", "प्याज़", "ਪਿਆਜ਼", 30, 0, 2),
    ("cauliflower", "Cauliflower", "फूलगोभी", "ਫੁੱਲ ਗੋਭੀ", 7, 0, 2),
    # Chilling-sensitive: below about 7 degrees capsicum pits and softens,
    # so its ideal band sits well above every other crop here.
    ("capsicum", "Capsicum", "शिमला मिर्च", "ਸ਼ਿਮਲਾ ਮਿਰਚ", 12, 7, 10),
]

# Rates sit in the Rs 1.50-2.50 per kg per month band Indian cold storages
# actually charge.
#
# The ids are fixed rather than generated, and they match the ids the web app
# ships in its own seed data. That is what lets a booking made on the device be
# pushed to this backend without a name-matching step in between - the client
# already knows which facility it chose.
FACILITIES = [
    # id, name, distance km, capacity kg, paise/kg/day, temp band, micro-slots, min kg
    ("ST-01", "Kisan Cold Storage", 2.4, 100_000, 6, (2, 4), True, 50),
    ("ST-02", "Rampur Agro Hub", 4.1, 80_000, 5, (2, 5), False, 450),
    ("ST-03", "Green Valley Storage", 6.8, 60_000, 9, (-2, 0), True, 50),
    ("ST-04", "Sharma Cold Storage", 3.2, 90_000, 7, (2, 4), True, 50),
]

# Only a slice of each facility is carved into micro-slots; the rest stays bulk.
MICRO_SLOTS_PER_FACILITY = 180


def seed(session: Session) -> None:
    settings = get_settings()

    # Add crops that are missing, rather than skipping the block whenever any
    # crop exists.
    #
    # All-or-nothing seeding is fine exactly once. The moment a crop is added to
    # the list - capsicum was - every database created before that day silently
    # never gets it, and the only symptom is a 404 when somebody books the new
    # crop. Seeding is meant to be idempotent; this makes it idempotent per row
    # instead of per table.
    existing = set(session.scalars(select(Crop.id)).all())
    missing = [c for c in CROPS if c[0] not in existing]
    if missing:
        session.add_all(
            Crop(
                id=cid,
                name=en,
                name_hi=hi,
                name_pa=pa,
                shelf_life_days=life,
                ideal_temp_min_c=Decimal(lo),
                ideal_temp_max_c=Decimal(hi_t),
            )
            for cid, en, hi, pa, life, lo, hi_t in missing
        )

    if session.scalar(select(func.count()).select_from(Farmer)) == 0:
        session.add(
            Farmer(
                username=settings.demo_username,
                name="Rajesh Kumar",
                phone="+91 98••• ••210",
                village="Rampur",
                district="Rampur, Uttar Pradesh",
                language="hi",
            )
        )

    if session.scalar(select(func.count()).select_from(Facility)) == 0:
        for fid, name, distance, capacity, price, (lo, hi_t), micro, min_kg in FACILITIES:
            facility = Facility(
                id=fid,
                name=name,
                district="Rampur",
                distance_km=Decimal(str(distance)),
                capacity_kg=capacity,
                slot_size_kg=25,
                price_paise_per_kg_day=price,
                temp_min_c=Decimal(lo),
                temp_max_c=Decimal(hi_t),
                accepts_micro_slots=micro,
                min_booking_kg=min_kg,
                verified=True,
            )
            session.add(facility)
            session.flush()

            session.add_all(
                Slot(
                    facility_id=facility.id,
                    index=i,
                    capacity_kg=facility.slot_size_kg,
                    # A facility that refuses micro-slots has none carved out.
                    status="FREE" if micro else "MAINTENANCE",
                )
                for i in range(MICRO_SLOTS_PER_FACILITY)
            )

    session.commit()

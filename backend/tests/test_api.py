"""The HTTP surface, end to end against a real SQLite database."""

from __future__ import annotations

import pytest

from app.config import get_settings


def test_health_needs_no_auth(api_client):
    assert api_client.get("/api/health").json()["status"] == "ok"


def test_login_rejects_a_wrong_password(api_client):
    r = api_client.post("/api/auth/login", json={"username": "farmer", "password": "nope"})
    assert r.status_code == 401


def test_protected_routes_refuse_an_anonymous_caller(api_client):
    r = api_client.get("/api/bookings", headers={"Authorization": ""})
    assert r.status_code == 401


def test_seeded_catalog_is_available(api_client):
    crops = api_client.get("/api/crops").json()
    assert {c["id"] for c in crops} >= {"tomato", "potato", "onion", "cauliflower"}
    # Names carry all three languages the app speaks.
    tomato = next(c for c in crops if c["id"] == "tomato")
    assert tomato["name_hi"] and tomato["name_pa"]

    facilities = api_client.get("/api/facilities").json()
    assert len(facilities) == 4
    assert any(not f["accepts_micro_slots"] for f in facilities), "bulk-only facility missing"
    assert any(f["accepts_micro_slots"] and f["slots_free"] > 0 for f in facilities)


def _micro_facility(client):
    return next(
        f for f in client.get("/api/facilities").json()
        if f["accepts_micro_slots"] and f["slots_free"] > 0
    )


def test_booking_round_trip(api_client):
    facility = _micro_facility(api_client)

    r = api_client.post(
        "/api/bookings",
        json={
            "facility_id": facility["id"],
            "crop_id": "tomato",
            "quantity_kg": 120,
            "client_key": "trip-1",
        },
    )
    assert r.status_code == 201, r.text
    booking = r.json()
    assert booking["status"] == "CONFIRMED"
    assert booking["slots_held"] == 5  # 120 kg over 25 kg slots
    assert booking["estimated_cost_paise"] > 0

    listed = api_client.get("/api/bookings").json()
    assert [b["reference"] for b in listed] == [booking["reference"]]


def test_bulk_only_facility_is_refused_over_http(api_client):
    bulk = next(f for f in api_client.get("/api/facilities").json() if not f["accepts_micro_slots"])

    r = api_client.post(
        "/api/bookings",
        json={"facility_id": bulk["id"], "crop_id": "tomato", "quantity_kg": 120},
    )
    assert r.status_code == 409
    assert "bulk" in r.json()["detail"].lower()


def test_offline_retry_is_idempotent_over_http(api_client):
    facility = _micro_facility(api_client)
    payload = {
        "facility_id": facility["id"],
        "crop_id": "tomato",
        "quantity_kg": 50,
        "client_key": "same-key",
    }

    first = api_client.post("/api/bookings", json=payload).json()
    second = api_client.post("/api/bookings", json=payload).json()

    assert first["reference"] == second["reference"]
    assert len(api_client.get("/api/bookings").json()) == 1


def test_receipt_is_issued_once_and_verifies(api_client):
    facility = _micro_facility(api_client)
    booking = api_client.post(
        "/api/bookings",
        json={"facility_id": facility["id"], "crop_id": "tomato", "quantity_kg": 75},
    ).json()

    first = api_client.get(f"/api/bookings/{booking['reference']}/receipt").json()
    second = api_client.get(f"/api/bookings/{booking['reference']}/receipt").json()
    assert first["signature"] == second["signature"], "a receipt must not be reissued"
    assert first["algorithm"] == "Ed25519"
    assert len(first["short_code"]) == 12

    verdict = api_client.post("/api/receipts/verify", json={"code": first["qr"]}).json()
    assert verdict["valid"] is True
    assert verdict["fields"]["crop_id"] == "tomato"


def test_tampered_receipt_is_rejected(api_client):
    facility = _micro_facility(api_client)
    booking = api_client.post(
        "/api/bookings",
        json={"facility_id": facility["id"], "crop_id": "tomato", "quantity_kg": 75},
    ).json()
    receipt = api_client.get(f"/api/bookings/{booking['reference']}/receipt").json()

    payload, signature = receipt["qr"].rsplit("#", 1)
    tampered = payload.replace("|75.00|", "|175.00|")

    verdict = api_client.post("/api/receipts/verify", json={"code": f"{tampered}#{signature}"}).json()
    assert verdict["valid"] is False
    assert "altered" in verdict["reason"].lower()


def test_verification_needs_no_credentials(api_client):
    r = api_client.post(
        "/api/receipts/verify", json={"code": "rubbish"}, headers={"Authorization": ""}
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False


def test_public_key_is_published(api_client):
    body = api_client.get("/api/receipts/public-key").json()
    assert body["algorithm"] == "Ed25519"
    # A raw Ed25519 public key is 32 bytes: 43 characters unpadded base64url.
    assert len(body["public_key"]) == 43


def test_cancelling_frees_capacity(api_client):
    facility = _micro_facility(api_client)
    before = facility["slots_free"]

    booking = api_client.post(
        "/api/bookings",
        json={"facility_id": facility["id"], "crop_id": "tomato", "quantity_kg": 100},
    ).json()

    during = next(f for f in api_client.get("/api/facilities").json() if f["id"] == facility["id"])
    assert during["slots_free"] == before - 4

    api_client.post(f"/api/bookings/{booking['reference']}/cancel")
    after = next(f for f in api_client.get("/api/facilities").json() if f["id"] == facility["id"])
    assert after["slots_free"] == before


@pytest.mark.parametrize(
    "recommendation,score,days", [("COLD_STORE", 88, 7.5), ("SELL_NOW", 55, 3.0), ("SELL_URGENT", 22, 1.0)]
)
def test_freshness_scans_are_recorded(api_client, recommendation, score, days):
    r = api_client.post(
        "/api/scans",
        json={
            "predicted_crop_id": "tomato",
            "crop_confidence": 82,
            "freshness_score": score,
            "remaining_shelf_life_days": days,
            "recommendation": recommendation,
            "features": {"blemish_pct": 4.2},
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["recommendation"] == recommendation

    listed = api_client.get("/api/scans").json()
    assert listed[0]["freshness_score"] == score


def test_unknown_recommendation_is_refused(api_client):
    r = api_client.post(
        "/api/scans",
        json={
            "freshness_score": 50,
            "remaining_shelf_life_days": 2,
            "recommendation": "EAT_IT",
        },
    )
    assert r.status_code == 422


def test_demo_credentials_are_the_documented_ones():
    settings = get_settings()
    assert settings.demo_username == "farmer"
    assert settings.demo_password == "farmflow"


def test_demo_reset_frees_capacity_and_clears_bookings(api_client):
    """The presenter's escape hatch.

    A 450 kg lot takes eighteen of a facility's micro-slots, so a handful of
    demo runs fill it and the next booking is correctly refused. Correct, and a
    terrible thing to find out on stage - hence a reset, and hence a test that
    it really frees the slots rather than only deleting the rows.
    """
    facility = _micro_facility(api_client)
    before = facility["slots_free"]

    r = api_client.post(
        "/api/bookings",
        json={
            "facility_id": facility["id"],
            "crop_id": "tomato",
            "quantity_kg": 450,
            "client_key": "reset-me",
        },
    )
    assert r.status_code == 201, r.text
    held = r.json()["slots_held"]
    assert held == 18

    after_booking = next(
        f for f in api_client.get("/api/facilities").json() if f["id"] == facility["id"]
    )
    assert after_booking["slots_free"] == before - held

    reset = api_client.post("/api/demo/reset")
    assert reset.status_code == 200, reset.text
    assert reset.json()["bookings_cleared"] >= 1
    assert reset.json()["slots_freed"] >= held

    restored = next(
        f for f in api_client.get("/api/facilities").json() if f["id"] == facility["id"]
    )
    assert restored["slots_free"] == before
    assert api_client.get("/api/bookings").json() == []


def test_demo_reset_does_not_exist_outside_development(api_client, monkeypatch):
    """An endpoint that deletes every booking should not merely be guarded in
    production - it should not be reachable at all."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")

    r = api_client.post("/api/demo/reset")
    assert r.status_code == 404


def test_seeding_adds_a_crop_that_did_not_exist_before(db):
    """Seeding must repair an older database, not skip it.

    All-or-nothing seeding is fine exactly once. The moment a crop is added to
    the list - capsicum was - every database created before that day silently
    never receives it, and the only symptom is a 404 the first time somebody
    books the new crop. This deletes a crop and reseeds to prove the gap closes.
    """
    from sqlalchemy import select

    from app.models import Crop
    from app.seed import seed

    # The `db` fixture hands back an empty schema, so seed it first - that is
    # the "older database" this test is about repairing.
    seed(db)
    before = set(db.scalars(select(Crop.id)).all())
    assert "capsicum" in before, "capsicum should be seeded by default"

    db.query(Crop).filter(Crop.id == "capsicum").delete(synchronize_session=False)
    db.commit()
    assert "capsicum" not in set(db.scalars(select(Crop.id)).all())

    seed(db)

    after = set(db.scalars(select(Crop.id)).all())
    assert "capsicum" in after, "reseeding should restore the missing crop"
    # And it must not duplicate the ones that were already there.
    assert len(after) == len(before)

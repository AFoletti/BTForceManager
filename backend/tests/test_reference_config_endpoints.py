"""Regression tests for reference/config endpoints newly wired to the frontend.

Covers Phase 10 (Issue 1) wiring:
- GET /api/downtime-actions
- GET /api/sp-choices
- GET /api/achievement-definitions
- POST /api/mechs/{id}/downtime (persistence + warchest deduction)
"""
import os
import copy
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Config endpoints ---

def test_downtime_actions_config(s):
    r = s.get(f"{API}/downtime-actions")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    ids = [a["id"] for a in data]
    assert "repair-armor" in ids
    categories = {a["category"] for a in data}
    assert {"mechActions", "elementalActions", "pilotActions"} <= categories
    # shape check
    a0 = data[0]
    for f in ("id", "name", "description", "category", "formula", "flags"):
        assert f in a0


def test_sp_choices_list(s):
    r = s.get(f"{API}/sp-choices")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    for item in data[:3]:
        assert "id" in item and "name" in item and "cost" in item
        assert isinstance(item["cost"], (int, float))


def test_achievement_definitions_list(s):
    r = s.get(f"{API}/achievement-definitions")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    ids = {a["id"] for a in data}
    assert "first-blood" in ids
    for a in data[:3]:
        for f in ("id", "name", "icon", "description"):
            assert f in a


# --- Downtime persistence (using a throwaway force to avoid polluting real data) ---

TEST_FORCE_ID = "test-config-endpoints-force"


@pytest.fixture(scope="module")
def throwaway_force(s):
    # Clean up if exists
    s.delete(f"{API}/forces/{TEST_FORCE_ID}")
    payload = {
        "id": TEST_FORCE_ID,
        "name": "TEST Config Endpoints Force",
        "description": "",
        "image": "",
        "startingWarchest": 1000,
        "currentWarchest": 1000,
        "currentDate": "3052-01-01",
        "mechs": [],
        "pilots": [],
        "elementals": [],
        "missions": [],
        "notes": "",
        "snapshots": [],
    }
    r = s.post(f"{API}/forces", json=payload)
    assert r.status_code in (200, 201), r.text
    yield TEST_FORCE_ID
    s.delete(f"{API}/forces/{TEST_FORCE_ID}")


def test_mech_downtime_repair_armor_persists(s, throwaway_force):
    mech_id = "mech-test-config-1"
    mech = {
        "id": mech_id,
        "name": "Locust LCT-1V",
        "model": "Locust LCT-1V",
        "weight": 20,
        "bv": 432,
        "status": "Damaged",
        "activityLog": [],
    }
    r = s.post(f"{API}/forces/{throwaway_force}/mechs", json=mech)
    assert r.status_code in (200, 201), r.text

    # apply downtime action
    payload = {"actionId": "repair-armor", "wpMultiplier": 1}
    r = s.post(f"{API}/mechs/{mech_id}/downtime", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    # Response should include the updated mech + updated warchest
    assert "currentWarchest" in body or "warchest" in body or "mech" in body

    # Verify via GET force
    r = s.get(f"{API}/forces/{throwaway_force}")
    assert r.status_code == 200
    force = r.json()
    # warchest should have decreased from 1000
    assert force["currentWarchest"] < 1000, f"warchest not decremented: {force['currentWarchest']}"
    # activity log should have an entry on the mech
    m = next(m for m in force["mechs"] if m["id"] == mech_id)
    assert len(m.get("activityLog", [])) >= 1

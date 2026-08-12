"""End-to-end tests for the consolidated /api/forces/{id}/state-snapshots feature.

Covers:
- create/list/get/restore endpoint contract
- retention cap (MAX_SNAPSHOTS_PER_FORCE = 3)
- post-downtime merge (two consecutive post-downtime -> collapse to 1)
- mission separator breaks merge chain
- restore drops all snapshots with id > restored id
- restore takes NO body (no createBackupBeforeRestore)
- image bytes survive: upload -> snapshot -> delete mech -> restore -> bytes match
- old removed endpoints /snapshots and /full-snapshots return 404/405
"""
import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


# Tiny valid PNG (red 1x1 pixel)
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
    b"\x00\x00\x00\x03\x00\x01[\xde\xc4\x1a\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def force_id(api):
    """Create a dedicated test force. Deletion cascades snapshots/mechs."""
    name = f"TEST_snap_{uuid.uuid4().hex[:8]}"
    r = api.post(f"{BASE_URL}/api/forces", json={
        "name": name,
        "startingWarchest": 1000,
        "currentWarchest": 1000,
        "startingDate": "3025-01-01",
        "currentDate": "3025-01-01",
    })
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    yield fid
    api.delete(f"{BASE_URL}/api/forces/{fid}")


@pytest.fixture
def clean_snaps(api, force_id):
    """Delete any pre-existing snapshots via direct DELETE endpoint."""
    r = api.get(f"{BASE_URL}/api/forces/{force_id}/state-snapshots")
    for s in r.json():
        api.delete(f"{BASE_URL}/api/forces/{force_id}/state-snapshots/{s['id']}")
    yield


# ---------- Basic CRUD ----------

def test_create_returns_expected_shape(api, force_id, clean_snaps):
    r = api.post(
        f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
        json={"label": "Prior to mission: Alpha", "waypointType": "pre-mission"},
    )
    assert r.status_code == 201, r.text
    d = r.json()
    for k in ["id", "forceId", "label", "type", "createdAt",
              "currentWarchest", "netWarchestChange", "missionsCompleted", "units"]:
        assert k in d, f"missing {k}"
    assert d["forceId"] == force_id
    assert d["type"] == "pre-mission"
    assert d["label"] == "Prior to mission: Alpha"
    assert "byStatus" in d["units"]["mechs"]
    assert "byStatus" in d["units"]["elementals"]


def test_list_newest_first(api, force_id, clean_snaps):
    ids = []
    for i in range(3):
        r = api.post(
            f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
            json={"label": f"snap-{i}", "waypointType": "pre-mission"},
        )
        assert r.status_code == 201
        ids.append(r.json()["id"])
    listing = api.get(f"{BASE_URL}/api/forces/{force_id}/state-snapshots").json()
    assert [s["id"] for s in listing] == list(reversed(ids))


def test_retention_cap_three(api, force_id, clean_snaps):
    for i in range(5):
        api.post(
            f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
            json={"label": f"cap-{i}", "waypointType": "pre-mission"},
        )
    listing = api.get(f"{BASE_URL}/api/forces/{force_id}/state-snapshots").json()
    assert len(listing) == 3
    # newest 3 kept: labels cap-4, cap-3, cap-2
    labels = [s["label"] for s in listing]
    assert labels == ["cap-4", "cap-3", "cap-2"]


# ---------- Merge rule ----------

def test_post_downtime_consecutive_merge(api, force_id, clean_snaps):
    r1 = api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
                  json={"label": "dt-1", "waypointType": "post-downtime"})
    assert r1.status_code == 201
    r2 = api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
                  json={"label": "dt-2", "waypointType": "post-downtime"})
    assert r2.status_code == 201
    listing = api.get(f"{BASE_URL}/api/forces/{force_id}/state-snapshots").json()
    dt = [s for s in listing if s["type"] == "post-downtime"]
    assert len(dt) == 1, f"Expected 1 post-downtime after merge, got {len(dt)}"
    assert dt[0]["label"] == "dt-2"  # newer replaces older


def test_mission_separates_downtime_no_merge(api, force_id, clean_snaps):
    api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
             json={"label": "dt-a", "waypointType": "post-downtime"})
    api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
             json={"label": "mission-x", "waypointType": "post-mission"})
    api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
             json={"label": "dt-b", "waypointType": "post-downtime"})
    listing = api.get(f"{BASE_URL}/api/forces/{force_id}/state-snapshots").json()
    dt = [s for s in listing if s["type"] == "post-downtime"]
    assert len(dt) == 2
    assert {s["label"] for s in dt} == {"dt-a", "dt-b"}


# ---------- Restore ----------

def test_restore_no_body_accepted_and_drops_newer(api, force_id, clean_snaps):
    ids = []
    for i, label in enumerate(["oldest", "middle", "newest"]):
        r = api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
                     json={"label": label, "waypointType": "pre-mission"})
        ids.append(r.json()["id"])
    middle_id = ids[1]

    # POST with NO body must succeed
    r = requests.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots/{middle_id}/restore")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "restoredForce" in body

    # Snapshots newer than middle should be gone; middle + oldest remain
    listing = api.get(f"{BASE_URL}/api/forces/{force_id}/state-snapshots").json()
    remaining_ids = [s["id"] for s in listing]
    assert ids[2] not in remaining_ids  # newest deleted
    assert middle_id in remaining_ids
    assert ids[0] in remaining_ids


def test_restore_ignores_backup_flag_still_works(api, force_id, clean_snaps):
    """Restore endpoint should NOT require or reject createBackupBeforeRestore
    - it should just work regardless of body content."""
    r = api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
                 json={"label": "restore-target", "waypointType": "pre-mission"})
    sid = r.json()["id"]
    # sending an arbitrary body should still return 200 (endpoint ignores body)
    r = requests.post(
        f"{BASE_URL}/api/forces/{force_id}/state-snapshots/{sid}/restore",
        json={"createBackupBeforeRestore": True},
    )
    assert r.status_code == 200, r.text


# ---------- Removed old endpoints ----------

def test_old_snapshots_endpoints_gone(api, force_id):
    r1 = api.post(f"{BASE_URL}/api/forces/{force_id}/snapshots", json={})
    r2 = api.post(f"{BASE_URL}/api/forces/{force_id}/full-snapshots", json={})
    assert r1.status_code in (404, 405), f"old /snapshots still present: {r1.status_code}"
    assert r2.status_code in (404, 405), f"old /full-snapshots still present: {r2.status_code}"


# ---------- Image integrity ----------

def test_image_survives_snapshot_delete_restore(api, force_id, clean_snaps):
    # Create a mech
    r = requests.post(f"{BASE_URL}/api/forces/{force_id}/mechs",
                      json={"name": "TEST_mech_img", "bv": 100, "weight": 50})
    assert r.status_code == 201, r.text
    mech = r.json()
    mech_id = mech["id"]

    # Upload image
    files = {"file": ("test.png", PNG_BYTES, "image/png")}
    up = requests.post(f"{BASE_URL}/api/mechs/{mech_id}/image", files=files)
    assert up.status_code == 200, up.text

    # Verify image accessible + bytes match
    got = requests.get(f"{BASE_URL}/api/mechs/{mech_id}/image")
    assert got.status_code == 200
    assert got.content == PNG_BYTES

    # Snapshot
    snap = api.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots",
                    json={"label": "with-image", "waypointType": "post-mission"})
    assert snap.status_code == 201
    sid = snap.json()["id"]

    # Delete mech
    d = requests.delete(f"{BASE_URL}/api/mechs/{mech_id}")
    assert d.status_code == 204
    missing = requests.get(f"{BASE_URL}/api/mechs/{mech_id}/image")
    assert missing.status_code == 404

    # Restore
    rr = requests.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots/{sid}/restore")
    assert rr.status_code == 200, rr.text

    # After restore, image should be back at same URL and match bytes
    restored = requests.get(f"{BASE_URL}/api/mechs/{mech_id}/image")
    assert restored.status_code == 200, f"image missing after restore: {restored.status_code}"
    assert restored.content == PNG_BYTES, "image bytes do not match original after restore"


# ---------- 404 handling ----------

def test_create_on_missing_force_404(api):
    r = api.post(f"{BASE_URL}/api/forces/does-not-exist/state-snapshots",
                 json={"label": "x", "waypointType": "pre-mission"})
    assert r.status_code == 404


def test_restore_missing_snapshot_404(api, force_id):
    r = requests.post(f"{BASE_URL}/api/forces/{force_id}/state-snapshots/999999/restore")
    assert r.status_code == 404

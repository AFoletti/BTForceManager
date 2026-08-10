"""Independent data parity verification via live API against source JSON/CSV files."""
import csv
import json
import os
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://btforce-sandbox.preview.emergentagent.com"
DATA_DIR = Path("/app/data")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Forces manifest / list parity ---
def test_forces_list_matches_manifest(api):
    manifest = json.loads((DATA_DIR / "forces" / "manifest.json").read_text())
    expected_ids = {f.replace(".json", "") for f in manifest["forces"]}
    r = api.get(f"{BASE_URL}/api/forces")
    assert r.status_code == 200, r.text
    data = r.json()
    # data may be list of objects or dict; extract ids
    if isinstance(data, dict) and "forces" in data:
        items = data["forces"]
    else:
        items = data
    api_ids = {item.get("id") or item.get("forceId") for item in items}
    assert api_ids == expected_ids, f"API ids {api_ids} != manifest {expected_ids}"
    # verify excluded not present
    for excluded in ("19th-great-white", "31th-comstar"):
        assert excluded not in api_ids


# --- Ghost Bear parity ---
def test_ghost_bear_parity(api):
    src = json.loads((DATA_DIR / "forces" / "ghost-bear.json").read_text())
    r = api.get(f"{BASE_URL}/api/forces/ghost-bear")
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d.get("mechs", [])) == 18, f"mechs: {len(d.get('mechs', []))}"
    assert len(d.get("pilots", [])) == 18
    assert len(d.get("elementals", [])) == 3
    assert len(d.get("missions", [])) == 2
    assert d.get("startingWarchest") == 2000
    assert d.get("currentWarchest") == 1564
    assert d.get("currentDate") == "3052-05-09"
    # spot-check a mech name from source
    src_mech_names = {m.get("chassis") or m.get("name") for m in src.get("mechs", [])}
    api_mech_names = {m.get("chassis") or m.get("name") for m in d.get("mechs", [])}
    assert src_mech_names == api_mech_names, f"diff: {src_mech_names ^ api_mech_names}"


def test_91st_division_parity(api):
    r = api.get(f"{BASE_URL}/api/forces/91st-division-vision-of-words")
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d.get("mechs", [])) == 24
    assert len(d.get("pilots", [])) == 24
    assert len(d.get("elementals", [])) == 0
    assert len(d.get("missions", [])) == 0


# --- Mech catalog parity ---
def test_mech_catalog_atlas(api):
    r = api.get(f"{BASE_URL}/api/mech-catalog", params={"search": "Atlas"})
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("results", []))
    assert len(items) > 0, "No Atlas results"
    # spot check tonnage/BV vs CSV
    csv_atlas = []
    with open(DATA_DIR / "mek_catalog.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row.get("chassis", "").strip().lower() == "atlas":
                csv_atlas.append(row)
    assert len(csv_atlas) > 0
    # verify at least one API atlas has matching tonnage in CSV
    api_chassis = [i for i in items if str(i.get("chassis", "")).lower() == "atlas"]
    assert len(api_chassis) > 0
    tonnages_csv = {str(r.get("tonnage") or r.get("weight") or "").strip() for r in csv_atlas}
    for it in api_chassis[:3]:
        t = str(it.get("tonnage") or it.get("weight") or "").strip()
        assert t in tonnages_csv or t == "100", f"Atlas tonnage {t} not in CSV {tonnages_csv}"


# --- SP choices parity ---
def test_sp_choices_parity(api):
    src = json.loads((DATA_DIR / "sp-choices.json").read_text())
    src_items = src if isinstance(src, list) else src.get("spChoices", src.get("choices", src.get("items", [])))
    r = api.get(f"{BASE_URL}/api/sp-choices")
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("choices", []))
    assert len(items) == 25, f"got {len(items)} expected 25"
    assert len(src_items) == 25
    src_ids = {i["id"] for i in src_items}
    api_ids = {i["id"] for i in items}
    assert src_ids == api_ids
    # check names & costs
    src_map = {i["id"]: i for i in src_items}
    for it in items:
        s = src_map[it["id"]]
        assert it.get("name") == s.get("name"), it["id"]
        assert it.get("cost") == s.get("cost"), it["id"]


# --- Achievements parity ---
def test_achievements_parity(api):
    src = json.loads((DATA_DIR / "achievements.json").read_text())
    src_items = src if isinstance(src, list) else src.get("achievements", src.get("items", []))
    r = api.get(f"{BASE_URL}/api/achievement-definitions")
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("achievements", []))
    assert len(items) == 16, f"got {len(items)} expected 16"
    assert len(src_items) == 16
    src_map = {i["id"]: i for i in src_items}
    for it in items:
        s = src_map.get(it["id"])
        assert s is not None, f"unknown id {it['id']}"
        for field in ("name", "icon", "description", "condition"):
            if field in s:
                assert it.get(field) == s.get(field), f"{it['id']}.{field} mismatch: {it.get(field)!r} vs {s.get(field)!r}"


# --- Downtime actions parity ---
def test_downtime_actions_parity(api):
    src = json.loads((DATA_DIR / "downtime-actions.json").read_text())
    # source is categorized dict
    expected = []
    if isinstance(src, dict):
        for cat_key, arr in src.items():
            if isinstance(arr, list):
                for it in arr:
                    expected.append((cat_key, it))
    r = api.get(f"{BASE_URL}/api/downtime-actions")
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", [])
    assert len(items) == 8, f"got {len(items)} expected 8"
    # 3 mech, 2 elemental, 3 pilot
    by_cat = {}
    for it in items:
        by_cat.setdefault(it.get("category"), []).append(it)
    print("Categories:", {k: len(v) for k, v in by_cat.items()})
    total_by_cat = {k: len(v) for k, v in by_cat.items()}
    assert sum(total_by_cat.values()) == 8
    # verify makesUnavailable only on repair-structure
    for it in items:
        flags = it.get("flags") or []
        if it.get("id") == "repair-structure":
            assert "makesUnavailable" in flags, f"repair-structure missing flag: {flags}"
        else:
            assert "makesUnavailable" not in flags, f"{it.get('id')} unexpectedly has makesUnavailable"
    # id parity with source
    src_ids = {it["id"] for _, it in expected}
    api_ids = {it["id"] for it in items}
    assert src_ids == api_ids, f"diff: {src_ids ^ api_ids}"

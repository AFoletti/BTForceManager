import json
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport

from server import app
from database import SessionLocal
from models import Force, Mech, Pilot, Elemental, Mission, Snapshot, FullSnapshot
from sqlalchemy import select, func

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FORCES_DIR = REPO_ROOT / "data" / "forces"
MANIFEST_PATH = FORCES_DIR / "manifest.json"


def source_forces():
    manifest = json.loads(MANIFEST_PATH.read_text())
    return [json.loads((FORCES_DIR / f).read_text()) for f in manifest["forces"]]


@pytest.mark.asyncio
async def test_migration_row_counts_match_source_json():
    async with SessionLocal() as session:
        for raw in source_forces():
            force_id = raw["id"]

            for model, key in (
                (Mech, "mechs"),
                (Pilot, "pilots"),
                (Elemental, "elementals"),
                (Mission, "missions"),
                (Snapshot, "snapshots"),
                (FullSnapshot, "fullSnapshots"),
            ):
                result = await session.execute(
                    select(func.count()).select_from(model).where(model.force_id == force_id)
                )
                db_count = result.scalar_one()
                assert db_count == len(raw.get(key, [])), (
                    f"{key} count mismatch for force {force_id}: "
                    f"db={db_count} json={len(raw.get(key, []))}"
                )

            force = await session.get(Force, force_id)
            assert force is not None
            assert force.name == raw.get("name", "")
            assert force.current_warchest == raw.get("currentWarchest", 0)


@pytest.mark.asyncio
async def test_list_forces_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/forces")
    assert response.status_code == 200
    data = response.json()
    ids = {f["id"] for f in data}
    assert "ghost-bear" in ids


@pytest.mark.asyncio
async def test_get_force_detail_endpoint_matches_source():
    raw = next(f for f in source_forces() if f["id"] == "ghost-bear")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/forces/ghost-bear")
    assert response.status_code == 200
    data = response.json()

    assert data["name"] == raw["name"]
    assert data["currentWarchest"] == raw["currentWarchest"]
    assert len(data["mechs"]) == len(raw["mechs"])
    assert len(data["pilots"]) == len(raw["pilots"])
    assert len(data["missions"]) == len(raw["missions"])
    assert len(data["snapshots"]) == len(raw["snapshots"])
    assert len(data["fullSnapshots"]) == len(raw["fullSnapshots"])

    source_mech_ids = {m["id"] for m in raw["mechs"]}
    returned_mech_ids = {m["id"] for m in data["mechs"]}
    assert source_mech_ids == returned_mech_ids


@pytest.mark.asyncio
async def test_get_force_detail_404_for_unknown_force():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/forces/does-not-exist")
    assert response.status_code == 404

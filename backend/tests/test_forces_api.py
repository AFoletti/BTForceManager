import pytest
from httpx import AsyncClient, ASGITransport

from server import app
from database import SessionLocal
from models import Force, Mech, Pilot, Elemental, Mission, Snapshot, FullSnapshot
from sqlalchemy import select, func

# Expected counts/fields for the two forces baked into the committed
# data/btforce.db - no JSON source files exist anymore (Issue 6), so this
# is a fixed regression check against the DB's own known state.
EXPECTED_FORCES = {
    "ghost-bear": {
        "name": "Bluefang Trinary",
        "currentWarchest": 1564,
        "mechs": 18, "pilots": 18, "elementals": 3, "missions": 2,
        "snapshots": 6, "fullSnapshots": 3,
    },
    "91st-division-vision-of-words": {
        "name": "91st Division Vision of Words",
        "currentWarchest": 2000,
        "mechs": 24, "pilots": 24, "elementals": 0, "missions": 0,
        "snapshots": 0, "fullSnapshots": 0,
    },
}


@pytest.mark.asyncio
async def test_committed_forces_row_counts_match_known_state():
    async with SessionLocal() as session:
        for force_id, expected in EXPECTED_FORCES.items():
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
                assert db_count == expected[key], (
                    f"{key} count mismatch for force {force_id}: db={db_count} expected={expected[key]}"
                )

            force = await session.get(Force, force_id)
            assert force is not None
            assert force.name == expected["name"]
            assert force.current_warchest == expected["currentWarchest"]


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
async def test_get_force_detail_endpoint_matches_known_state():
    expected = EXPECTED_FORCES["ghost-bear"]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/forces/ghost-bear")
    assert response.status_code == 200
    data = response.json()

    assert data["name"] == expected["name"]
    assert data["currentWarchest"] == expected["currentWarchest"]
    assert len(data["mechs"]) == expected["mechs"]
    assert len(data["pilots"]) == expected["pilots"]
    assert len(data["missions"]) == expected["missions"]
    assert len(data["snapshots"]) == expected["snapshots"]
    assert len(data["fullSnapshots"]) == expected["fullSnapshots"]


@pytest.mark.asyncio
async def test_get_force_detail_404_for_unknown_force():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/forces/does-not-exist")
    assert response.status_code == 404

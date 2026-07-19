import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from server import app
from database import SessionLocal
from models import Force, Pilot, PilotSpecialAbility, PilotSpaAssignment

TEST_FORCE_ID = "test-force-spa"
TEST_PILOT_ID = "test-pilot-spa"
TEST_SPA_NAME = "Weapon Specialist"


async def _cleanup(session):
    await session.execute(delete(PilotSpaAssignment).where(PilotSpaAssignment.pilot_id == TEST_PILOT_ID))
    await session.execute(delete(Pilot).where(Pilot.id == TEST_PILOT_ID))
    await session.execute(delete(Force).where(Force.id == TEST_FORCE_ID))
    await session.execute(delete(PilotSpecialAbility).where(PilotSpecialAbility.name == TEST_SPA_NAME))
    await session.commit()


@pytest.mark.asyncio
async def test_pilot_spa_pool_crud_and_pilot_linking():
    async with SessionLocal() as session:
        await _cleanup(session)
        session.add(Force(id=TEST_FORCE_ID, name="Test Force SPA"))
        session.add(Pilot(id=TEST_PILOT_ID, force_id=TEST_FORCE_ID, name="Test Pilot"))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        empty_list_resp = await client.get(f"/api/pilots/{TEST_PILOT_ID}/spa")
        assert empty_list_resp.status_code == 200
        assert empty_list_resp.json() == []

        create_resp = await client.post(
            "/api/pilot-special-abilities",
            json={"name": TEST_SPA_NAME, "description": "+2 to-hit vs a chosen target type"},
        )
        assert create_resp.status_code == 201
        spa = create_resp.json()
        spa_id = spa["id"]
        assert spa["name"] == TEST_SPA_NAME

        dup_resp = await client.post(
            "/api/pilot-special-abilities", json={"name": TEST_SPA_NAME, "description": "dup"}
        )
        assert dup_resp.status_code == 409

        list_resp = await client.get("/api/pilot-special-abilities")
        assert list_resp.status_code == 200
        assert any(a["id"] == spa_id for a in list_resp.json())

        link_resp = await client.put(f"/api/pilots/{TEST_PILOT_ID}/spa", json={"spaIds": [spa_id]})
        assert link_resp.status_code == 200
        linked = link_resp.json()
        assert len(linked) == 1
        assert linked[0]["id"] == spa_id

        get_link_resp = await client.get(f"/api/pilots/{TEST_PILOT_ID}/spa")
        assert get_link_resp.status_code == 200
        assert len(get_link_resp.json()) == 1

        unlink_resp = await client.put(f"/api/pilots/{TEST_PILOT_ID}/spa", json={"spaIds": []})
        assert unlink_resp.status_code == 200
        assert unlink_resp.json() == []

        bad_pilot_resp = await client.get("/api/pilots/does-not-exist/spa")
        assert bad_pilot_resp.status_code == 404

        bad_link_resp = await client.put(f"/api/pilots/{TEST_PILOT_ID}/spa", json={"spaIds": [999999]})
        assert bad_link_resp.status_code == 404

        delete_resp = await client.delete(f"/api/pilot-special-abilities/{spa_id}")
        assert delete_resp.status_code == 204

        delete_missing_resp = await client.delete(f"/api/pilot-special-abilities/{spa_id}")
        assert delete_missing_resp.status_code == 404

    async with SessionLocal() as session:
        await _cleanup(session)


@pytest.mark.asyncio
async def test_deleting_pilot_spa_cascades_assignments():
    async with SessionLocal() as session:
        await _cleanup(session)
        session.add(Force(id=TEST_FORCE_ID, name="Test Force SPA"))
        session.add(Pilot(id=TEST_PILOT_ID, force_id=TEST_FORCE_ID, name="Test Pilot"))
        ability = PilotSpecialAbility(name=TEST_SPA_NAME, description="test")
        session.add(ability)
        await session.commit()
        await session.refresh(ability)
        session.add(PilotSpaAssignment(pilot_id=TEST_PILOT_ID, spa_id=ability.id))
        await session.commit()
        spa_id = ability.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        delete_resp = await client.delete(f"/api/pilot-special-abilities/{spa_id}")
        assert delete_resp.status_code == 204

    async with SessionLocal() as session:
        remaining_links = (
            await session.execute(select(PilotSpaAssignment).where(PilotSpaAssignment.spa_id == spa_id))
        ).scalars().all()
        assert remaining_links == []
        await _cleanup(session)

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from server import app
from database import SessionLocal
from models import (
    Force,
    Mech,
    Pilot,
    Elemental,
    Mission,
    MissionSpPurchase,
    PilotAchievement,
)

TEST_FORCE_ID = "test-write-api-lance"


async def _cleanup():
    async with SessionLocal() as session:
        pilot_id_rows = (
            await session.execute(select(Pilot.id).where(Pilot.force_id == TEST_FORCE_ID))
        ).scalars().all()
        if pilot_id_rows:
            await session.execute(delete(PilotAchievement).where(PilotAchievement.pilot_id.in_(pilot_id_rows)))
        mission_id_rows = (
            await session.execute(select(Mission.id).where(Mission.force_id == TEST_FORCE_ID))
        ).scalars().all()
        if mission_id_rows:
            await session.execute(delete(MissionSpPurchase).where(MissionSpPurchase.mission_id.in_(mission_id_rows)))
        await session.execute(delete(Mission).where(Mission.force_id == TEST_FORCE_ID))
        await session.execute(delete(Mech).where(Mech.force_id == TEST_FORCE_ID))
        await session.execute(delete(Elemental).where(Elemental.force_id == TEST_FORCE_ID))
        await session.execute(delete(Pilot).where(Pilot.force_id == TEST_FORCE_ID))
        await session.execute(delete(Force).where(Force.id == TEST_FORCE_ID))
        await session.commit()


@pytest_asyncio.fixture(autouse=True)
async def cleanup_before_and_after():
    await _cleanup()
    yield
    await _cleanup()


@pytest.mark.asyncio
async def test_full_lifecycle_create_force_mech_pilot_mission_complete():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        force_resp = await client.post(
            "/api/forces",
            json={
                "id": TEST_FORCE_ID,
                "name": "Test Write API Lance",
                "startingWarchest": 1000,
                "currentDate": "3052-01-01",
                "wpMultiplier": 5,
            },
        )
        assert force_resp.status_code == 201
        force = force_resp.json()
        assert force["currentWarchest"] == 1000

        mech_resp = await client.post(
            f"/api/forces/{TEST_FORCE_ID}/mechs",
            json={"name": "Atlas AS7-D", "bv": 1897, "weight": 100},
        )
        assert mech_resp.status_code == 201
        mech = mech_resp.json()
        mech_id = mech["id"]

        pilot_resp = await client.post(
            f"/api/forces/{TEST_FORCE_ID}/pilots",
            json={"name": "Test Pilot", "gunnery": 3, "piloting": 4},
        )
        assert pilot_resp.status_code == 201
        pilot = pilot_resp.json()
        pilot_id = pilot["id"]

        # Assign pilot to mech
        assign_resp = await client.put(f"/api/mechs/{mech_id}", json={"pilotId": pilot_id})
        assert assign_resp.status_code == 200
        assert assign_resp.json()["pilotId"] == pilot_id

        # Create mission with an objective, assigned mech, and an SP purchase
        mission_resp = await client.post(
            f"/api/forces/{TEST_FORCE_ID}/missions",
            json={
                "name": "Test Strike",
                "cost": 50,
                "objectives": [{"title": "Hold the line", "wpReward": 30, "achieved": False}],
                "assignedMechs": [mech_id],
                "spBudget": 10,
                "spPurchases": [{"choiceId": "art_longtom"}],
            },
        )
        assert mission_resp.status_code == 201
        mission = mission_resp.json()
        mission_id = mission["id"]
        assert len(mission["spPurchases"]) == 1
        assert mission["spPurchases"][0]["choiceId"] == "art_longtom"

        # Warchest reduced by mission cost after creation
        force_after_creation = (
            await client.get(f"/api/forces/{TEST_FORCE_ID}")
        ).json()
        assert force_after_creation["currentWarchest"] == 950
        assert len(force_after_creation["mechs"][0]["activityLog"]) == 1
        assert len(force_after_creation["pilots"][0]["activityLog"]) == 1

        # Complete the mission: objective achieved, pilot scores a kill (-> first-blood achievement)
        complete_resp = await client.post(
            f"/api/missions/{mission_id}/complete",
            json={
                "objectives": [{"title": "Hold the line", "wpReward": 30, "achieved": True}],
                "recap": "Victory",
                "mechs": {mech_id: {"status": "Damaged"}},
                "pilots": {pilot_id: {"injuries": 1, "kills": [{"mechModel": "Enemy Locust", "tonnage": 20}], "assists": 0}},
            },
        )
        assert complete_resp.status_code == 200
        completion = complete_resp.json()
        assert completion["reward"] == 30
        assert completion["currentWarchest"] == 980  # 1000 - 50 + 30
        assert completion["mission"]["completed"] is True
        assert completion["mechs"][0]["status"] == "Damaged"
        assert completion["pilots"][0]["injuries"] == 1
        assert "first-blood" in completion["pilots"][0]["achievements"]
        assert len(completion["newAchievements"]) == 1
        assert completion["newAchievements"][0]["achievements"][0]["id"] == "first-blood"

        # Re-completing must be rejected (idempotency guard)
        double_complete_resp = await client.post(
            f"/api/missions/{mission_id}/complete", json={"objectives": [], "recap": "x"}
        )
        assert double_complete_resp.status_code == 409

        # Achievement persisted in the normalized pilot_achievements table
        pilot_achievements_resp = await client.get(f"/api/pilots/{pilot_id}/achievements")
        assert pilot_achievements_resp.status_code == 200
        assert any(a["achievementId"] == "first-blood" for a in pilot_achievements_resp.json())

        # Downtime: repair the damaged mech's armor
        downtime_resp = await client.post(f"/api/mechs/{mech_id}/downtime", json={"actionId": "repair-armor"})
        assert downtime_resp.status_code == 200
        downtime_result = downtime_resp.json()
        assert downtime_result["cost"] == 20  # weight(100)/wpMultiplier(5)
        assert downtime_result["mech"]["status"] == "Operational"
        assert downtime_result["currentWarchest"] == 960  # 980 - 20

        # Final force state reflects everything
        final_force = (await client.get(f"/api/forces/{TEST_FORCE_ID}")).json()
        assert final_force["currentWarchest"] == 960
        assert final_force["missions"][0]["completed"] is True

        # Delete the force cascades cleanly
        delete_resp = await client.delete(f"/api/forces/{TEST_FORCE_ID}")
        assert delete_resp.status_code == 204
        get_after_delete = await client.get(f"/api/forces/{TEST_FORCE_ID}")
        assert get_after_delete.status_code == 404


@pytest.mark.asyncio
async def test_pilot_downtime_heal_injury_and_training():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/forces", json={"id": TEST_FORCE_ID, "name": "Test Write API Lance", "startingWarchest": 500, "wpMultiplier": 5})
        pilot_resp = await client.post(
            f"/api/forces/{TEST_FORCE_ID}/pilots", json={"name": "Rookie", "gunnery": 4, "piloting": 5, "injuries": 2}
        )
        pilot_id = pilot_resp.json()["id"]

        heal_resp = await client.post(f"/api/pilots/{pilot_id}/downtime", json={"actionId": "heal-injury"})
        assert heal_resp.status_code == 200
        heal_body = heal_resp.json()
        assert heal_body["pilot"]["injuries"] == 0
        assert heal_body["cost"] == 12  # (30*2)/5
        assert heal_body["pilot"]["combatRecord"]["totalInjuriesHealed"] == 2

        train_resp = await client.post(f"/api/pilots/{pilot_id}/downtime", json={"actionId": "train-gunnery"})
        assert train_resp.status_code == 200
        assert train_resp.json()["pilot"]["gunnery"] == 3
        assert train_resp.json()["cost"] == 40  # 200/5


@pytest.mark.asyncio
async def test_elemental_downtime_repair_and_purchase():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/forces", json={"id": TEST_FORCE_ID, "name": "Test Write API Lance", "startingWarchest": 500, "wpMultiplier": 5})
        elemental_resp = await client.post(
            f"/api/forces/{TEST_FORCE_ID}/elementals",
            json={"name": "Point Alpha", "status": "Damaged", "suitsDamaged": 2, "suitsDestroyed": 0},
        )
        elemental_id = elemental_resp.json()["id"]

        repair_resp = await client.post(
            f"/api/elementals/{elemental_id}/downtime", json={"actionId": "repair-elemental"}
        )
        assert repair_resp.status_code == 200
        body = repair_resp.json()
        assert body["elemental"]["suitsDamaged"] == 0
        assert body["elemental"]["status"] == "Operational"
        assert body["cost"] == 1  # ceil((2*2.5)/5) = ceil(1.0) = 1


@pytest.mark.asyncio
async def test_create_mech_and_pilot_requires_existing_force():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/forces/does-not-exist/mechs", json={"name": "Ghost Mech"})
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_and_delete_mech():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/forces", json={"id": TEST_FORCE_ID, "name": "Test Write API Lance"})
        mech_resp = await client.post(f"/api/forces/{TEST_FORCE_ID}/mechs", json={"name": "Locust", "bv": 400, "weight": 20})
        mech_id = mech_resp.json()["id"]

        update_resp = await client.put(f"/api/mechs/{mech_id}", json={"status": "Destroyed"})
        assert update_resp.status_code == 200
        assert update_resp.json()["status"] == "Destroyed"

        delete_resp = await client.delete(f"/api/mechs/{mech_id}")
        assert delete_resp.status_code == 204

        delete_missing_resp = await client.delete(f"/api/mechs/{mech_id}")
        assert delete_missing_resp.status_code == 404

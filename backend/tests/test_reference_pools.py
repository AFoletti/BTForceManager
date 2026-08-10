import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete, func

from server import app
from database import SessionLocal
from models import (
    Force,
    Pilot,
    Mission,
    AchievementDefinition,
    PilotAchievement,
    SpChoice,
    MissionSpPurchase,
)

TEST_FORCE_ID = "test-force-refdata"
TEST_PILOT_ID = "test-pilot-refdata"
TEST_MISSION_ID = "test-mission-refdata"
TEST_CHOICE_ID = "test-choice-refdata"


async def _cleanup(session):
    await session.execute(delete(PilotAchievement).where(PilotAchievement.pilot_id == TEST_PILOT_ID))
    await session.execute(delete(MissionSpPurchase).where(MissionSpPurchase.mission_id == TEST_MISSION_ID))
    await session.execute(delete(Pilot).where(Pilot.id == TEST_PILOT_ID))
    await session.execute(delete(Mission).where(Mission.id == TEST_MISSION_ID))
    await session.execute(delete(Force).where(Force.id == TEST_FORCE_ID))
    await session.execute(delete(SpChoice).where(SpChoice.id == TEST_CHOICE_ID))
    await session.commit()


@pytest.mark.asyncio
async def test_reference_pools_are_prefilled_in_committed_db():
    async with SessionLocal() as session:
        achievements_count = (
            await session.execute(select(func.count()).select_from(AchievementDefinition))
        ).scalar_one()
        sp_choices_count = (await session.execute(select(func.count()).select_from(SpChoice))).scalar_one()

        # data/btforce.db is the single canonical source now (Issue 6) - no
        # JSON files or seed scripts exist, just fixed regression counts.
        assert achievements_count == 16
        assert sp_choices_count == 25


@pytest.mark.asyncio
async def test_repeated_sp_purchase_of_same_choice_creates_two_separate_line_items():
    async with SessionLocal() as session:
        await _cleanup(session)

        session.add(Force(id=TEST_FORCE_ID, name="Test Force RefData"))
        session.add(SpChoice(id=TEST_CHOICE_ID, name="Test Strike", cost=10))
        session.add(
            Mission(
                id=TEST_MISSION_ID,
                force_id=TEST_FORCE_ID,
                name="Test Mission",
            )
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        first_resp = await client.post(
            f"/api/missions/{TEST_MISSION_ID}/sp-purchases", json={"choiceId": TEST_CHOICE_ID}
        )
        assert first_resp.status_code == 201
        second_resp = await client.post(
            f"/api/missions/{TEST_MISSION_ID}/sp-purchases", json={"choiceId": TEST_CHOICE_ID}
        )
        assert second_resp.status_code == 201
        assert first_resp.json()["id"] != second_resp.json()["id"]

    async with SessionLocal() as session:
        rows = (
            await session.execute(
                select(MissionSpPurchase).where(MissionSpPurchase.mission_id == TEST_MISSION_ID)
            )
        ).scalars().all()
        assert len(rows) == 2
        assert {r.id for r in rows} == {first_resp.json()["id"], second_resp.json()["id"]}
        assert all(r.choice_id == TEST_CHOICE_ID for r in rows)

        await _cleanup(session)


@pytest.mark.asyncio
async def test_catalog_price_change_does_not_retroactively_alter_historical_cost():
    async with SessionLocal() as session:
        await _cleanup(session)

        choice = SpChoice(id=TEST_CHOICE_ID, name="Test Strike", cost=10)
        session.add(choice)
        session.add(Force(id=TEST_FORCE_ID, name="Test Force RefData"))
        session.add(Mission(id=TEST_MISSION_ID, force_id=TEST_FORCE_ID, name="Test Mission"))
        await session.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            purchase_resp = await client.post(
                f"/api/missions/{TEST_MISSION_ID}/sp-purchases", json={"choiceId": TEST_CHOICE_ID}
            )
        assert purchase_resp.status_code == 201
        purchase = purchase_resp.json()
        assert purchase["cost"] == 10

        # Catalog price changes after the purchase was made.
        choice_row = await session.get(SpChoice, TEST_CHOICE_ID)
        choice_row.cost = 999
        await session.commit()

        purchase_row = await session.get(MissionSpPurchase, purchase["id"])
        assert purchase_row.cost_at_purchase == 10, "historical purchase cost must not change"

        current_catalog = (await session.execute(select(SpChoice).where(SpChoice.id == TEST_CHOICE_ID))).scalar_one()
        assert current_catalog.cost == 999

        await session.execute(delete(MissionSpPurchase).where(MissionSpPurchase.id == purchase["id"]))
        await session.commit()
        await _cleanup(session)


@pytest.mark.asyncio
async def test_pilot_achievements_api_flow():
    async with SessionLocal() as session:
        await _cleanup(session)
        session.add(Force(id=TEST_FORCE_ID, name="Test Force RefData"))
        session.add(Pilot(id=TEST_PILOT_ID, force_id=TEST_FORCE_ID, name="Test Pilot"))
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        empty_resp = await client.get(f"/api/pilots/{TEST_PILOT_ID}/achievements")
        assert empty_resp.status_code == 200
        assert empty_resp.json() == []

        create_resp = await client.post(
            f"/api/pilots/{TEST_PILOT_ID}/achievements",
            json={"achievementId": "first-blood", "earnedAt": "3052-05-01"},
        )
        assert create_resp.status_code == 201
        body = create_resp.json()
        assert body["achievementId"] == "first-blood"
        assert body["earnedAt"] == "3052-05-01"
        assert body["name"] == "First Blood"

        dup_resp = await client.post(
            f"/api/pilots/{TEST_PILOT_ID}/achievements", json={"achievementId": "first-blood"}
        )
        assert dup_resp.status_code == 409

        unknown_resp = await client.post(
            f"/api/pilots/{TEST_PILOT_ID}/achievements", json={"achievementId": "does-not-exist"}
        )
        assert unknown_resp.status_code == 404

        list_resp = await client.get(f"/api/pilots/{TEST_PILOT_ID}/achievements")
        assert list_resp.status_code == 200
        assert len(list_resp.json()) == 1

        missing_pilot_resp = await client.get("/api/pilots/does-not-exist/achievements")
        assert missing_pilot_resp.status_code == 404

    async with SessionLocal() as session:
        await _cleanup(session)


@pytest.mark.asyncio
async def test_forces_detail_serializes_normalized_achievements_and_sp_purchases():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/forces/ghost-bear")
    assert resp.status_code == 200
    data = resp.json()

    pilots_with_achievements = [p for p in data["pilots"] if p["achievements"]]
    assert len(pilots_with_achievements) > 0
    assert "survivor" in pilots_with_achievements[0]["achievements"] or all(
        isinstance(a, str) for a in pilots_with_achievements[0]["achievements"]
    )

    missions_with_purchases = [m for m in data["missions"] if m.get("spPurchases")]
    assert len(missions_with_purchases) > 0
    for purchase in missions_with_purchases[0]["spPurchases"]:
        assert set(purchase.keys()) == {"id", "choiceId", "name", "cost"}

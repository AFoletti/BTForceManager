import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from server import app
from database import SessionLocal
from models import Force, SpecialAbility, ForceSpecialAbility
from migrate_special_abilities import migrate

TEST_FORCE_A = "test-force-alpha"
TEST_FORCE_B = "test-force-beta"
SHARED_ABILITY_NAME = "Zellbrigen"


async def _cleanup_test_forces(session):
    for force_id in (TEST_FORCE_A, TEST_FORCE_B):
        await session.execute(delete(ForceSpecialAbility).where(ForceSpecialAbility.force_id == force_id))
        await session.execute(delete(Force).where(Force.id == force_id))
    await session.execute(delete(SpecialAbility).where(SpecialAbility.name == SHARED_ABILITY_NAME))
    await session.commit()


@pytest.mark.asyncio
async def test_migration_dedupes_shared_ability_across_two_forces():
    async with SessionLocal() as session:
        await _cleanup_test_forces(session)

        session.add(
            Force(
                id=TEST_FORCE_A,
                name="Test Force Alpha",
                special_abilities=[{"title": SHARED_ABILITY_NAME, "description": "Clan Honor Dueling Protocols"}],
            )
        )
        session.add(
            Force(
                id=TEST_FORCE_B,
                name="Test Force Beta",
                special_abilities=[{"title": SHARED_ABILITY_NAME, "description": "Clan Honor Dueling Protocols"}],
            )
        )
        await session.commit()

        pool_created, links_created = await migrate(session)
        await session.commit()
        assert pool_created == 1
        assert links_created == 2

        # Re-running is idempotent: no new rows created.
        pool_created_again, links_created_again = await migrate(session)
        await session.commit()
        assert pool_created_again == 0
        assert links_created_again == 0

        pool_rows = (
            await session.execute(select(SpecialAbility).where(SpecialAbility.name == SHARED_ABILITY_NAME))
        ).scalars().all()
        assert len(pool_rows) == 1

        join_rows = (
            await session.execute(
                select(ForceSpecialAbility).where(ForceSpecialAbility.ability_id == pool_rows[0].id)
            )
        ).scalars().all()
        assert len(join_rows) == 2
        assert {j.force_id for j in join_rows} == {TEST_FORCE_A, TEST_FORCE_B}

        await _cleanup_test_forces(session)


@pytest.mark.asyncio
async def test_special_abilities_pool_crud_and_force_linking():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_resp = await client.post(
            "/api/special-abilities", json={"name": "Blood Fury", "description": "+1 Initiative when outnumbered"}
        )
        assert create_resp.status_code == 201
        ability = create_resp.json()
        ability_id = ability["id"]
        assert ability["name"] == "Blood Fury"

        dup_resp = await client.post(
            "/api/special-abilities", json={"name": "Blood Fury", "description": "dup"}
        )
        assert dup_resp.status_code == 409

        list_resp = await client.get("/api/special-abilities")
        assert list_resp.status_code == 200
        assert any(a["id"] == ability_id for a in list_resp.json())

        link_resp = await client.put(
            "/api/forces/ghost-bear/special-abilities", json={"abilityIds": [ability_id]}
        )
        assert link_resp.status_code == 200
        linked = link_resp.json()
        assert len(linked) == 1
        assert linked[0]["id"] == ability_id

        get_link_resp = await client.get("/api/forces/ghost-bear/special-abilities")
        assert get_link_resp.status_code == 200
        assert len(get_link_resp.json()) == 1

        force_detail_resp = await client.get("/api/forces/ghost-bear")
        assert force_detail_resp.status_code == 200
        special_abilities = force_detail_resp.json()["specialAbilities"]
        assert special_abilities == [{"id": ability_id, "title": "Blood Fury", "description": "+1 Initiative when outnumbered"}]

        unlink_resp = await client.put("/api/forces/ghost-bear/special-abilities", json={"abilityIds": []})
        assert unlink_resp.status_code == 200
        assert unlink_resp.json() == []

        bad_force_resp = await client.get("/api/forces/does-not-exist/special-abilities")
        assert bad_force_resp.status_code == 404

        bad_link_resp = await client.put(
            "/api/forces/ghost-bear/special-abilities", json={"abilityIds": [999999]}
        )
        assert bad_link_resp.status_code == 404

        delete_resp = await client.delete(f"/api/special-abilities/{ability_id}")
        assert delete_resp.status_code == 204

        delete_missing_resp = await client.delete(f"/api/special-abilities/{ability_id}")
        assert delete_missing_resp.status_code == 404

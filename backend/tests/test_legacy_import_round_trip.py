"""Round-trip test for the legacy JSON -> SQLite import path (import_legacy_data.py).

Uses a small, anonymized fixture force covering every top-level field
(mechs, pilots, elementals, missions, snapshots, full snapshots, special
abilities, other-actions-log) and asserts nothing is silently dropped.
"""
import json
from pathlib import Path

import pytest
from sqlalchemy import delete, select

import import_legacy_data
from database import SessionLocal
from models import Force, Mech, Pilot, Elemental, Mission, Snapshot, FullSnapshot

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
FIXTURE_FILENAME = "sample-force.json"
FORCE_ID = "test-fixture-force"


async def cleanup(session):
    for model in (FullSnapshot, Snapshot, Mission, Elemental, Pilot, Mech):
        await session.execute(delete(model).where(model.force_id == FORCE_ID))
    await session.execute(delete(Force).where(Force.id == FORCE_ID))
    await session.commit()


@pytest.mark.asyncio
async def test_legacy_import_round_trip_is_lossless(monkeypatch):
    monkeypatch.setattr(import_legacy_data, "FORCES_DIR", FIXTURES_DIR)
    raw = json.loads((FIXTURES_DIR / FIXTURE_FILENAME).read_text())

    async with SessionLocal() as session:
        try:
            async with session.begin():
                force_id, counts = await import_legacy_data.import_force(session, FIXTURE_FILENAME)

            assert force_id == FORCE_ID
            assert counts == {
                "mechs": 2,
                "pilots": 1,
                "elementals": 1,
                "missions": 1,
                "snapshots": 1,
                "fullSnapshots": 1,
            }

            force = await session.get(Force, FORCE_ID)
            assert force is not None
            assert force.name == raw["name"]
            assert force.description == raw["description"]
            assert force.starting_warchest == raw["startingWarchest"]
            assert force.current_warchest == raw["currentWarchest"]
            assert force.wp_multiplier == raw["wpMultiplier"]
            assert force.current_date == raw["currentDate"]
            assert force.notes == raw["notes"]
            assert force.other_actions_log == raw["otherActionsLog"]

            mechs = {
                m.id: m
                for m in (await session.execute(select(Mech).where(Mech.force_id == FORCE_ID))).scalars().all()
            }
            assert set(mechs.keys()) == {m["id"] for m in raw["mechs"]}
            for raw_mech in raw["mechs"]:
                mech = mechs[raw_mech["id"]]
                assert mech.name == raw_mech["name"]
                assert mech.status == raw_mech["status"]
                assert mech.pilot_id == raw_mech["pilotId"]
                assert mech.bv == raw_mech["bv"]
                assert mech.weight == raw_mech["weight"]
                assert mech.activity_log == raw_mech["activityLog"]

            elementals = (
                await session.execute(select(Elemental).where(Elemental.force_id == FORCE_ID))
            ).scalars().all()
            assert len(elementals) == 1
            raw_elemental = raw["elementals"][0]
            elemental = elementals[0]
            assert elemental.id == raw_elemental["id"]
            assert elemental.name == raw_elemental["name"]
            assert elemental.commander == raw_elemental["commander"]
            assert elemental.suits_damaged == raw_elemental["suitsDamaged"]
            assert elemental.bv == raw_elemental["bv"]

            pilots = (
                await session.execute(select(Pilot).where(Pilot.force_id == FORCE_ID))
            ).scalars().all()
            assert len(pilots) == 1
            raw_pilot = raw["pilots"][0]
            pilot = pilots[0]
            assert pilot.id == raw_pilot["id"]
            assert pilot.name == raw_pilot["name"]
            assert pilot.gunnery == raw_pilot["gunnery"]
            assert pilot.piloting == raw_pilot["piloting"]
            assert pilot.injuries == raw_pilot["injuries"]
            assert pilot.activity_log == raw_pilot["activityLog"]
            assert pilot.combat_record == raw_pilot["combatRecord"]

            missions = (
                await session.execute(select(Mission).where(Mission.force_id == FORCE_ID))
            ).scalars().all()
            assert len(missions) == 1
            raw_mission = raw["missions"][0]
            mission = missions[0]
            assert mission.id == raw_mission["id"]
            assert mission.name == raw_mission["name"]
            assert mission.cost == raw_mission["cost"]
            assert mission.objectives == raw_mission["objectives"]
            assert mission.recap == raw_mission["recap"]
            assert mission.completed == raw_mission["completed"]
            assert mission.assigned_mechs == raw_mission["assignedMechs"]
            assert mission.assigned_elementals == raw_mission["assignedElementals"]
            assert mission.sp_purchases == raw_mission["spPurchases"]
            assert mission.total_tonnage == raw_mission["totalTonnage"]

            snapshots = (
                await session.execute(select(Snapshot).where(Snapshot.force_id == FORCE_ID))
            ).scalars().all()
            assert len(snapshots) == 1
            assert snapshots[0].id == raw["snapshots"][0]["id"]
            assert snapshots[0].label == raw["snapshots"][0]["label"]

            full_snapshots = (
                await session.execute(select(FullSnapshot).where(FullSnapshot.force_id == FORCE_ID))
            ).scalars().all()
            assert len(full_snapshots) == 1
            assert full_snapshots[0].id == raw["fullSnapshots"][0]["id"]
            assert full_snapshots[0].force_data == raw["fullSnapshots"][0]["forceData"]
        finally:
            await cleanup(session)

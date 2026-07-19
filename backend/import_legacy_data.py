"""One-time migration script: imports legacy JSON campaign data (data/forces/*.json,
as listed in data/forces/manifest.json) into the SQLite database.

Safe to re-run: for each force being imported, existing rows for that force are
deleted before re-inserting, so the script always leaves the DB in sync with the
current contents of the JSON files.

Usage:
    cd backend && python import_legacy_data.py
"""
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import delete

from database import SessionLocal, engine
from models import Base, Force, Mech, Pilot, Elemental, Mission, Snapshot, FullSnapshot

REPO_ROOT = Path(__file__).resolve().parent.parent
FORCES_DIR = REPO_ROOT / "data" / "forces"
MANIFEST_PATH = FORCES_DIR / "manifest.json"


def load_manifest_filenames():
    manifest = json.loads(MANIFEST_PATH.read_text())
    return manifest["forces"]


def build_force(raw):
    return Force(
        id=raw["id"],
        name=raw.get("name", ""),
        description=raw.get("description", ""),
        image=raw.get("image", ""),
        starting_warchest=raw.get("startingWarchest", 0),
        current_warchest=raw.get("currentWarchest", 0),
        wp_multiplier=raw.get("wpMultiplier", 5),
        current_date=raw.get("currentDate", ""),
        notes=raw.get("notes", ""),
        special_abilities=raw.get("specialAbilities", []),
        other_actions_log=raw.get("otherActionsLog", []),
    )


def build_mechs(raw, force_id):
    return [
        Mech(
            id=m["id"],
            force_id=force_id,
            name=m.get("name", ""),
            status=m.get("status", "Operational"),
            pilot_id=m.get("pilotId", ""),
            bv=m.get("bv", 0),
            weight=m.get("weight", 0),
            image=m.get("image", ""),
            history=m.get("history", ""),
            warchest_cost=m.get("warchestCost", 0),
            activity_log=m.get("activityLog", []),
        )
        for m in raw.get("mechs", [])
    ]


def build_elementals(raw, force_id):
    return [
        Elemental(
            id=e["id"],
            force_id=force_id,
            name=e.get("name", ""),
            commander=e.get("commander", ""),
            gunnery=e.get("gunnery", 0),
            antimech=e.get("antimech", 0),
            suits_destroyed=e.get("suitsDestroyed", 0),
            suits_damaged=e.get("suitsDamaged", 0),
            bv=e.get("bv", 0),
            status=e.get("status", "Operational"),
            image=e.get("image", ""),
            history=e.get("history", ""),
            warchest_cost=e.get("warchestCost", 0),
            activity_log=e.get("activityLog", []),
        )
        for e in raw.get("elementals", [])
    ]


def build_pilots(raw, force_id):
    return [
        Pilot(
            id=p["id"],
            force_id=force_id,
            name=p.get("name", ""),
            gunnery=p.get("gunnery", 0),
            piloting=p.get("piloting", 0),
            injuries=p.get("injuries", 0),
            dezgra=p.get("dezgra", False),
            history=p.get("history", ""),
            warchest_cost=p.get("warchestCost", 0),
            activity_log=p.get("activityLog", []),
            combat_record=p.get("combatRecord"),
            achievements=p.get("achievements", []),
        )
        for p in raw.get("pilots", [])
    ]


def build_missions(raw, force_id):
    return [
        Mission(
            id=m["id"],
            force_id=force_id,
            name=m.get("name", ""),
            cost=m.get("cost", 0),
            description=m.get("description", ""),
            objectives=m.get("objectives", []),
            recap=m.get("recap", ""),
            completed=m.get("completed", False),
            assigned_mechs=m.get("assignedMechs", []),
            assigned_elementals=m.get("assignedElementals", []),
            created_at=m.get("createdAt", ""),
            in_game_date=m.get("inGameDate", ""),
            completed_at=m.get("completedAt"),
            sp_budget=m.get("spBudget"),
            sp_purchases=m.get("spPurchases", []),
            total_tonnage=m.get("totalTonnage"),
            op_for_units=m.get("opForUnits", []),
        )
        for m in raw.get("missions", [])
    ]


def build_snapshots(raw, force_id):
    return [
        Snapshot(
            id=s["id"],
            force_id=force_id,
            type=s.get("type", ""),
            label=s.get("label", ""),
            created_at=s.get("createdAt", ""),
            current_warchest=s.get("currentWarchest", 0),
            starting_warchest=s.get("startingWarchest", 0),
            net_warchest_change=s.get("netWarchestChange", 0),
            missions_completed=s.get("missionsCompleted", 0),
            units=s.get("units", {}),
        )
        for s in raw.get("snapshots", [])
    ]


def build_full_snapshots(raw, force_id):
    return [
        FullSnapshot(
            id=fs["id"],
            force_id=force_id,
            snapshot_id=fs.get("snapshotId", ""),
            force_data=fs.get("forceData", {}),
            created_at=fs.get("createdAt", ""),
        )
        for fs in raw.get("fullSnapshots", [])
    ]


async def import_force(session, filename):
    raw = json.loads((FORCES_DIR / filename).read_text())
    force_id = raw["id"]

    # Idempotent re-run: wipe any existing rows for this force first.
    for model in (FullSnapshot, Snapshot, Mission, Elemental, Pilot, Mech):
        await session.execute(delete(model).where(model.force_id == force_id))
    await session.execute(delete(Force).where(Force.id == force_id))

    session.add(build_force(raw))
    session.add_all(build_mechs(raw, force_id))
    session.add_all(build_elementals(raw, force_id))
    session.add_all(build_pilots(raw, force_id))
    session.add_all(build_missions(raw, force_id))
    session.add_all(build_snapshots(raw, force_id))
    session.add_all(build_full_snapshots(raw, force_id))

    counts = {
        "mechs": len(raw.get("mechs", [])),
        "pilots": len(raw.get("pilots", [])),
        "elementals": len(raw.get("elementals", [])),
        "missions": len(raw.get("missions", [])),
        "snapshots": len(raw.get("snapshots", [])),
        "fullSnapshots": len(raw.get("fullSnapshots", [])),
    }
    return force_id, counts


async def main():
    filenames = load_manifest_filenames()
    async with SessionLocal() as session:
        async with session.begin():
            for filename in filenames:
                force_id, counts = await import_force(session, filename)
                print(f"Imported {filename} -> force '{force_id}': {counts}")
    await engine.dispose()
    print(f"Done. Imported {len(filenames)} force(s) from manifest.")


if __name__ == "__main__":
    asyncio.run(main())

"""One-time migration: seeds the downtime_actions table from
data/downtime-actions.json (mechActions/elementalActions/pilotActions).

After this runs, backend/domain/downtime_logic.py reads exclusively from the
downtime_actions table - this script is the only backend code that still
reads the legacy JSON file, purely as a one-time seed source (same pattern
as migrate_reference_data.py for achievements.json/sp-choices.json).

Idempotent: upserts by id, so re-running never duplicates rows.

This is now an importable-only helper - run `python migrate_all.py` instead
of this script directly.
"""
import sys
import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal
from models import DowntimeAction

REPO_ROOT = Path(__file__).resolve().parent.parent
DOWNTIME_ACTIONS_PATH = REPO_ROOT / "data" / "downtime-actions.json"


async def seed_downtime_actions(session):
    data = json.loads(DOWNTIME_ACTIONS_PATH.read_text())
    created, updated = 0, 0
    for category, actions in data.items():
        for entry in actions:
            flags = ["makesUnavailable"] if entry.get("makesUnavailable") else []
            existing = await session.get(DowntimeAction, entry["id"])
            if existing:
                existing.name = entry.get("name", "")
                existing.description = entry.get("description", "")
                existing.category = category
                existing.formula = entry.get("formula", "")
                existing.flags = flags
                updated += 1
            else:
                session.add(
                    DowntimeAction(
                        id=entry["id"],
                        name=entry.get("name", ""),
                        description=entry.get("description", ""),
                        category=category,
                        formula=entry.get("formula", ""),
                        flags=flags,
                    )
                )
                created += 1
    await session.flush()
    return created, updated


async def main():
    async with SessionLocal() as session:
        async with session.begin():
            created, updated = await seed_downtime_actions(session)
    print(f"Downtime actions: {created} created, {updated} updated.")


if __name__ == "__main__":
    print("migrate_downtime_actions.py is now an importable-only helper.")
    print("Run the full one-time cutover instead: python migrate_all.py")
    sys.exit(1)

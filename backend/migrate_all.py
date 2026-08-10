"""Single entrypoint for the one-time legacy JSON -> SQLite cutover.

Runs, in the only valid order, the three migrations that together move a
force from the static GitHub Pages app's JSON files into this app's
database:

  1. import_legacy_data   - imports data/forces/*.json (forces, mechs,
     pilots, elementals, missions, snapshots). Destructive/wipe-and-reinsert
     per force, so this must run first.
  2. migrate_reference_data - seeds achievement_definitions/sp_choices from
     data/achievements.json + data/sp-choices.json, then normalizes each
     Pilot's legacy achievements[] and Mission's legacy spPurchases[] (just
     populated by step 1) into pilot_achievements/mission_sp_purchases.
  3. migrate_special_abilities - normalizes each legacy force's
     specialAbilities (read straight from data/forces/*.json) into the
     special_abilities pool + force_special_abilities join table.
  4. migrate_downtime_actions - seeds the downtime_actions table from
     data/downtime-actions.json (mechActions/elementalActions/pilotActions).

All four are idempotent, so re-running this script is always safe - it
never creates duplicate rows. import_legacy_data is the one exception:
it deliberately wipes and reinserts each force's rows every run, so only
re-run this after the initial cutover if you actually want to reset a
force back to its JSON file's contents. That's also why the automatic
first-boot Docker seed (seed_if_empty.py) never runs it again once the
database already has data.

import_legacy_data.py, migrate_reference_data.py and migrate_special_abilities.py
are now importable-only helpers - run this script instead of any of them
directly.

The mech catalog import (import_mech_catalog.py) is intentionally NOT part
of this script - it's an ongoing sync operation (also triggered by the
watched-folder auto-import), not a one-time cutover step.

Usage:
    cd backend && python migrate_all.py
"""
import asyncio

from dotenv import load_dotenv

load_dotenv()

import import_legacy_data
import migrate_reference_data
import migrate_special_abilities
import migrate_downtime_actions
from database import engine


async def main():
    print("=== Step 1/4: import_legacy_data ===")
    await import_legacy_data.main()

    print("=== Step 2/4: migrate_reference_data ===")
    await migrate_reference_data.main()

    print("=== Step 3/4: migrate_special_abilities ===")
    await migrate_special_abilities.main()

    print("=== Step 4/4: migrate_downtime_actions ===")
    await migrate_downtime_actions.main()

    await engine.dispose()
    print("=== Cutover complete. ===")


if __name__ == "__main__":
    asyncio.run(main())

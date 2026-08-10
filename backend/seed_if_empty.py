"""First-boot data seed, run automatically by entrypoint.sh after migrations.

Runs the legacy import/reference-data scripts only when the `forces` table
is completely empty (i.e. a brand new SQLite file, first container start).
On every later restart the database already has forces, so this is a no-op
and live campaign progress is never overwritten by the static seed JSON
files - only import_legacy_data.py itself is destructive (it wipes+reinserts
forces by id), the others are already safe/idempotent upserts, but there is
no reason to run any of them again once the DB is seeded.

Usage:
    cd backend && python seed_if_empty.py
"""
import asyncio
import subprocess
import sys

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select, func

from database import SessionLocal
from models import Force

SEED_SCRIPTS = [
    "import_legacy_data.py",
    "import_mech_catalog.py",
    "migrate_reference_data.py",
    "migrate_special_abilities.py",
]


async def has_existing_data():
    async with SessionLocal() as session:
        result = await session.execute(select(func.count()).select_from(Force))
        return result.scalar_one() > 0


def run_script(name):
    subprocess.run([sys.executable, name], check=True)


def main():
    if asyncio.run(has_existing_data()):
        print("seed_if_empty: existing forces found, skipping first-boot seed.")
        return

    print("seed_if_empty: empty database detected, running first-boot seed...")
    for script in SEED_SCRIPTS:
        run_script(script)
    print("seed_if_empty: first-boot seed complete.")


if __name__ == "__main__":
    main()

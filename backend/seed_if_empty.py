"""Diagnostic-only check, not run automatically by entrypoint.sh.

data/btforce.db is the committed, prefilled live database - there is no
JSON/CSV seeding step in this architecture. This script just logs whether
the Force table happens to be empty (which would indicate something is
wrong with the mounted/committed DB file, not a "first boot" state to fix).

Usage:
    cd backend && python seed_if_empty.py
"""
import asyncio

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select, func

from database import SessionLocal
from models import Force


async def has_existing_data():
    async with SessionLocal() as session:
        result = await session.execute(select(func.count()).select_from(Force))
        return result.scalar_one() > 0


def main():
    if asyncio.run(has_existing_data()):
        print("seed_if_empty: forces table has data, as expected.")
    else:
        print("seed_if_empty: WARNING - forces table is empty. data/btforce.db "
              "should already be prefilled; check the DATABASE_URL/volume mount.")


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()

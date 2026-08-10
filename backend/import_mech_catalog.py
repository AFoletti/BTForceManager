"""Operational tool for bulk-importing a mech catalog CSV (e.g. exported
from MekHQ or the Master Unit List) into the mech_catalog table.

The initial catalog already lives in the committed data/btforce.db - this
script is for importing *future* updates: point it at any CSV file (it is
not tied to a specific repo-shipped file). The watched-folder mechanism
(watcher.py) covers automatic drops; this script is for manual/ad-hoc runs.

Idempotent re-import: entries with a mul_id are matched/updated by mul_id;
entries without a mul_id (some catalog rows have none) are matched/updated
by (chassis, model) instead, so re-running never creates duplicate rows.

Usage:
    cd backend && python import_mech_catalog.py /path/to/mechs.csv
"""
import asyncio
import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select

from database import SessionLocal, engine
from models import MechCatalogEntry


def parse_int(value):
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


async def import_catalog(session, csv_path):
    created, updated = 0, 0
    now = datetime.now(timezone.utc).isoformat()

    existing_rows = (await session.execute(select(MechCatalogEntry))).scalars().all()
    by_mul_id = {row.mul_id: row for row in existing_rows if row.mul_id is not None}
    by_chassis_model = {
        (row.chassis, row.model): row for row in existing_rows if row.mul_id is None
    }

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            chassis = (row.get("chassis") or "").strip()
            if not chassis:
                continue
            model = (row.get("model") or "").strip()
            mul_id = parse_int(row.get("mul_id"))
            bv = parse_int(row.get("BV")) or 0
            tonnage = parse_int(row.get("tonnage")) or 0
            year = parse_int(row.get("year"))
            techbase = (row.get("techBase") or "").strip() or None
            role = (row.get("role") or "").strip() or None
            walk = parse_int(row.get("walk")) or 0
            max_walk = parse_int(row.get("maxWalk")) or walk
            jump = parse_int(row.get("jump")) or 0
            max_jump = parse_int(row.get("maxJump")) or jump
            heat = parse_int(row.get("heat")) or 0
            dissipation = parse_int(row.get("dissipation")) or 0
            dissipation_efficiency = parse_int(row.get("dissipationEfficiency")) or 0
            components = (row.get("components") or "").strip()

            existing = by_mul_id.get(mul_id) if mul_id is not None else by_chassis_model.get((chassis, model))

            if existing:
                existing.chassis = chassis
                existing.model = model
                existing.bv = bv
                existing.tonnage = tonnage
                existing.year = year
                existing.techbase = techbase
                existing.role = role
                existing.walk = walk
                existing.max_walk = max_walk
                existing.jump = jump
                existing.max_jump = max_jump
                existing.heat = heat
                existing.dissipation = dissipation
                existing.dissipation_efficiency = dissipation_efficiency
                existing.components = components
                existing.updated_at = now
                updated += 1
            else:
                entry = MechCatalogEntry(
                    mul_id=mul_id,
                    chassis=chassis,
                    model=model,
                    bv=bv,
                    tonnage=tonnage,
                    year=year,
                    techbase=techbase,
                    role=role,
                    walk=walk,
                    max_walk=max_walk,
                    jump=jump,
                    max_jump=max_jump,
                    heat=heat,
                    dissipation=dissipation,
                    dissipation_efficiency=dissipation_efficiency,
                    components=components,
                    updated_at=now,
                )
                session.add(entry)
                if mul_id is not None:
                    by_mul_id[mul_id] = entry
                else:
                    by_chassis_model[(chassis, model)] = entry
                created += 1

    return created, updated


async def main(csv_path):
    async with SessionLocal() as session:
        async with session.begin():
            created, updated = await import_catalog(session, csv_path)
    await engine.dispose()
    print(f"Mech catalog import done. Created {created}, updated {updated}.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_mech_catalog.py <path-to-csv>")
        sys.exit(1)
    asyncio.run(main(Path(sys.argv[1])))

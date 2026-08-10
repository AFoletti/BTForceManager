"""One-time migration: parse each legacy force's specialAbilities JSON (from
data/forces/*.json, the same source import_legacy_data.py seeds from) into a
deduped special_abilities pool and a force_special_abilities join table.

Force.special_abilities used to be an intermediate JSON column on the forces
table, but the API only ever reads from the normalized pool/join tables, so
that column was dead storage and has been removed - this script now reads
straight from the legacy JSON files instead.

Idempotent: uses get-or-create semantics for both the pool row (by name) and
the join row (by force_id + ability_id), so re-running never creates
duplicates and never touches rows created independently via the API.

This is now an importable-only helper - run `python migrate_all.py` instead
of this script directly.
"""
import sys
import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select

from database import SessionLocal
from models import SpecialAbility, ForceSpecialAbility

REPO_ROOT = Path(__file__).resolve().parent.parent
FORCES_DIR = REPO_ROOT / "data" / "forces"
MANIFEST_PATH = FORCES_DIR / "manifest.json"


def load_forces_with_abilities():
    """Read (force_id, specialAbilities list) pairs straight from the legacy
    JSON files listed in the manifest."""
    manifest = json.loads(MANIFEST_PATH.read_text())
    pairs = []
    for filename in manifest["forces"]:
        raw = json.loads((FORCES_DIR / filename).read_text())
        pairs.append((raw["id"], raw.get("specialAbilities", []) or []))
    return pairs


async def get_or_create_ability(session, name, description):
    ability = (
        await session.execute(select(SpecialAbility).where(SpecialAbility.name == name))
    ).scalar_one_or_none()
    if ability:
        return ability, False
    ability = SpecialAbility(name=name, description=description)
    session.add(ability)
    await session.flush()
    return ability, True


async def link_if_missing(session, force_id, ability_id):
    link = (
        await session.execute(
            select(ForceSpecialAbility).where(
                ForceSpecialAbility.force_id == force_id,
                ForceSpecialAbility.ability_id == ability_id,
            )
        )
    ).scalar_one_or_none()
    if link:
        return False
    session.add(ForceSpecialAbility(force_id=force_id, ability_id=ability_id))
    return True


async def migrate(session, forces_with_abilities=None):
    """Run the dedupe + link migration. `forces_with_abilities` is a list of
    (force_id, abilities) pairs; defaults to reading the legacy JSON files
    (production/seed usage). Tests can pass synthetic pairs directly."""
    if forces_with_abilities is None:
        forces_with_abilities = load_forces_with_abilities()

    pool_created = 0
    links_created = 0

    for force_id, abilities in forces_with_abilities:
        for entry in abilities or []:
            name = (entry.get("title") or "").strip()
            if not name:
                continue
            description = entry.get("description", "")

            ability, was_created = await get_or_create_ability(session, name, description)
            if was_created:
                pool_created += 1

            if await link_if_missing(session, force_id, ability.id):
                links_created += 1

    return pool_created, links_created


async def main():
    async with SessionLocal() as session:
        async with session.begin():
            pool_created, links_created = await migrate(session)
    print(f"Done. Created {pool_created} new pool row(s), {links_created} new link row(s).")


if __name__ == "__main__":
    print("migrate_special_abilities.py is now an importable-only helper.")
    print("Run the full one-time cutover instead: python migrate_all.py")
    sys.exit(1)

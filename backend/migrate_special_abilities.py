"""One-time migration: parse each Force's specialAbilities JSON (populated by
Phase 2's import_legacy_data.py) into a deduped special_abilities pool and a
force_special_abilities join table.

Idempotent: uses get-or-create semantics for both the pool row (by name) and
the join row (by force_id + ability_id), so re-running never creates
duplicates and never touches rows created independently via the API.

Usage:
    cd backend && python migrate_special_abilities.py
"""
import asyncio

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select

from database import SessionLocal, engine
from models import Force, SpecialAbility, ForceSpecialAbility


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


async def migrate(session):
    """Run the dedupe + link migration against all forces currently in the DB."""
    pool_created = 0
    links_created = 0

    forces = (await session.execute(select(Force))).scalars().all()
    for force in forces:
        for entry in force.special_abilities or []:
            name = (entry.get("title") or "").strip()
            if not name:
                continue
            description = entry.get("description", "")

            ability, was_created = await get_or_create_ability(session, name, description)
            if was_created:
                pool_created += 1

            if await link_if_missing(session, force.id, ability.id):
                links_created += 1

    return pool_created, links_created


async def main():
    async with SessionLocal() as session:
        async with session.begin():
            pool_created, links_created = await migrate(session)
    await engine.dispose()
    print(f"Done. Created {pool_created} new pool row(s), {links_created} new link row(s).")


if __name__ == "__main__":
    asyncio.run(main())

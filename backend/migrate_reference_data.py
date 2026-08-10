"""One-time migration: seeds the achievement_definitions and sp_choices
catalogs from data/achievements.json and data/sp-choices.json, then parses
each Pilot's legacy `achievements[]` and each Mission's legacy `spPurchases[]`
JSON columns (populated by Phase 2's import_legacy_data.py) into the new
normalized tables:
  - pilot_achievements: link row per pilot+achievement (earned_at unknown
    for historical data, left null - future POSTs can supply a real date)
  - mission_sp_purchases: one row per historical purchase line item, with
    cost_at_purchase/name_at_purchase snapshotted from the JSON at import
    time so later catalog price changes never retroactively alter history

Idempotent: catalogs are upserted by id; pilot_achievements/mission_sp_purchases
use get-or-create (by pilot+achievement, or by purchase id) so re-running never
duplicates rows.

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
from models import (
    Pilot,
    Mission,
    AchievementDefinition,
    PilotAchievement,
    SpChoice,
    MissionSpPurchase,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
ACHIEVEMENTS_PATH = REPO_ROOT / "data" / "achievements.json"
SP_CHOICES_PATH = REPO_ROOT / "data" / "sp-choices.json"


async def seed_achievement_definitions(session):
    data = json.loads(ACHIEVEMENTS_PATH.read_text())
    created, updated = 0, 0
    for entry in data.get("achievements", []):
        existing = await session.get(AchievementDefinition, entry["id"])
        if existing:
            existing.name = entry.get("name", "")
            existing.icon = entry.get("icon", "")
            existing.description = entry.get("description", "")
            existing.condition = entry.get("condition", "")
            updated += 1
        else:
            session.add(
                AchievementDefinition(
                    id=entry["id"],
                    name=entry.get("name", ""),
                    icon=entry.get("icon", ""),
                    description=entry.get("description", ""),
                    condition=entry.get("condition", ""),
                )
            )
            created += 1
    await session.flush()
    return created, updated


async def seed_sp_choices(session):
    data = json.loads(SP_CHOICES_PATH.read_text())
    created, updated = 0, 0
    for entry in data.get("spChoices", []):
        existing = await session.get(SpChoice, entry["id"])
        if existing:
            existing.name = entry.get("name", "")
            existing.cost = entry.get("cost", 0)
            updated += 1
        else:
            session.add(SpChoice(id=entry["id"], name=entry.get("name", ""), cost=entry.get("cost", 0)))
            created += 1
    await session.flush()
    return created, updated


async def migrate_pilot_achievements(session):
    links_created = 0
    pilots = (await session.execute(select(Pilot))).scalars().all()
    for pilot in pilots:
        for achievement_id in pilot.achievements or []:
            existing = (
                await session.execute(
                    select(PilotAchievement).where(
                        PilotAchievement.pilot_id == pilot.id,
                        PilotAchievement.achievement_id == achievement_id,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                continue
            definition = await session.get(AchievementDefinition, achievement_id)
            if not definition:
                print(f"Warning: pilot {pilot.id} has unknown achievement id '{achievement_id}', skipping")
                continue
            session.add(PilotAchievement(pilot_id=pilot.id, achievement_id=achievement_id, earned_at=None))
            links_created += 1
    return links_created


async def migrate_mission_sp_purchases(session):
    purchases_created = 0
    missions = (await session.execute(select(Mission))).scalars().all()
    for mission in missions:
        for purchase in mission.sp_purchases or []:
            purchase_id = purchase.get("id")
            if not purchase_id:
                continue
            existing = await session.get(MissionSpPurchase, purchase_id)
            if existing:
                continue
            session.add(
                MissionSpPurchase(
                    id=purchase_id,
                    mission_id=mission.id,
                    choice_id=purchase.get("choiceId"),
                    cost_at_purchase=purchase.get("cost", 0),
                    name_at_purchase=purchase.get("name", ""),
                )
            )
            purchases_created += 1
    return purchases_created


async def main():
    async with SessionLocal() as session:
        async with session.begin():
            ach_created, ach_updated = await seed_achievement_definitions(session)
            sp_created, sp_updated = await seed_sp_choices(session)
            pilot_links_created = await migrate_pilot_achievements(session)
            sp_purchases_created = await migrate_mission_sp_purchases(session)
    print(f"Achievement definitions: {ach_created} created, {ach_updated} updated.")
    print(f"SP choices: {sp_created} created, {sp_updated} updated.")
    print(f"Pilot achievement links created: {pilot_links_created}")
    print(f"Mission SP purchase line items created: {sp_purchases_created}")


if __name__ == "__main__":
    print("migrate_reference_data.py is now an importable-only helper.")
    print("Run the full one-time cutover instead: python migrate_all.py")
    sys.exit(1)

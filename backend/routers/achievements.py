from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Pilot, AchievementDefinition, PilotAchievement

router = APIRouter(prefix="/api")


class PilotAchievementIn(BaseModel):
    achievementId: str
    earnedAt: Optional[str] = None


def definition_to_dict(a):
    return {"id": a.id, "name": a.name, "icon": a.icon, "description": a.description, "condition": a.condition}


def pilot_achievement_to_dict(link, definition):
    return {
        "id": link.id,
        "achievementId": link.achievement_id,
        "earnedAt": link.earned_at,
        "name": definition.name if definition else None,
        "icon": definition.icon if definition else None,
        "description": definition.description if definition else None,
    }


@router.get("/achievement-definitions")
async def list_achievement_definitions(session: AsyncSession = Depends(get_session)):
    definitions = (await session.execute(select(AchievementDefinition))).scalars().all()
    return [definition_to_dict(d) for d in definitions]


@router.get("/pilots/{pilot_id}/achievements")
async def get_pilot_achievements(pilot_id: str, session: AsyncSession = Depends(get_session)):
    pilot = await session.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    links = (
        await session.execute(select(PilotAchievement).where(PilotAchievement.pilot_id == pilot_id))
    ).scalars().all()
    result = []
    for link in links:
        definition = await session.get(AchievementDefinition, link.achievement_id)
        result.append(pilot_achievement_to_dict(link, definition))
    return result


@router.post("/pilots/{pilot_id}/achievements", status_code=201)
async def add_pilot_achievement(
    pilot_id: str, payload: PilotAchievementIn, session: AsyncSession = Depends(get_session)
):
    pilot = await session.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    definition = await session.get(AchievementDefinition, payload.achievementId)
    if not definition:
        raise HTTPException(status_code=404, detail="Achievement definition not found")

    existing = (
        await session.execute(
            select(PilotAchievement).where(
                PilotAchievement.pilot_id == pilot_id,
                PilotAchievement.achievement_id == payload.achievementId,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Pilot already has this achievement")

    link = PilotAchievement(pilot_id=pilot_id, achievement_id=payload.achievementId, earned_at=payload.earnedAt)
    session.add(link)
    await session.commit()
    await session.refresh(link)
    return pilot_achievement_to_dict(link, definition)

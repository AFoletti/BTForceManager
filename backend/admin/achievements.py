"""Admin CRUD for global achievement definitions (rules applied to pilots'
combat records). Separate from the play-facing
`GET /api/achievement-definitions` (routers/achievements.py), which stays
read-only.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import AchievementDefinition, PilotAchievement

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AchievementDefinitionCreateIn(BaseModel):
    id: str
    name: str
    icon: str = ""
    description: str = ""
    condition: str = ""


class AchievementDefinitionUpdateIn(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[str] = None


def definition_to_dict(a):
    return {"id": a.id, "name": a.name, "icon": a.icon, "description": a.description, "condition": a.condition}


@router.get("/achievement-definitions")
async def admin_list_achievement_definitions(session: AsyncSession = Depends(get_session)):
    defs = (await session.execute(select(AchievementDefinition))).scalars().all()
    return [definition_to_dict(d) for d in defs]


@router.post("/achievement-definitions", status_code=201)
async def admin_create_achievement_definition(
    payload: AchievementDefinitionCreateIn, session: AsyncSession = Depends(get_session)
):
    if await session.get(AchievementDefinition, payload.id):
        raise HTTPException(status_code=409, detail="Achievement definition with this id already exists")
    definition = AchievementDefinition(**payload.model_dump())
    session.add(definition)
    await session.commit()
    return definition_to_dict(definition)


@router.put("/achievement-definitions/{achievement_id}")
async def admin_update_achievement_definition(
    achievement_id: str, payload: AchievementDefinitionUpdateIn, session: AsyncSession = Depends(get_session)
):
    definition = await session.get(AchievementDefinition, achievement_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Achievement definition not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(definition, key, value)
    await session.commit()
    return definition_to_dict(definition)


@router.delete("/achievement-definitions/{achievement_id}", status_code=204)
async def admin_delete_achievement_definition(achievement_id: str, session: AsyncSession = Depends(get_session)):
    definition = await session.get(AchievementDefinition, achievement_id)
    if not definition:
        raise HTTPException(status_code=404, detail="Achievement definition not found")
    await session.execute(delete(PilotAchievement).where(PilotAchievement.achievement_id == achievement_id))
    await session.delete(definition)
    await session.commit()
    return Response(status_code=204)

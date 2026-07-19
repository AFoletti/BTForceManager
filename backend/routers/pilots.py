import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Pilot, PilotAchievement, PilotSpaAssignment
from serializers import pilot_to_dict

router = APIRouter(prefix="/api")

_FIELD_MAP = {
    "name": "name",
    "gunnery": "gunnery",
    "piloting": "piloting",
    "injuries": "injuries",
    "dezgra": "dezgra",
    "history": "history",
    "warchestCost": "warchest_cost",
    "activityLog": "activity_log",
    "combatRecord": "combat_record",
}


class PilotCreateIn(BaseModel):
    id: Optional[str] = None
    name: str
    gunnery: int = 4
    piloting: int = 5
    injuries: int = 0
    dezgra: bool = False
    history: str = ""
    warchestCost: int = 0
    activityLog: Optional[List[dict]] = None
    combatRecord: Optional[dict] = None


class PilotUpdateIn(BaseModel):
    name: Optional[str] = None
    gunnery: Optional[int] = None
    piloting: Optional[int] = None
    injuries: Optional[int] = None
    dezgra: Optional[bool] = None
    history: Optional[str] = None
    warchestCost: Optional[int] = None
    activityLog: Optional[List[dict]] = None
    combatRecord: Optional[dict] = None


@router.post("/forces/{force_id}/pilots", status_code=201)
async def create_pilot(force_id: str, payload: PilotCreateIn, session: AsyncSession = Depends(get_session)):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    pilot = Pilot(
        id=payload.id or f"pilot-{uuid.uuid4().hex[:12]}",
        force_id=force_id,
        name=payload.name,
        gunnery=payload.gunnery,
        piloting=payload.piloting,
        injuries=payload.injuries,
        dezgra=payload.dezgra,
        history=payload.history,
        warchest_cost=payload.warchestCost,
        activity_log=payload.activityLog if payload.activityLog is not None else [],
        combat_record=payload.combatRecord,
        achievements=[],
    )
    session.add(pilot)
    await session.commit()
    return pilot_to_dict(pilot, [])


@router.put("/pilots/{pilot_id}")
async def update_pilot(pilot_id: str, payload: PilotUpdateIn, session: AsyncSession = Depends(get_session)):
    pilot = await session.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(pilot, _FIELD_MAP[key], value)

    await session.commit()
    links = (
        await session.execute(select(PilotAchievement).where(PilotAchievement.pilot_id == pilot_id))
    ).scalars().all()
    return pilot_to_dict(pilot, [l.achievement_id for l in links])


@router.delete("/pilots/{pilot_id}", status_code=204)
async def delete_pilot(pilot_id: str, session: AsyncSession = Depends(get_session)):
    pilot = await session.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    await session.execute(delete(PilotAchievement).where(PilotAchievement.pilot_id == pilot_id))
    await session.execute(delete(PilotSpaAssignment).where(PilotSpaAssignment.pilot_id == pilot_id))
    await session.delete(pilot)
    await session.commit()
    return Response(status_code=204)

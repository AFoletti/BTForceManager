import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import (
    Force,
    Mech,
    Pilot,
    Elemental,
    Mission,
    Snapshot,
    FullSnapshot,
    ForceSpecialAbility,
    PilotAchievement,
    PilotSpaAssignment,
    MissionSpPurchase,
)

router = APIRouter(prefix="/api")


class ForceCreateIn(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    image: str = ""
    startingWarchest: int = 0
    currentWarchest: Optional[int] = None
    wpMultiplier: int = 10
    currentDate: str = ""
    startingDate: str = "3025-01-01"
    notes: str = ""


class ForceUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    startingWarchest: Optional[int] = None
    currentWarchest: Optional[int] = None
    wpMultiplier: Optional[int] = None
    currentDate: Optional[str] = None
    startingDate: Optional[str] = None
    notes: Optional[str] = None


_FIELD_MAP = {
    "name": "name",
    "description": "description",
    "image": "image",
    "startingWarchest": "starting_warchest",
    "currentWarchest": "current_warchest",
    "wpMultiplier": "wp_multiplier",
    "currentDate": "current_date",
    "startingDate": "starting_date",
    "notes": "notes",
}


def force_core_dict(force):
    return {
        "id": force.id,
        "name": force.name,
        "description": force.description,
        "image": force.image,
        "startingWarchest": force.starting_warchest,
        "currentWarchest": force.current_warchest,
        "wpMultiplier": force.wp_multiplier,
        "currentDate": force.current_date,
        "startingDate": force.starting_date,
        "notes": force.notes,
    }


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "force"


@router.post("/forces", status_code=201)
async def create_force(payload: ForceCreateIn, session: AsyncSession = Depends(get_session)):
    force_id = payload.id or slugify(payload.name)
    base_id = force_id
    suffix = 1
    while await session.get(Force, force_id):
        suffix += 1
        force_id = f"{base_id}-{suffix}"

    force = Force(
        id=force_id,
        name=payload.name,
        description=payload.description,
        image=payload.image,
        starting_warchest=payload.startingWarchest,
        current_warchest=(
            payload.currentWarchest if payload.currentWarchest is not None else payload.startingWarchest
        ),
        wp_multiplier=payload.wpMultiplier,
        current_date=payload.currentDate,
        starting_date=payload.startingDate,
        notes=payload.notes,
    )
    session.add(force)
    await session.commit()
    return force_core_dict(force)


@router.put("/forces/{force_id}")
async def update_force(force_id: str, payload: ForceUpdateIn, session: AsyncSession = Depends(get_session)):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(force, _FIELD_MAP[key], value)

    await session.commit()
    return force_core_dict(force)


@router.delete("/forces/{force_id}", status_code=204)
async def delete_force(force_id: str, session: AsyncSession = Depends(get_session)):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    pilot_ids = (await session.execute(select(Pilot.id).where(Pilot.force_id == force_id))).scalars().all()
    mission_ids = (await session.execute(select(Mission.id).where(Mission.force_id == force_id))).scalars().all()

    if pilot_ids:
        await session.execute(delete(PilotAchievement).where(PilotAchievement.pilot_id.in_(pilot_ids)))
        await session.execute(delete(PilotSpaAssignment).where(PilotSpaAssignment.pilot_id.in_(pilot_ids)))
    if mission_ids:
        await session.execute(delete(MissionSpPurchase).where(MissionSpPurchase.mission_id.in_(mission_ids)))

    await session.execute(delete(ForceSpecialAbility).where(ForceSpecialAbility.force_id == force_id))
    await session.execute(delete(Mission).where(Mission.force_id == force_id))
    await session.execute(delete(Mech).where(Mech.force_id == force_id))
    await session.execute(delete(Pilot).where(Pilot.force_id == force_id))
    await session.execute(delete(Elemental).where(Elemental.force_id == force_id))
    await session.execute(delete(Snapshot).where(Snapshot.force_id == force_id))
    await session.execute(delete(FullSnapshot).where(FullSnapshot.force_id == force_id))
    await session.delete(force)
    await session.commit()
    return Response(status_code=204)

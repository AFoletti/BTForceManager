from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Pilot, PilotSpecialAbility, PilotSpaAssignment

router = APIRouter(prefix="/api")


class PilotSpecialAbilityIn(BaseModel):
    name: str
    description: str = ""


class PilotSpaLinksIn(BaseModel):
    spaIds: List[int] = []


def spa_to_dict(a):
    return {"id": a.id, "name": a.name, "description": a.description}


async def get_spas_for_pilot(session, pilot_id):
    result = await session.execute(
        select(PilotSpecialAbility)
        .join(PilotSpaAssignment, PilotSpaAssignment.spa_id == PilotSpecialAbility.id)
        .where(PilotSpaAssignment.pilot_id == pilot_id)
    )
    return result.scalars().all()


@router.get("/pilot-special-abilities")
async def list_pilot_special_abilities(session: AsyncSession = Depends(get_session)):
    abilities = (await session.execute(select(PilotSpecialAbility))).scalars().all()
    return [spa_to_dict(a) for a in abilities]


@router.post("/pilot-special-abilities", status_code=201)
async def create_pilot_special_ability(
    payload: PilotSpecialAbilityIn, session: AsyncSession = Depends(get_session)
):
    existing = (
        await session.execute(
            select(PilotSpecialAbility).where(PilotSpecialAbility.name == payload.name)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Pilot special ability with this name already exists")

    ability = PilotSpecialAbility(name=payload.name, description=payload.description)
    session.add(ability)
    await session.commit()
    await session.refresh(ability)
    return spa_to_dict(ability)


@router.delete("/pilot-special-abilities/{spa_id}", status_code=204)
async def delete_pilot_special_ability(spa_id: int, session: AsyncSession = Depends(get_session)):
    ability = await session.get(PilotSpecialAbility, spa_id)
    if not ability:
        raise HTTPException(status_code=404, detail="Pilot special ability not found")

    await session.execute(delete(PilotSpaAssignment).where(PilotSpaAssignment.spa_id == spa_id))
    await session.delete(ability)
    await session.commit()
    return Response(status_code=204)


@router.get("/pilots/{pilot_id}/spa")
async def get_pilot_spa(pilot_id: str, session: AsyncSession = Depends(get_session)):
    pilot = await session.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    abilities = await get_spas_for_pilot(session, pilot_id)
    return [spa_to_dict(a) for a in abilities]


@router.put("/pilots/{pilot_id}/spa")
async def set_pilot_spa(
    pilot_id: str, payload: PilotSpaLinksIn, session: AsyncSession = Depends(get_session)
):
    pilot = await session.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    if payload.spaIds:
        result = await session.execute(
            select(PilotSpecialAbility.id).where(PilotSpecialAbility.id.in_(payload.spaIds))
        )
        found_ids = {row[0] for row in result.all()}
        missing = set(payload.spaIds) - found_ids
        if missing:
            raise HTTPException(status_code=404, detail=f"Unknown pilot special ability id(s): {sorted(missing)}")

    await session.execute(delete(PilotSpaAssignment).where(PilotSpaAssignment.pilot_id == pilot_id))
    for spa_id in payload.spaIds:
        session.add(PilotSpaAssignment(pilot_id=pilot_id, spa_id=spa_id))
    await session.commit()

    abilities = await get_spas_for_pilot(session, pilot_id)
    return [spa_to_dict(a) for a in abilities]

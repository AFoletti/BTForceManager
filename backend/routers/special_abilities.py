from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, SpecialAbility, ForceSpecialAbility

router = APIRouter(prefix="/api")


class SpecialAbilityIn(BaseModel):
    name: str
    description: str = ""


class ForceAbilityLinksIn(BaseModel):
    abilityIds: List[int] = []


def ability_to_dict(a):
    return {"id": a.id, "name": a.name, "description": a.description}


async def get_abilities_for_force(session, force_id):
    result = await session.execute(
        select(SpecialAbility)
        .join(ForceSpecialAbility, ForceSpecialAbility.ability_id == SpecialAbility.id)
        .where(ForceSpecialAbility.force_id == force_id)
    )
    return result.scalars().all()


@router.get("/special-abilities")
async def list_special_abilities(session: AsyncSession = Depends(get_session)):
    abilities = (await session.execute(select(SpecialAbility))).scalars().all()
    return [ability_to_dict(a) for a in abilities]


@router.post("/special-abilities", status_code=201)
async def create_special_ability(
    payload: SpecialAbilityIn, session: AsyncSession = Depends(get_session)
):
    existing = (
        await session.execute(select(SpecialAbility).where(SpecialAbility.name == payload.name))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Special ability with this name already exists")

    ability = SpecialAbility(name=payload.name, description=payload.description)
    session.add(ability)
    await session.commit()
    await session.refresh(ability)
    return ability_to_dict(ability)


@router.delete("/special-abilities/{ability_id}", status_code=204)
async def delete_special_ability(ability_id: int, session: AsyncSession = Depends(get_session)):
    ability = await session.get(SpecialAbility, ability_id)
    if not ability:
        raise HTTPException(status_code=404, detail="Special ability not found")

    await session.execute(delete(ForceSpecialAbility).where(ForceSpecialAbility.ability_id == ability_id))
    await session.delete(ability)
    await session.commit()
    return Response(status_code=204)


@router.get("/forces/{force_id}/special-abilities")
async def get_force_special_abilities(force_id: str, session: AsyncSession = Depends(get_session)):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    abilities = await get_abilities_for_force(session, force_id)
    return [ability_to_dict(a) for a in abilities]


@router.put("/forces/{force_id}/special-abilities")
async def set_force_special_abilities(
    force_id: str, payload: ForceAbilityLinksIn, session: AsyncSession = Depends(get_session)
):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    if payload.abilityIds:
        result = await session.execute(
            select(SpecialAbility.id).where(SpecialAbility.id.in_(payload.abilityIds))
        )
        found_ids = {row[0] for row in result.all()}
        missing = set(payload.abilityIds) - found_ids
        if missing:
            raise HTTPException(
                status_code=404, detail=f"Unknown special ability id(s): {sorted(missing)}"
            )

    await session.execute(delete(ForceSpecialAbility).where(ForceSpecialAbility.force_id == force_id))
    for ability_id in payload.abilityIds:
        session.add(ForceSpecialAbility(force_id=force_id, ability_id=ability_id))
    await session.commit()

    abilities = await get_abilities_for_force(session, force_id)
    return [ability_to_dict(a) for a in abilities]

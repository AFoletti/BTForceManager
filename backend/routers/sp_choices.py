import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Mission, SpChoice, MissionSpPurchase

router = APIRouter(prefix="/api")


class MissionSpPurchaseIn(BaseModel):
    choiceId: str


def sp_choice_to_dict(c):
    return {"id": c.id, "name": c.name, "cost": c.cost}


def sp_purchase_to_dict(p):
    return {
        "id": p.id,
        "missionId": p.mission_id,
        "choiceId": p.choice_id,
        "name": p.name_at_purchase,
        "cost": p.cost_at_purchase,
    }


@router.get("/sp-choices")
async def list_sp_choices(session: AsyncSession = Depends(get_session)):
    choices = (await session.execute(select(SpChoice))).scalars().all()
    return [sp_choice_to_dict(c) for c in choices]


@router.post("/missions/{mission_id}/sp-purchases", status_code=201)
async def create_mission_sp_purchase(
    mission_id: str, payload: MissionSpPurchaseIn, session: AsyncSession = Depends(get_session)
):
    mission = await session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    choice = await session.get(SpChoice, payload.choiceId)
    if not choice:
        raise HTTPException(status_code=404, detail="SP choice not found in catalog")

    # Snapshot the catalog's current name/cost at the moment of purchase -
    # this value never changes even if the catalog price is edited later.
    purchase = MissionSpPurchase(
        id=f"sp-{uuid.uuid4().hex[:12]}",
        mission_id=mission_id,
        choice_id=choice.id,
        cost_at_purchase=choice.cost,
        name_at_purchase=choice.name,
    )
    session.add(purchase)
    await session.commit()
    await session.refresh(purchase)
    return sp_purchase_to_dict(purchase)

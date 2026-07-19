import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Elemental
from serializers import elemental_to_dict

router = APIRouter(prefix="/api")

_FIELD_MAP = {
    "name": "name",
    "commander": "commander",
    "gunnery": "gunnery",
    "antimech": "antimech",
    "suitsDestroyed": "suits_destroyed",
    "suitsDamaged": "suits_damaged",
    "bv": "bv",
    "status": "status",
    "image": "image",
    "history": "history",
    "warchestCost": "warchest_cost",
    "activityLog": "activity_log",
}


class ElementalCreateIn(BaseModel):
    id: Optional[str] = None
    name: str
    commander: str = ""
    gunnery: int = 4
    antimech: int = 4
    suitsDestroyed: int = 0
    suitsDamaged: int = 0
    bv: int = 0
    status: str = "Operational"
    image: str = ""
    history: str = ""
    warchestCost: int = 0
    activityLog: Optional[List[dict]] = None


class ElementalUpdateIn(BaseModel):
    name: Optional[str] = None
    commander: Optional[str] = None
    gunnery: Optional[int] = None
    antimech: Optional[int] = None
    suitsDestroyed: Optional[int] = None
    suitsDamaged: Optional[int] = None
    bv: Optional[int] = None
    status: Optional[str] = None
    image: Optional[str] = None
    history: Optional[str] = None
    warchestCost: Optional[int] = None
    activityLog: Optional[List[dict]] = None


@router.post("/forces/{force_id}/elementals", status_code=201)
async def create_elemental(
    force_id: str, payload: ElementalCreateIn, session: AsyncSession = Depends(get_session)
):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    elemental = Elemental(
        id=payload.id or f"elemental-{uuid.uuid4().hex[:12]}",
        force_id=force_id,
        name=payload.name,
        commander=payload.commander,
        gunnery=payload.gunnery,
        antimech=payload.antimech,
        suits_destroyed=payload.suitsDestroyed,
        suits_damaged=payload.suitsDamaged,
        bv=payload.bv,
        status=payload.status,
        image=payload.image,
        history=payload.history,
        warchest_cost=payload.warchestCost,
        activity_log=payload.activityLog if payload.activityLog is not None else [],
    )
    session.add(elemental)
    await session.commit()
    return elemental_to_dict(elemental)


@router.put("/elementals/{elemental_id}")
async def update_elemental(
    elemental_id: str, payload: ElementalUpdateIn, session: AsyncSession = Depends(get_session)
):
    elemental = await session.get(Elemental, elemental_id)
    if not elemental:
        raise HTTPException(status_code=404, detail="Elemental not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(elemental, _FIELD_MAP[key], value)

    await session.commit()
    return elemental_to_dict(elemental)


@router.delete("/elementals/{elemental_id}", status_code=204)
async def delete_elemental(elemental_id: str, session: AsyncSession = Depends(get_session)):
    elemental = await session.get(Elemental, elemental_id)
    if not elemental:
        raise HTTPException(status_code=404, detail="Elemental not found")
    await session.delete(elemental)
    await session.commit()
    return Response(status_code=204)

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Mech
from serializers import mech_to_dict

router = APIRouter(prefix="/api")

_FIELD_MAP = {
    "name": "name",
    "status": "status",
    "pilotId": "pilot_id",
    "bv": "bv",
    "weight": "weight",
    "image": "image",
    "history": "history",
    "warchestCost": "warchest_cost",
}


class MechCreateIn(BaseModel):
    id: Optional[str] = None
    name: str
    status: str = "Operational"
    pilotId: str = ""
    bv: int = 0
    weight: int = 0
    image: str = ""
    history: str = ""
    warchestCost: int = 0


class MechUpdateIn(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    pilotId: Optional[str] = None
    bv: Optional[int] = None
    weight: Optional[int] = None
    image: Optional[str] = None
    history: Optional[str] = None
    warchestCost: Optional[int] = None


@router.post("/forces/{force_id}/mechs", status_code=201)
async def create_mech(force_id: str, payload: MechCreateIn, session: AsyncSession = Depends(get_session)):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    mech = Mech(
        id=payload.id or f"mech-{uuid.uuid4().hex[:12]}",
        force_id=force_id,
        name=payload.name,
        status=payload.status,
        pilot_id=payload.pilotId,
        bv=payload.bv,
        weight=payload.weight,
        image=payload.image,
        history=payload.history,
        warchest_cost=payload.warchestCost,
        activity_log=[],
    )
    session.add(mech)
    await session.commit()
    return mech_to_dict(mech)


@router.put("/mechs/{mech_id}")
async def update_mech(mech_id: str, payload: MechUpdateIn, session: AsyncSession = Depends(get_session)):
    mech = await session.get(Mech, mech_id)
    if not mech:
        raise HTTPException(status_code=404, detail="Mech not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(mech, _FIELD_MAP[key], value)

    await session.commit()
    return mech_to_dict(mech)


@router.delete("/mechs/{mech_id}", status_code=204)
async def delete_mech(mech_id: str, session: AsyncSession = Depends(get_session)):
    mech = await session.get(Mech, mech_id)
    if not mech:
        raise HTTPException(status_code=404, detail="Mech not found")
    await session.delete(mech)
    await session.commit()
    return Response(status_code=204)

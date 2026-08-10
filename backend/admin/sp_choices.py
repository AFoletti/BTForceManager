"""Admin CRUD for the global SP (Support Point) purchase catalog.

Separate from the play-facing `GET /api/sp-choices` (routers/sp_choices.py),
which stays read-only for Mission Manager's dropdown. This is the only place
that can create/edit/delete SpChoice rows.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import SpChoice

router = APIRouter(prefix="/api/admin", tags=["admin"])


class SpChoiceCreateIn(BaseModel):
    id: Optional[str] = None
    name: str
    cost: float = 0


class SpChoiceUpdateIn(BaseModel):
    name: Optional[str] = None
    cost: Optional[float] = None


def sp_choice_to_dict(c):
    return {"id": c.id, "name": c.name, "cost": c.cost}


@router.get("/sp-choices")
async def admin_list_sp_choices(session: AsyncSession = Depends(get_session)):
    choices = (await session.execute(select(SpChoice))).scalars().all()
    return [sp_choice_to_dict(c) for c in choices]


@router.post("/sp-choices", status_code=201)
async def admin_create_sp_choice(payload: SpChoiceCreateIn, session: AsyncSession = Depends(get_session)):
    choice_id = payload.id or f"sp-choice-{uuid.uuid4().hex[:12]}"
    if await session.get(SpChoice, choice_id):
        raise HTTPException(status_code=409, detail="SP choice with this id already exists")
    choice = SpChoice(id=choice_id, name=payload.name, cost=payload.cost)
    session.add(choice)
    await session.commit()
    return sp_choice_to_dict(choice)


@router.put("/sp-choices/{choice_id}")
async def admin_update_sp_choice(
    choice_id: str, payload: SpChoiceUpdateIn, session: AsyncSession = Depends(get_session)
):
    choice = await session.get(SpChoice, choice_id)
    if not choice:
        raise HTTPException(status_code=404, detail="SP choice not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(choice, key, value)
    await session.commit()
    return sp_choice_to_dict(choice)


@router.delete("/sp-choices/{choice_id}", status_code=204)
async def admin_delete_sp_choice(choice_id: str, session: AsyncSession = Depends(get_session)):
    choice = await session.get(SpChoice, choice_id)
    if not choice:
        raise HTTPException(status_code=404, detail="SP choice not found")
    await session.delete(choice)
    await session.commit()
    return Response(status_code=204)

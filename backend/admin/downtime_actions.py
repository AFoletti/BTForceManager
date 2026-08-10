"""Admin CRUD for the global downtime action catalog (mech/elemental/pilot
formulas used by the Downtime tab). Separate from the play-facing
`GET /api/downtime-actions` (routers/downtime_actions.py), which stays
read-only.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import DowntimeAction

router = APIRouter(prefix="/api/admin", tags=["admin"])


class DowntimeActionCreateIn(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    category: str
    formula: str = ""
    flags: List[str] = []


class DowntimeActionUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    formula: Optional[str] = None
    flags: Optional[List[str]] = None


def action_to_dict(a):
    return {
        "id": a.id,
        "name": a.name,
        "description": a.description,
        "category": a.category,
        "formula": a.formula,
        "flags": a.flags,
    }


@router.get("/downtime-actions")
async def admin_list_downtime_actions(session: AsyncSession = Depends(get_session)):
    actions = (await session.execute(select(DowntimeAction))).scalars().all()
    return [action_to_dict(a) for a in actions]


@router.post("/downtime-actions", status_code=201)
async def admin_create_downtime_action(
    payload: DowntimeActionCreateIn, session: AsyncSession = Depends(get_session)
):
    action_id = payload.id or f"downtime-{uuid.uuid4().hex[:12]}"
    if await session.get(DowntimeAction, action_id):
        raise HTTPException(status_code=409, detail="Downtime action with this id already exists")
    action = DowntimeAction(
        id=action_id,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        formula=payload.formula,
        flags=payload.flags,
    )
    session.add(action)
    await session.commit()
    return action_to_dict(action)


@router.put("/downtime-actions/{action_id}")
async def admin_update_downtime_action(
    action_id: str, payload: DowntimeActionUpdateIn, session: AsyncSession = Depends(get_session)
):
    action = await session.get(DowntimeAction, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Downtime action not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(action, key, value)
    await session.commit()
    return action_to_dict(action)


@router.delete("/downtime-actions/{action_id}", status_code=204)
async def admin_delete_downtime_action(action_id: str, session: AsyncSession = Depends(get_session)):
    action = await session.get(DowntimeAction, action_id)
    if not action:
        raise HTTPException(status_code=404, detail="Downtime action not found")
    await session.delete(action)
    await session.commit()
    return Response(status_code=204)

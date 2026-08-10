from fastapi import APIRouter
from sqlalchemy import select

from database import SessionLocal
from models import DowntimeAction

router = APIRouter(prefix="/api")


@router.get("/downtime-actions")
async def list_downtime_actions():
    async with SessionLocal() as session:
        result = await session.execute(select(DowntimeAction))
        actions = result.scalars().all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "category": a.category,
            "formula": a.formula,
            "flags": a.flags,
        }
        for a in actions
    ]

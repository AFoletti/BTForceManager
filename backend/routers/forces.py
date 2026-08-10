from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Mech, Pilot, Elemental, Mission
from serializers import force_summary_to_dict
from services.force_state import serialize_force

router = APIRouter(prefix="/api")


async def count_for_force(session, model, force_id):
    result = await session.execute(
        select(func.count()).select_from(model).where(model.force_id == force_id)
    )
    return result.scalar_one()


@router.get("/forces")
async def list_forces(session: AsyncSession = Depends(get_session)):
    forces = (await session.execute(select(Force))).scalars().all()
    summaries = []
    for force in forces:
        mech_count = await count_for_force(session, Mech, force.id)
        pilot_count = await count_for_force(session, Pilot, force.id)
        elemental_count = await count_for_force(session, Elemental, force.id)
        mission_count = await count_for_force(session, Mission, force.id)
        summaries.append(
            force_summary_to_dict(force, mech_count, pilot_count, elemental_count, mission_count)
        )
    return summaries


@router.get("/forces/{force_id}")
async def get_force(force_id: str, session: AsyncSession = Depends(get_session)):
    force_data = await serialize_force(session, force_id)
    if not force_data:
        raise HTTPException(status_code=404, detail="Force not found")
    return force_data


@router.get("/forces/{force_id}/export")
async def export_force(force_id: str, session: AsyncSession = Depends(get_session)):
    """Canonical force export, backed by the same serialization service as
    `GET /api/forces/{id}` - the single source of truth for Export today and
    for force-level snapshot restore in later issues."""
    force_data = await serialize_force(session, force_id)
    if not force_data:
        raise HTTPException(status_code=404, detail="Force not found")
    return force_data

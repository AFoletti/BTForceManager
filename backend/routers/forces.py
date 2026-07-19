from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Mech, Pilot, Elemental, Mission, Snapshot, FullSnapshot
from serializers import force_summary_to_dict, force_detail_to_dict

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
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    mechs = (await session.execute(select(Mech).where(Mech.force_id == force_id))).scalars().all()
    pilots = (await session.execute(select(Pilot).where(Pilot.force_id == force_id))).scalars().all()
    elementals = (
        await session.execute(select(Elemental).where(Elemental.force_id == force_id))
    ).scalars().all()
    missions = (
        await session.execute(select(Mission).where(Mission.force_id == force_id))
    ).scalars().all()
    snapshots = (
        await session.execute(select(Snapshot).where(Snapshot.force_id == force_id))
    ).scalars().all()
    full_snapshots = (
        await session.execute(select(FullSnapshot).where(FullSnapshot.force_id == force_id))
    ).scalars().all()

    return force_detail_to_dict(force, mechs, pilots, elementals, missions, snapshots, full_snapshots)

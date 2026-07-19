from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Snapshot, FullSnapshot
from serializers import snapshot_to_dict, full_snapshot_to_dict

router = APIRouter(prefix="/api")


class SnapshotIn(BaseModel):
    id: str
    type: str = ""
    label: str = ""
    createdAt: str = ""
    currentWarchest: int = 0
    startingWarchest: int = 0
    netWarchestChange: int = 0
    missionsCompleted: int = 0
    units: dict = {}


class FullSnapshotIn(BaseModel):
    id: str
    snapshotId: str = ""
    forceData: dict = {}
    createdAt: str = ""


@router.post("/forces/{force_id}/snapshots", status_code=201)
async def create_snapshot(
    force_id: str, payload: SnapshotIn, session: AsyncSession = Depends(get_session)
):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    snapshot = Snapshot(
        id=payload.id,
        force_id=force_id,
        type=payload.type,
        label=payload.label,
        created_at=payload.createdAt,
        current_warchest=payload.currentWarchest,
        starting_warchest=payload.startingWarchest,
        net_warchest_change=payload.netWarchestChange,
        missions_completed=payload.missionsCompleted,
        units=payload.units,
    )
    session.add(snapshot)
    await session.commit()
    return snapshot_to_dict(snapshot)


@router.delete("/snapshots/{snapshot_id}", status_code=204)
async def delete_snapshot(snapshot_id: str, session: AsyncSession = Depends(get_session)):
    snapshot = await session.get(Snapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    await session.delete(snapshot)
    await session.commit()
    return Response(status_code=204)


@router.post("/forces/{force_id}/full-snapshots", status_code=201)
async def create_full_snapshot(
    force_id: str, payload: FullSnapshotIn, session: AsyncSession = Depends(get_session)
):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    full_snapshot = FullSnapshot(
        id=payload.id,
        force_id=force_id,
        snapshot_id=payload.snapshotId,
        force_data=payload.forceData,
        created_at=payload.createdAt,
    )
    session.add(full_snapshot)
    await session.commit()
    return full_snapshot_to_dict(full_snapshot)


@router.delete("/full-snapshots/{full_snapshot_id}", status_code=204)
async def delete_full_snapshot(full_snapshot_id: str, session: AsyncSession = Depends(get_session)):
    full_snapshot = await session.get(FullSnapshot, full_snapshot_id)
    if not full_snapshot:
        raise HTTPException(status_code=404, detail="Full snapshot not found")
    await session.delete(full_snapshot)
    await session.commit()
    return Response(status_code=204)

"""Full-state force snapshots (backup/restore mechanism).

Distinct from the pre-existing lightweight point-in-time `Snapshot`/
`FullSnapshot` models (routers/snapshots.py) that back the Snapshots tab -
those stay untouched. This is a separate feature: a `force_snapshots` table
storing a complete, restorable copy of a force's state, reusing the exact
same JSON shape as `GET /api/forces/{id}/export` via `serialize_force`.

Note: the issue that requested this suggested `/api/forces/{id}/snapshots`
as an example path, but that exact path is already used by the pre-existing
lightweight Snapshot creation endpoint (`routers/snapshots.py`). To avoid
breaking that existing play flow, this feature is exposed under
`/api/forces/{id}/state-snapshots` instead.

Restore (applying a `force_snapshots` row back onto a force) is out of
scope for this issue and will use `services.force_state.deserialize_force`
in a later issue.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, ForceSnapshot
from services.force_state import serialize_force

router = APIRouter(prefix="/api", tags=["force-snapshots"])


class ForceSnapshotCreateIn(BaseModel):
    label: str
    waypointType: Optional[str] = ""


def snapshot_summary_to_dict(snap):
    return {
        "id": snap.id,
        "forceId": snap.force_id,
        "label": snap.label,
        "waypointType": snap.waypoint_type,
        "createdAt": snap.created_at,
    }


def snapshot_detail_to_dict(snap):
    return {**snapshot_summary_to_dict(snap), "snapshotJson": snap.snapshot_json}


@router.get("/forces/{force_id}/state-snapshots")
async def list_force_snapshots(force_id: str, session: AsyncSession = Depends(get_session)):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    rows = (
        await session.execute(
            select(ForceSnapshot).where(ForceSnapshot.force_id == force_id).order_by(ForceSnapshot.id.desc())
        )
    ).scalars().all()
    return [snapshot_summary_to_dict(s) for s in rows]


@router.get("/forces/{force_id}/state-snapshots/{snapshot_id}")
async def get_force_snapshot(force_id: str, snapshot_id: int, session: AsyncSession = Depends(get_session)):
    snap = await session.get(ForceSnapshot, snapshot_id)
    if not snap or snap.force_id != force_id:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot_detail_to_dict(snap)


@router.post("/forces/{force_id}/state-snapshots", status_code=201)
async def create_force_snapshot(
    force_id: str, payload: ForceSnapshotCreateIn, session: AsyncSession = Depends(get_session)
):
    # Reuses the exact same serialization path as Export, so the two never drift apart.
    force_data = await serialize_force(session, force_id)
    if force_data is None:
        raise HTTPException(status_code=404, detail="Force not found")

    snapshot = ForceSnapshot(
        force_id=force_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        label=payload.label,
        waypoint_type=payload.waypointType or "",
        snapshot_json=force_data,
    )
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)
    return snapshot_detail_to_dict(snapshot)

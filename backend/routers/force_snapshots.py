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

Restore (applying a `force_snapshots` row back onto a force) reuses
`services.force_state.deserialize_force`. It is strictly force-scoped: it
overwrites only the target force's rows (Force scalar fields, mechs,
elementals, pilots, missions, snapshots, fullSnapshots, special-ability
links) and never touches the mech catalog, global SP/downtime/achievement
catalogs, or any other force. It's also transactional at the force level -
`deserialize_force` performs its deletes+inserts and a single commit; if
anything raises before that commit, the whole operation (including the
newer-snapshot cleanup below) is rolled back and the force is left exactly
as it was.

Retention/merge rules (matching the old JSON-era Snapshot/FullSnapshot
mechanic): at most MAX_SNAPSHOTS_PER_FORCE snapshots are kept per force,
oldest dropped first. Two consecutive `post-downtime` snapshots not
separated by a mission collapse into one (the newer create replaces the
older one instead of appending). Restoring to a snapshot deletes every
snapshot newer than it, since they no longer represent a valid future.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, ForceSnapshot
from services.force_state import serialize_force, deserialize_force

router = APIRouter(prefix="/api", tags=["force-snapshots"])

MAX_SNAPSHOTS_PER_FORCE = 3

_STATUS_ORDER = ["Operational", "Damaged", "Disabled", "Repairing", "Unavailable", "Destroyed"]


class ForceSnapshotCreateIn(BaseModel):
    label: str
    waypointType: Optional[str] = ""


def _build_status_counts(units):
    counts = {status: 0 for status in _STATUS_ORDER}
    for unit in units or []:
        status = unit.get("status") or "Operational"
        if status in counts:
            counts[status] += 1
    return counts


def snapshot_summary_to_dict(snap):
    data = snap.snapshot_json or {}
    current_warchest = data.get("currentWarchest", 0)
    starting_warchest = data.get("startingWarchest", 0)
    missions_completed = sum(1 for m in (data.get("missions") or []) if m.get("completed"))
    return {
        "id": snap.id,
        "forceId": snap.force_id,
        "label": snap.label,
        "type": snap.waypoint_type,
        "createdAt": snap.created_at,
        "currentWarchest": current_warchest,
        "netWarchestChange": current_warchest - starting_warchest,
        "missionsCompleted": missions_completed,
        "units": {
            "mechs": {"byStatus": _build_status_counts(data.get("mechs"))},
            "elementals": {"byStatus": _build_status_counts(data.get("elementals"))},
        },
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
    # Reuses the exact same serialization path as Export, so the two never drift
    # apart, except images are embedded as base64 data (not live URLs) so this
    # snapshot stays correct even if the image is later replaced/removed.
    force_data = await serialize_force(session, force_id, embed_images=True)
    if force_data is None:
        raise HTTPException(status_code=404, detail="Force not found")

    snapshot_type = payload.waypointType or ""

    # Two downtime cycles not separated by a mission collapse into one
    # snapshot instead of piling up.
    if snapshot_type == "post-downtime":
        last = (
            await session.execute(
                select(ForceSnapshot)
                .where(ForceSnapshot.force_id == force_id)
                .order_by(ForceSnapshot.id.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if last and last.waypoint_type == "post-downtime":
            await session.delete(last)

    snapshot = ForceSnapshot(
        force_id=force_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        label=payload.label,
        waypoint_type=snapshot_type,
        snapshot_json=force_data,
    )
    session.add(snapshot)
    await session.flush()

    # Only the MAX_SNAPSHOTS_PER_FORCE most recent snapshots are kept per force.
    stale_ids = (
        await session.execute(
            select(ForceSnapshot.id)
            .where(ForceSnapshot.force_id == force_id)
            .order_by(ForceSnapshot.id.desc())
            .offset(MAX_SNAPSHOTS_PER_FORCE)
        )
    ).scalars().all()
    if stale_ids:
        await session.execute(delete(ForceSnapshot).where(ForceSnapshot.id.in_(stale_ids)))

    await session.commit()
    await session.refresh(snapshot)
    return snapshot_detail_to_dict(snapshot)


@router.delete("/forces/{force_id}/state-snapshots/{snapshot_id}", status_code=204)
async def delete_force_snapshot(force_id: str, snapshot_id: int, session: AsyncSession = Depends(get_session)):
    snap = await session.get(ForceSnapshot, snapshot_id)
    if not snap or snap.force_id != force_id:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    await session.delete(snap)
    await session.commit()


@router.post("/forces/{force_id}/state-snapshots/{snapshot_id}/restore")
async def restore_force_snapshot(
    force_id: str,
    snapshot_id: int,
    session: AsyncSession = Depends(get_session),
):
    snapshot = await session.get(ForceSnapshot, snapshot_id)
    if not snapshot or snapshot.force_id != force_id:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    try:
        # Rolling back rewinds history: anything created after this snapshot
        # no longer represents a valid future, so it's discarded.
        await session.execute(
            delete(ForceSnapshot).where(ForceSnapshot.force_id == force_id, ForceSnapshot.id > snapshot_id)
        )
        # deserialize_force wipes+reinserts this force's children and commits
        # once at the end - the snapshot cleanup above rides along in the
        # same uncommitted transaction, so both apply together or (on any
        # error) neither does.
        restored_force = await deserialize_force(session, force_id, snapshot.snapshot_json)
    except Exception as exc:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Restore failed, force left unchanged: {exc}")

    return {"restoredForce": restored_force}

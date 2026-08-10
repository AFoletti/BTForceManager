from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Force, Mech, Elemental, Pilot, PilotAchievement
from serializers import mech_to_dict, elemental_to_dict, pilot_to_dict
from domain.downtime_logic import get_action, evaluate_downtime_cost, get_downtime_actions_config
from domain.achievements_logic import record_injuries_healed

router = APIRouter(prefix="/api")


class DowntimeActionIn(BaseModel):
    actionId: str
    lastMissionName: Optional[str] = None


@router.get("/downtime-actions")
async def get_downtime_actions_config_route():
    return await get_downtime_actions_config()


@router.post("/mechs/{mech_id}/downtime")
async def apply_mech_downtime(
    mech_id: str, payload: DowntimeActionIn, session: AsyncSession = Depends(get_session)
):
    mech = await session.get(Mech, mech_id)
    if not mech:
        raise HTTPException(status_code=404, detail="Mech not found")
    force = await session.get(Force, mech.force_id)

    action = await get_action("mechActions", payload.actionId)
    if not action:
        raise HTTPException(status_code=404, detail="Unknown mech downtime action")

    context = {"weight": mech.weight or 0, "wpMultiplier": force.wp_multiplier or 5}
    cost = evaluate_downtime_cost(action["formula"], context)

    timestamp = force.current_date
    log = list(mech.activity_log or [])
    log.append(
        {"timestamp": timestamp, "action": f"{action['name']} performed ({cost} WP)", "mission": payload.lastMissionName, "cost": cost}
    )
    mech.activity_log = log

    if action["id"] == "repair-armor" and mech.status == "Damaged":
        mech.status = "Operational"
    if action.get("makesUnavailable"):
        mech.status = "Repairing" if action["id"] == "repair-structure" else "Unavailable"

    force.current_warchest = force.current_warchest - cost
    await session.commit()

    return {"mech": mech_to_dict(mech), "currentWarchest": force.current_warchest, "cost": cost}


@router.post("/elementals/{elemental_id}/downtime")
async def apply_elemental_downtime(
    elemental_id: str, payload: DowntimeActionIn, session: AsyncSession = Depends(get_session)
):
    elemental = await session.get(Elemental, elemental_id)
    if not elemental:
        raise HTTPException(status_code=404, detail="Elemental not found")
    force = await session.get(Force, elemental.force_id)

    action = await get_action("elementalActions", payload.actionId)
    if not action:
        raise HTTPException(status_code=404, detail="Unknown elemental downtime action")

    context = {
        "suitsDamaged": elemental.suits_damaged or 0,
        "suitsDestroyed": elemental.suits_destroyed or 0,
        "wpMultiplier": force.wp_multiplier or 5,
    }
    cost = evaluate_downtime_cost(action["formula"], context)

    timestamp = force.current_date
    log = list(elemental.activity_log or [])
    log.append(
        {"timestamp": timestamp, "action": f"{action['name']} performed ({cost} WP)", "mission": payload.lastMissionName, "cost": cost}
    )
    elemental.activity_log = log

    if action["id"] == "repair-elemental":
        had_destroyed = (elemental.suits_destroyed or 0) > 0
        elemental.suits_damaged = 0
        if elemental.status == "Damaged" and not had_destroyed:
            elemental.status = "Operational"
    elif action["id"] == "purchase-elemental":
        elemental.suits_destroyed = 0
        elemental.status = "Repairing"

    force.current_warchest = force.current_warchest - cost
    await session.commit()

    return {"elemental": elemental_to_dict(elemental), "currentWarchest": force.current_warchest, "cost": cost}


@router.post("/pilots/{pilot_id}/downtime")
async def apply_pilot_downtime(
    pilot_id: str, payload: DowntimeActionIn, session: AsyncSession = Depends(get_session)
):
    pilot = await session.get(Pilot, pilot_id)
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    force = await session.get(Force, pilot.force_id)

    action = await get_action("pilotActions", payload.actionId)
    if not action:
        raise HTTPException(status_code=404, detail="Unknown pilot downtime action")

    context = {"injuries": pilot.injuries or 0, "wpMultiplier": force.wp_multiplier or 5}
    cost = evaluate_downtime_cost(action["formula"], context)

    timestamp = force.current_date
    mission_suffix = f" after {payload.lastMissionName}" if payload.lastMissionName else ""
    log = list(pilot.activity_log or [])
    log.append(
        {
            "timestamp": timestamp,
            "action": f"{action['name']} performed ({cost} WP){mission_suffix}",
            "mission": payload.lastMissionName,
            "cost": cost,
        }
    )
    pilot.activity_log = log

    if action["id"] == "train-gunnery":
        base = pilot.gunnery if pilot.gunnery is not None else 4
        pilot.gunnery = max(0, min(8, base - 1))
    elif action["id"] == "train-piloting":
        base = pilot.piloting if pilot.piloting is not None else 5
        pilot.piloting = max(0, min(8, base - 1))
    elif action["id"] == "heal-injury":
        injuries_to_heal = pilot.injuries or 0
        if injuries_to_heal > 0:
            pilot.combat_record = record_injuries_healed(pilot.combat_record, injuries_to_heal)
        pilot.injuries = 0

    force.current_warchest = force.current_warchest - cost
    await session.commit()

    links = (
        await session.execute(select(PilotAchievement).where(PilotAchievement.pilot_id == pilot_id))
    ).scalars().all()
    return {
        "pilot": pilot_to_dict(pilot, [l.achievement_id for l in links]),
        "currentWarchest": force.current_warchest,
        "cost": cost,
    }

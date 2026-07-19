import uuid
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import (
    Force,
    Mech,
    Pilot,
    Elemental,
    Mission,
    MissionSpPurchase,
    SpChoice,
    AchievementDefinition,
    PilotAchievement,
)
from serializers import mission_to_dict, mech_to_dict, elemental_to_dict, pilot_to_dict
from domain.missions_logic import calculate_mission_total_tonnage
from domain.achievements_logic import (
    check_achievements,
    find_new_achievements,
    create_empty_combat_record,
    add_kill,
    add_assists,
    record_mission_completion,
)

router = APIRouter(prefix="/api")


def _new_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class ObjectiveIn(BaseModel):
    id: Optional[str] = None
    title: str = ""
    description: str = ""
    wpReward: int = 0
    achieved: bool = False


class SpPurchaseChoiceIn(BaseModel):
    id: Optional[str] = None
    choiceId: str


class MissionCreateIn(BaseModel):
    id: Optional[str] = None
    name: str
    cost: int = 0
    description: str = ""
    objectives: List[ObjectiveIn] = []
    assignedMechs: List[str] = []
    assignedElementals: List[str] = []
    spBudget: int = 0
    spPurchases: List[SpPurchaseChoiceIn] = []
    opForUnits: List[dict] = []


class MissionUpdateIn(BaseModel):
    name: Optional[str] = None
    cost: Optional[int] = None
    description: Optional[str] = None
    objectives: Optional[List[ObjectiveIn]] = None
    assignedMechs: Optional[List[str]] = None
    assignedElementals: Optional[List[str]] = None
    spBudget: Optional[int] = None
    opForUnits: Optional[List[dict]] = None
    completed: Optional[bool] = None
    completedAt: Optional[str] = None
    recap: Optional[str] = None


class KillIn(BaseModel):
    mechModel: str
    tonnage: int = 0


class PilotCompletionIn(BaseModel):
    injuries: Optional[int] = None
    kills: List[KillIn] = []
    assists: int = 0


class ElementalCompletionIn(BaseModel):
    status: Optional[str] = None
    suitsDamaged: Optional[int] = None
    suitsDestroyed: Optional[int] = None


class MechCompletionIn(BaseModel):
    status: Optional[str] = None


class MissionCompletionIn(BaseModel):
    objectives: List[ObjectiveIn] = []
    recap: str = ""
    mechs: Dict[str, MechCompletionIn] = {}
    elementals: Dict[str, ElementalCompletionIn] = {}
    pilots: Dict[str, PilotCompletionIn] = {}


_UPDATE_FIELD_MAP = {
    "name": "name",
    "cost": "cost",
    "description": "description",
    "assignedMechs": "assigned_mechs",
    "assignedElementals": "assigned_elementals",
    "spBudget": "sp_budget",
    "opForUnits": "op_for_units",
    "completed": "completed",
    "completedAt": "completed_at",
    "recap": "recap",
}


@router.post("/forces/{force_id}/missions", status_code=201)
async def create_mission(
    force_id: str, payload: MissionCreateIn, session: AsyncSession = Depends(get_session)
):
    force = await session.get(Force, force_id)
    if not force:
        raise HTTPException(status_code=404, detail="Force not found")

    timestamp = force.current_date

    mechs = (await session.execute(select(Mech).where(Mech.force_id == force_id))).scalars().all()
    mechs_by_id = {m.id: m for m in mechs}
    total_tonnage = calculate_mission_total_tonnage(mechs_by_id, payload.assignedMechs)

    mission_id = payload.id or _new_id("mission")
    mission = Mission(
        id=mission_id,
        force_id=force_id,
        name=payload.name,
        cost=payload.cost,
        description=payload.description,
        objectives=[o.model_dump() for o in payload.objectives],
        recap="",
        completed=False,
        assigned_mechs=payload.assignedMechs,
        assigned_elementals=payload.assignedElementals,
        created_at=timestamp,
        in_game_date=timestamp,
        completed_at=None,
        sp_budget=payload.spBudget,
        sp_purchases=[],
        total_tonnage=total_tonnage,
        op_for_units=payload.opForUnits,
    )
    session.add(mission)

    assigned_mech_ids = set(payload.assignedMechs)
    for mech in mechs:
        if mech.id in assigned_mech_ids:
            log = list(mech.activity_log or [])
            log.append(
                {"timestamp": timestamp, "action": f"Assigned to mission: {payload.name}", "mission": payload.name, "cost": 0}
            )
            mech.activity_log = log

    elementals = (
        await session.execute(select(Elemental).where(Elemental.force_id == force_id))
    ).scalars().all()
    assigned_elemental_ids = set(payload.assignedElementals)
    for elemental in elementals:
        if elemental.id in assigned_elemental_ids:
            log = list(elemental.activity_log or [])
            log.append(
                {"timestamp": timestamp, "action": f"Assigned to mission: {payload.name}", "mission": payload.name, "cost": 0}
            )
            elemental.activity_log = log

    pilots = (await session.execute(select(Pilot).where(Pilot.force_id == force_id))).scalars().all()
    pilots_by_id = {p.id: p for p in pilots}
    for mech in mechs:
        if mech.id in assigned_mech_ids and mech.pilot_id:
            pilot = pilots_by_id.get(mech.pilot_id)
            if pilot:
                log = list(pilot.activity_log or [])
                log.append(
                    {
                        "timestamp": timestamp,
                        "inGameDate": force.current_date,
                        "action": f"Assigned to mission: {payload.name} (piloting {mech.name})",
                        "mission": payload.name,
                        "cost": 0,
                    }
                )
                pilot.activity_log = log

    force.current_warchest = force.current_warchest - payload.cost

    created_purchases = []
    for choice_in in payload.spPurchases:
        choice = await session.get(SpChoice, choice_in.choiceId)
        if not choice:
            raise HTTPException(status_code=404, detail=f"SP choice '{choice_in.choiceId}' not found in catalog")
        purchase = MissionSpPurchase(
            id=choice_in.id or _new_id("sp"),
            mission_id=mission_id,
            choice_id=choice.id,
            cost_at_purchase=choice.cost,
            name_at_purchase=choice.name,
        )
        session.add(purchase)
        created_purchases.append(purchase)

    await session.commit()
    return mission_to_dict(mission, created_purchases)


@router.put("/missions/{mission_id}")
async def update_mission(
    mission_id: str, payload: MissionUpdateIn, session: AsyncSession = Depends(get_session)
):
    mission = await session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    data = payload.model_dump(exclude_unset=True)
    if "objectives" in data:
        mission.objectives = [o.model_dump() for o in payload.objectives]
        data.pop("objectives")

    for key, value in data.items():
        setattr(mission, _UPDATE_FIELD_MAP[key], value)

    if "assignedMechs" in data:
        mechs = (
            await session.execute(select(Mech).where(Mech.force_id == mission.force_id))
        ).scalars().all()
        mechs_by_id = {m.id: m for m in mechs}
        mission.total_tonnage = calculate_mission_total_tonnage(mechs_by_id, mission.assigned_mechs)

    await session.commit()
    sp_purchases = (
        await session.execute(select(MissionSpPurchase).where(MissionSpPurchase.mission_id == mission_id))
    ).scalars().all()
    return mission_to_dict(mission, sp_purchases)


@router.delete("/missions/{mission_id}", status_code=204)
async def delete_mission(mission_id: str, session: AsyncSession = Depends(get_session)):
    mission = await session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    await session.execute(delete(MissionSpPurchase).where(MissionSpPurchase.mission_id == mission_id))
    await session.delete(mission)
    await session.commit()
    return Response(status_code=204)


@router.post("/missions/{mission_id}/complete")
async def complete_mission(
    mission_id: str, payload: MissionCompletionIn, session: AsyncSession = Depends(get_session)
):
    mission = await session.get(Mission, mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    if mission.completed:
        raise HTTPException(status_code=409, detail="Mission already completed")

    force = await session.get(Force, mission.force_id)
    timestamp = force.current_date

    updated_mechs = []
    for mech_id, mech_data in payload.mechs.items():
        mech = await session.get(Mech, mech_id)
        if not mech or mech.force_id != force.id:
            continue
        if mech_data.status is not None:
            mech.status = mech_data.status
        updated_mechs.append(mech)

    updated_elementals = []
    for elemental_id, e_data in payload.elementals.items():
        elemental = await session.get(Elemental, elemental_id)
        if not elemental or elemental.force_id != force.id:
            continue
        if e_data.status is not None:
            elemental.status = e_data.status
        if e_data.suitsDamaged is not None:
            elemental.suits_damaged = max(0, min(6, e_data.suitsDamaged))
        if e_data.suitsDestroyed is not None:
            elemental.suits_destroyed = max(0, min(6, e_data.suitsDestroyed))
        updated_elementals.append(elemental)

    achievement_defs = (await session.execute(select(AchievementDefinition))).scalars().all()

    new_achievements_by_pilot = []
    updated_pilots = []

    for pilot_id, p_data in payload.pilots.items():
        pilot = await session.get(Pilot, pilot_id)
        if not pilot or pilot.force_id != force.id:
            continue

        previous_injuries = pilot.injuries or 0
        new_injuries = max(0, min(6, p_data.injuries)) if p_data.injuries is not None else previous_injuries
        was_injured = new_injuries > previous_injuries

        combat_record = pilot.combat_record or create_empty_combat_record()
        combat_record = record_mission_completion(combat_record, was_injured)

        for kill in p_data.kills:
            combat_record = add_kill(
                combat_record,
                {"mechModel": kill.mechModel, "tonnage": kill.tonnage, "mission": mission.name, "date": timestamp},
            )

        if p_data.assists:
            combat_record = add_assists(combat_record, p_data.assists)

        current_achievement_ids = check_achievements(combat_record, achievement_defs)

        previous_links = (
            await session.execute(select(PilotAchievement).where(PilotAchievement.pilot_id == pilot_id))
        ).scalars().all()
        previous_achievement_ids = [link.achievement_id for link in previous_links]

        earned_new = find_new_achievements(previous_achievement_ids, current_achievement_ids)
        earned_details = []
        for achievement_id in earned_new:
            session.add(PilotAchievement(pilot_id=pilot_id, achievement_id=achievement_id, earned_at=timestamp))
            definition = next((a for a in achievement_defs if a.id == achievement_id), None)
            earned_details.append(
                {
                    "id": achievement_id,
                    "name": definition.name if definition else achievement_id,
                    "icon": definition.icon if definition else None,
                    "description": definition.description if definition else None,
                }
            )

        if earned_details:
            new_achievements_by_pilot.append(
                {"pilotId": pilot_id, "pilotName": pilot.name, "achievements": earned_details}
            )

        pilot.injuries = new_injuries
        pilot.combat_record = combat_record
        updated_pilots.append(pilot)

    mission.objectives = [o.model_dump() for o in payload.objectives]
    mission.recap = payload.recap
    mission.completed = True
    mission.completed_at = timestamp

    reward = sum(o.wpReward for o in payload.objectives if o.achieved and o.wpReward and o.wpReward > 0)
    force.current_warchest = force.current_warchest + reward

    await session.commit()

    pilots_response = []
    for pilot in updated_pilots:
        links = (
            await session.execute(select(PilotAchievement).where(PilotAchievement.pilot_id == pilot.id))
        ).scalars().all()
        pilots_response.append(pilot_to_dict(pilot, [l.achievement_id for l in links]))

    sp_purchases = (
        await session.execute(select(MissionSpPurchase).where(MissionSpPurchase.mission_id == mission_id))
    ).scalars().all()

    return {
        "mission": mission_to_dict(mission, sp_purchases),
        "currentWarchest": force.current_warchest,
        "reward": reward,
        "mechs": [mech_to_dict(m) for m in updated_mechs],
        "elementals": [elemental_to_dict(e) for e in updated_elementals],
        "pilots": pilots_response,
        "newAchievements": new_achievements_by_pilot,
    }

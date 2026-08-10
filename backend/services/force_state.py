"""Centralized force state serialization/deserialization.

This is the single source of truth for turning a Force (plus all of its
children) into the JSON contract described in TECHNICAL_README.md section 7,
and back. It's used today by `GET /api/forces/{id}` and the dedicated
`GET /api/forces/{id}/export` endpoint (routers/forces.py), and is intended
to be reused by force-level snapshot create/restore logic in later issues.
"""
import uuid

from sqlalchemy import select, delete

from models import (
    Force,
    Mech,
    Pilot,
    Elemental,
    Mission,
    Snapshot,
    FullSnapshot,
    SpecialAbility,
    ForceSpecialAbility,
    PilotAchievement,
    MissionSpPurchase,
)
from serializers import force_detail_to_dict


async def serialize_force(session, force_id):
    """Serialize a force and all of its children into the export/detail JSON shape.

    Returns None if the force does not exist.
    """
    force = await session.get(Force, force_id)
    if not force:
        return None

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
    special_abilities = (
        await session.execute(
            select(SpecialAbility)
            .join(ForceSpecialAbility, ForceSpecialAbility.ability_id == SpecialAbility.id)
            .where(ForceSpecialAbility.force_id == force_id)
        )
    ).scalars().all()

    achievements_by_pilot = {p.id: [] for p in pilots}
    if pilots:
        pilot_achv_rows = (
            await session.execute(
                select(PilotAchievement).where(PilotAchievement.pilot_id.in_(achievements_by_pilot.keys()))
            )
        ).scalars().all()
        for row in pilot_achv_rows:
            achievements_by_pilot[row.pilot_id].append(row.achievement_id)

    sp_purchases_by_mission = {m.id: [] for m in missions}
    if missions:
        sp_purchase_rows = (
            await session.execute(
                select(MissionSpPurchase).where(MissionSpPurchase.mission_id.in_(sp_purchases_by_mission.keys()))
            )
        ).scalars().all()
        for row in sp_purchase_rows:
            sp_purchases_by_mission[row.mission_id].append(row)

    return force_detail_to_dict(
        force,
        mechs,
        pilots,
        elementals,
        missions,
        snapshots,
        full_snapshots,
        special_abilities,
        achievements_by_pilot,
        sp_purchases_by_mission,
    )


async def deserialize_force(session, force_id, data):
    """Reconstruct/overwrite a force's full state from JSON in the shape
    produced by `serialize_force`.

    Existing mechs/pilots/elementals/missions/snapshots/fullSnapshots/
    special-ability links for this force are wiped and replaced with the
    contents of `data`. The force itself must already exist. Not yet wired
    to any endpoint - reserved for force-level snapshot restore (issues
    S1-S3) to call directly.
    """
    force = await session.get(Force, force_id)
    if not force:
        raise ValueError(f"Force '{force_id}' not found")

    force.name = data.get("name", force.name)
    force.description = data.get("description", force.description)
    force.image = data.get("image", force.image)
    force.starting_warchest = data.get("startingWarchest", force.starting_warchest)
    force.current_warchest = data.get("currentWarchest", force.current_warchest)
    force.wp_multiplier = data.get("wpMultiplier", force.wp_multiplier)
    force.current_date = data.get("currentDate", force.current_date)
    force.starting_date = data.get("startingDate", force.starting_date)
    force.notes = data.get("notes", force.notes)
    force.other_actions_log = data.get("otherActionsLog", force.other_actions_log)

    pilot_ids = (await session.execute(select(Pilot.id).where(Pilot.force_id == force_id))).scalars().all()
    mission_ids = (await session.execute(select(Mission.id).where(Mission.force_id == force_id))).scalars().all()

    if pilot_ids:
        await session.execute(delete(PilotAchievement).where(PilotAchievement.pilot_id.in_(pilot_ids)))
    if mission_ids:
        await session.execute(delete(MissionSpPurchase).where(MissionSpPurchase.mission_id.in_(mission_ids)))

    await session.execute(delete(ForceSpecialAbility).where(ForceSpecialAbility.force_id == force_id))
    await session.execute(delete(Mission).where(Mission.force_id == force_id))
    await session.execute(delete(Mech).where(Mech.force_id == force_id))
    await session.execute(delete(Pilot).where(Pilot.force_id == force_id))
    await session.execute(delete(Elemental).where(Elemental.force_id == force_id))
    await session.execute(delete(Snapshot).where(Snapshot.force_id == force_id))
    await session.execute(delete(FullSnapshot).where(FullSnapshot.force_id == force_id))

    for m in data.get("mechs", []) or []:
        session.add(
            Mech(
                id=m["id"],
                force_id=force_id,
                name=m.get("name", ""),
                status=m.get("status", "Operational"),
                pilot_id=m.get("pilotId", ""),
                bv=m.get("bv", 0),
                weight=m.get("weight", 0),
                image=m.get("image", ""),
                history=m.get("history", ""),
                warchest_cost=m.get("warchestCost", 0),
                activity_log=m.get("activityLog", []) or [],
            )
        )

    for e in data.get("elementals", []) or []:
        session.add(
            Elemental(
                id=e["id"],
                force_id=force_id,
                name=e.get("name", ""),
                commander=e.get("commander", ""),
                gunnery=e.get("gunnery", 0),
                antimech=e.get("antimech", 0),
                suits_destroyed=e.get("suitsDestroyed", 0),
                suits_damaged=e.get("suitsDamaged", 0),
                bv=e.get("bv", 0),
                status=e.get("status", "Operational"),
                image=e.get("image", ""),
                history=e.get("history", ""),
                warchest_cost=e.get("warchestCost", 0),
                activity_log=e.get("activityLog", []) or [],
            )
        )

    for p in data.get("pilots", []) or []:
        session.add(
            Pilot(
                id=p["id"],
                force_id=force_id,
                name=p.get("name", ""),
                gunnery=p.get("gunnery", 4),
                piloting=p.get("piloting", 5),
                injuries=p.get("injuries", 0),
                dezgra=p.get("dezgra", False),
                history=p.get("history", ""),
                warchest_cost=p.get("warchestCost", 0),
                activity_log=p.get("activityLog", []) or [],
                combat_record=p.get("combatRecord"),
                achievements=[],
            )
        )
        for achievement_id in p.get("achievements", []) or []:
            session.add(PilotAchievement(pilot_id=p["id"], achievement_id=achievement_id, earned_at=None))

    for mi in data.get("missions", []) or []:
        session.add(
            Mission(
                id=mi["id"],
                force_id=force_id,
                name=mi.get("name", ""),
                cost=mi.get("cost", 0),
                description=mi.get("description", ""),
                objectives=mi.get("objectives", []) or [],
                recap=mi.get("recap", ""),
                completed=mi.get("completed", False),
                assigned_mechs=mi.get("assignedMechs", []) or [],
                assigned_elementals=mi.get("assignedElementals", []) or [],
                created_at=mi.get("createdAt", ""),
                in_game_date=mi.get("inGameDate", ""),
                completed_at=mi.get("completedAt"),
                sp_budget=mi.get("spBudget"),
                sp_purchases=[],
                total_tonnage=mi.get("totalTonnage"),
                op_for_units=mi.get("opForUnits", []) or [],
            )
        )
        for sp in mi.get("spPurchases", []) or []:
            session.add(
                MissionSpPurchase(
                    id=sp.get("id") or f"sp-{uuid.uuid4().hex[:12]}",
                    mission_id=mi["id"],
                    choice_id=sp.get("choiceId"),
                    cost_at_purchase=sp.get("cost", 0),
                    name_at_purchase=sp.get("name", ""),
                )
            )

    for s in data.get("snapshots", []) or []:
        session.add(
            Snapshot(
                id=s["id"],
                force_id=force_id,
                type=s.get("type", ""),
                label=s.get("label", ""),
                created_at=s.get("createdAt", ""),
                current_warchest=s.get("currentWarchest", 0),
                starting_warchest=s.get("startingWarchest", 0),
                net_warchest_change=s.get("netWarchestChange", 0),
                missions_completed=s.get("missionsCompleted", 0),
                units=s.get("units", {}) or {},
            )
        )

    for fs in data.get("fullSnapshots", []) or []:
        session.add(
            FullSnapshot(
                id=fs["id"],
                force_id=force_id,
                snapshot_id=fs.get("snapshotId", ""),
                force_data=fs.get("forceData", {}) or {},
                created_at=fs.get("createdAt", ""),
            )
        )

    for a in data.get("specialAbilities", []) or []:
        if a.get("id") is not None:
            session.add(ForceSpecialAbility(force_id=force_id, ability_id=a["id"]))

    await session.commit()
    return await serialize_force(session, force_id)

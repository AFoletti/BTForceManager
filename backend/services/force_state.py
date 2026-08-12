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
from serializers import force_detail_to_dict, decode_image_data_uri


def _resolve_image_fields_for_restore(image_value):
    """Given a snapshot's `image` field (a base64 `data:` URI produced by
    `resolve_image(embed=True)`, or a legacy plain URL string), return the
    `(image, image_data, image_mime_type)` triple ready to assign to a
    Force/Mech/Elemental so the restored entity's image matches the
    snapshot exactly (including "had no image")."""
    img_bytes, img_mime = decode_image_data_uri(image_value)
    if img_bytes is not None:
        return "", img_bytes, img_mime
    return image_value or "", None, None


async def serialize_force(session, force_id, embed_images=False):
    """Serialize a force and all of its children into the export/detail JSON shape.

    Returns None if the force does not exist. When `embed_images=True` (used
    for snapshots), mech/elemental/force images are inlined as base64 data
    URIs instead of live endpoint URLs, so the snapshot stays correct even if
    the image is later replaced, removed, or the entity itself is deleted.
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
        await session.execute(select(ForceSpecialAbility).where(ForceSpecialAbility.force_id == force_id))
    ).scalars().all()
    ability_ids = [row.ability_id for row in special_abilities]
    abilities_by_id = {}
    if ability_ids:
        ability_rows = (
            await session.execute(select(SpecialAbility).where(SpecialAbility.id.in_(ability_ids)))
        ).scalars().all()
        abilities_by_id = {a.id: a for a in ability_rows}

    # Resilient against a globally-edited/removed SpecialAbility (e.g. after
    # a restore references an ability that no longer exists) - surfaced as
    # an explicit "unknown" entry instead of silently disappearing.
    special_abilities_dicts = []
    for row in special_abilities:
        ability = abilities_by_id.get(row.ability_id)
        if ability:
            special_abilities_dicts.append(
                {"id": ability.id, "title": ability.name, "description": ability.description, "unknown": False}
            )
        else:
            special_abilities_dicts.append(
                {
                    "id": row.ability_id,
                    "title": "Unknown Special Ability",
                    "description": "This ability no longer exists in the catalog.",
                    "unknown": True,
                }
            )

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
        special_abilities_dicts,
        achievements_by_pilot,
        sp_purchases_by_mission,
        embed_images=embed_images,
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
    force.image, force.image_data, force.image_mime_type = _resolve_image_fields_for_restore(
        data.get("image", force.image)
    )
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
        m_image, m_image_data, m_image_mime = _resolve_image_fields_for_restore(m.get("image", ""))
        session.add(
            Mech(
                id=m["id"],
                force_id=force_id,
                name=m.get("name", ""),
                status=m.get("status", "Operational"),
                pilot_id=m.get("pilotId", ""),
                bv=m.get("bv", 0),
                weight=m.get("weight", 0),
                image=m_image,
                image_data=m_image_data,
                image_mime_type=m_image_mime,
                history=m.get("history", ""),
                warchest_cost=m.get("warchestCost", 0),
                activity_log=m.get("activityLog", []) or [],
            )
        )

    for e in data.get("elementals", []) or []:
        e_image, e_image_data, e_image_mime = _resolve_image_fields_for_restore(e.get("image", ""))
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
                image=e_image,
                image_data=e_image_data,
                image_mime_type=e_image_mime,
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

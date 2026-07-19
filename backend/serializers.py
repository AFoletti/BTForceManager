def mech_to_dict(m):
    return {
        "id": m.id,
        "name": m.name,
        "status": m.status,
        "pilotId": m.pilot_id,
        "bv": m.bv,
        "weight": m.weight,
        "image": m.image,
        "history": m.history,
        "warchestCost": m.warchest_cost,
        "activityLog": m.activity_log or [],
    }


def elemental_to_dict(e):
    return {
        "id": e.id,
        "name": e.name,
        "commander": e.commander,
        "gunnery": e.gunnery,
        "antimech": e.antimech,
        "suitsDestroyed": e.suits_destroyed,
        "suitsDamaged": e.suits_damaged,
        "bv": e.bv,
        "status": e.status,
        "image": e.image,
        "history": e.history,
        "warchestCost": e.warchest_cost,
        "activityLog": e.activity_log or [],
    }


def pilot_to_dict(p):
    d = {
        "id": p.id,
        "name": p.name,
        "gunnery": p.gunnery,
        "piloting": p.piloting,
        "injuries": p.injuries,
        "dezgra": p.dezgra,
        "history": p.history,
        "warchestCost": p.warchest_cost,
        "activityLog": p.activity_log or [],
        "achievements": p.achievements or [],
    }
    if p.combat_record:
        d["combatRecord"] = p.combat_record
    return d


def mission_to_dict(m):
    d = {
        "id": m.id,
        "name": m.name,
        "cost": m.cost,
        "description": m.description,
        "objectives": m.objectives or [],
        "recap": m.recap,
        "completed": m.completed,
        "assignedMechs": m.assigned_mechs or [],
        "assignedElementals": m.assigned_elementals or [],
        "createdAt": m.created_at,
        "inGameDate": m.in_game_date,
        "completedAt": m.completed_at,
    }
    if m.sp_budget is not None:
        d["spBudget"] = m.sp_budget
    if m.sp_purchases:
        d["spPurchases"] = m.sp_purchases
    if m.total_tonnage is not None:
        d["totalTonnage"] = m.total_tonnage
    if m.op_for_units:
        d["opForUnits"] = m.op_for_units
    return d


def snapshot_to_dict(s):
    return {
        "id": s.id,
        "type": s.type,
        "label": s.label,
        "createdAt": s.created_at,
        "currentWarchest": s.current_warchest,
        "startingWarchest": s.starting_warchest,
        "netWarchestChange": s.net_warchest_change,
        "missionsCompleted": s.missions_completed,
        "units": s.units or {},
    }


def full_snapshot_to_dict(fs):
    return {
        "id": fs.id,
        "snapshotId": fs.snapshot_id,
        "forceData": fs.force_data,
        "createdAt": fs.created_at,
    }


def force_summary_to_dict(force, mech_count, pilot_count, elemental_count, mission_count):
    return {
        "id": force.id,
        "name": force.name,
        "description": force.description,
        "image": force.image,
        "startingWarchest": force.starting_warchest,
        "currentWarchest": force.current_warchest,
        "currentDate": force.current_date,
        "mechCount": mech_count,
        "pilotCount": pilot_count,
        "elementalCount": elemental_count,
        "missionCount": mission_count,
    }


def force_detail_to_dict(
    force, mechs, pilots, elementals, missions, snapshots, full_snapshots, special_abilities=None
):
    return {
        "id": force.id,
        "name": force.name,
        "description": force.description,
        "image": force.image,
        "startingWarchest": force.starting_warchest,
        "currentWarchest": force.current_warchest,
        "wpMultiplier": force.wp_multiplier,
        "specialAbilities": [
            {"id": a.id, "title": a.name, "description": a.description} for a in (special_abilities or [])
        ],
        "otherActionsLog": force.other_actions_log or [],
        "currentDate": force.current_date,
        "notes": force.notes,
        "mechs": [mech_to_dict(m) for m in mechs],
        "pilots": [pilot_to_dict(p) for p in pilots],
        "elementals": [elemental_to_dict(e) for e in elementals],
        "missions": [mission_to_dict(m) for m in missions],
        "snapshots": [snapshot_to_dict(s) for s in snapshots],
        "fullSnapshots": [full_snapshot_to_dict(fs) for fs in full_snapshots],
    }

import base64


def resolve_image(kind, entity, embed=False):
    """Return the value the frontend/snapshot should use for an entity's
    image. By default, the dedicated binary-image endpoint if bytes are
    stored in the DB, falling back to the legacy `image` URL column for
    older/unmigrated data. When `embed=True` (used for snapshots, which must
    stay correct even if the image is later replaced/removed), the actual
    bytes are inlined as a base64 `data:` URI instead of a live URL."""
    if getattr(entity, "image_data", None):
        if embed:
            mime = entity.image_mime_type or "application/octet-stream"
            b64 = base64.b64encode(entity.image_data).decode("ascii")
            return f"data:{mime};base64,{b64}"
        return f"/api/{kind}/{entity.id}/image"
    return entity.image or ""


def decode_image_data_uri(value):
    """If `value` is a `data:<mime>;base64,<payload>` URI (as produced by
    `resolve_image(embed=True)` for snapshots), decode it back into
    `(bytes, mime_type)`. Otherwise returns `(None, None)` - legacy plain
    URLs carry no bytes to restore."""
    if not value or not isinstance(value, str) or not value.startswith("data:"):
        return None, None
    try:
        header, b64_payload = value.split(",", 1)
        mime = header[len("data:"):].split(";")[0] or "application/octet-stream"
        return base64.b64decode(b64_payload), mime
    except Exception:
        return None, None


def mech_to_dict(m, embed_images=False):
    return {
        "id": m.id,
        "name": m.name,
        "status": m.status,
        "pilotId": m.pilot_id,
        "bv": m.bv,
        "weight": m.weight,
        "image": resolve_image("mechs", m, embed=embed_images),
        "history": m.history,
        "warchestCost": m.warchest_cost,
        "activityLog": m.activity_log or [],
    }


def elemental_to_dict(e, embed_images=False):
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
        "image": resolve_image("elementals", e, embed=embed_images),
        "history": e.history,
        "warchestCost": e.warchest_cost,
        "activityLog": e.activity_log or [],
    }


def pilot_to_dict(p, achievement_ids=None):
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
        "achievements": achievement_ids if achievement_ids is not None else (p.achievements or []),
    }
    if p.combat_record:
        d["combatRecord"] = p.combat_record
    return d


def sp_purchase_to_dict(sp):
    return {
        "id": sp.id,
        "choiceId": sp.choice_id,
        "name": sp.name_at_purchase,
        "cost": sp.cost_at_purchase,
    }


def mission_to_dict(m, sp_purchases=None):
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
    resolved_sp_purchases = sp_purchases if sp_purchases is not None else m.sp_purchases
    if resolved_sp_purchases:
        d["spPurchases"] = (
            [sp_purchase_to_dict(sp) for sp in sp_purchases] if sp_purchases is not None else resolved_sp_purchases
        )
    if m.total_tonnage is not None:
        d["totalTonnage"] = m.total_tonnage
    if m.op_for_units:
        d["opForUnits"] = m.op_for_units
    return d


def force_summary_to_dict(force, mech_count, pilot_count, elemental_count, mission_count):
    return {
        "id": force.id,
        "name": force.name,
        "description": force.description,
        "image": resolve_image("forces", force),
        "startingWarchest": force.starting_warchest,
        "currentWarchest": force.current_warchest,
        "currentDate": force.current_date,
        "startingDate": force.starting_date,
        "mechCount": mech_count,
        "pilotCount": pilot_count,
        "elementalCount": elemental_count,
        "missionCount": mission_count,
    }


def force_detail_to_dict(
    force,
    mechs,
    pilots,
    elementals,
    missions,
    special_abilities=None,
    achievements_by_pilot=None,
    sp_purchases_by_mission=None,
    embed_images=False,
):
    achievements_by_pilot = achievements_by_pilot or {}
    sp_purchases_by_mission = sp_purchases_by_mission or {}
    return {
        "id": force.id,
        "name": force.name,
        "description": force.description,
        "image": resolve_image("forces", force, embed=embed_images),
        "startingWarchest": force.starting_warchest,
        "currentWarchest": force.current_warchest,
        "wpMultiplier": force.wp_multiplier,
        "specialAbilities": special_abilities or [],
        "otherActionsLog": force.other_actions_log or [],
        "currentDate": force.current_date,
        "startingDate": force.starting_date,
        "notes": force.notes,
        "mechs": [mech_to_dict(m, embed_images=embed_images) for m in mechs],
        "pilots": [pilot_to_dict(p, achievements_by_pilot.get(p.id)) for p in pilots],
        "elementals": [elemental_to_dict(e, embed_images=embed_images) for e in elementals],
        "missions": [mission_to_dict(m, sp_purchases_by_mission.get(m.id)) for m in missions],
    }

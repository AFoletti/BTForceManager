"""Ported from frontend/src/lib/missions.js - availability + BV/tonnage calculations."""
from domain.mechs_logic import get_mech_adjusted_bv


def is_mech_available_for_mission(mech, pilot):
    if not mech:
        return False
    if mech.status == "Destroyed":
        return False
    if mech.status not in ("Operational", "Damaged"):
        return False
    if not pilot:
        return False
    if pilot.injuries == 6:
        return False
    return True


def is_elemental_available_for_mission(elemental):
    if not elemental:
        return False
    if (elemental.suits_destroyed or 0) >= 6:
        return False
    if elemental.status not in ("Operational", "Damaged"):
        return False
    if (elemental.suits_destroyed or 0) >= 5:
        return False
    return True


def calculate_mission_total_tonnage(mechs_by_id, mech_ids):
    total = 0
    for mech_id in mech_ids:
        mech = mechs_by_id.get(mech_id)
        if mech:
            total += mech.weight or 0
    return total


def calculate_mission_total_bv(mechs_by_id, pilots_by_id, mech_ids, elementals_by_id, elemental_ids):
    mech_bv = 0
    for mech_id in mech_ids:
        mech = mechs_by_id.get(mech_id)
        if not mech:
            continue
        pilot = pilots_by_id.get(mech.pilot_id) if mech.pilot_id else None
        mech_bv += get_mech_adjusted_bv(mech, pilot)

    elemental_bv = 0
    for elemental_id in elemental_ids:
        elemental = elementals_by_id.get(elemental_id)
        if elemental:
            elemental_bv += elemental.bv or 0

    return mech_bv + elemental_bv

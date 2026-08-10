"""Ported from frontend/src/lib/achievements.js - combat stats & achievement checks."""
import re

WEIGHT_CLASSES = {
    "light": (20, 35),
    "medium": (40, 55),
    "heavy": (60, 75),
    "assault": (80, 100),
}


def get_weight_class(tonnage):
    for name, (lo, hi) in WEIGHT_CLASSES.items():
        if lo <= tonnage <= hi:
            return name
    return None


def compute_combat_stats(combat_record):
    combat_record = combat_record or {}
    kills = combat_record.get("kills") or []
    assists = combat_record.get("assists") or 0
    missions_completed = combat_record.get("missionsCompleted") or 0
    missions_without_injury = combat_record.get("missionsWithoutInjury") or 0
    total_injuries_healed = combat_record.get("totalInjuriesHealed") or 0

    light_kills = medium_kills = heavy_kills = assault_kills = 0
    total_tonnage_destroyed = 0
    max_tonnage_kill = 0

    for kill in kills:
        tonnage = kill.get("tonnage") or 0
        total_tonnage_destroyed += tonnage
        if tonnage > max_tonnage_kill:
            max_tonnage_kill = tonnage
        weight_class = get_weight_class(tonnage)
        if weight_class == "light":
            light_kills += 1
        elif weight_class == "medium":
            medium_kills += 1
        elif weight_class == "heavy":
            heavy_kills += 1
        elif weight_class == "assault":
            assault_kills += 1

    return {
        "killCount": len(kills),
        "assists": assists,
        "missionsCompleted": missions_completed,
        "missionsWithoutInjury": missions_without_injury,
        "totalInjuriesHealed": total_injuries_healed,
        "lightKills": light_kills,
        "mediumKills": medium_kills,
        "heavyKills": heavy_kills,
        "assaultKills": assault_kills,
        "totalTonnageDestroyed": total_tonnage_destroyed,
        "maxTonnageKill": max_tonnage_kill,
    }


_CONDITION_RE = re.compile(r"^(\w+)\s*(>=|===|>|<|<=)\s*(\d+)$")


def check_condition(condition, stats):
    try:
        parts = [p.strip() for p in condition.split("&&")]
        for part in parts:
            match = _CONDITION_RE.match(part)
            if not match:
                return False
            variable, operator, value_str = match.groups()
            stat_value = stats.get(variable, 0) or 0
            target = int(value_str)
            if operator == ">=":
                ok = stat_value >= target
            elif operator == ">":
                ok = stat_value > target
            elif operator == "<=":
                ok = stat_value <= target
            elif operator == "<":
                ok = stat_value < target
            elif operator == "===":
                ok = stat_value == target
            else:
                ok = False
            if not ok:
                return False
        return True
    except Exception:
        return False


def check_achievements(combat_record, achievement_definitions):
    """achievement_definitions: list of dicts/objects with 'id' and 'condition'."""
    stats = compute_combat_stats(combat_record)
    earned = []
    for achievement in achievement_definitions:
        condition = achievement["condition"] if isinstance(achievement, dict) else achievement.condition
        achievement_id = achievement["id"] if isinstance(achievement, dict) else achievement.id
        if check_condition(condition, stats):
            earned.append(achievement_id)
    return earned


def find_new_achievements(previous_ids, current_ids):
    prev = set(previous_ids or [])
    return [aid for aid in current_ids if aid not in prev]


def create_empty_combat_record():
    return {
        "kills": [],
        "assists": 0,
        "missionsCompleted": 0,
        "missionsWithoutInjury": 0,
        "totalInjuriesHealed": 0,
    }


def add_kill(combat_record, kill):
    record = combat_record or create_empty_combat_record()
    kills = list(record.get("kills") or [])
    kills.append(kill)
    return {**record, "kills": kills}


def add_assists(combat_record, count):
    record = combat_record or create_empty_combat_record()
    return {**record, "assists": (record.get("assists") or 0) + count}


def record_mission_completion(combat_record, was_injured):
    record = combat_record or create_empty_combat_record()
    return {
        **record,
        "missionsCompleted": (record.get("missionsCompleted") or 0) + 1,
        "missionsWithoutInjury": 0 if was_injured else (record.get("missionsWithoutInjury") or 0) + 1,
    }


def record_injuries_healed(combat_record, count):
    record = combat_record or create_empty_combat_record()
    return {**record, "totalInjuriesHealed": (record.get("totalInjuriesHealed") or 0) + count}

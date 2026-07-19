"""Ported from frontend/src/lib/mechs.js - BV adjustment based on pilot skill."""
import math

BV_MULTIPLIER_TABLE = [
    [2.42, 2.31, 2.21, 2.10, 1.93, 1.75, 1.68, 1.59, 1.50],
    [2.21, 2.11, 2.02, 1.92, 1.76, 1.60, 1.54, 1.46, 1.38],
    [1.93, 1.85, 1.76, 1.68, 1.54, 1.40, 1.35, 1.28, 1.21],
    [1.66, 1.58, 1.51, 1.44, 1.32, 1.20, 1.16, 1.10, 1.04],
    [1.38, 1.32, 1.26, 1.20, 1.10, 1.00, 0.95, 0.90, 0.85],
    [1.31, 1.19, 1.13, 1.08, 0.99, 0.90, 0.86, 0.81, 0.77],
    [1.24, 1.12, 1.07, 1.02, 0.94, 0.85, 0.81, 0.77, 0.72],
    [1.17, 1.06, 1.01, 0.96, 0.88, 0.80, 0.76, 0.72, 0.68],
    [1.10, 0.99, 0.95, 0.90, 0.83, 0.75, 0.71, 0.68, 0.64],
]


def _round_half_up(value):
    """Match JS Math.round (round-half-up) rather than Python's banker's rounding."""
    return math.floor(value + 0.5)


def get_bv_multiplier(gunnery, piloting):
    g = max(0, min(8, int(gunnery if gunnery is not None else 4)))
    p = max(0, min(8, int(piloting if piloting is not None else 5)))
    return BV_MULTIPLIER_TABLE[g][p]


def get_adjusted_bv(base_bv, gunnery, piloting):
    if not base_bv:
        return 0
    if gunnery is None or piloting is None:
        return _round_half_up(base_bv)
    return _round_half_up(base_bv * get_bv_multiplier(gunnery, piloting))


def get_mech_adjusted_bv(mech, pilot):
    if not mech or not mech.bv:
        return 0
    if not pilot:
        return _round_half_up(mech.bv)
    return get_adjusted_bv(mech.bv, pilot.gunnery, pilot.piloting)

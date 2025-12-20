// Helpers for mech–pilot relationships.
// Centralises the logic that determines which pilot is assigned
// to which mech, which pilots are available, etc.
/**
 * @typedef {Object} Mech
 * @property {string} id
 * @property {string} [pilotId]
 * @property {number} [bv]
 */

/**
 * @typedef {Object} Pilot
 * @property {string} id
 * @property {string} name
 * @property {number} [gunnery]
 * @property {number} [piloting]
 * @property {number} [injuries]
 */

/**
 * @typedef {Object} Force
 * @property {Mech[]} mechs
 * @property {Pilot[]} pilots
 */

/**
 * Standard BattleTech BV skill multiplier table.
 * Rows are Gunnery (0-8), columns are Piloting (0-8).
 * Base value (1.0) is at Gunnery 4, Piloting 5.
 */
const BV_MULTIPLIER_TABLE = [
  // Piloting:  0      1      2      3      4      5      6      7      8
  /* G0 */  [2.42,  2.31,  2.21,  2.10,  1.93,  1.75,  1.68,  1.59,  1.50],
  /* G1 */  [2.21,  2.11,  2.02,  1.92,  1.76,  1.60,  1.54,  1.46,  1.38],
  /* G2 */  [1.93,  1.85,  1.76,  1.68,  1.54,  1.40,  1.35,  1.28,  1.21],
  /* G3 */  [1.66,  1.58,  1.51,  1.44,  1.32,  1.20,  1.16,  1.10,  1.04],
  /* G4 */  [1.38,  1.32,  1.26,  1.20,  1.10,  1.00,  0.95,  0.90,  0.85],
  /* G5 */  [1.31,  1.25,  1.19,  1.13,  1.04,  0.95,  0.90,  0.86,  0.81],
  /* G6 */  [1.24,  1.18,  1.13,  1.08,  0.99,  0.90,  0.86,  0.81,  0.77],
  /* G7 */  [1.17,  1.12,  1.07,  1.02,  0.94,  0.85,  0.81,  0.77,  0.72],
  /* G8 */  [1.10,  1.05,  1.01,  0.96,  0.88,  0.80,  0.76,  0.72,  0.68],
];

/**
 * Get the BV multiplier for a given Gunnery/Piloting combination.
 * 
 * @param {number} gunnery - Gunnery skill (0-8)
 * @param {number} piloting - Piloting skill (0-8)
 * @returns {number} The BV multiplier
 */
export function getBVMultiplier(gunnery, piloting) {
  // Clamp values to valid range
  const g = Math.max(0, Math.min(8, Math.floor(gunnery ?? 4)));
  const p = Math.max(0, Math.min(8, Math.floor(piloting ?? 5)));
  return BV_MULTIPLIER_TABLE[g][p];
}

/**
 * Calculate the adjusted BV for a mech based on its pilot's skills.
 * If no pilot is assigned, returns the base BV.
 * 
 * @param {number} baseBV - The mech's base BV (at 4/5 pilot)
 * @param {number|null} gunnery - Pilot's gunnery skill (null if no pilot)
 * @param {number|null} piloting - Pilot's piloting skill (null if no pilot)
 * @returns {number} Adjusted BV, rounded to nearest integer
 */
export function getAdjustedBV(baseBV, gunnery, piloting) {
  if (baseBV == null || baseBV === 0) return 0;
  
  // If no pilot skills provided, return base BV
  if (gunnery == null || piloting == null) {
    return Math.round(baseBV);
  }
  
  const multiplier = getBVMultiplier(gunnery, piloting);
  return Math.round(baseBV * multiplier);
}

/**
 * Get the adjusted BV for a mech considering its assigned pilot.
 * Convenience function that looks up the pilot from the force.
 * 
 * @param {Force} force - The force object
 * @param {Mech} mech - The mech object
 * @returns {number} Adjusted BV, rounded to nearest integer
 */
export function getMechAdjustedBV(force, mech) {
  if (!mech || !mech.bv) return 0;
  
  const pilot = findPilotForMech(force, mech);
  if (!pilot) {
    return Math.round(mech.bv);
  }
  
  return getAdjustedBV(mech.bv, pilot.gunnery, pilot.piloting);
}

/**
 * Find the pilot object assigned to a mech, if any.
 * Matching is done strictly by pilot ID.
 *
 * @param {Force} force
 * @param {Mech} mech
 * @returns {Pilot|null}
 */
export function findPilotForMech(force, mech) {
  if (!mech || !force) return null;
  const pilots = force.pilots || [];

  if (!mech.pilotId) return null;
  return pilots.find((pilot) => pilot.id === mech.pilotId) || null;
}

/**
 * Find the mech object a pilot is assigned to, if any.
 *
 * @param {Force} force
 * @param {Pilot} pilot
 * @returns {Mech|null}
 */
export function findMechForPilot(force, pilot) {
  if (!pilot || !force) return null;
  const mechs = force.mechs || [];

  return mechs.find((mech) => mech.pilotId === pilot.id) || null;
}

/**
 * Return the list of pilots that are available for assignment to a mech.
 * A pilot is considered unavailable if they are already assigned to a mech
 * other than the one currently being edited.
 *
 * @param {Force} force
 * @param {Mech|null} editingMech The mech currently being edited (or null when creating)
 * @returns {Pilot[]} Array of pilot objects
 */
export function getAvailablePilotsForMech(force, editingMech) {
  const pilots = force.pilots || [];
  const mechs = force.mechs || [];

  const assignedPilotIds = new Set();

  mechs.forEach((mech) => {
    // Skip the mech being edited
    if (editingMech && mech.id === editingMech.id) return;
    if (mech.pilotId) {
      assignedPilotIds.add(mech.pilotId);
    }
  });

  return pilots.filter((pilot) => !assignedPilotIds.has(pilot.id));
}

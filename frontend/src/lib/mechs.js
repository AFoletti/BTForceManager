// Helpers for mech–pilot relationships.
// Centralises the logic that determines which pilot is assigned
// to which mech, which pilots are available, etc.
/**
 * @typedef {Object} Mech
 * @property {string} id
 * @property {string} [pilotId]
 * @property {string} [pilot] - Deprecated: legacy name field, use pilotId
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
 * Find the pilot object assigned to a mech, if any.
 * Matching is done by pilot ID. For backward compatibility, falls back to name matching
 * if pilotId is not present but pilot (name) is.
 *
 * @param {Force} force
 * @param {Mech} mech
 * @returns {Pilot|null}
 */
export function findPilotForMech(force, mech) {
  if (!mech) return null;
  const pilots = force.pilots || [];
  
  // New approach: use pilotId
  if (mech.pilotId) {
    return pilots.find((pilot) => pilot.id === mech.pilotId) || null;
  }
  
  // Legacy fallback: use pilot name (for backward compatibility)
  if (mech.pilot) {
    return pilots.find((pilot) => pilot.name === mech.pilot) || null;
  }
  
  return null;
}

/**
 * Find the mech object a pilot is assigned to, if any.
 *
 * @param {Force} force
 * @param {Pilot} pilot
 * @returns {Mech|null}
 */
export function findMechForPilot(force, pilot) {
  if (!pilot) return null;
  const mechs = force.mechs || [];
  
  // Check both pilotId (new) and pilot name (legacy)
  return mechs.find((mech) => 
    mech.pilotId === pilot.id || mech.pilot === pilot.name
  ) || null;
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

  // Build set of assigned pilot IDs and names (for legacy support)
  const assignedPilotIds = new Set();
  const assignedPilotNames = new Set();
  
  mechs.forEach((mech) => {
    // Skip the mech being edited
    if (editingMech && mech.id === editingMech.id) return;
    
    if (mech.pilotId) {
      assignedPilotIds.add(mech.pilotId);
    }
    if (mech.pilot) {
      assignedPilotNames.add(mech.pilot);
    }
  });

  return pilots.filter((pilot) => 
    !assignedPilotIds.has(pilot.id) && !assignedPilotNames.has(pilot.name)
  );
}

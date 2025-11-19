// Helpers for mech–pilot relationships.
// Centralises the logic that determines which pilot is assigned
// to which mech, which pilots are available, etc.

/**
 * Find the pilot object assigned to a mech, if any.
 * Matching is done by pilot name because mechs currently store
 * only the pilot's name.
 *
 * @param {Object} force
 * @param {Object} mech
 * @returns {Object|null}
 */
export function findPilotForMech(force, mech) {
  if (!mech || !mech.pilot) return null;
  const pilots = force.pilots || [];
  return pilots.find((pilot) => pilot.name === mech.pilot) || null;
}

/**
 * Find the mech object a pilot is assigned to, if any.
 *
 * @param {Object} force
 * @param {Object} pilot
 * @returns {Object|null}
 */
export function findMechForPilot(force, pilot) {
  if (!pilot) return null;
  const mechs = force.mechs || [];
  return mechs.find((mech) => mech.pilot === pilot.name) || null;
}

/**
 * Return the list of pilots that are available for assignment to a mech.
 * A pilot is considered unavailable if they are already assigned to a mech
 * other than the one currently being edited.
 *
 * @param {Object} force
 * @param {Object|null} editingMech The mech currently being edited (or null when creating)
 * @returns {Object[]} Array of pilot objects
 */
export function getAvailablePilotsForMech(force, editingMech) {
  const pilots = force.pilots || [];
  const mechs = force.mechs || [];

  const assignedToOtherMechs = new Set(
    mechs
      .filter((mech) => mech.pilot && (!editingMech || mech.id !== editingMech.id))
      .map((mech) => mech.pilot),
  );

  return pilots.filter((pilot) => !assignedToOtherMechs.has(pilot.name));
}

// Mission-related helpers.
// These functions are pure and never mutate the input `force` object.

/**
 * @typedef {Object} Mech
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [pilot]
 * @property {number} [bv]
 * @property {number} [weight]
 * @property {Array<Object>} [activityLog]
 */

/**
 * @typedef {Object} Pilot
 * @property {string} id
 * @property {string} name
 * @property {number} [gunnery]
 * @property {number} [piloting]
 * @property {number} [injuries]
 * @property {Array<Object>} [activityLog]
 */

/**
 * @typedef {Object} Elemental
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [commander]
 * @property {number} [gunnery]
 * @property {number} [antimech]
 * @property {number} [suitsDestroyed]
 * @property {number} [suitsDamaged]
 * @property {number} [bv]
 * @property {Array<Object>} [activityLog]
 */

/**
 * @typedef {Object} Mission
 * @property {string} id
 * @property {string} name
 * @property {number} cost
 * @property {number} warchestGained
 * @property {string} [description]
 * @property {string} [objectives]
 * @property {string} [recap]
 * @property {boolean} [completed]
 * @property {string[]} [assignedMechs]
 * @property {string[]} [assignedElementals]
 * @property {string} [createdAt]
 */

/**
 * @typedef {Object} Force
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} [image]
 * @property {number} startingWarchest
 * @property {number} currentWarchest
 * @property {number} [wpMultiplier]
 * @property {Mech[]} mechs
 * @property {Pilot[]} pilots
 * @property {Elemental[]} [elementals]
 * @property {Mission[]} [missions]
 * @property {Array<Object>} [otherActionsLog]
 */


import { findPilotForMech } from './mechs';

/**
 * Determine if a mech is available for mission assignment.
 *
 * Rules (must all be true):
 * - Mech is not destroyed
 * - Status is Operational or Damaged
 * - Mech has an assigned pilot
 * - Pilot is not KIA (injuries !== 6)
 *
 * @param {Force} force
 * @param {Mech} mech
 * @returns {boolean}
 */
export function isMechAvailableForMission(force, mech) {
  if (!mech) return false;
  if (mech.status === 'Destroyed') return false;

  const statusAllowsDeployment = mech.status === 'Operational' || mech.status === 'Damaged';
  if (!statusAllowsDeployment) return false;

  const pilot = findPilotForMech(force, mech);
  if (!pilot) return false;
  if (pilot.injuries === 6) return false;

  return true;
}

/**
 * Determine if an elemental point is available for mission assignment.
 *
 * Rules (must all be true):
 * - Less than 6 suits destroyed (otherwise point is hidden)
 * - Status is Operational or Damaged
 * - suitsDestroyed <= 4 (5 is visible but not selectable)
 *
 * @param {Elemental} elemental
 * @returns {boolean}
 */
export function isElementalAvailableForMission(elemental) {
  if (!elemental) return false;
  if (elemental.suitsDestroyed >= 6) return false;

  const statusAllowsDeployment =
    elemental.status === 'Operational' || elemental.status === 'Damaged';
  if (!statusAllowsDeployment) return false;

  if (elemental.suitsDestroyed >= 5) return false;

  return true;
}

/**
 * Calculate the total BV of a mission assignment.
 *
 * @param {Force} force
 * @param {string[]} mechIds
 * @param {string[]} [elementalIds=[]]
 * @returns {number}
 */
export function calculateMissionTotalBV(force, mechIds, elementalIds = []) {
  const mechBV = mechIds.reduce((total, mechId) => {
    const mech = force.mechs.find((m) => m.id === mechId);
    return total + (mech?.bv || 0);
  }, 0);

  const elementals = force.elementals || [];
  const elementalBV = elementalIds.reduce((total, elementalId) => {
    const elemental = elementals.find((e) => e.id === elementalId);
    return total + (elemental?.bv || 0);
  }, 0);

  return mechBV + elementalBV;
}

/**
 * Return the mech objects corresponding to the given ids, preserving order.
 *
 * @param {Force} force
 * @param {string[]} mechIds
 * @returns {Mech[]}
 */
export function getAssignedMechs(force, mechIds) {
  return mechIds
    .map((id) => force.mechs.find((mech) => mech.id === id))
    .filter(Boolean);
}

/**
 * Return the elemental objects corresponding to the given ids, preserving order.
 *
 * @param {Force} force
 * @param {string[]} elementalIds
 * @returns {Elemental[]}
 */
export function getAssignedElementals(force, elementalIds = []) {
  const elementals = force.elementals || [];
  return elementalIds
    .map((id) => elementals.find((elemental) => elemental.id === id))
    .filter(Boolean);
}

/**
 * Create a new mission and update mechs, elementals, pilots and warchest
 * according to the current form data.
 *
 * Mirrors the behaviour previously implemented inline in MissionManager.
 *
 * @param {Force} force
 * @param {Mission} formData
 * @param {string} timestamp ISO timestamp string
 * @returns {{ missions: Mission[], mechs: Mech[], elementals: Elemental[], pilots: Pilot[], currentWarchest: number }}
 */
export function applyMissionCreation(force, formData, timestamp) {
  const missions = [...(force.missions || [])];

  const newMission = {
    ...formData,
    id: `mission-${Date.now()}`,
    createdAt: timestamp,
  };
  missions.push(newMission);

  // Log mission assignment for assigned mechs
  const updatedMechs = force.mechs.map((mech) => {
    if (formData.assignedMechs.includes(mech.id)) {
      const activityLog = [...(mech.activityLog || [])];
      activityLog.push({
        timestamp,
        action: `Assigned to mission: ${formData.name}`,
        mission: formData.name,
        cost: 0,
      });
      return { ...mech, activityLog };
    }
    return mech;
  });

  // Log mission assignment for elementals
  const updatedElementals = (force.elementals || []).map((elemental) => {
    if (formData.assignedElementals?.includes(elemental.id)) {
      const activityLog = [...(elemental.activityLog || [])];
      activityLog.push({
        timestamp,
        action: `Assigned to mission: ${formData.name}`,
        mission: formData.name,
        cost: 0,
      });
      return { ...elemental, activityLog };
    }
    return elemental;
  });

  // Log mission assignment for pilots of assigned mechs
  const assignedMechs = force.mechs.filter((mech) =>
    formData.assignedMechs.includes(mech.id),
  );
  const updatedPilots = force.pilots.map((pilot) => {
    const pilotMech = assignedMechs.find((mech) => mech.pilot === pilot.name);
    if (pilotMech) {
      const activityLog = [...(pilot.activityLog || [])];
      activityLog.push({
        timestamp,
        inGameDate: force.currentDate,
        action: `Assigned to mission: ${formData.name} (piloting ${pilotMech.name})`,
        mission: formData.name,
        cost: 0,
      });
      return { ...pilot, activityLog };
    }
    return pilot;
  });

  const currentWarchest = force.currentWarchest - formData.cost;

  return {
    missions,
    mechs: updatedMechs,
    elementals: updatedElementals,
    pilots: updatedPilots,
    currentWarchest,
  };
}

/**
 * Update an existing mission within a missions array.
 *
 * @param {Mission[]} missions
 * @param {string} missionId
 * @param {Mission} formData
 * @param {string} timestamp ISO timestamp string
 * @returns {Mission[]}
 */
export function applyMissionUpdate(missions, missionId, formData, timestamp) {
  return missions.map((mission) =>
    mission.id === missionId
      ? {
          ...mission,
          ...formData,
          id: missionId,
        }
      : mission,
  );
}

/**
 * Mark a mission as completed and update the force warchest accordingly.
 *
 * @param {Force} force
 * @param {string} missionId
 * @param {string} [timestamp] Optional ISO timestamp; defaults to now.
 * @returns {{ missions: Mission[], currentWarchest: number }}
 */
export function applyMissionCompletion(force, missionId, timestamp) {
  const completionTimestamp = timestamp || force.currentDate;

  const missions = force.missions.map((mission) => {
    if (mission.id === missionId && !mission.completed) {
      return {
        ...mission,
        completed: true,
      };
    }
    return mission;
  });

  const mission = force.missions.find((m) => m.id === missionId);
  const currentWarchest = force.currentWarchest + (mission?.warchestGained || 0);

  return { missions, currentWarchest };
}

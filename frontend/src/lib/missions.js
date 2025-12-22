// Mission-related helpers.
// These functions are pure and never mutate the input `force` object.

/**
 * @typedef {Object} Mech
 * @property {string} id
 * @property {string} name
 * @property {string} [status]
 * @property {string} [pilotId]
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
 * @typedef {Object} MissionObjective
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {number} wpReward // positive integer
 * @property {boolean} achieved
 */

/**
 * @typedef {Object} Mission
 * @property {string} id
 * @property {string} name
 * @property {number} cost
 * @property {string} [description]
 * @property {MissionObjective[]} [objectives]
 * @property {string} [recap]
 * @property {boolean} [completed]
 * @property {string[]} [assignedMechs]
 * @property {string[]} [assignedElementals]
 * @property {string} [createdAt]
 * @property {string} [inGameDate]
 * @property {string} [completedAt]
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
 */

import { findPilotForMech, findMechForPilot, getMechAdjustedBV } from './mechs';

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
 * Uses adjusted BV for mechs (based on pilot skills).
 *
 * @param {Force} force
 * @param {string[]} mechIds
 * @param {string[]} [elementalIds=[]]
 * @returns {number}
 */
export function calculateMissionTotalBV(force, mechIds, elementalIds = []) {
  const mechBV = mechIds.reduce((total, mechId) => {
    const mech = force.mechs.find((m) => m.id === mechId);
    if (!mech) return total;
    return total + getMechAdjustedBV(force, mech);
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
 * Sum all achieved objective rewards for a mission.
 *
 * @param {Mission} mission
 * @returns {number}
 */
export function getMissionObjectiveReward(mission) {
  if (!mission || !Array.isArray(mission.objectives)) return 0;
  return mission.objectives.reduce((sum, obj) => {
    if (!obj || !obj.achieved) return sum;
    const reward = typeof obj.wpReward === 'number' && obj.wpReward > 0 ? obj.wpReward : 0;
    return sum + reward;
  }, 0);
}

/**
 * Create a new mission and update mechs, elementals, pilots and warchest
 * according to the current form data.
 *
 * On creation, the mission cost is immediately subtracted from the Warchest
 * and a corresponding ledger entry will be emitted.
 *
 * If this is the first mission, the original BV values are calculated and stored.
 *
 * @param {Force} force
 * @param {Mission} formData
 * @param {string} timestamp ISO timestamp string (in-universe date)
 * @returns {{ missions: Mission[], mechs: Mech[], elementals: Elemental[], pilots: Pilot[], currentWarchest: number, originalBaseBV?: number, originalAdjustedBV?: number }}
 */
export function applyMissionCreation(force, formData, timestamp) {
  const missions = [...(force.missions || [])];
  const isFirstMission = missions.length === 0 && force.originalBaseBV === undefined;

  const newMission = {
    ...formData,
    id: `mission-${Date.now()}`,
    createdAt: timestamp,
    inGameDate: timestamp,
    completed: false,
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

  // Log mission assignment for pilots of assigned mechs (ID-based)
  const assignedMechIds = new Set(formData.assignedMechs || []);
  const updatedPilots = (force.pilots || []).map((pilot) => {
    const pilotMech = findMechForPilot(force, pilot);
    if (!pilotMech || !assignedMechIds.has(pilotMech.id)) {
      return pilot;
    }

    const activityLog = [...(pilot.activityLog || [])];
    activityLog.push({
      timestamp,
      inGameDate: force.currentDate,
      action: `Assigned to mission: ${formData.name} (piloting ${pilotMech.name})`,
      mission: formData.name,
      cost: 0,
    });
    return { ...pilot, activityLog };
  });

  const missionCost = typeof formData.cost === 'number' ? formData.cost : 0;
  const currentWarchest = force.currentWarchest - missionCost;

  const result = {
    missions,
    mechs: updatedMechs,
    elementals: updatedElementals,
    pilots: updatedPilots,
    currentWarchest,
  };

  // Calculate and store original BV if this is the first mission
  if (isFirstMission) {
    const mechs = force.mechs || [];
    
    // Calculate base BV (sum of all mechs' base BV)
    const originalBaseBV = mechs.reduce((sum, mech) => sum + (mech.bv || 0), 0);
    
    // Calculate adjusted BV (sum of all mechs' adjusted BV based on pilot skills)
    const originalAdjustedBV = mechs.reduce((sum, mech) => sum + getMechAdjustedBV(force, mech), 0);
    
    result.originalBaseBV = originalBaseBV;
    result.originalAdjustedBV = originalAdjustedBV;
  }

  return result;
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
 * Mark a mission as completed, set its completedAt date, update objectives and
 * update the force warchest based on achieved objectives.
 *
 * @param {Force} force
 * @param {string} missionId
 * @param {{ objectives?: MissionObjective[], recap?: string }} completionData
 * @param {string} timestamp ISO timestamp (in-universe date)
 * @returns {{ missions: Mission[], currentWarchest: number }}
 */
export function applyMissionCompletion(force, missionId, completionData, timestamp) {
  let reward = 0;

  const missions = (force.missions || []).map((mission) => {
    if (mission.id !== missionId) return mission;

    const updatedMission = {
      ...mission,
      ...completionData,
      id: mission.id,
      completed: true,
      completedAt: timestamp,
    };

    reward = getMissionObjectiveReward(updatedMission);
    return updatedMission;
  });

  const currentWarchest = force.currentWarchest + reward;

  return { missions, currentWarchest };
}

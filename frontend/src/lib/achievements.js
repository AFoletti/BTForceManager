// Achievement checking and combat record helpers

/**
 * Weight class boundaries (inclusive)
 */
const WEIGHT_CLASSES = {
  light: { min: 20, max: 35 },
  medium: { min: 40, max: 55 },
  heavy: { min: 60, max: 75 },
  assault: { min: 80, max: 100 },
};

/**
 * Get the weight class for a given tonnage
 * @param {number} tonnage
 * @returns {string|null} 'light', 'medium', 'heavy', 'assault', or null if invalid
 */
export function getWeightClass(tonnage) {
  if (tonnage >= WEIGHT_CLASSES.light.min && tonnage <= WEIGHT_CLASSES.light.max) return 'light';
  if (tonnage >= WEIGHT_CLASSES.medium.min && tonnage <= WEIGHT_CLASSES.medium.max) return 'medium';
  if (tonnage >= WEIGHT_CLASSES.heavy.min && tonnage <= WEIGHT_CLASSES.heavy.max) return 'heavy';
  if (tonnage >= WEIGHT_CLASSES.assault.min && tonnage <= WEIGHT_CLASSES.assault.max) return 'assault';
  return null;
}

/**
 * Compute derived stats from a pilot's combat record
 * @param {Object} combatRecord
 * @returns {Object} computed stats for achievement checking
 */
export function computeCombatStats(combatRecord) {
  const kills = combatRecord?.kills || [];
  const assists = combatRecord?.assists || 0;
  const missionsCompleted = combatRecord?.missionsCompleted || 0;
  const missionsWithoutInjury = combatRecord?.missionsWithoutInjury || 0;
  const totalInjuriesHealed = combatRecord?.totalInjuriesHealed || 0;

  let lightKills = 0;
  let mediumKills = 0;
  let heavyKills = 0;
  let assaultKills = 0;
  let totalTonnageDestroyed = 0;
  let maxTonnageKill = 0;

  kills.forEach((kill) => {
    const tonnage = kill.tonnage || 0;
    totalTonnageDestroyed += tonnage;
    if (tonnage > maxTonnageKill) maxTonnageKill = tonnage;

    const weightClass = getWeightClass(tonnage);
    if (weightClass === 'light') lightKills++;
    else if (weightClass === 'medium') mediumKills++;
    else if (weightClass === 'heavy') heavyKills++;
    else if (weightClass === 'assault') assaultKills++;
  });

  return {
    killCount: kills.length,
    assists,
    missionsCompleted,
    missionsWithoutInjury,
    totalInjuriesHealed,
    lightKills,
    mediumKills,
    heavyKills,
    assaultKills,
    totalTonnageDestroyed,
    maxTonnageKill,
  };
}

/**
 * Check if an achievement condition is met
 * @param {string} condition - e.g. "killCount >= 5"
 * @param {Object} stats - computed combat stats
 * @returns {boolean}
 */
export function checkCondition(condition, stats) {
  // Simple expression evaluator for our specific conditions
  // Supports: variable >= number, variable === number, && operator
  try {
    const parts = condition.split('&&').map((p) => p.trim());
    
    return parts.every((part) => {
      // Match patterns like "killCount >= 5" or "totalInjuriesTaken === 0"
      const match = part.match(/^(\w+)\s*(>=|===|>|<|<=)\s*(\d+)$/);
      if (!match) return false;
      
      const [, variable, operator, valueStr] = match;
      const statValue = stats[variable] || 0;
      const targetValue = parseInt(valueStr, 10);
      
      switch (operator) {
        case '>=': return statValue >= targetValue;
        case '>': return statValue > targetValue;
        case '<=': return statValue <= targetValue;
        case '<': return statValue < targetValue;
        case '===': return statValue === targetValue;
        default: return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Check which achievements a pilot has earned based on their combat record
 * @param {Object} combatRecord
 * @param {Array} achievementDefinitions - from achievements.json
 * @returns {string[]} array of achievement IDs earned
 */
export function checkAchievements(combatRecord, achievementDefinitions) {
  const stats = computeCombatStats(combatRecord);
  const earned = [];

  achievementDefinitions.forEach((achievement) => {
    if (checkCondition(achievement.condition, stats)) {
      earned.push(achievement.id);
    }
  });

  return earned;
}

/**
 * Find newly earned achievements by comparing before and after
 * @param {string[]} previousAchievements
 * @param {string[]} currentAchievements
 * @returns {string[]} newly earned achievement IDs
 */
export function findNewAchievements(previousAchievements, currentAchievements) {
  const prev = new Set(previousAchievements || []);
  return currentAchievements.filter((id) => !prev.has(id));
}

/**
 * Initialize an empty combat record
 * @returns {Object}
 */
export function createEmptyCombatRecord() {
  return {
    kills: [],
    assists: 0,
    missionsCompleted: 0,
    missionsWithoutInjury: 0,
    totalInjuriesHealed: 0,
  };
}

/**
 * Add a kill to a pilot's combat record
 * @param {Object} combatRecord
 * @param {Object} kill - { mechModel, tonnage, mission, date }
 * @returns {Object} updated combat record
 */
export function addKill(combatRecord, kill) {
  const record = combatRecord || createEmptyCombatRecord();
  return {
    ...record,
    kills: [...(record.kills || []), kill],
  };
}

/**
 * Add assists to a pilot's combat record
 * @param {Object} combatRecord
 * @param {number} count
 * @returns {Object} updated combat record
 */
export function addAssists(combatRecord, count) {
  const record = combatRecord || createEmptyCombatRecord();
  return {
    ...record,
    assists: (record.assists || 0) + count,
  };
}

/**
 * Record mission completion for a pilot
 * @param {Object} combatRecord
 * @param {boolean} wasInjured - did pilot take injury this mission
 * @returns {Object} updated combat record
 */
export function recordMissionCompletion(combatRecord, wasInjured) {
  const record = combatRecord || createEmptyCombatRecord();
  return {
    ...record,
    missionsCompleted: (record.missionsCompleted || 0) + 1,
    missionsWithoutInjury: wasInjured ? 0 : (record.missionsWithoutInjury || 0) + 1,
  };
}

/**
 * Record healed injuries for a pilot
 * @param {Object} combatRecord
 * @param {number} count - injuries healed
 * @returns {Object} updated combat record
 */
export function recordInjuriesHealed(combatRecord, count) {
  const record = combatRecord || createEmptyCombatRecord();
  return {
    ...record,
    totalInjuriesHealed: (record.totalInjuriesHealed || 0) + count,
  };
}

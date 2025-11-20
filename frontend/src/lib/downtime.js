// Downtime / repair helpers.
// Centralises cost calculation and force updates so the component
// stays mostly focused on UI concerns.

/**
 * Build the context object used when evaluating downtime formulas.
 *
 * @param {Object} force
 * @param {Object} unit Mech or Elemental
 * @returns {{ weight?: number, suitsDamaged?: number, suitsDestroyed?: number, wpMultiplier: number }}
 */
export function buildDowntimeContext(force, unit) {
  return {
    weight: unit.weight || 0,
    suitsDamaged: unit.suitsDamaged || 0,
    suitsDestroyed: unit.suitsDestroyed || 0,
    wpMultiplier: force.wpMultiplier || 5,
  };
}

/**
 * Evaluate a downtime formula against a limited context.
 *
 * This mirrors the previous behaviour in DowntimeOperations, including the use
 * of `eval`, but keeps it in one place and only substitutes known context keys.
 * It is assumed that downtime formulas come from trusted JSON in the repo.
 *
 * IMPORTANT: Formulas are **not** user input. They come only from
 * `data/downtime-actions.json` checked into version control. If you ever allow
 * user-defined formulas, replace this with a proper expression parser.
 *
 * @param {string} formula
 * @param {Object} context
 * @returns {number} Cost in WP, rounded up to the nearest integer (>= 0)
 */
export function evaluateDowntimeCost(formula, context) {
  try {
    // Basic guard: allow only word characters, digits, whitespace, and
    // arithmetic operators/parentheses. This keeps formulas simple and
    // aligned with the documented variables (weight, suitsDamaged,
    // suitsDestroyed, wpMultiplier).
    const safePattern = /^[\w\d\s+\-*/().]+$/;
    if (!safePattern.test(formula)) {
      // eslint-disable-next-line no-console
      console.warn('Downtime formula contains unsupported characters:', formula);
      return 0;
    }

    const expression = formula.replace(/(\w+)/g, (match) =>
      Object.prototype.hasOwnProperty.call(context, match) ? context[match] : match,
    );

    // eslint-disable-next-line no-eval
    const rawResult = eval(expression);

    if (typeof rawResult !== 'number' || Number.isNaN(rawResult) || !Number.isFinite(rawResult)) {
      return 0;
    }

    return Math.ceil(rawResult);
  } catch (error) {
    // Keep behaviour consistent with the previous inline implementation.
    // eslint-disable-next-line no-console
    console.error('Downtime formula evaluation error:', error);
    return 0;
  }
}

/**
 * Apply a mech downtime action to a force.
 *
 * @param {Object} force
 * @param {{ mechId: string, action: Object, cost: number, timestamp: string, lastMissionName: string | null }} params
 * @returns {{ mechs: Object[], currentWarchest: number }}
 */
export function applyMechDowntimeAction(
  force,
  { mechId, action, cost, timestamp, lastMissionName, inGameDate },
) {
  const mechs = force.mechs.map((mech) => {
    if (mech.id !== mechId) return mech;

    const activityLog = [...(mech.activityLog || [])];
    activityLog.push({
      timestamp,
      inGameDate,
      action: `${action.name} performed (${cost} WP)`,
      mission: lastMissionName,
    });

    return {
      ...mech,
      status: action.makesUnavailable ? 'Unavailable' : mech.status,
      activityLog,
    };
  });

  const currentWarchest = force.currentWarchest - cost;

  return { mechs, currentWarchest };
}

/**
 * Apply an elemental downtime action to a force.
 *
 * @param {Object} force
 * @param {{ elementalId: string, actionId: string, action: Object, cost: number, timestamp: string, lastMissionName: string | null }} params
 * @returns {{ elementals: Object[], currentWarchest: number }}
 */
export function applyElementalDowntimeAction(
  force,
  { elementalId, actionId, action, cost, timestamp, lastMissionName, inGameDate },
) {
  const elementals = (force.elementals || []).map((elemental) => {
    if (elemental.id !== elementalId) return elemental;

    const activityLog = [...(elemental.activityLog || [])];
    activityLog.push({
      timestamp,
      inGameDate,
      action: `${action.name} performed (${cost} WP)`,
      mission: lastMissionName,
    });

    const updates = { activityLog };

    // Reset counters based on action id, mirroring previous behaviour.
    if (actionId === 'repair-elemental') {
      updates.suitsDamaged = 0;
    } else if (actionId === 'purchase-elemental') {
      updates.suitsDestroyed = 0;
    }

    return { ...elemental, ...updates };
  });

  const currentWarchest = force.currentWarchest - cost;

  return { elementals, currentWarchest };
}

/**
 * Log a generic "other" downtime action at force level.
 *
 * @param {Object} force
 * @param {{ description: string, cost: number, timestamp: string }} params
 * @returns {{ otherActionsLog: Object[], currentWarchest: number }}
 */
export function logOtherDowntimeAction(force, { description, cost, timestamp, inGameDate }) {
  const otherActionsLog = [...(force.otherActionsLog || [])];

  otherActionsLog.push({
    timestamp,
    inGameDate,
    description,
    cost,
  });

  const currentWarchest = force.currentWarchest - cost;

  return { otherActionsLog, currentWarchest };
}

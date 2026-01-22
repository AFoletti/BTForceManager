// Downtime / repair helpers.
// Centralises cost calculation and force updates so the component
// stays mostly focused on UI concerns.

import { DOWNTIME_ACTION_IDS, UNIT_STATUS } from './constants';

/**
 * Build the context object used when evaluating downtime formulas.
 *
 * @param {Object} force
 * @param {Object} unit Mech, Elemental, or Pilot
 * @returns {{ weight?: number, suitsDamaged?: number, suitsDestroyed?: number, injuries?: number, wpMultiplier: number }}
 */
export function buildDowntimeContext(force, unit) {
  return {
    weight: unit.weight || 0,
    suitsDamaged: unit.suitsDamaged || 0,
    suitsDestroyed: unit.suitsDestroyed || 0,
    injuries: unit.injuries || 0,
    wpMultiplier: force.wpMultiplier || 5,
  };
}

// --- Tiny arithmetic expression parser for downtime formulas ---

/**
 * Tokenise a simple arithmetic expression into numbers, identifiers, operators and parentheses.
 * Supports: numbers (ints/decimals), identifiers (variables), + - * / and ()
 *
 * @param {string} expression
 * @returns {Array<{type: string, value: string}>}
 */
function tokenize(expression) {
  const tokens = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }

    // Match numbers (including decimals starting with .)
    // Ensure a dot is followed by a digit to be considered a number
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < expression.length && /[0-9]/.test(expression[i + 1]))) {
      let num = ch;
      i += 1;
      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        num += expression[i];
        i += 1;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let id = ch;
      i += 1;
      while (i < expression.length && /[A-Za-z0-9_]/.test(expression[i])) {
        id += expression[i];
        i += 1;
      }
      tokens.push({ type: 'identifier', value: id });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'operator', value: ch });
      i += 1;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i += 1;
      continue;
    }

    throw new Error(`Unsupported character in expression: ${ch}`);
  }

  return tokens;
}

const OP_PRECEDENCE = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
};

/**
 * Convert tokens to Reverse Polish Notation using the shunting-yard algorithm.
 *
 * @param {Array<{type: string, value: string}>} tokens
 * @returns {Array<{type: string, value: string}>}
 */
function toRpn(tokens) {
  const output = [];
  const ops = [];

  tokens.forEach((token) => {
    if (token.type === 'number' || token.type === 'identifier') {
      output.push(token);
    } else if (token.type === 'operator') {
      while (ops.length > 0) {
        const top = ops[ops.length - 1];
        if (
          top.type === 'operator' &&
          OP_PRECEDENCE[top.value] >= OP_PRECEDENCE[token.value]
        ) {
          output.push(ops.pop());
        } else {
          break;
        }
      }
      ops.push(token);
    } else if (token.type === 'paren' && token.value === '(') {
      ops.push(token);
    } else if (token.type === 'paren' && token.value === ')') {
      let foundLeft = false;
      while (ops.length > 0) {
        const top = ops.pop();
        if (top.type === 'paren' && top.value === '(') {
          foundLeft = true;
          break;
        }
        output.push(top);
      }
      if (!foundLeft) {
        throw new Error('Mismatched parentheses');
      }
    }
  });

  while (ops.length > 0) {
    const top = ops.pop();
    if (top.type === 'paren') {
      throw new Error('Mismatched parentheses');
    }
    output.push(top);
  }

  return output;
}

/**
 * Evaluate an RPN expression with a given context of variables.
 *
 * @param {Array<{type: string, value: string}>} rpn
 * @param {Object} context
 * @returns {number}
 */
function evalRpn(rpn, context) {
  const stack = [];

  rpn.forEach((token) => {
    if (token.type === 'number') {
      const n = Number(token.value);
      if (Number.isNaN(n)) {
        throw new Error(`Invalid number token: ${token.value}`);
      }
      stack.push(n);
    } else if (token.type === 'identifier') {
      const value = context[token.value];
      const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
      stack.push(n);
    } else if (token.type === 'operator') {
      if (stack.length < 2) {
        throw new Error('Insufficient values in expression');
      }
      const b = stack.pop();
      const a = stack.pop();
      let result;
      switch (token.value) {
        case '+':
          result = a + b;
          break;
        case '-':
          result = a - b;
          break;
        case '*':
          result = a * b;
          break;
        case '/':
          if (b === 0) {
            throw new Error('Division by zero');
          }
          result = a / b;
          break;
        default:
          throw new Error(`Unknown operator: ${token.value}`);
      }
      stack.push(result);
    }
  });

  if (stack.length !== 1) {
    throw new Error('Invalid expression');
  }

  return stack[0];
}

/**
 * Evaluate a downtime formula against a limited context.
 *
 * Formulas are simple arithmetic expressions using variables like
 * `weight`, `suitsDamaged`, `suitsDestroyed`, `wpMultiplier` and
 * numbers/operators (+, -, *, /, parentheses).
 *
 * IMPORTANT: Formulas are **not** user input. They come only from
 * `data/downtime-actions.json` checked into version control.
 *
 * @param {string} formula
 * @param {Object} context
 * @returns {number} Cost in WP, rounded up to the nearest integer (>= 0)
 */
export function evaluateDowntimeCost(formula, context) {
  try {
    if (typeof formula !== 'string' || formula.trim() === '') {
      return 0;
    }

    // Basic guard: allow only word characters, digits, whitespace, and
    // arithmetic operators/parentheses.
    const safePattern = /^[\w\d\s+\-*/().]+$/;
    if (!safePattern.test(formula)) {
      // eslint-disable-next-line no-console
      // console.warn('Downtime formula contains unsupported characters:', formula);
      return 0;
    }

    const tokens = tokenize(formula);
    const rpn = toRpn(tokens);
    const rawResult = evalRpn(rpn, context || {});

    if (typeof rawResult !== 'number' || Number.isNaN(rawResult) || !Number.isFinite(rawResult)) {
      return 0;
    }

    const rounded = Math.ceil(rawResult);
    return rounded < 0 ? 0 : rounded;
  } catch (error) {
    // Keep behaviour consistent with the previous inline implementation.
    // eslint-disable-next-line no-console
    // console.error('Downtime formula evaluation error:', error);
    return 0;
  }
}

/**
 * Apply a mech downtime action to a force.
 *
 * @param {Object} force
 * @param {{ mechId: string, action: { id?: string, name: string, makesUnavailable?: boolean }, cost: number, timestamp: string, lastMissionName: string | null }} params
 * @returns {{ mechs: Object[], currentWarchest: number }}
 */
export function applyMechDowntimeAction(
  force,
  { mechId, action, cost, timestamp, lastMissionName },
) {
  const mechs = force.mechs.map((mech) => {
    if (mech.id !== mechId) return mech;

    const activityLog = [...(mech.activityLog || [])];
    activityLog.push({
      timestamp,
      action: `${action.name} performed (${cost} WP)`,
      mission: lastMissionName,
      cost,
    });

    let nextStatus = mech.status;

    // If repairing armor on a Damaged mech, set it to Operational.
    if (action.id === DOWNTIME_ACTION_IDS.REPAIR_ARMOR && mech.status === UNIT_STATUS.DAMAGED) {
      nextStatus = UNIT_STATUS.OPERATIONAL;
    }

    // For internal structure repairs, mark the mech as "Repairing" instead of
    // the generic "Unavailable" status, while still keeping it off the field
    // for mission selection (mission availability only allows Operational/Damaged).
    if (action.makesUnavailable) {
      if (action.id === DOWNTIME_ACTION_IDS.REPAIR_STRUCTURE) {
        nextStatus = UNIT_STATUS.REPAIRING;
      } else {
        nextStatus = UNIT_STATUS.UNAVAILABLE;
      }
    }

    return {
      ...mech,
      status: nextStatus,
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
  { elementalId, actionId, action, cost, timestamp, lastMissionName },
) {
  const elementals = (force.elementals || []).map((elemental) => {
    if (elemental.id !== elementalId) return elemental;

    const activityLog = [...(elemental.activityLog || [])];
    activityLog.push({
      timestamp,
      action: `${action.name} performed (${cost} WP)`,
      mission: lastMissionName,
      cost,
    });

    const updates = { activityLog };

    // Reset counters and adjust status based on action id.
    if (actionId === DOWNTIME_ACTION_IDS.REPAIR_ELEMENTAL) {
      const hadDestroyedSuits = (elemental.suitsDestroyed || 0) > 0;
      updates.suitsDamaged = 0;

      // If the point was simply damaged (no destroyed suits) and we fully
      // repair the damage, the point returns to Operational.
      if (elemental.status === UNIT_STATUS.DAMAGED && !hadDestroyedSuits) {
        updates.status = UNIT_STATUS.OPERATIONAL;
      }
    } else if (actionId === DOWNTIME_ACTION_IDS.PURCHASE_ELEMENTAL) {
      // Purchasing new suits brings the point into a "Repairing" state while
      // they are being integrated, and clears destroyed suits for that point.
      updates.suitsDestroyed = 0;
      updates.status = UNIT_STATUS.REPAIRING;
    }

    return { ...elemental, ...updates };
  });

  const currentWarchest = force.currentWarchest - cost;

  return { elementals, currentWarchest };
}

/**
 * Apply a pilot downtime action to a force.
 *
 * Supported action ids (by convention, see data/downtime-actions.json):
 * - train-gunnery: reduce gunnery by 1 (to a minimum of 0)
 * - train-piloting: reduce piloting by 1 (to a minimum of 0)
 * - heal-injury: heal one injury (reducing injuries by 1, minimum 0)
 *
 * @param {Object} force
 * @param {{ pilotId: string, actionId: string, action: Object, cost: number, timestamp: string, inGameDate?: string, lastMissionName: string | null }} params
 * @returns {{ pilots: Object[], currentWarchest: number }}
 */
export function applyPilotDowntimeAction(
  force,
  { pilotId, actionId, action, cost, timestamp, inGameDate, lastMissionName },
) {
  const pilots = (force.pilots || []).map((pilot) => {
    if (pilot.id !== pilotId) return pilot;

    const activityLog = [...(pilot.activityLog || [])];
    activityLog.push({
      timestamp,
      action:
        `${action.name} performed (${cost} WP)` +
        (lastMissionName ? ` after ${lastMissionName}` : ''),
      mission: lastMissionName,
      cost,
    });

    let gunnery = pilot.gunnery;
    let piloting = pilot.piloting;
    let injuries = pilot.injuries;

    if (actionId === DOWNTIME_ACTION_IDS.TRAIN_GUNNERY) {
      const base = typeof gunnery === 'number' ? gunnery : 4;
      gunnery = Math.max(0, Math.min(8, base - 1));
    } else if (actionId === DOWNTIME_ACTION_IDS.TRAIN_PILOTING) {
      const base = typeof piloting === 'number' ? piloting : 5;
      piloting = Math.max(0, Math.min(8, base - 1));
    } else if (actionId === DOWNTIME_ACTION_IDS.HEAL_INJURY) {
      const base = typeof injuries === 'number' ? injuries : 0;
      injuries = Math.max(0, Math.min(6, base - 1));
    }

    return {
      ...pilot,
      gunnery,
      piloting,
      injuries,
      activityLog,
    };
  });

  const currentWarchest = force.currentWarchest - cost;

  return { pilots, currentWarchest };
}

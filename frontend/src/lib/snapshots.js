// Snapshot helpers for capturing campaign state at key moments
// (e.g. after mission completion, after a downtime cycle).

import { UNIT_STATUS } from './constants';

/**
 * @typedef {Object} SnapshotUnitsSummary
 * @property {{ byStatus: Record<string, number> }} mechs
 * @property {{ byStatus: Record<string, number> }} elementals
 */

/**
 * @typedef {Object} Snapshot
 * @property {string} id
 * @property {('post-mission'|'post-downtime')} type
 * @property {string} label
 * @property {string} createdAt        // in-universe date, typically force.currentDate
 * @property {number} currentWarchest
 * @property {number} startingWarchest
 * @property {number} netWarchestChange
 * @property {number} missionsCompleted
 * @property {SnapshotUnitsSummary} units
 * @property {Object} forceState       // trimmed copy of the force at that point in time
 */

const STATUS_ORDER = [
  UNIT_STATUS.OPERATIONAL,
  UNIT_STATUS.DAMAGED,
  UNIT_STATUS.DISABLED,
  UNIT_STATUS.REPAIRING,
  UNIT_STATUS.UNAVAILABLE,
  UNIT_STATUS.DESTROYED,
];

const buildStatusCounts = (units = []) => {
  const counts = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  units.forEach((unit) => {
    const status = unit.status || UNIT_STATUS.OPERATIONAL;
    if (STATUS_ORDER.includes(status)) {
      counts[status] += 1;
    }
  });

  return counts;
};


/**
 * Create a snapshot of the given force, capturing high-level status and
 * financial state along with a trimmed copy of the force.
 *
 * For units, we store the distribution of statuses at the time of snapshot
 * creation, mirroring the force summary banner (Operational, Damaged,
 * Disabled, Repairing, Unavailable, Destroyed). Pilot-level information is
 * intentionally omitted from the snapshot summary.
 *
 * @param {Object} force Normalised force object
 * @param {{ type: 'post-mission' | 'post-downtime', label: string }} options
 * @returns {Snapshot}
 */
export function createSnapshot(force, { type, label }) {
  const mechs = force.mechs || [];
  const elementals = force.elementals || [];
  const missions = force.missions || [];

  const mechStatusCounts = buildStatusCounts(mechs);
  const elementalStatusCounts = buildStatusCounts(elementals);

  const currentWarchest = typeof force.currentWarchest === 'number' ? force.currentWarchest : 0;
  const startingWarchest = typeof force.startingWarchest === 'number' ? force.startingWarchest : 0;
  const netWarchestChange = currentWarchest - startingWarchest;

  const missionsCompleted = missions.filter((m) => m.completed).length;

  const createdAt = force.currentDate || new Date().toISOString().slice(0, 10);

  const snapshot = {
    id: `snapshot-${Date.now()}`,
    type,
    label,
    createdAt,
    currentWarchest,
    startingWarchest,
    netWarchestChange,
    missionsCompleted,
    units: {
      mechs: {
        byStatus: mechStatusCounts,
      },
      elementals: {
        byStatus: elementalStatusCounts,
      },
    },
    forceState: {
      id: force.id,
      name: force.name,
      description: force.description,
      image: force.image,
      currentDate: force.currentDate,
      startingWarchest: force.startingWarchest,
      currentWarchest: force.currentWarchest,
      wpMultiplier: force.wpMultiplier,
      mechs: force.mechs,
      pilots: force.pilots,
      elementals: force.elementals,
      missions: force.missions,
    },
  };

  return snapshot;
}

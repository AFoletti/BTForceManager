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
 * @property {('pre-mission'|'post-mission'|'post-downtime')} type
 * @property {string} label
 * @property {string} createdAt        // in-universe date, typically force.currentDate
 * @property {number} currentWarchest
 * @property {number} startingWarchest
 * @property {number} netWarchestChange
 * @property {number} missionsCompleted
 * @property {SnapshotUnitsSummary} units
 */

/**
 * @typedef {Object} FullSnapshot
 * @property {string} id               // matches the corresponding Snapshot id
 * @property {string} snapshotId       // reference to the linked Snapshot
 * @property {Object} forceData        // complete force data for restoration
 * @property {string} createdAt        // timestamp
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
 * @param {{ type: 'pre-mission' | 'post-mission' | 'post-downtime', label: string }} options
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
  };

  return snapshot;
}

/**
 * Advance a YYYY-MM-DD date string by one day. If the input is invalid,
 * returns it unchanged.
 *
 * @param {string} dateStr
 * @returns {string}
 */
export function advanceDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;

  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateStr;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateStr;

  date.setUTCDate(date.getUTCDate() + 1);

  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/**
 * Maximum number of full snapshots to keep for rollback.
 */
export const MAX_FULL_SNAPSHOTS = 2;

/**
 * Create a full snapshot that stores complete force data for rollback.
 * This is separate from the regular snapshot which only stores summaries.
 *
 * @param {Object} force The complete force object to snapshot
 * @param {string} snapshotId The ID of the corresponding regular snapshot
 * @returns {FullSnapshot}
 */
export function createFullSnapshot(force, snapshotId) {
  // Deep clone the force data, excluding fullSnapshots to avoid circular/bloat
  const { fullSnapshots, ...forceDataToStore } = force;
  
  return {
    id: `full-${snapshotId}`,
    snapshotId,
    forceData: JSON.parse(JSON.stringify(forceDataToStore)),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Add a full snapshot to the array, keeping only the most recent MAX_FULL_SNAPSHOTS.
 *
 * @param {FullSnapshot[]} existingFullSnapshots
 * @param {FullSnapshot} newFullSnapshot
 * @returns {FullSnapshot[]}
 */
export function addFullSnapshot(existingFullSnapshots, newFullSnapshot) {
  const updated = [...(existingFullSnapshots || []), newFullSnapshot];
  
  // Keep only the most recent MAX_FULL_SNAPSHOTS
  if (updated.length > MAX_FULL_SNAPSHOTS) {
    return updated.slice(-MAX_FULL_SNAPSHOTS);
  }
  
  return updated;
}

/**
 * Check if a snapshot has a corresponding full snapshot for rollback.
 *
 * @param {string} snapshotId
 * @param {FullSnapshot[]} fullSnapshots
 * @returns {boolean}
 */
export function hasFullSnapshot(snapshotId, fullSnapshots) {
  if (!fullSnapshots || !Array.isArray(fullSnapshots)) return false;
  return fullSnapshots.some(fs => fs.snapshotId === snapshotId);
}

/**
 * Get the full snapshot for a given snapshot ID.
 *
 * @param {string} snapshotId
 * @param {FullSnapshot[]} fullSnapshots
 * @returns {FullSnapshot|null}
 */
export function getFullSnapshot(snapshotId, fullSnapshots) {
  if (!fullSnapshots || !Array.isArray(fullSnapshots)) return null;
  return fullSnapshots.find(fs => fs.snapshotId === snapshotId) || null;
}

/**
 * Perform a rollback to a specific snapshot.
 * Simply restores the force data as it was when the snapshot was taken.
 *
 * @param {Object} force Current force
 * @param {string} snapshotId The snapshot ID to roll back to
 * @returns {Object | null} The restored force data ready for onUpdate
 */
export function rollbackToSnapshot(force, snapshotId) {
  const fullSnapshots = force.fullSnapshots || [];
  
  const fullSnap = getFullSnapshot(snapshotId, fullSnapshots);
  if (!fullSnap) {
    console.warn('Rollback failed: No full snapshot found for', snapshotId);
    return null;
  }
  
  // Simply restore forceData, preserving current force ID
  // Rebuild fullSnapshots to only keep those matching snapshots in restored data
  const restoredSnapshots = fullSnap.forceData.snapshots || [];
  const restoredSnapshotIds = new Set(restoredSnapshots.map(s => s.id));
  const keptFullSnapshots = fullSnapshots.filter(fs => restoredSnapshotIds.has(fs.snapshotId));
  
  return {
    ...fullSnap.forceData,
    id: force.id,
    fullSnapshots: keptFullSnapshots,
  };
}

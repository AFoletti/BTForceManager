// Snapshot helpers for capturing campaign state at key moments
// (e.g. after mission completion, after a downtime cycle).

/**
 * @typedef {Object} SnapshotUnitsSummary
 * @property {{ ready: number, total: number, destroyed: number }} mechs
 * @property {{ ready: number, total: number, destroyed: number }} elementals
 * @property {{ ready: number, total: number, kia: number }} pilots
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

/**
 * Create a snapshot of the given force, capturing high-level readiness and
 * financial state along with a trimmed copy of the force.
 *
 * Ready-for-action definition:
 * - Mechs: status Operational or Damaged (and not Destroyed).
 * - Elementals: status Operational or Damaged and suitsDestroyed < 6.
 * - Pilots: injuries !== 6 (i.e. not KIA).
 *
 * Totals exclude destroyed/KIA where appropriate so the snapshot shows
 * `<ready> / <total minus destroyed> (+ destroyed/KIA)`.
 *
 * @param {Object} force Normalised force object
 * @param {{ type: 'post-mission' | 'post-downtime', label: string }} options
 * @returns {Snapshot}
 */
export function createSnapshot(force, { type, label }) {
  const mechs = force.mechs || [];
  const pilots = force.pilots || [];
  const elementals = force.elementals || [];
  const missions = force.missions || [];

  // Mechs
  const mechDestroyedCount = mechs.filter((m) => m.status === 'Destroyed').length;
  const mechTotalMinusDestroyed = mechs.length - mechDestroyedCount;
  const mechReadyCount = mechs.filter((m) => {
    if (m.status === 'Destroyed') return false;
    return m.status === 'Operational' || m.status === 'Damaged';
  }).length;

  // Elementals: consider a point "destroyed" when status is Destroyed or
  // all suits are destroyed (>= 6). Ready when Operational/Damaged and
  // suitsDestroyed < 6.
  const elemDestroyedCount = elementals.filter((e) => {
    const suitsDestroyed = typeof e.suitsDestroyed === 'number' ? e.suitsDestroyed : 0;
    return e.status === 'Destroyed' || suitsDestroyed >= 6;
  }).length;
  const elemTotalMinusDestroyed = elementals.length - elemDestroyedCount;
  const elemReadyCount = elementals.filter((e) => {
    const suitsDestroyed = typeof e.suitsDestroyed === 'number' ? e.suitsDestroyed : 0;
    if (e.status === 'Destroyed' || suitsDestroyed >= 6) return false;
    return e.status === 'Operational' || e.status === 'Damaged';
  }).length;

  // Pilots: KIA when injuries === 6; ready otherwise.
  const pilotKiaCount = pilots.filter((p) => p.injuries === 6).length;
  const pilotTotalMinusKia = pilots.length - pilotKiaCount;
  const pilotReadyCount = pilots.filter((p) => p.injuries !== 6).length;

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
        ready: mechReadyCount,
        total: mechTotalMinusDestroyed,
        destroyed: mechDestroyedCount,
      },
      elementals: {
        ready: elemReadyCount,
        total: elemTotalMinusDestroyed,
        destroyed: elemDestroyedCount,
      },
      pilots: {
        ready: pilotReadyCount,
        total: pilotTotalMinusKia,
        kia: pilotKiaCount,
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

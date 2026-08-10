// Transparent sync engine: diffs a force object against the last known
// backend-confirmed state and dispatches the minimal set of API calls
// needed to persist the difference. Game logic itself lives entirely in
// components/lib/*.js and is untouched - this module only mirrors whatever
// the client already computed into the SQLite-backed API.
import * as api from '../lib/api';

const MECH_FIELDS = ['name', 'status', 'pilotId', 'bv', 'weight', 'image', 'history', 'warchestCost', 'activityLog'];
const PILOT_FIELDS = ['name', 'gunnery', 'piloting', 'injuries', 'dezgra', 'history', 'warchestCost', 'activityLog', 'combatRecord'];
const ELEMENTAL_FIELDS = ['name', 'commander', 'gunnery', 'antimech', 'suitsDestroyed', 'suitsDamaged', 'bv', 'status', 'image', 'history', 'warchestCost', 'activityLog'];
const MISSION_FIELDS = ['name', 'cost', 'description', 'objectives', 'assignedMechs', 'assignedElementals', 'spBudget', 'opForUnits', 'completed', 'completedAt', 'recap'];
const FORCE_FIELDS = ['name', 'description', 'image', 'startingWarchest', 'currentWarchest', 'wpMultiplier', 'currentDate', 'notes'];

const pick = (obj, fields) => {
  const out = {};
  fields.forEach((f) => {
    if (obj[f] !== undefined) out[f] = obj[f];
  });
  return out;
};

const entityChanged = (prevEntity, nextEntity, fields) =>
  fields.some((f) => JSON.stringify(prevEntity[f]) !== JSON.stringify(nextEntity[f]));

// Generic array-of-entities sync: creates new ids, updates changed ids,
// deletes ids no longer present. `fields` drives change-detection only;
// `handlers.create` receives the full next entity (caller decides what to send).
async function syncEntityArray(prevArr, nextArr, fields, handlers) {
  const prevById = new Map((prevArr || []).map((e) => [e.id, e]));
  const nextById = new Map((nextArr || []).map((e) => [e.id, e]));

  for (const [id, entity] of nextById) {
    try {
      if (!prevById.has(id)) {
        await handlers.create(entity);
      } else if (entityChanged(prevById.get(id), entity, fields)) {
        await handlers.update(id, pick(entity, fields));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Sync failed for entity', id, err);
    }
  }

  for (const [id] of prevById) {
    if (!nextById.has(id)) {
      try {
        await handlers.remove(id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Delete-sync failed for entity', id, err);
      }
    }
  }
}

async function syncMechs(forceId, prev, next) {
  await syncEntityArray(prev.mechs, next.mechs, MECH_FIELDS, {
    create: (m) => api.createMech(forceId, pick(m, ['id', ...MECH_FIELDS])),
    update: (id, fields) => api.updateMech(id, fields),
    remove: (id) => api.deleteMech(id),
  });
}

async function syncPilots(forceId, prev, next) {
  await syncEntityArray(prev.pilots, next.pilots, PILOT_FIELDS, {
    create: (p) => api.createPilot(forceId, pick(p, ['id', ...PILOT_FIELDS])),
    update: (id, fields) => api.updatePilot(id, fields),
    remove: (id) => api.deletePilot(id),
  });

  // Achievements are stored in a normalised join table, additive-only.
  for (const nextPilot of next.pilots || []) {
    const prevPilot = (prev.pilots || []).find((p) => p.id === nextPilot.id);
    const prevAch = prevPilot?.achievements || [];
    const nextAch = nextPilot.achievements || [];
    for (const achId of nextAch) {
      if (!prevAch.includes(achId)) {
        try {
          await api.addPilotAchievement(nextPilot.id, achId, next.currentDate);
        } catch (err) {
          if (err.status !== 409) {
            // eslint-disable-next-line no-console
            console.error('Failed to sync pilot achievement', achId, err);
          }
        }
      }
    }
  }
}

async function syncElementals(forceId, prev, next) {
  await syncEntityArray(prev.elementals, next.elementals, ELEMENTAL_FIELDS, {
    create: (e) => api.createElemental(forceId, pick(e, ['id', ...ELEMENTAL_FIELDS])),
    update: (id, fields) => api.updateElemental(id, fields),
    remove: (id) => api.deleteElemental(id),
  });
}

async function syncMissions(forceId, prev, next) {
  await syncEntityArray(prev.missions, next.missions, MISSION_FIELDS, {
    create: (m) =>
      api.createMission(forceId, {
        id: m.id,
        name: m.name,
        cost: m.cost || 0,
        description: m.description || '',
        objectives: m.objectives || [],
        assignedMechs: m.assignedMechs || [],
        assignedElementals: m.assignedElementals || [],
        spBudget: m.spBudget || 0,
        spPurchases: (m.spPurchases || []).map((p) => ({ id: p.id, choiceId: p.choiceId })),
        opForUnits: m.opForUnits || [],
      }),
    update: (id, fields) => api.updateMission(id, fields),
    remove: (id) => api.deleteMission(id),
  });

  // SP purchases added to or removed from an already-synced mission (not
  // brand new this cycle - those are covered by `spPurchases` on create above).
  for (const nextMission of next.missions || []) {
    const prevMission = (prev.missions || []).find((m) => m.id === nextMission.id);
    if (!prevMission) continue;
    const prevPurchases = prevMission.spPurchases || [];
    const nextPurchases = nextMission.spPurchases || [];
    if (JSON.stringify(prevPurchases) === JSON.stringify(nextPurchases)) continue;

    const prevIds = new Set(prevPurchases.map((p) => p.id));
    const nextIds = new Set(nextPurchases.map((p) => p.id));

    for (const purchase of nextPurchases) {
      if (!prevIds.has(purchase.id)) {
        try {
          await api.addSpPurchase(nextMission.id, { id: purchase.id, choiceId: purchase.choiceId });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to sync SP purchase', purchase, err);
        }
      }
    }

    for (const purchase of prevPurchases) {
      if (!nextIds.has(purchase.id)) {
        try {
          await api.deleteSpPurchase(purchase.id);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to delete SP purchase', purchase, err);
        }
      }
    }
  }
}

async function syncForceScalars(forceId, prev, next) {
  const changes = pick(next, FORCE_FIELDS.filter((f) => JSON.stringify(prev[f]) !== JSON.stringify(next[f])));
  if (Object.keys(changes).length === 0) return;
  try {
    await api.updateForce(forceId, changes);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to sync force fields', changes, err);
  }
}

async function syncSnapshots(forceId, prev, next) {
  await syncEntityArray(prev.snapshots, next.snapshots, [], {
    create: (s) => api.createSnapshot(forceId, s),
    update: () => Promise.resolve(),
    remove: (id) => api.deleteSnapshot(id),
  });
  await syncEntityArray(prev.fullSnapshots, next.fullSnapshots, [], {
    create: (fs) => api.createFullSnapshot(forceId, fs),
    update: () => Promise.resolve(),
    remove: (id) => api.deleteFullSnapshot(id),
  });
}

/**
 * Diff `next` against `prev` (the last backend-confirmed state) for the
 * given force and persist every difference via the API. Best-effort: a
 * failure on one entity does not block syncing the rest.
 */
export async function syncForceToBackend(forceId, prev, next) {
  // Mission creation has a server-side side effect: it independently appends
  // "Assigned to mission" activity-log entries to assigned mechs/pilots/elementals
  // (mirroring frontend/src/lib/missions.js). Sync missions FIRST so that the
  // subsequent entity PUTs below (which carry the client's already-correct,
  // already-deduplicated activityLog) overwrite that server-side side effect
  // instead of being overwritten by it - PUT sets the field, it never appends.
  await syncMissions(forceId, prev, next);
  await syncMechs(forceId, prev, next);
  await syncPilots(forceId, prev, next);
  await syncElementals(forceId, prev, next);
  await syncForceScalars(forceId, prev, next);
  await syncSnapshots(forceId, prev, next);
}

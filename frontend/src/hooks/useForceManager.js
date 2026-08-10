import { useState, useEffect, useRef } from 'react';
import * as api from '../lib/api';
import { syncForceToBackend } from './forceSync';

// Normalize a raw force object loaded from JSON so components can rely on
// certain fields always being present and correctly typed.

/**
 * Attempt to derive the most recent in-universe date from any missions or
 * unit activity logs on a raw force object.
 *
 * Returns a string (preferably in YYYY-MM-DD form) or null if nothing
 * usable is found.
 */
function findLatestInGameDate(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const candidates = [];

  const add = (value) => {
    if (!value || typeof value !== 'string') return;
    candidates.push(value);
  };

  // Mission-level dates
  (raw.missions || []).forEach((mission) => {
    add(mission.inGameDate);
    add(mission.completedAt);
    add(mission.createdAt);
  });

  // Mech logs
  (raw.mechs || []).forEach((mech) => {
    (mech.activityLog || []).forEach((entry) => {
      add(entry.inGameDate);
      add(entry.timestamp);
    });
  });

  // Elemental logs
  (raw.elementals || []).forEach((elemental) => {
    (elemental.activityLog || []).forEach((entry) => {
      add(entry.inGameDate);
      add(entry.timestamp);
    });
  });

  // Pilot logs
  (raw.pilots || []).forEach((pilot) => {
    (pilot.activityLog || []).forEach((entry) => {
      add(entry.inGameDate);
      add(entry.timestamp);
    });
  });

  if (candidates.length === 0) return null;

  let latestString = null;
  let latestTime = -Infinity;

  candidates.forEach((value) => {
    const time = Date.parse(value);
    if (!Number.isNaN(time) && time > latestTime) {
      latestTime = time;
      latestString = value;
    }
  });

  if (latestString) {
    // Normalise to YYYY-MM-DD if the string is at least that long
    if (latestString.length >= 10) {
      return latestString.slice(0, 10);
    }
    return latestString;
  }

  // Fallback: lexicographical max
  candidates.sort();
  const last = candidates[candidates.length - 1];
  if (!last) return null;
  if (last.length >= 10) return last.slice(0, 10);
  return last;
}

/**
 * @param {any} raw
 * @returns {import('../lib/missions').Force}
 */
export function normalizeForce(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  const normalized = { ...raw };

  const toNumberOrDefault = (value, fallback) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  normalized.startingWarchest = toNumberOrDefault(normalized.startingWarchest, 0);
  normalized.currentWarchest = toNumberOrDefault(
    normalized.currentWarchest,
    normalized.startingWarchest,
  );
  normalized.wpMultiplier = toNumberOrDefault(normalized.wpMultiplier, 5);

  // Ensure there is always a valid in-universe date on the force.
  // Mandatory format: YYYY-MM-DD, years between 2400 and 3500.
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const rawDate = typeof normalized.currentDate === 'string' ? normalized.currentDate : '';
  let finalDate = null;

  if (datePattern.test(rawDate)) {
    const year = Number(rawDate.slice(0, 4));
    if (year >= 2400 && year <= 3500) {
      finalDate = rawDate;
    }
  }

  // If no valid currentDate on the force, derive it from missions/logs.
  if (!finalDate) {
    const derived = findLatestInGameDate(normalized);
    if (derived && datePattern.test(derived)) {
      const year = Number(derived.slice(0, 4));
      if (year >= 2400 && year <= 3500) {
        finalDate = derived;
      }
    }
  }

  // Absolute fallback if nothing usable was found.
  if (!finalDate) {
    finalDate = '3025-01-01';
  }

  normalized.currentDate = finalDate;

  normalized.mechs = Array.isArray(normalized.mechs) ? normalized.mechs : [];
  normalized.pilots = Array.isArray(normalized.pilots) ? normalized.pilots : [];
  normalized.elementals = Array.isArray(normalized.elementals) ? normalized.elementals : [];
  normalized.missions = Array.isArray(normalized.missions) ? normalized.missions : [];

  // Force-level notes (freeform campaign notes)
  normalized.notes =
    typeof normalized.notes === 'string' ? normalized.notes : '';

  // Snapshots (optional, for campaign history). If not present, default to []
  normalized.snapshots = Array.isArray(normalized.snapshots)
    ? normalized.snapshots
    : [];

  // Full snapshots for rollback (max 3 kept). If not present, default to []
  normalized.fullSnapshots = Array.isArray(normalized.fullSnapshots)
    ? normalized.fullSnapshots
    : [];

  return normalized;
}

const SYNC_DEBOUNCE_MS = 900;

export function useForceManager() {
  const [forces, setForces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForceId, setSelectedForceId] = useState(null);

  // Last backend-confirmed state per force id, used as the diff baseline.
  const lastSyncedRef = useRef({});
  // Latest locally-merged state per force id, read by the debounced sync.
  const pendingForceRef = useRef({});
  const syncTimersRef = useRef({});

  // Load (or reload) all forces from the backend API. Exposed as
  // `refreshForces` so the Admin interface can re-sync the roster/mission
  // flows after creating/editing/deleting a force there.
  const refreshForces = async () => {
    try {
      const summaries = await api.listForces();

      const failedIds = [];
      const forcePromises = summaries.map(async (summary) => {
        try {
          return await api.getForce(summary.id);
        } catch (fetchError) {
          failedIds.push(summary.id);
          // eslint-disable-next-line no-console
          console.error(`Failed to load force: ${summary.id}`, fetchError);
          return null;
        }
      });

      const loadedForces = await Promise.all(forcePromises);
      const validForces = loadedForces.filter((f) => f !== null).map(normalizeForce);

      validForces.forEach((force) => {
        lastSyncedRef.current[force.id] = JSON.parse(JSON.stringify(force));
        pendingForceRef.current[force.id] = force;
      });

      setForces(validForces);

      setSelectedForceId((current) => {
        if (current && validForces.some((f) => f.id === current)) return current;
        return validForces.length > 0 ? validForces[0].id : null;
      });

      if (failedIds.length > 0) {
        setError(
          `Loaded ${validForces.length}/${summaries.length} forces. Failed to load: ${failedIds.join(', ')}.`,
        );
      } else {
        setError(null);
      }

      setLoading(false);
    } catch (err) {
      setError(`Failed to reach the BTForceManager API: ${err.message}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshForces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedForce = forces.find((f) => f.id === selectedForceId);

  // Helper to get the current in-universe date for logging purposes
  const getCurrentInGameDate = () => selectedForce?.currentDate || null;

  const scheduleSync = (forceId) => {
    if (syncTimersRef.current[forceId]) {
      clearTimeout(syncTimersRef.current[forceId]);
    }
    syncTimersRef.current[forceId] = setTimeout(async () => {
      delete syncTimersRef.current[forceId];
      const next = pendingForceRef.current[forceId];
      const prev = lastSyncedRef.current[forceId];
      if (!next || !prev) return;
      try {
        await syncForceToBackend(forceId, prev, next);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Background sync failed for force ${forceId}`, err);
      } finally {
        lastSyncedRef.current[forceId] = JSON.parse(JSON.stringify(next));
      }
    }, SYNC_DEBOUNCE_MS);
  };

  const updateForceData = (updates) => {
    setForces((prev) =>
      prev.map((force) => {
        if (force.id !== selectedForceId) return force;
        const merged = normalizeForce({ ...force, ...updates });
        pendingForceRef.current[force.id] = merged;
        return merged;
      }),
    );
    scheduleSync(selectedForceId);
  };

  const addNewForce = async (newForce) => {
    try {
      const created = await api.createForce({
        id: newForce.id,
        name: newForce.name,
        description: newForce.description || '',
        image: newForce.image || '',
        startingWarchest: newForce.startingWarchest || 0,
        currentWarchest: newForce.currentWarchest ?? newForce.startingWarchest ?? 0,
        wpMultiplier: newForce.wpMultiplier || 5,
      });

      const normalized = normalizeForce({
        ...newForce,
        ...created,
        mechs: [],
        pilots: [],
        elementals: [],
        missions: [],
        snapshots: [],
        fullSnapshots: [],
      });

      lastSyncedRef.current[normalized.id] = JSON.parse(JSON.stringify(normalized));
      pendingForceRef.current[normalized.id] = normalized;

      setForces((prev) => [...prev, normalized]);
      setSelectedForceId(normalized.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to create force on the backend', err);
      // eslint-disable-next-line no-alert
      alert(`Failed to create force: ${err.message}`);
    }
  };

  const exportData = () => {
    // Export all forces
    return { forces };
  };

  const exportForce = async (forceId) => {
    // Export single force via the backend's centralized serialization
    // service (GET /api/forces/{id}/export) rather than dumping local state.
    return await api.exportForce(forceId);
  };

  return {
    forces,
    selectedForceId,
    selectedForce,
    setSelectedForceId,
    updateForceData,
    addNewForce,
    exportData,
    exportForce,
    refreshForces,
    getCurrentInGameDate,
    loading,
    error,
  };
}

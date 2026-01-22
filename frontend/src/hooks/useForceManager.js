import { useState, useEffect } from 'react';

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

export function useForceManager() {
  const [forces, setForces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForceId, setSelectedForceId] = useState(null);

  // Load forces from individual JSON files
  useEffect(() => {
    const loadForces = async () => {
      try {
        // First, get the manifest to know which files to load
        const manifestResponse = await fetch('./data/forces/manifest.json');
        if (!manifestResponse.ok) {
          throw new Error(
            'Failed to load forces manifest at data/forces/manifest.json. Check that the file exists and is correctly referenced.',
          );
        }
        const manifest = await manifestResponse.json();

        if (!manifest || !Array.isArray(manifest.forces)) {
          throw new Error('Invalid forces manifest: expected a "forces" array.');
        }

        // Load each force file
        const failedFiles = [];

        const forcePromises = manifest.forces.map(async (filename) => {
          try {
            const response = await fetch(`./data/forces/${filename}`);
            if (!response.ok) {
              failedFiles.push(filename);
              // eslint-disable-next-line no-console
              console.error(`Failed to load force file: ${filename}`);
              return null;
            }
            const data = await response.json();
            return data;
          } catch (fileError) {
            failedFiles.push(filename);
            // eslint-disable-next-line no-console
            console.error(`Error loading force file ${filename}:`, fileError);
            return null;
          }
        });

        const loadedForces = await Promise.all(forcePromises);
        const validForces = loadedForces.filter((f) => f !== null).map(normalizeForce);

        setForces(validForces);

        // Select first force by default
        if (validForces.length > 0) {
          setSelectedForceId(validForces[0].id);
        }

        if (failedFiles.length > 0) {
          const loadedCount = validForces.length;
          const totalCount = manifest.forces.length;
          const failedList = failedFiles.join(', ');
          setError(
            `Loaded ${loadedCount}/${totalCount} forces. Failed to load: ${failedList}. Check data/forces for missing or invalid JSON files.`,
          );
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadForces();
  }, []);

  const selectedForce = forces.find((f) => f.id === selectedForceId);

  // Helper to get the current in-universe date for logging purposes
  const getCurrentInGameDate = () => selectedForce?.currentDate || null;

  const updateForceData = (updates) => {
    setForces((prev) =>
      prev.map((force) => {
        if (force.id !== selectedForceId) return force;
        const merged = { ...force, ...updates };
        return normalizeForce(merged);
      }),
    );
  };

  const addNewForce = (newForce) => {
    const normalized = normalizeForce(newForce);
    setForces((prev) => [...prev, normalized]);
    setSelectedForceId(normalized.id);
  };

  const exportData = () => {
    // Export all forces
    return { forces };
  };

  const exportForce = (forceId) => {
    // Export single force
    const force = forces.find((f) => f.id === forceId);
    return force;
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
    getCurrentInGameDate,
    loading,
    error,
  };
}

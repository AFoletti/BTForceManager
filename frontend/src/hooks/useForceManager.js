import { useState, useEffect } from 'react';

// Normalize a raw force object loaded from JSON so components can rely on
// certain fields always being present and correctly typed.
function normalizeForce(raw) {
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

  normalized.mechs = Array.isArray(normalized.mechs) ? normalized.mechs : [];
  normalized.pilots = Array.isArray(normalized.pilots) ? normalized.pilots : [];
  normalized.elementals = Array.isArray(normalized.elementals) ? normalized.elementals : [];
  normalized.missions = Array.isArray(normalized.missions) ? normalized.missions : [];
  normalized.otherActionsLog = Array.isArray(normalized.otherActionsLog)
    ? normalized.otherActionsLog
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
        
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadForces();
  }, []);

  const selectedForce = forces.find(f => f.id === selectedForceId);

  const updateForceData = (updates) => {
    setForces(prev => 
      prev.map(force =>
        force.id === selectedForceId ? { ...force, ...updates } : force
      )
    );
  };

  const addNewForce = (newForce) => {
    setForces(prev => [...prev, newForce]);
    setSelectedForceId(newForce.id);
  };

  const exportData = () => {
    // Export all forces
    return { forces };
  };

  const exportForce = (forceId) => {
    // Export single force
    const force = forces.find(f => f.id === forceId);
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
    loading,
    error
  };
}

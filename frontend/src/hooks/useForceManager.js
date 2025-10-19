import { useState, useEffect } from 'react';

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
          throw new Error('Failed to load forces manifest');
        }
        const manifest = await manifestResponse.json();

        // Load each force file
        const forcePromises = manifest.forces.map(async (filename) => {
          const response = await fetch(`./data/forces/${filename}`);
          if (!response.ok) {
            console.error(`Failed to load ${filename}`);
            return null;
          }
          return response.json();
        });

        const loadedForces = await Promise.all(forcePromises);
        const validForces = loadedForces.filter(f => f !== null);

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

import { useState, useEffect } from 'react';

export function useForceManager() {
  const [data, setData] = useState({ forces: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedForceId, setSelectedForceId] = useState(null);

  // Load data from static JSON file on mount
  useEffect(() => {
    fetch('./data/forces.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load forces data');
        }
        return response.json();
      })
      .then(jsonData => {
        setData(jsonData);
        // Select first force by default
        if (jsonData.forces && jsonData.forces.length > 0) {
          setSelectedForceId(jsonData.forces[0].id);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const selectedForce = data.forces.find(f => f.id === selectedForceId);

  const updateForceData = (updates) => {
    setData(prev => ({
      ...prev,
      forces: prev.forces.map(force =>
        force.id === selectedForceId ? { ...force, ...updates } : force
      )
    }));
  };

  const exportData = () => data;

  return {
    forces: data.forces,
    selectedForceId,
    selectedForce,
    setSelectedForceId,
    updateForceData,
    exportData,
    loading,
    error
  };
}

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'battletech-forces-data';

const DEFAULT_DATA = {
  forces: [
    {
      id: 'force-1',
      name: 'Gray Death Legion',
      description: 'Elite mercenary unit known for tactical excellence',
      image: 'https://images.unsplash.com/photo-1589254065878-42c9da997008?w=400',
      startingWarchest: 1000,
      currentWarchest: 1000,
      mechs: [
        {
          id: 'mech-1',
          name: 'Atlas AS7-D',
          status: 'Operational',
          pilot: 'Grayson Carlyle',
          bv: 1897,
          weight: 100,
          image: 'https://images.unsplash.com/photo-1589254066007-f3f74e0e8543?w=200',
          activityLog: []
        },
        {
          id: 'mech-2',
          name: 'Marauder MAD-3R',
          status: 'Operational',
          pilot: 'Lori Kalmar',
          bv: 1543,
          weight: 75,
          image: 'https://images.unsplash.com/photo-1589254066213-a0c9dc853511?w=200',
          activityLog: []
        }
      ],
      pilots: [
        {
          id: 'pilot-1',
          name: 'Grayson Carlyle',
          gunnery: 3,
          piloting: 4,
          injuries: 0,
          activityLog: []
        },
        {
          id: 'pilot-2',
          name: 'Lori Kalmar',
          gunnery: 4,
          piloting: 4,
          injuries: 0,
          activityLog: []
        }
      ],
      missions: [],
      repairActions: [
        {
          id: 'repair-1',
          name: 'Repair Armor',
          formula: '(weight/5)',
          makesUnavailable: false
        },
        {
          id: 'repair-2',
          name: 'Reconfigure Omni',
          formula: '(weight*20)/5',
          makesUnavailable: true
        },
        {
          id: 'repair-3',
          name: 'Replace Structure',
          formula: '(weight/3)',
          makesUnavailable: true
        }
      ]
    }
  ]
};

export function useForceManager() {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_DATA;
    } catch {
      return DEFAULT_DATA;
    }
  });

  const [selectedForceId, setSelectedForceId] = useState(data.forces[0]?.id);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

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

  const importData = (newData) => {
    setData(newData);
    if (newData.forces[0]) {
      setSelectedForceId(newData.forces[0].id);
    }
  };

  return {
    forces: data.forces,
    selectedForceId,
    selectedForce,
    setSelectedForceId,
    updateForceData,
    exportData,
    importData
  };
}

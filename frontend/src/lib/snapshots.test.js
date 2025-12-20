import { createSnapshot } from './snapshots';

const makeForce = (overrides = {}) => ({
  id: 'force-1',
  name: 'Test Force',
  description: 'Desc',
  image: null,
  currentDate: '3052-01-10',
  startingWarchest: 1000,
  currentWarchest: 900,
  wpMultiplier: 5,
  mechs: [],
  pilots: [],
  elementals: [],
  missions: [],
  ...overrides,
});

describe('createSnapshot', () => {
  it('computes readiness and warchest metrics correctly', () => {
    const force = makeForce({
      mechs: [
        { id: 'm1', name: 'Op', status: 'Operational' },
        { id: 'm2', name: 'Dam', status: 'Damaged' },
        { id: 'm3', name: 'Dest', status: 'Destroyed' },
        { id: 'm4', name: 'Unavail', status: 'Unavailable' },
      ],
      elementals: [
        { id: 'e1', name: 'Op', status: 'Operational', suitsDestroyed: 0 },
        { id: 'e2', name: 'Dam', status: 'Damaged', suitsDestroyed: 4 },
        { id: 'e3', name: 'Too many', status: 'Damaged', suitsDestroyed: 6 },
        { id: 'e4', name: 'Dest', status: 'Destroyed', suitsDestroyed: 0 },
      ],
      pilots: [
        { id: 'p1', name: 'Ready1', injuries: 0 },
        { id: 'p2', name: 'Ready2', injuries: 2 },
        { id: 'p3', name: 'KIA', injuries: 6 },
      ],
      missions: [
        { id: 'm1', completed: true },
        { id: 'm2', completed: false },
      ],
      startingWarchest: 1000,
      currentWarchest: 850,
    });

    const snapshot = createSnapshot(force, {
      type: 'post-mission',
      label: 'After test mission',
    });

    // Mechs status distribution
    expect(snapshot.units.mechs.byStatus).toEqual({
      Operational: 1,
      Damaged: 1,
      Disabled: 0,
      Repairing: 0,
      Unavailable: 1,
      Destroyed: 1,
    });

    // Elementals status distribution
    expect(snapshot.units.elementals.byStatus).toEqual({
      Operational: 1,
      Damaged: 3,
      Disabled: 0,
      Repairing: 0,
      Unavailable: 0,
      Destroyed: 0,
    });

    // Warchest and net change
    expect(snapshot.currentWarchest).toBe(850);
    expect(snapshot.startingWarchest).toBe(1000);
    expect(snapshot.netWarchestChange).toBe(-150);

    // Missions completed
    expect(snapshot.missionsCompleted).toBe(1);

    // Basic metadata
    expect(snapshot.type).toBe('post-mission');
    expect(snapshot.label).toBe('After test mission');
    expect(snapshot.createdAt).toBe('3052-01-10');
  });
});

import {
  isMechAvailableForMission,
  isElementalAvailableForMission,
  calculateMissionTotalBV,
  getAssignedMechs,
  getAssignedElementals,
  getMissionObjectiveReward,
  applyMissionCreation,
  applyMissionUpdate,
  applyMissionCompletion,
} from './missions';

// Small helpers to build sample forces for tests
const makePilot = (overrides = {}) => ({
  id: 'pilot-1',
  name: 'Test Pilot',
  gunnery: 4,
  piloting: 5,
  injuries: 0,
  activityLog: [],
  ...overrides,
});

const makeMech = (overrides = {}) => ({
  id: 'mech-1',
  name: 'Test Mech',
  status: 'Operational',
  pilotId: 'pilot-1',
  bv: 1000,
  weight: 50,
  activityLog: [],
  ...overrides,
});

const makeElemental = (overrides = {}) => ({
  id: 'elem-1',
  name: 'Test Elemental',
  status: 'Operational',
  commander: 'Cmdr',
  gunnery: 3,
  antimech: 4,
  suitsDestroyed: 0,
  suitsDamaged: 0,
  bv: 500,
  activityLog: [],
  ...overrides,
});

const makeForce = (overrides = {}) => ({
  id: 'force-1',
  name: 'Test Force',
  startingWarchest: 1000,
  currentWarchest: 1000,
  wpMultiplier: 5,
  mechs: [],
  pilots: [],
  elementals: [],
  missions: [],
  currentDate: '3052-01-01',
  ...overrides,
});

describe('mission availability helpers', () => {
  it('isMechAvailableForMission returns false for destroyed or non-deployable mechs', () => {
    const pilot = makePilot();
    const mechDestroyed = makeMech({ id: 'm1', status: 'Destroyed' });
    const mechUnavailable = makeMech({ id: 'm2', status: 'Unavailable' });
    const force = makeForce({ mechs: [mechDestroyed, mechUnavailable], pilots: [pilot] });

    expect(isMechAvailableForMission(force, mechDestroyed)).toBe(false);
    expect(isMechAvailableForMission(force, mechUnavailable)).toBe(false);
  });

  it('isMechAvailableForMission returns false if mech has no pilot or pilot is KIA', () => {
    const healthyPilot = makePilot({ id: 'p1' });
    const kiaPilot = makePilot({ id: 'p2', injuries: 6 });

    const mechNoPilot = makeMech({ id: 'm1', pilotId: null });
    const mechWithKiaPilot = makeMech({ id: 'm2', pilotId: 'p2' });

    const force = makeForce({
      mechs: [mechNoPilot, mechWithKiaPilot],
      pilots: [healthyPilot, kiaPilot],
    });

    expect(isMechAvailableForMission(force, mechNoPilot)).toBe(false);
    expect(isMechAvailableForMission(force, mechWithKiaPilot)).toBe(false);
  });

  it('isMechAvailableForMission returns true only when all rules are satisfied', () => {
    const pilot = makePilot();
    const mech = makeMech({ status: 'Damaged' });
    const force = makeForce({ mechs: [mech], pilots: [pilot] });

    expect(isMechAvailableForMission(force, mech)).toBe(true);
  });

  it('isElementalAvailableForMission follows suitsDestroyed and status rules', () => {
    const base = makeElemental();

    expect(isElementalAvailableForMission(base)).toBe(true);
    expect(
      isElementalAvailableForMission(
        makeElemental({ status: 'Damaged', suitsDestroyed: 0 }),
      ),
    ).toBe(true);
    expect(
      isElementalAvailableForMission(
        makeElemental({ status: 'Damaged', suitsDestroyed: 4 }),
      ),
    ).toBe(true);

    expect(
      isElementalAvailableForMission(
        makeElemental({ status: 'Damaged', suitsDestroyed: 5 }),
      ),
    ).toBe(false);
    expect(
      isElementalAvailableForMission(
        makeElemental({ status: 'Damaged', suitsDestroyed: 6 }),
      ),
    ).toBe(false);
    expect(isElementalAvailableForMission(makeElemental({ status: 'Disabled' }))).toBe(false);
  });
});

describe('BV and assignment helpers', () => {
  it('calculateMissionTotalBV sums mech and elemental BV correctly', () => {
    const mech1 = makeMech({ id: 'm1', bv: 100 });
    const mech2 = makeMech({ id: 'm2', bv: 200 });
    const elem1 = makeElemental({ id: 'e1', bv: 50 });
    const elem2 = makeElemental({ id: 'e2', bv: 75 });

    const force = makeForce({
      mechs: [mech1, mech2],
      elementals: [elem1, elem2],
    });

    expect(calculateMissionTotalBV(force, ['m1'], ['e1'])).toBe(150);
    expect(calculateMissionTotalBV(force, ['m1', 'm2'], ['e1', 'e2'])).toBe(425);
  });

  it('getAssignedMechs and getAssignedElementals preserve order and filter missing', () => {
    const mech1 = makeMech({ id: 'm1' });
    const mech2 = makeMech({ id: 'm2' });
    const elem1 = makeElemental({ id: 'e1' });
    const elem2 = makeElemental({ id: 'e2' });
    const force = makeForce({ mechs: [mech1, mech2], elementals: [elem1, elem2] });

    expect(getAssignedMechs(force, ['m2', 'm1', 'mx']).map((m) => m.id)).toEqual([
      'm2',
      'm1',
    ]);
    expect(
      getAssignedElementals(force, ['e2', 'e1', 'ex']).map((e) => e.id),
    ).toEqual(['e2', 'e1']);
  });

  it('getMissionObjectiveReward sums only achieved objectives with positive rewards', () => {
    const mission = {
      id: 'mission-1',
      name: 'Test Mission',
      objectives: [
        { id: 'o1', title: 'A', wpReward: 100, achieved: true },
        { id: 'o2', title: 'B', wpReward: 0, achieved: true },
        { id: 'o3', title: 'C', wpReward: 50, achieved: false },
      ],
    };

    expect(getMissionObjectiveReward(mission)).toBe(100);
  });
});

describe('mission lifecycle helpers', () => {
  it('applyMissionCreation creates mission, logs assignments and subtracts cost', () => {
    const pilot = makePilot({ id: 'p1', name: 'Natasha' });
    const mech = makeMech({ id: 'm1', name: 'Warhammer', pilotId: 'p1' });
    const elemental = makeElemental({ id: 'e1', name: 'Point Alpha' });

    const force = makeForce({
      mechs: [mech],
      pilots: [pilot],
      elementals: [elemental],
      missions: [],
      currentWarchest: 1000,
      currentDate: '3052-05-01',
    });

    const formData = {
      name: 'M01 - Test Mission',
      cost: 200,
      description: 'Test mission',
      objectives: [],
      recap: '',
      completed: false,
      assignedMechs: ['m1'],
      assignedElementals: ['e1'],
    };

    const timestamp = '3052-05-01';
    const result = applyMissionCreation(force, formData, timestamp);

    expect(result.missions).toHaveLength(1);
    const created = result.missions[0];
    expect(created.name).toBe(formData.name);
    expect(created.cost).toBe(200);
    expect(created.createdAt).toBe(timestamp);
    expect(created.inGameDate).toBe(timestamp);
    expect(created.completed).toBe(false);
    expect(created.assignedMechs).toEqual(['m1']);
    expect(created.assignedElementals).toEqual(['e1']);
    expect(typeof created.id).toBe('string');
    expect(created.id.startsWith('mission-')).toBe(true);

    const updatedMech = result.mechs.find((m) => m.id === 'm1');
    expect(updatedMech.activityLog).toHaveLength(1);
    expect(updatedMech.activityLog[0]).toMatchObject({
      timestamp,
      mission: formData.name,
      cost: 0,
    });

    const updatedElem = result.elementals.find((e) => e.id === 'e1');
    expect(updatedElem.activityLog).toHaveLength(1);
    expect(updatedElem.activityLog[0]).toMatchObject({
      timestamp,
      mission: formData.name,
      cost: 0,
    });

    const updatedPilot = result.pilots.find((p) => p.id === 'p1');
    expect(updatedPilot.activityLog).toHaveLength(1);
    expect(updatedPilot.activityLog[0]).toMatchObject({
      timestamp,
      inGameDate: force.currentDate,
      mission: formData.name,
      cost: 0,
    });
    expect(updatedPilot.activityLog[0].action).toContain('Assigned to mission:');
    expect(updatedPilot.activityLog[0].action).toContain('Warhammer');

    expect(result.currentWarchest).toBe(800);
  });

  it('applyMissionUpdate updates only the matching mission and preserves id', () => {
    const missions = [
      { id: 'm1', name: 'Old', cost: 100 },
      { id: 'm2', name: 'Other', cost: 50 },
    ];

    const updated = applyMissionUpdate(missions, 'm1', {
      name: 'Updated',
      cost: 200,
    });

    expect(updated).toHaveLength(2);
    const m1 = updated.find((m) => m.id === 'm1');
    const m2 = updated.find((m) => m.id === 'm2');
    expect(m1.name).toBe('Updated');
    expect(m1.cost).toBe(200);
    expect(m1.id).toBe('m1');
    expect(m2).toEqual(missions[1]);
  });

  it('applyMissionCompletion marks mission completed and adds reward to warchest', () => {
    const mission = {
      id: 'm1',
      name: 'Mission',
      cost: 100,
      objectives: [
        { id: 'o1', title: 'A', wpReward: 50, achieved: false },
        { id: 'o2', title: 'B', wpReward: 75, achieved: false },
      ],
      completed: false,
    };

    const force = makeForce({
      missions: [mission],
      currentWarchest: 500,
    });

    const timestamp = '3052-05-10';
    const completionData = {
      objectives: [
        { id: 'o1', title: 'A', wpReward: 50, achieved: true },
        { id: 'o2', title: 'B', wpReward: 75, achieved: true },
      ],
      recap: 'All objectives achieved',
    };

    const result = applyMissionCompletion(force, 'm1', completionData, timestamp);

    expect(result.missions).toHaveLength(1);
    const completed = result.missions[0];
    expect(completed.completed).toBe(true);
    expect(completed.completedAt).toBe(timestamp);
    expect(completed.recap).toBe('All objectives achieved');
    expect(getMissionObjectiveReward(completed)).toBe(125);
    expect(result.currentWarchest).toBe(625);
  });
});

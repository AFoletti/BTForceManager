import { findPilotForMech, findMechForPilot, getAvailablePilotsForMech, getBVMultiplier, getAdjustedBV, getMechAdjustedBV } from './mechs';

const makePilot = (overrides = {}) => ({
  id: 'pilot-1',
  name: 'Test Pilot',
  gunnery: 4,
  piloting: 5,
  injuries: 0,
  ...overrides,
});

const makeMech = (overrides = {}) => ({
  id: 'mech-1',
  name: 'Test Mech',
  status: 'Operational',
  pilotId: null,
  bv: 1000,
  ...overrides,
});

const makeForce = (overrides = {}) => ({
  mechs: [],
  pilots: [],
  ...overrides,
});

describe('findPilotForMech', () => {
  it('returns null when mech has no pilotId or force has no matching pilot', () => {
    const force = makeForce({ pilots: [makePilot({ id: 'p1' })] });
    const mechNoPilot = makeMech({ pilotId: null });
    const mechUnknownPilot = makeMech({ pilotId: 'p2' });

    expect(findPilotForMech(force, mechNoPilot)).toBeNull();
    expect(findPilotForMech(force, mechUnknownPilot)).toBeNull();
  });

  it('returns the correct pilot by id', () => {
    const pilot = makePilot({ id: 'p1', name: 'Natasha' });
    const mech = makeMech({ pilotId: 'p1' });
    const force = makeForce({ mechs: [mech], pilots: [pilot] });

    const result = findPilotForMech(force, mech);
    expect(result).toBe(pilot);
  });
});

describe('findMechForPilot', () => {
  it('returns null when pilot is not assigned to any mech', () => {
    const pilot = makePilot({ id: 'p1' });
    const mech = makeMech({ id: 'm1', pilotId: null });
    const force = makeForce({ mechs: [mech], pilots: [pilot] });

    expect(findMechForPilot(force, pilot)).toBeNull();
  });

  it('returns the correct mech assigned to the pilot', () => {
    const pilot = makePilot({ id: 'p1' });
    const mech1 = makeMech({ id: 'm1', pilotId: 'p1' });
    const mech2 = makeMech({ id: 'm2', pilotId: null });
    const force = makeForce({ mechs: [mech1, mech2], pilots: [pilot] });

    const result = findMechForPilot(force, pilot);
    expect(result).toBe(mech1);
  });
});

describe('getAvailablePilotsForMech', () => {
  it('returns all pilots when no mech has assignments', () => {
    const p1 = makePilot({ id: 'p1' });
    const p2 = makePilot({ id: 'p2' });
    const force = makeForce({
      mechs: [makeMech({ id: 'm1', pilotId: null })],
      pilots: [p1, p2],
    });

    const available = getAvailablePilotsForMech(force, null);
    expect(available).toHaveLength(2);
    expect(available.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('excludes pilots already assigned to other mechs', () => {
    const p1 = makePilot({ id: 'p1' });
    const p2 = makePilot({ id: 'p2' });

    const mech1 = makeMech({ id: 'm1', pilotId: 'p1' });
    const mech2 = makeMech({ id: 'm2', pilotId: null });

    const force = makeForce({ mechs: [mech1, mech2], pilots: [p1, p2] });

    const availableForNew = getAvailablePilotsForMech(force, null);
    expect(availableForNew.map((p) => p.id)).toEqual(['p2']);
  });

  it('includes the current mech\'s pilot when editing that mech', () => {
    const p1 = makePilot({ id: 'p1' });
    const p2 = makePilot({ id: 'p2' });

    const mech1 = makeMech({ id: 'm1', pilotId: 'p1' });
    const mech2 = makeMech({ id: 'm2', pilotId: 'p2' });

    const force = makeForce({ mechs: [mech1, mech2], pilots: [p1, p2] });

    const availableForMech1 = getAvailablePilotsForMech(force, mech1);
    expect(availableForMech1.map((p) => p.id).sort()).toEqual(['p1']);

    const availableForMech2 = getAvailablePilotsForMech(force, mech2);
    expect(availableForMech2.map((p) => p.id).sort()).toEqual(['p2']);
  });
});

describe('getBVMultiplier', () => {
  it('returns 1.0 for base skills (4/5)', () => {
    expect(getBVMultiplier(4, 5)).toBe(1.0);
  });

  it('returns higher multiplier for better skills', () => {
    expect(getBVMultiplier(3, 4)).toBe(1.32);
    expect(getBVMultiplier(2, 3)).toBe(1.68);
    expect(getBVMultiplier(0, 0)).toBe(2.42);
  });

  it('returns lower multiplier for worse skills', () => {
    expect(getBVMultiplier(5, 6)).toBe(0.90);
    expect(getBVMultiplier(6, 7)).toBe(0.81);
    expect(getBVMultiplier(8, 8)).toBe(0.68);
  });

  it('clamps out-of-range values', () => {
    expect(getBVMultiplier(-1, 5)).toBe(getBVMultiplier(0, 5));
    expect(getBVMultiplier(4, 10)).toBe(getBVMultiplier(4, 8));
  });
});

describe('getAdjustedBV', () => {
  it('returns base BV when no pilot skills provided', () => {
    expect(getAdjustedBV(1000, null, null)).toBe(1000);
    expect(getAdjustedBV(1000, null, 5)).toBe(1000);
    expect(getAdjustedBV(1000, 4, null)).toBe(1000);
  });

  it('returns 0 when base BV is 0 or null', () => {
    expect(getAdjustedBV(0, 4, 5)).toBe(0);
    expect(getAdjustedBV(null, 4, 5)).toBe(0);
  });

  it('returns base BV for 4/5 pilot', () => {
    expect(getAdjustedBV(1000, 4, 5)).toBe(1000);
  });

  it('increases BV for better pilots', () => {
    expect(getAdjustedBV(1000, 3, 4)).toBe(1320); // 1.32x
    expect(getAdjustedBV(1000, 2, 3)).toBe(1680); // 1.68x
  });

  it('decreases BV for worse pilots', () => {
    expect(getAdjustedBV(1000, 5, 6)).toBe(900); // 0.90x
    expect(getAdjustedBV(1000, 6, 7)).toBe(810); // 0.81x
  });

  it('rounds to nearest integer', () => {
    expect(getAdjustedBV(1500, 3, 4)).toBe(1980); // 1500 * 1.32 = 1980
    expect(getAdjustedBV(1337, 4, 5)).toBe(1337); // 1337 * 1.0 = 1337
  });
});

describe('getMechAdjustedBV', () => {
  it('returns base BV when mech has no pilot', () => {
    const mech = makeMech({ bv: 1500, pilotId: null });
    const force = makeForce({ mechs: [mech], pilots: [] });
    
    expect(getMechAdjustedBV(force, mech)).toBe(1500);
  });

  it('returns adjusted BV based on assigned pilot', () => {
    const pilot = makePilot({ id: 'p1', gunnery: 3, piloting: 4 });
    const mech = makeMech({ bv: 1000, pilotId: 'p1' });
    const force = makeForce({ mechs: [mech], pilots: [pilot] });
    
    expect(getMechAdjustedBV(force, mech)).toBe(1320); // 1.32x
  });

  it('returns 0 for mech with no BV', () => {
    const mech = makeMech({ bv: 0, pilotId: null });
    const force = makeForce({ mechs: [mech], pilots: [] });
    
    expect(getMechAdjustedBV(force, mech)).toBe(0);
  });
});

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

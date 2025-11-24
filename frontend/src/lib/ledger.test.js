import { buildLedgerEntries, summariseLedger } from './ledger';

const makeForce = (overrides = {}) => ({
  id: 'force-1',
  name: 'Test Force',
  startingWarchest: 1000,
  currentWarchest: 900,
  currentDate: '3052-01-10',
  mechs: [],
  pilots: [],
  elementals: [],
  missions: [],
  ...overrides,
});

describe('buildLedgerEntries', () => {
  it('returns empty array for invalid force', () => {
    expect(buildLedgerEntries(null)).toEqual([]);
    expect(buildLedgerEntries(undefined)).toEqual([]);
  });

  it('collects costs from mech, elemental and pilot activity logs', () => {
    const force = makeForce({
      mechs: [
        {
          name: 'Atlas',
          activityLog: [
            { timestamp: '3052-01-01', action: 'Repair', cost: 50 },
            { timestamp: '3052-01-02', action: 'Other (no cost)', cost: 0 },
          ],
        },
      ],
      elementals: [
        {
          name: 'Point Alpha',
          activityLog: [{ timestamp: '3052-01-03', action: 'Rearm', cost: 20 }],
        },
      ],
      pilots: [
        {
          name: 'Natasha',
          activityLog: [{ timestamp: '3052-01-04', action: 'Training', cost: 10 }],
        },
      ],
    });

    const ledger = buildLedgerEntries(force);

    // Only non-zero costs should be present
    const entries = ledger.map(({ timestamp, sourceType, unitName, description, cost, gain }) => ({
      timestamp,
      sourceType,
      unitName,
      description,
      cost,
      gain,
    }));

    expect(entries).toEqual([
      {
        timestamp: '3052-01-01',
        sourceType: 'Mech',
        unitName: 'Atlas',
        description: 'Repair',
        cost: -50,
        gain: 0,
      },
      {
        timestamp: '3052-01-03',
        sourceType: 'Elemental',
        unitName: 'Point Alpha',
        description: 'Rearm',
        cost: -20,
        gain: 0,
      },
      {
        timestamp: '3052-01-04',
        sourceType: 'Pilot',
        unitName: 'Natasha',
        description: 'Training',
        cost: -10,
        gain: 0,
      },
    ]);
  });

  it('collects mission costs and objective rewards and sorts by timestamp', () => {
    const force = makeForce({
      mechs: [],
      pilots: [],
      elementals: [],
      missions: [
        {
          id: 'm1',
          name: 'Early Mission',
          cost: 100,
          createdAt: '3052-01-01',
          objectives: [
            { id: 'o1', title: 'Cap Objective', wpReward: 50, achieved: true },
          ],
        },
        {
          id: 'm2',
          name: 'Later Mission',
          cost: 0,
          inGameDate: '3052-01-05',
          objectives: [
            { id: 'o2', title: 'Secondary', wpReward: 75, achieved: true },
          ],
        },
      ],
    });

    const ledger = buildLedgerEntries(force);

    const simplified = ledger.map(({ timestamp, sourceType, unitName, description, cost, gain }) => ({
      timestamp,
      sourceType,
      unitName,
      description,
      cost,
      gain,
    }));

    expect(simplified).toEqual([
      {
        timestamp: '3052-01-01',
        sourceType: 'Mission',
        unitName: 'Early Mission',
        description: 'Track cost',
        cost: -100,
        gain: 0,
      },
      {
        timestamp: '3052-01-01',
        sourceType: 'Objective',
        unitName: 'Early Mission',
        description: 'Cap Objective',
        cost: 0,
        gain: 50,
      },
      {
        timestamp: '3052-01-05',
        sourceType: 'Objective',
        unitName: 'Later Mission',
        description: 'Secondary',
        cost: 0,
        gain: 75,
      },
    ]);
  });
});

describe('summariseLedger', () => {
  it('computes totals and formatted strings correctly', () => {
    const ledgerEntries = [
      { cost: -100, gain: 0 },
      { cost: -20, gain: 0 },
      { cost: 0, gain: 50 },
    ];

    const result = summariseLedger(ledgerEntries, 930, 1000);

    expect(result.totalSpent).toBe(-120);
    expect(result.totalGained).toBe(50);
    expect(result.net).toBe(-70);
    expect(result.currentWarchest).toBe(930);
    expect(result.startingWarchest).toBe(1000);

    expect(result.formatted).toEqual({
      totalSpent: "-120",
      totalGained: "+50",
      net: "-70",
      current: "930",
      starting: "1'000",
    });
  });
});

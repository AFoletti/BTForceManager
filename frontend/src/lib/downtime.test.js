import { evaluateDowntimeCost, buildDowntimeContext } from './downtime';

// Basic unit tests for the downtime expression parser and context builder.

describe('buildDowntimeContext', () => {
  it('builds context from mech with defaults', () => {
    const force = { wpMultiplier: 5 };
    const mech = { weight: 40 };

    const ctx = buildDowntimeContext(force, mech);

    expect(ctx).toEqual({
      weight: 40,
      suitsDamaged: 0,
      suitsDestroyed: 0,
      wpMultiplier: 5,
    });
  });

  it('builds context from elemental with suits data', () => {
    const force = { wpMultiplier: 4 };
    const elemental = { suitsDamaged: 2, suitsDestroyed: 3 };

    const ctx = buildDowntimeContext(force, elemental);

    expect(ctx).toEqual({
      weight: 0,
      suitsDamaged: 2,
      suitsDestroyed: 3,
      wpMultiplier: 4,
    });
  });
});

describe('evaluateDowntimeCost', () => {
  it('returns 0 for empty or invalid formulas', () => {
    expect(evaluateDowntimeCost('', {})).toBe(0);
    expect(evaluateDowntimeCost('   ', {})).toBe(0);
    // Unsupported characters should be rejected
    expect(evaluateDowntimeCost('weight * wpMultiplier + Math.random()', { weight: 10, wpMultiplier: 5 })).toBe(0);
  });

  it('evaluates simple numeric expressions', () => {
    expect(evaluateDowntimeCost('10', {})).toBe(10);
    expect(evaluateDowntimeCost('10/3', {})).toBe(4); // ceil(3.33...)
    expect(evaluateDowntimeCost('1 + 2 * 3', {})).toBe(7);
    expect(evaluateDowntimeCost('(1 + 2) * 3', {})).toBe(9);
  });

  it('evaluates expressions with context variables', () => {
    const ctx = { weight: 40, wpMultiplier: 5, suitsDamaged: 2, suitsDestroyed: 3 };

    // Mirrors data/downtime-actions.json formulas
    expect(evaluateDowntimeCost('weight/wpMultiplier', ctx)).toBe(8); // 40/5 = 8
    expect(evaluateDowntimeCost('(weight*2)/wpMultiplier', ctx)).toBe(16); // 80/5 = 16
    expect(evaluateDowntimeCost('(weight/4)/wpMultiplier', ctx)).toBe(2); // 10/5 = 2
    expect(evaluateDowntimeCost('(suitsDamaged*2.5)/wpMultiplier', ctx)).toBe(1); // 5/5 = 1
    expect(evaluateDowntimeCost('(suitsDestroyed*50)/wpMultiplier', ctx)).toBe(30); // 150/5 = 30
    expect(evaluateDowntimeCost('200/wpMultiplier', ctx)).toBe(40);
    expect(evaluateDowntimeCost('150/wpMultiplier', ctx)).toBe(30);
    expect(evaluateDowntimeCost('30/wpMultiplier', ctx)).toBe(6);
  });

  it('treats unknown identifiers as 0 and clamps negative results to 0', () => {
    // unknownVar becomes 0
    expect(evaluateDowntimeCost('unknownVar + 5', {})).toBe(5);

    // Negative values are clamped to 0
    expect(evaluateDowntimeCost('-5', {})).toBe(0);
  });

  it('returns 0 on division by zero or malformed expressions', () => {
    expect(evaluateDowntimeCost('10/0', {})).toBe(0);
    expect(evaluateDowntimeCost('1 + * 2', {})).toBe(0);
  });
});

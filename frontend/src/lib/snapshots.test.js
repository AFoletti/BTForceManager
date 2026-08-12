import { advanceDateString } from './snapshots';

describe('advanceDateString', () => {
  it('advances a normal date by one day', () => {
    expect(advanceDateString('3052-01-10')).toBe('3052-01-11');
  });

  it('rolls over to the next month', () => {
    expect(advanceDateString('3052-01-31')).toBe('3052-02-01');
  });

  it('rolls over to the next year', () => {
    expect(advanceDateString('3052-12-31')).toBe('3053-01-01');
  });

  it('returns the input unchanged if it is not a valid date string', () => {
    expect(advanceDateString('')).toBe('');
    expect(advanceDateString(null)).toBe(null);
    expect(advanceDateString('not-a-date')).toBe('not-a-date');
  });
});

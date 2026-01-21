import { getPilotDisplayName } from './pilots';

describe('getPilotDisplayName', () => {
  it('returns empty string for null pilot', () => {
    expect(getPilotDisplayName(null)).toBe('');
  });

  it('returns pilot name without marker by default', () => {
    expect(getPilotDisplayName({ name: 'Kai Allard-Liao' })).toBe('Kai Allard-Liao');
  });

  it('adds (D) marker when pilot is dezgra', () => {
    expect(getPilotDisplayName({ name: 'Trent', dezgra: true })).toBe('Trent (D)');
  });
});

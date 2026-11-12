import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_HEALER,
  STORAGE_KEY,
  loadHealerSettings,
  parseHealerSettings,
  saveHealerSettings,
  type HealerSettings,
} from '../src/settings';

const SAMPLE: HealerSettings = {
  rulesVersion: 'legacy',
  proficiency: 'master',
  bonus: 22,
  feats: {
    continualRecovery: true,
    riskySurgery: false,
    mortalHealing: true,
    medicDedication: false,
  },
};

describe('parseHealerSettings', () => {
  it('accepts valid settings', () => {
    expect(parseHealerSettings(SAMPLE)).toEqual(SAMPLE);
  });

  it.each([null, 'x', 42, [], undefined])('defaults for %j', (data) => {
    expect(parseHealerSettings(data)).toEqual(DEFAULT_HEALER);
  });

  it('replaces only the invalid fields', () => {
    const parsed = parseHealerSettings({
      ...SAMPLE,
      rulesVersion: 'pf1',
      proficiency: { toString: () => 'master' },
      bonus: 2.5,
      feats: { continualRecovery: 'yes', riskySurgery: true, extra: true },
    });
    expect(parsed).toEqual({
      rulesVersion: 'remaster',
      proficiency: 'trained',
      bonus: 5,
      feats: {
        continualRecovery: false,
        riskySurgery: true,
        mortalHealing: false,
        medicDedication: false,
      },
    });
  });

  it('rejects out-of-range and non-numeric bonuses', () => {
    for (const bad of [-1, 41, '5', NaN, Infinity]) {
      expect(parseHealerSettings({ bonus: bad }).bonus).toBe(5);
    }
    expect(parseHealerSettings({ bonus: 0 }).bonus).toBe(0);
  });
});

describe('load and save', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('returns null when nothing is saved', () => {
    expect(loadHealerSettings()).toBeNull();
  });

  it('round-trips settings', () => {
    saveHealerSettings(SAMPLE);
    expect(loadHealerSettings()).toEqual(SAMPLE);
  });

  it('returns null for corrupt JSON', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadHealerSettings()).toBeNull();
  });

  it('ignores storage errors', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => saveHealerSettings(SAMPLE)).not.toThrow();
    expect(loadHealerSettings()).toBeNull();
  });
});

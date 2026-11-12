import { describe, expect, it } from 'vitest';
import {
  describeChange,
  formatClock,
  formatDuration,
  formatSigned,
} from '../src/format';
import type { Attempt } from '../src/rules/healing';

const ATTEMPT: Attempt = {
  number: 1,
  startMinute: 0,
  d20: 12,
  checkTotal: 22,
  dc: 20,
  degree: 'success',
  surgeryDamage: null,
  dice: [3, 7],
  tierBonus: 10,
  doubled: false,
  flatBonus: 0,
  change: 20,
  hpBefore: 10,
  hpAfter: 30,
};

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(10)).toBe('10 min');
    expect(formatDuration(60)).toBe('1 hour');
    expect(formatDuration(150)).toBe('2 hours 30 min');
  });

  it('formats clock offsets', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(70)).toBe('1:10');
    expect(formatClock(1500)).toBe('25:00');
  });

  it('formats signed numbers', () => {
    expect(formatSigned(12)).toBe('+12');
    expect(formatSigned(-3.46)).toBe('−3.5');
    expect(formatSigned(0.01)).toBe('0');
  });

  it('describes the healing roll', () => {
    expect(describeChange(ATTEMPT)).toBe('2d8 (3, 7) + 10');
    expect(describeChange({ ...ATTEMPT, doubled: true, flatBonus: 5 })).toBe(
      '(2d8 (3, 7) + 10) × 2 + 5',
    );
    expect(
      describeChange({
        ...ATTEMPT,
        degree: 'criticalFailure',
        dice: [4],
        surgeryDamage: 2,
      }),
    ).toBe('surgery 1d8 (2) damage; 1d8 (4) damage');
    expect(describeChange({ ...ATTEMPT, degree: 'failure', dice: [] })).toBe(
      '',
    );
  });
});

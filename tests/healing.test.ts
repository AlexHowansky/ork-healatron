import { describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS,
  allowedTiers,
  attemptDegree,
  attemptInterval,
  averageHealing,
  bestTier,
  checkOdds,
  continualRecoveryAllowed,
  healingAmount,
  riskySurgeryGain,
  rollDegree,
  simulate,
  treatDc,
  type Roller,
} from '../src/rules/healing';
import type { HealingInputs } from '../src/rules/types';

const BASE: HealingInputs = {
  rulesVersion: 'remaster',
  proficiency: 'trained',
  bonus: 5,
  expandedToolkit: false,
  feats: {
    continualRecovery: false,
    riskySurgery: false,
    mortalHealing: false,
    medicDedication: false,
  },
  tier: 'trained',
  dcAdjustment: 0,
  fullHour: false,
  godless: false,
  currentHp: 20,
  maxHp: 60,
};

const withFeats = (
  feats: Partial<HealingInputs['feats']>,
  rest: Partial<HealingInputs> = {},
): HealingInputs => ({ ...BASE, ...rest, feats: { ...BASE.feats, ...feats } });

function scripted(...rolls: number[]): Roller {
  let i = 0;
  return () => {
    const r = rolls[i];
    i += 1;
    if (r === undefined) throw new Error('Out of scripted rolls');
    return r;
  };
}

describe('tiers', () => {
  it('limits DCs by proficiency', () => {
    expect(allowedTiers('trained')).toEqual(['trained']);
    expect(allowedTiers('master')).toEqual(['trained', 'expert', 'master']);
    expect(allowedTiers('legendary')).toHaveLength(4);
  });

  it('applies the DC and GM adjustment', () => {
    expect(treatDc(BASE)).toBe(15);
    expect(treatDc({ ...BASE, tier: 'master', dcAdjustment: 2 })).toBe(32);
    expect(treatDc({ ...BASE, tier: 'legendary', dcAdjustment: -1 })).toBe(39);
  });

  it('needs expert for Continual Recovery', () => {
    expect(continualRecoveryAllowed('trained')).toBe(false);
    expect(continualRecoveryAllowed('expert')).toBe(true);
  });
});

describe('degrees and odds', () => {
  it('applies natural 1 and 20', () => {
    expect(rollDegree(20, 0, 30)).toBe('failure');
    expect(rollDegree(1, 30, 15)).toBe('success');
    expect(rollDegree(10, 5, 15)).toBe('success');
    expect(rollDegree(20, 5, 15)).toBe('criticalSuccess');
    expect(rollDegree(1, 5, 15)).toBe('criticalFailure');
  });

  it('sums to 1', () => {
    const o = checkOdds(BASE);
    expect(
      o.criticalSuccess + o.success + o.failure + o.criticalFailure,
    ).toBeCloseTo(1);
    // +5 vs 15: 10-19 succeed, 20 crits, 2-9 fail, 1 crit fails.
    expect(o).toEqual({
      criticalSuccess: 0.05,
      success: 0.5,
      failure: 0.4,
      criticalFailure: 0.05,
    });
  });

  it('upgrades a success with Risky Surgery (+2) or Mortal Healing', () => {
    const risky = withFeats({ riskySurgery: true });
    expect(attemptDegree(8, risky)).toBe('criticalSuccess'); // 8 + 7 = 15
    expect(attemptDegree(7, risky)).toBe('failure');
    expect(checkOdds(risky).success).toBe(0);
    const mortal = withFeats({ mortalHealing: true });
    expect(attemptDegree(10, mortal)).toBe('criticalSuccess');
    expect(attemptDegree(9, mortal)).toBe('failure');
  });

  it('compares the average per hour with and without Risky Surgery', () => {
    // +5 vs DC 15: many plain successes to upgrade, so it helps.
    expect(riskySurgeryGain(BASE)).toBeGreaterThan(0);
    // +20 vs DC 15 already crits often, so the damage outweighs it.
    expect(riskySurgeryGain({ ...BASE, bonus: 20 })).toBeLessThan(0);
    // Mortal Healing already upgrades successes.
    expect(riskySurgeryGain(withFeats({ mortalHealing: true }))).toBeLessThan(
      0,
    );
    // Same answer whether or not the box is ticked.
    expect(riskySurgeryGain(withFeats({ riskySurgery: true }))).toBe(
      riskySurgeryGain(BASE),
    );
  });

  it("adds +1 for an expanded healer's toolkit", () => {
    const kit = { ...BASE, expandedToolkit: true };
    expect(attemptDegree(9, kit)).toBe('success'); // 9 + 6 = 15
    expect(attemptDegree(9, BASE)).toBe('failure');
  });
});

describe('healing amounts', () => {
  it('adds the tier bonus', () => {
    expect(healingAmount(9, BASE)).toBe(9);
    expect(healingAmount(9, { ...BASE, tier: 'master' })).toBe(39);
  });

  it('doubles for a full hour only under the Remaster rules', () => {
    const hour = { ...BASE, tier: 'expert' as const, fullHour: true };
    expect(healingAmount(9, hour)).toBe(38);
    expect(healingAmount(9, { ...hour, rulesVersion: 'legacy' })).toBe(19);
  });

  it('adds Medic and Godless bonuses after doubling', () => {
    const inputs = withFeats(
      { medicDedication: true },
      { tier: 'master', fullHour: true, godless: true },
    );
    // (9 + 30) * 2 + 10 + 5
    expect(healingAmount(9, inputs)).toBe(93);
    expect(healingAmount(9, withFeats({ medicDedication: true }))).toBe(9);
  });

  it('averages per attempt', () => {
    const a = averageHealing(BASE);
    expect(a.success).toBe(9);
    expect(a.criticalSuccess).toBe(18);
    // 0.05*18 + 0.5*9 - 0.05*4.5
    expect(a.perAttempt).toBeCloseTo(5.175);
    expect(a.minutesPerAttempt).toBe(60);
    expect(a.perHour).toBeCloseTo(5.175);
  });

  it('counts Risky Surgery damage every attempt', () => {
    const a = averageHealing(withFeats({ riskySurgery: true }));
    expect(a.surgeryDamage).toBe(4.5);
    // +7 vs 15: 8-20 crit (13), 2-7 fail, 1 crit fail.
    expect(a.perAttempt).toBeCloseTo(0.65 * 18 - 0.05 * 4.5 - 4.5);
  });

  it('picks the DC with the most healing per hour', () => {
    expect(bestTier({ ...BASE, proficiency: 'expert', bonus: 15 })).toBe(
      'expert',
    );
    expect(bestTier({ ...BASE, proficiency: 'legendary', bonus: 3 })).toBe(
      'trained',
    );
  });
});

describe('time', () => {
  it('waits out the 1 hour immunity', () => {
    expect(attemptInterval('success', BASE)).toBe(60);
  });

  it('uses 10 minute immunity with Continual Recovery at expert', () => {
    const cr = withFeats(
      { continualRecovery: true },
      { proficiency: 'expert' },
    );
    expect(attemptInterval('failure', cr)).toBe(10);
    // Ignored when not allowed.
    expect(
      attemptInterval('failure', withFeats({ continualRecovery: true })),
    ).toBe(60);
  });

  it('takes a full hour on a doubled success', () => {
    const both = withFeats(
      { continualRecovery: true },
      { proficiency: 'expert', fullHour: true },
    );
    expect(attemptInterval('success', both)).toBe(60);
    expect(attemptInterval('failure', both)).toBe(10);
  });
});

describe('simulate', () => {
  it('returns at once when already at full HP', () => {
    const sim = simulate({ ...BASE, currentHp: 60 }, scripted());
    expect(sim).toMatchObject({ attempts: [], end: 'full', minutes: 0 });
  });

  it('rolls until full HP, clamping at max', () => {
    // Success 16, failure, crit 32 (clamped to 60).
    const sim = simulate(BASE, scripted(10, 8, 8, 2, 20, 8, 8, 8, 8));
    expect(sim.end).toBe('full');
    expect(sim.attempts.map((a) => a.hpAfter)).toEqual([36, 36, 60]);
    expect(sim.attempts.map((a) => a.startMinute)).toEqual([0, 60, 120]);
    expect(sim.healed).toBe(40);
    expect(sim.minutes).toBe(130);
  });

  it('applies crit fail damage and stops when the target is down', () => {
    const sim = simulate({ ...BASE, currentHp: 3 }, scripted(1, 5));
    expect(sim.end).toBe('down');
    expect(sim.endHp).toBe(0);
    expect(sim.healed).toBe(-3);
    expect(sim.attempts[0]?.change).toBe(-5);
  });

  it('keeps going from 0 HP after a plain failure', () => {
    const sim = simulate(
      { ...BASE, currentHp: 0, maxHp: 5 },
      scripted(2, 10, 3, 3),
    );
    expect(sim.end).toBe('full');
    expect(sim.attempts).toHaveLength(2);
  });

  it('applies Risky Surgery before healing', () => {
    const inputs = withFeats({ riskySurgery: true });
    // d20 10 (+7 = 17, upgraded to crit), surgery 4, 4d8 = 12.
    const sim = simulate(
      { ...inputs, currentHp: 15, maxHp: 20 },
      scripted(10, 4, 3, 3, 3, 3),
    );
    const first = sim.attempts[0];
    expect(first?.degree).toBe('criticalSuccess');
    expect(first?.surgeryDamage).toBe(4);
    expect(first?.change).toBe(12);
    expect(first?.hpAfter).toBe(20);
    expect(sim.end).toBe('full');
  });

  it('stops after the attempt limit', () => {
    const sim = simulate(BASE, () => 5); // always a failure
    expect(sim.end).toBe('limit');
    expect(sim.attempts).toHaveLength(MAX_ATTEMPTS);
    expect(sim.minutes).toBe((MAX_ATTEMPTS - 1) * 60 + 10);
  });
});

/**
 * Pure PF2e Treat Wounds calculations (Player Core, Player Core 2 and
 * Lost Omens Hellfire Dispatches feats). No DOM access.
 */
import {
  DC_TIERS,
  type DcTier,
  type Degree,
  type HealingInputs,
  type Proficiency,
  type RulesVersion,
} from './types';

const RANK: Readonly<Record<Proficiency, number>> = Object.freeze({
  trained: 0,
  expert: 1,
  master: 2,
  legendary: 3,
});

/** Treat Wounds DC for each tier, before any GM adjustment. */
export const TIER_DC: Readonly<Record<DcTier, number>> = Object.freeze({
  trained: 15,
  expert: 20,
  master: 30,
  legendary: 40,
});

/** Extra HP regained on a success for attempting the higher DC. */
export const TIER_BONUS: Readonly<Record<DcTier, number>> = Object.freeze({
  trained: 0,
  expert: 10,
  master: 30,
  legendary: 50,
});

/** Medic Dedication's circumstance bonus to HP regained, by DC tier. */
export const MEDIC_BONUS: Readonly<Record<DcTier, number>> = Object.freeze({
  trained: 0,
  expert: 5,
  master: 10,
  legendary: 15,
});

export const GODLESS_BONUS = 5;
export const RISKY_SURGERY_BONUS = 2;
/** Item bonus to Medicine from an expanded healer's toolkit. */
export const EXPANDED_TOOLKIT_BONUS = 1;
export const TREAT_MINUTES = 10;
export const FULL_HOUR_MINUTES = 60;
export const IMMUNITY_MINUTES = 60;
export const CONTINUAL_IMMUNITY_MINUTES = 10;
/** A simulated run stops after this many attempts. */
export const MAX_ATTEMPTS = 200;

const AVERAGE_D8 = 4.5;

/** Healing dice rolled (d8s) for each degree; on a crit fail it's damage. */
export const DICE: Readonly<Record<Degree, number>> = Object.freeze({
  criticalSuccess: 4,
  success: 2,
  failure: 0,
  criticalFailure: 1,
});

export function tierAllowed(tier: DcTier, proficiency: Proficiency): boolean {
  return RANK[tier] <= RANK[proficiency];
}

/** DC tiers the healer may attempt, lowest first. */
export function allowedTiers(proficiency: Proficiency): DcTier[] {
  return DC_TIERS.filter((t) => tierAllowed(t, proficiency));
}

/** Continual Recovery needs expert Medicine. */
export function continualRecoveryAllowed(proficiency: Proficiency): boolean {
  return RANK[proficiency] >= RANK.expert;
}

/** Treating for a full hour to double the healing is a Remaster rule. */
export function fullHourAllowed(version: RulesVersion): boolean {
  return version === 'remaster';
}

export function treatDc(inputs: HealingInputs): number {
  return TIER_DC[inputs.tier] + inputs.dcAdjustment;
}

/**
 * Medicine bonus for the check, including the expanded toolkit's +1 and
 * Risky Surgery's +2.
 */
export function checkBonus(inputs: HealingInputs): number {
  return (
    inputs.bonus +
    (inputs.expandedToolkit ? EXPANDED_TOOLKIT_BONUS : 0) +
    (inputs.feats.riskySurgery ? RISKY_SURGERY_BONUS : 0)
  );
}

/** Risky Surgery and Mortal Healing turn a success into a critical one. */
export function upgradesSuccess(inputs: HealingInputs): boolean {
  return inputs.feats.riskySurgery || inputs.feats.mortalHealing;
}

function usesContinualRecovery(inputs: HealingInputs): boolean {
  return (
    inputs.feats.continualRecovery &&
    continualRecoveryAllowed(inputs.proficiency)
  );
}

/** Whether a success is doubled by treating for a full hour. */
export function doubles(inputs: HealingInputs): boolean {
  return inputs.fullHour && fullHourAllowed(inputs.rulesVersion);
}

const STEPS: readonly Degree[] = [
  'criticalFailure',
  'failure',
  'success',
  'criticalSuccess',
];

/**
 * Degree of success for a d20 roll, applying the natural 20 / natural 1
 * one-step adjustment.
 */
export function rollDegree(d20: number, bonus: number, dc: number): Degree {
  const total = d20 + bonus;
  let step = total >= dc + 10 ? 3 : total >= dc ? 2 : total <= dc - 10 ? 0 : 1;
  if (d20 === 20) step = Math.min(3, step + 1);
  if (d20 === 1) step = Math.max(0, step - 1);
  return STEPS[step] ?? 'failure';
}

/** Degree achieved, after any feat that upgrades a success. */
export function attemptDegree(d20: number, inputs: HealingInputs): Degree {
  const degree = rollDegree(d20, checkBonus(inputs), treatDc(inputs));
  return degree === 'success' && upgradesSuccess(inputs)
    ? 'criticalSuccess'
    : degree;
}

export type CheckOdds = Readonly<Record<Degree, number>>;

/** Chance (0 - 1) of each degree, after feat upgrades. */
export function checkOdds(inputs: HealingInputs): CheckOdds {
  const counts: Record<Degree, number> = {
    criticalSuccess: 0,
    success: 0,
    failure: 0,
    criticalFailure: 0,
  };
  for (let d20 = 1; d20 <= 20; d20 += 1) {
    counts[attemptDegree(d20, inputs)] += 1;
  }
  return {
    criticalSuccess: counts.criticalSuccess / 20,
    success: counts.success / 20,
    failure: counts.failure / 20,
    criticalFailure: counts.criticalFailure / 20,
  };
}

/** Flat HP added after any doubling: Medic Dedication, Godless Healing. */
export function flatBonus(inputs: HealingInputs): number {
  return (
    (inputs.feats.medicDedication ? MEDIC_BONUS[inputs.tier] : 0) +
    (inputs.godless ? GODLESS_BONUS : 0)
  );
}

/** HP regained on a success or critical success, given the dice total. */
export function healingAmount(
  diceTotal: number,
  inputs: HealingInputs,
): number {
  const base = diceTotal + TIER_BONUS[inputs.tier];
  return (doubles(inputs) ? base * 2 : base) + flatBonus(inputs);
}

function heals(degree: Degree): boolean {
  return degree === 'criticalSuccess' || degree === 'success';
}

/** How long the treatment itself lasts. */
export function treatmentMinutes(
  degree: Degree,
  inputs: HealingInputs,
): number {
  return heals(degree) && doubles(inputs) ? FULL_HOUR_MINUTES : TREAT_MINUTES;
}

/** How long the target is immune to the healer's Treat Wounds. */
export function immunityMinutes(inputs: HealingInputs): number {
  return usesContinualRecovery(inputs)
    ? CONTINUAL_IMMUNITY_MINUTES
    : IMMUNITY_MINUTES;
}

/**
 * Minutes from the start of one attempt to the start of the next. The
 * immunity starts with the treatment, so the two overlap.
 */
export function attemptInterval(degree: Degree, inputs: HealingInputs): number {
  return Math.max(treatmentMinutes(degree, inputs), immunityMinutes(inputs));
}

export interface AverageHealing {
  readonly odds: CheckOdds;
  /** Average HP regained on each healing degree. */
  readonly criticalSuccess: number;
  readonly success: number;
  /** Average damage dealt on a critical failure. */
  readonly criticalFailureDamage: number;
  /** Average Risky Surgery damage dealt every attempt (0 without it). */
  readonly surgeryDamage: number;
  /** Average net HP change per attempt (may be negative). */
  readonly perAttempt: number;
  /** Average minutes between attempts. */
  readonly minutesPerAttempt: number;
  /** Average net HP change per hour. */
  readonly perHour: number;
}

export function averageHealing(inputs: HealingInputs): AverageHealing {
  const odds = checkOdds(inputs);
  const criticalSuccess = healingAmount(
    DICE.criticalSuccess * AVERAGE_D8,
    inputs,
  );
  const success = healingAmount(DICE.success * AVERAGE_D8, inputs);
  const criticalFailureDamage = DICE.criticalFailure * AVERAGE_D8;
  const surgeryDamage = inputs.feats.riskySurgery ? AVERAGE_D8 : 0;
  const perAttempt =
    odds.criticalSuccess * criticalSuccess +
    odds.success * success -
    odds.criticalFailure * criticalFailureDamage -
    surgeryDamage;
  const minutesPerAttempt =
    odds.criticalSuccess * attemptInterval('criticalSuccess', inputs) +
    odds.success * attemptInterval('success', inputs) +
    odds.failure * attemptInterval('failure', inputs) +
    odds.criticalFailure * attemptInterval('criticalFailure', inputs);
  return {
    odds,
    criticalSuccess,
    success,
    criticalFailureDamage,
    surgeryDamage,
    perAttempt,
    minutesPerAttempt,
    perHour: (perAttempt * 60) / minutesPerAttempt,
  };
}

/**
 * The allowed DC tier with the most healing per hour on average; ties go
 * to the lower DC.
 */
export function bestTier(inputs: HealingInputs): DcTier {
  let best: DcTier = 'trained';
  let bestRate = -Infinity;
  for (const tier of allowedTiers(inputs.proficiency)) {
    const rate = averageHealing({ ...inputs, tier }).perHour;
    if (rate > bestRate + 1e-9) {
      best = tier;
      bestRate = rate;
    }
  }
  return best;
}

/** Returns a whole number from 1 to sides. */
export type Roller = (sides: number) => number;

export interface Attempt {
  /** 1-based attempt number. */
  readonly number: number;
  /** Minutes from the start of the first attempt. */
  readonly startMinute: number;
  readonly d20: number;
  readonly checkTotal: number;
  readonly dc: number;
  readonly degree: Degree;
  /** Risky Surgery damage, or null without the feat. */
  readonly surgeryDamage: number | null;
  /** d8s rolled: healing on a success, damage on a critical failure. */
  readonly dice: readonly number[];
  readonly tierBonus: number;
  readonly doubled: boolean;
  readonly flatBonus: number;
  /** HP regained (positive) or crit-fail damage (negative), unclamped. */
  readonly change: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
}

/** Why a run stopped. */
export type SimulationEnd = 'full' | 'down' | 'limit';

export interface Simulation {
  readonly attempts: readonly Attempt[];
  readonly end: SimulationEnd;
  readonly startHp: number;
  readonly endHp: number;
  /** Net HP gained over the run (negative if the target lost HP). */
  readonly healed: number;
  /** Minutes until the last treatment ends. */
  readonly minutes: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Roll Treat Wounds again and again until the target is at full HP, is
 * brought down to 0 HP by damage, or MAX_ATTEMPTS is reached.
 */
export function simulate(inputs: HealingInputs, roll: Roller): Simulation {
  const maxHp = Math.max(1, inputs.maxHp);
  const startHp = clamp(inputs.currentHp, 0, maxHp);
  const dc = treatDc(inputs);
  const bonus = checkBonus(inputs);
  const attempts: Attempt[] = [];
  let hp = startHp;
  let start = 0;
  let minutes = 0;
  let end: SimulationEnd = hp >= maxHp ? 'full' : 'limit';

  while (end === 'limit' && attempts.length < MAX_ATTEMPTS) {
    const hpBefore = hp;
    const d20 = roll(20);
    const degree = attemptDegree(d20, inputs);
    const surgeryDamage = inputs.feats.riskySurgery ? roll(8) : null;
    if (surgeryDamage !== null) hp = Math.max(0, hp - surgeryDamage);

    const dice = Array.from({ length: DICE[degree] }, () => roll(8));
    let change = 0;
    if (heals(degree)) change = healingAmount(sum(dice), inputs);
    else if (degree === 'criticalFailure') change = -sum(dice);
    hp = clamp(hp + change, 0, maxHp);

    attempts.push({
      number: attempts.length + 1,
      startMinute: start,
      d20,
      checkTotal: d20 + bonus,
      dc,
      degree,
      surgeryDamage,
      dice,
      tierBonus: TIER_BONUS[inputs.tier],
      doubled: heals(degree) && doubles(inputs),
      flatBonus: heals(degree) ? flatBonus(inputs) : 0,
      change,
      hpBefore,
      hpAfter: hp,
    });
    minutes = start + treatmentMinutes(degree, inputs);
    start += attemptInterval(degree, inputs);

    const damaged = surgeryDamage !== null || degree === 'criticalFailure';
    if (hp >= maxHp) end = 'full';
    else if (hp === 0 && damaged) end = 'down';
    else if (attempts.length >= MAX_ATTEMPTS) break;
  }

  return {
    attempts,
    end,
    startHp,
    endHp: hp,
    healed: hp - startHp,
    minutes,
  };
}

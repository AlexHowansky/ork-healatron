export const PROFICIENCIES = [
  'trained',
  'expert',
  'master',
  'legendary',
] as const;
export type Proficiency = (typeof PROFICIENCIES)[number];

export const RULES_VERSIONS = ['remaster', 'legacy'] as const;
export type RulesVersion = (typeof RULES_VERSIONS)[number];

/**
 * Treat Wounds DC tiers, named for the Medicine proficiency each needs:
 * DC 15 (trained), 20 (expert), 30 (master), 40 (legendary).
 */
export const DC_TIERS = PROFICIENCIES;
export type DcTier = Proficiency;

/** Healer feats that change Treat Wounds. */
export const HEALER_FEATS = [
  'continualRecovery',
  'riskySurgery',
  'mortalHealing',
  'medicDedication',
] as const;
export type HealerFeat = (typeof HEALER_FEATS)[number];

export const DEGREES = [
  'criticalSuccess',
  'success',
  'failure',
  'criticalFailure',
] as const;
export type Degree = (typeof DEGREES)[number];

export const DEGREE_NAMES: Readonly<Record<Degree, string>> = Object.freeze({
  criticalSuccess: 'Critical success',
  success: 'Success',
  failure: 'Failure',
  criticalFailure: 'Critical failure',
});

export const LIMITS = Object.freeze({
  bonus: { min: 0, max: 40 },
  maxHp: { min: 1, max: 400 },
  level: { min: 1, max: 20 },
  dcAdjustment: { min: -10, max: 10 },
});

export interface HealingInputs {
  readonly rulesVersion: RulesVersion;
  readonly proficiency: Proficiency;
  /** Medicine skill bonus, without the expanded toolkit's item bonus. */
  readonly bonus: number;
  /** The healer uses an expanded healer's toolkit (+1 item bonus). */
  readonly expandedToolkit: boolean;
  readonly feats: Readonly<Record<HealerFeat, boolean>>;
  /** Chosen DC tier; must be allowed by the proficiency. */
  readonly tier: DcTier;
  /** GM's adjustment to the DC for the circumstances. */
  readonly dcAdjustment: number;
  /** Keep treating for a full hour on a success (Remaster only). */
  readonly fullHour: boolean;
  /** The target has the Godless Healing feat. */
  readonly godless: boolean;
  /** The target's character level. */
  readonly level: number;
  /** The target has the Robust Health feat (level 3 or higher). */
  readonly robustHealth: boolean;
  readonly currentHp: number;
  readonly maxHp: number;
}

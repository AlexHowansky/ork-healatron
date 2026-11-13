/**
 * Remembers the Healer panel between visits, in localStorage. Stored data
 * is untrusted: every field is validated on load, and any field that is
 * missing or invalid falls back to its default. Storage may be unavailable
 * (private browsing, blocked site data); failures are logged and ignored.
 */
import { createLogger } from './logger';
import {
  HEALER_FEATS,
  LIMITS,
  PROFICIENCIES,
  RULES_VERSIONS,
  type HealerFeat,
  type Proficiency,
  type RulesVersion,
} from './rules/types';

const log = createLogger('settings');

export const STORAGE_KEY = 'healatron.healer.v1';

export interface HealerSettings {
  readonly rulesVersion: RulesVersion;
  readonly proficiency: Proficiency;
  readonly bonus: number;
  readonly expandedToolkit: boolean;
  readonly feats: Readonly<Record<HealerFeat, boolean>>;
}

export const DEFAULT_HEALER: HealerSettings = Object.freeze({
  rulesVersion: 'remaster',
  proficiency: 'trained',
  bonus: 5,
  expandedToolkit: false,
  feats: Object.freeze({
    continualRecovery: false,
    riskySurgery: false,
    mortalHealing: false,
    medicDedication: false,
  }),
});

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function intIn(
  value: unknown,
  limits: { readonly min: number; readonly max: number },
  fallback: number,
): number {
  return Number.isInteger(value) &&
    (value as number) >= limits.min &&
    (value as number) <= limits.max
    ? (value as number)
    : fallback;
}

/** Validate parsed storage data, falling back to defaults field by field. */
export function parseHealerSettings(data: unknown): HealerSettings {
  const d = DEFAULT_HEALER;
  if (!isRecord(data)) return d;
  const feats = isRecord(data.feats) ? data.feats : {};
  return {
    rulesVersion: oneOf(RULES_VERSIONS, data.rulesVersion, d.rulesVersion),
    proficiency: oneOf(PROFICIENCIES, data.proficiency, d.proficiency),
    bonus: intIn(data.bonus, LIMITS.bonus, d.bonus),
    expandedToolkit:
      typeof data.expandedToolkit === 'boolean'
        ? data.expandedToolkit
        : d.expandedToolkit,
    feats: Object.fromEntries(
      HEALER_FEATS.map((f) => [
        f,
        typeof feats[f] === 'boolean' ? feats[f] : d.feats[f],
      ]),
    ) as Record<HealerFeat, boolean>,
  };
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The saved Healer settings, or null if none are saved or readable. */
export function loadHealerSettings(): HealerSettings | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY) ?? null;
    if (raw === null) return null;
    const settings = parseHealerSettings(JSON.parse(raw));
    log.debug('Loaded Healer settings', settings);
    return settings;
  } catch (err) {
    log.warn('Could not load saved Healer settings', err);
    return null;
  }
}

export function saveHealerSettings(settings: HealerSettings): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    log.warn('Could not save Healer settings', err);
  }
}

/** Binds the input form to the healing rules and the Results panel. */
import { rollDie } from '../dice';
import { formatSigned } from '../format';
import { createLogger } from '../logger';
import {
  TIER_DC,
  allowedTiers,
  averageHealing,
  bestTier,
  checkBonus,
  continualRecoveryAllowed,
  fullHourAllowed,
  simulate,
  tierAllowed,
  treatDc,
  upgradesSuccess,
  type Roller,
} from '../rules/healing';
import {
  DC_TIERS,
  HEALER_FEATS,
  LIMITS,
  PROFICIENCIES,
  RULES_VERSIONS,
  type DcTier,
  type HealerFeat,
  type HealingInputs,
  type Proficiency,
  type RulesVersion,
} from '../rules/types';
import { loadHealerSettings, saveHealerSettings } from '../settings';
import { byId } from './dom';
import { createRangeInput, type RangeInput } from './rangeInput';
import {
  clearSimulation,
  clearSummary,
  renderSimulation,
  renderSummary,
} from './results';

const log = createLogger('form');

const FULL_HOUR_HINT =
  'On a success, keep treating for 1 hour to double the healing.';
const FULL_HOUR_LEGACY_HINT =
  'Remaster rule only; not available with the Legacy rules.';
const STALE_MESSAGE = 'The inputs changed. Roll again to see new results.';

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string,
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function range(
  id: string,
  label: string,
  min: number,
  max: number,
  onChange: () => void,
): RangeInput {
  return createRangeInput({
    text: byId(id, HTMLInputElement),
    slider: byId(`${id}-slider`, HTMLInputElement),
    error: byId(`${id}-error`, HTMLElement),
    label,
    min,
    max,
    onChange,
  });
}

export interface FormOptions {
  /** Dice roller; injected for tests. */
  readonly roll?: Roller;
}

export function initForm(opts: FormOptions = {}): void {
  const roll = opts.roll ?? rollDie;
  const rulesVersion = byId('rules-version', HTMLSelectElement);
  const proficiency = byId('proficiency', HTMLSelectElement);
  const dcTier = byId('dc-tier', HTMLSelectElement);
  const dcTierHint = byId('dc-tier-hint', HTMLElement);
  const fullHour = byId('full-hour', HTMLInputElement);
  const fullHourHint = byId('full-hour-hint', HTMLElement);
  const godless = byId('has-godless', HTMLInputElement);
  const toolkit = byId('has-toolkit', HTMLInputElement);
  const rollButton = byId('roll', HTMLButtonElement);
  const clearButton = byId('clear-rolls', HTMLButtonElement);
  const featBoxes: Readonly<Record<HealerFeat, HTMLInputElement>> = {
    continualRecovery: byId('has-continual', HTMLInputElement),
    riskySurgery: byId('has-risky', HTMLInputElement),
    mortalHealing: byId('has-mortal', HTMLInputElement),
    medicDedication: byId('has-medic', HTMLInputElement),
  };

  // Restore the saved Healer panel before the range inputs read it.
  const saved = loadHealerSettings();
  if (saved) {
    rulesVersion.value = saved.rulesVersion;
    proficiency.value = saved.proficiency;
    byId('bonus', HTMLInputElement).value = String(saved.bonus);
    toolkit.checked = saved.expandedToolkit;
    for (const feat of HEALER_FEATS) {
      featBoxes[feat].checked = saved.feats[feat];
    }
  }

  // Ignore change events fired while the inputs are being set up.
  let ready = false;
  // Whether a roll log is showing that matches the current inputs.
  let rolled = false;

  const update = (): void => {
    if (!ready) return;
    if (rolled) {
      rolled = false;
      clearSimulation(STALE_MESSAGE);
    }
    recalc();
  };

  function currentVersion(): RulesVersion {
    return oneOf<RulesVersion>(RULES_VERSIONS, rulesVersion.value, 'remaster');
  }

  function currentProficiency(): Proficiency {
    return oneOf<Proficiency>(PROFICIENCIES, proficiency.value, 'trained');
  }

  function currentFeats(): Record<HealerFeat, boolean> {
    return {
      continualRecovery: featBoxes.continualRecovery.checked,
      riskySurgery: featBoxes.riskySurgery.checked,
      mortalHealing: featBoxes.mortalHealing.checked,
      medicDedication: featBoxes.medicDedication.checked,
    };
  }

  /** Remember the Healer panel for the next visit. */
  const saveHealer = (): void => {
    if (!ready) return;
    saveHealerSettings({
      rulesVersion: currentVersion(),
      proficiency: currentProficiency(),
      bonus: bonus.value,
      expandedToolkit: toolkit.checked,
      feats: currentFeats(),
    });
  };

  const bonus = range(
    'bonus',
    'Medicine bonus',
    LIMITS.bonus.min,
    LIMITS.bonus.max,
    () => {
      saveHealer();
      update();
    },
  );
  const maxHp = range(
    'max-hp',
    'Max HP',
    LIMITS.maxHp.min,
    LIMITS.maxHp.max,
    () => {
      // May clamp current HP, which calls update() itself.
      currentHp.setMax(maxHp.value);
      update();
    },
  );
  const currentHp = range('current-hp', 'Current HP', 0, maxHp.value, update);
  const dcAdjust = range(
    'dc-adjust',
    'DC adjustment',
    LIMITS.dcAdjustment.min,
    LIMITS.dcAdjustment.max,
    update,
  );

  /** Only offer the DCs the healer's proficiency allows. */
  function applyTierLimits(): void {
    const rank = currentProficiency();
    for (const option of dcTier.options) {
      const tier = oneOf<DcTier>(DC_TIERS, option.value, 'trained');
      option.disabled = !tierAllowed(tier, rank);
    }
    const tier = oneOf<DcTier>(DC_TIERS, dcTier.value, 'trained');
    if (!tierAllowed(tier, rank)) {
      dcTier.value = allowedTiers(rank).at(-1) ?? 'trained';
    }
  }

  /** Continual Recovery needs expert Medicine. */
  function applyFeatRequirements(): void {
    const box = featBoxes.continualRecovery;
    const allowed = continualRecoveryAllowed(currentProficiency());
    box.disabled = !allowed;
    if (!allowed) box.checked = false;
  }

  /** Treating for a full hour is a Remaster rule. */
  function applyVersionRules(): void {
    const allowed = fullHourAllowed(currentVersion());
    fullHour.disabled = !allowed;
    if (!allowed) fullHour.checked = false;
    fullHourHint.textContent = allowed ? FULL_HOUR_HINT : FULL_HOUR_LEGACY_HINT;
  }

  applyTierLimits();
  applyFeatRequirements();
  applyVersionRules();

  function inputs(): HealingInputs {
    return {
      rulesVersion: currentVersion(),
      proficiency: currentProficiency(),
      bonus: bonus.value,
      expandedToolkit: toolkit.checked,
      feats: currentFeats(),
      tier: oneOf<DcTier>(DC_TIERS, dcTier.value, 'trained'),
      dcAdjustment: dcAdjust.value,
      fullHour: fullHour.checked,
      godless: godless.checked,
      currentHp: currentHp.value,
      maxHp: maxHp.value,
    };
  }

  function updateTierHint(current: HealingInputs): void {
    const best = bestTier(current);
    if (best === current.tier) {
      dcTierHint.textContent =
        allowedTiers(current.proficiency).length > 1
          ? 'This DC heals the most on average.'
          : 'Expert or better Medicine unlocks higher DCs.';
      return;
    }
    const rate = averageHealing({ ...current, tier: best }).perHour;
    dcTierHint.textContent =
      `DC ${TIER_DC[best] + current.dcAdjustment} heals more on average ` +
      `(${formatSigned(rate)} HP per hour).`;
  }

  function recalc(): void {
    const current = inputs();
    try {
      renderSummary({
        dc: treatDc(current),
        checkBonus: checkBonus(current),
        missingHp: current.maxHp - current.currentHp,
        upgrades: upgradesSuccess(current),
        average: averageHealing(current),
      });
      updateTierHint(current);
      rollButton.disabled = false;
      log.debug('Calculated', current);
    } catch (err) {
      log.error('Calculation failed', err);
      clearSummary();
      dcTierHint.textContent =
        'Something went wrong with that calculation. Please check the inputs.';
      rollButton.disabled = true;
    }
  }

  rollButton.addEventListener('click', () => {
    const current = inputs();
    try {
      const sim = simulate(current, roll);
      log.info(
        `Rolled ${sim.attempts.length} attempts: ${sim.end}, ` +
          `${sim.healed} HP in ${sim.minutes} min`,
      );
      renderSimulation(sim, current.maxHp);
      rolled = true;
    } catch (err) {
      log.error('Simulation failed', err);
      clearSimulation('Sorry, the rolls could not be made. Please try again.');
    }
  });

  clearButton.addEventListener('click', () => {
    rolled = false;
    clearSimulation();
  });

  rulesVersion.addEventListener('change', () => {
    applyVersionRules();
    saveHealer();
    update();
  });
  proficiency.addEventListener('change', () => {
    applyTierLimits();
    applyFeatRequirements();
    saveHealer();
    update();
  });
  for (const box of [toolkit, ...Object.values(featBoxes)]) {
    box.addEventListener('change', () => {
      saveHealer();
      update();
    });
  }
  for (const el of [dcTier, fullHour, godless]) {
    el.addEventListener('change', update);
  }
  // The form has no submit action; keep Enter from reloading the page.
  byId('inputs', HTMLFormElement).addEventListener('submit', (e) => {
    e.preventDefault();
  });

  ready = true;
  recalc();
  log.info('Calculator ready');
}

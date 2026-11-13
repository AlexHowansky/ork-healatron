import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Roller } from '../src/rules/healing';
import { STORAGE_KEY } from '../src/settings';
import { initForm } from '../src/ui/form';

const html = readFileSync('index.html', 'utf8');
const body = new DOMParser().parseFromString(html, 'text/html').body;

const el = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

function change(id: string, value: string | boolean): void {
  const input = el<HTMLInputElement>(id);
  if (typeof value === 'boolean') input.checked = value;
  else input.value = value;
  input.dispatchEvent(new Event(input.type === 'text' ? 'input' : 'change'));
}

/** Plays back the given rolls in order. */
function scripted(...rolls: number[]): Roller {
  let i = 0;
  return () => {
    const r = rolls[i];
    i += 1;
    if (r === undefined) throw new Error('Out of scripted rolls');
    return r;
  };
}

// jsdom has no modal dialogs; stand in for showModal() and close().
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.open = false;
};

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren(...Array.from(body.cloneNode(true).childNodes));
});

describe('Healer panel persistence', () => {
  it('restores saved settings on start', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rulesVersion: 'legacy',
        proficiency: 'master',
        bonus: 18,
        expandedToolkit: true,
        feats: { continualRecovery: true, medicDedication: true },
      }),
    );
    initForm();
    expect(el<HTMLSelectElement>('rules-version').value).toBe('legacy');
    expect(el<HTMLSelectElement>('proficiency').value).toBe('master');
    expect(el<HTMLInputElement>('bonus').value).toBe('18');
    expect(el<HTMLInputElement>('bonus-slider').value).toBe('18');
    expect(el<HTMLInputElement>('has-toolkit').checked).toBe(true);
    expect(el<HTMLInputElement>('has-continual').checked).toBe(true);
    expect(el<HTMLInputElement>('has-medic').checked).toBe(true);
    expect(el<HTMLInputElement>('has-risky').checked).toBe(false);
    // Legacy has no full-hour treatment.
    expect(el<HTMLInputElement>('full-hour').disabled).toBe(true);
  });

  it('saves changes to the Healer panel', () => {
    initForm();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    change('rules-version', 'legacy');
    change('proficiency', 'expert');
    change('bonus', '14');
    change('has-continual', true);
    change('has-toolkit', true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      rulesVersion: 'legacy',
      proficiency: 'expert',
      bonus: 14,
      expandedToolkit: true,
      feats: {
        continualRecovery: true,
        riskySurgery: false,
        mortalHealing: false,
        medicDedication: false,
      },
    });
  });
});

describe('form behaviour', () => {
  it('limits DCs and Continual Recovery by proficiency', () => {
    initForm();
    const tier = el<HTMLSelectElement>('dc-tier');
    expect(tier.options[1]?.disabled).toBe(true);
    expect(el<HTMLInputElement>('has-continual').disabled).toBe(true);
    change('proficiency', 'master');
    expect(tier.options[2]?.disabled).toBe(false);
    expect(tier.options[3]?.disabled).toBe(true);
    change('dc-tier', 'master');
    change('proficiency', 'expert');
    expect(tier.value).toBe('expert');
  });

  it('enables Robust Health from level 3', () => {
    initForm();
    const robust = el<HTMLInputElement>('has-robust');
    expect(robust.disabled).toBe(true);
    change('level', '3');
    expect(robust.disabled).toBe(false);
    change('has-robust', true);
    change('level', '2');
    expect(robust.disabled).toBe(true);
    expect(robust.checked).toBe(false);
  });

  it('keeps current HP within max HP', () => {
    initForm();
    change('max-hp', '10');
    expect(el<HTMLInputElement>('current-hp').value).toBe('10');
    expect(el<HTMLInputElement>('current-hp-slider').max).toBe('10');
  });

  it('shows the summary for the inputs', () => {
    initForm();
    change('bonus', '10');
    expect(el('out-dc').textContent).toBe('15');
    expect(el('out-bonus').textContent).toBe('+10');
    change('has-toolkit', true);
    expect(el('out-bonus').textContent).toBe('+11');
    expect(el('out-missing').textContent).toBe('40');
    expect(el('odds-list').children).toHaveLength(4);
  });

  it('says whether Risky Surgery helps', () => {
    initForm();
    const hint = (): string | null => el('has-risky-effect').textContent;
    const helps = (): boolean => el('risky-option').classList.contains('helps');
    expect(hint()).toBe(
      'With these inputs it raises the average by 1.8 HP per hour.',
    );
    expect(helps()).toBe(true);
    change('bonus', '20');
    expect(hint()).toBe(
      'With these inputs it lowers the average by 3.2 HP per hour.',
    );
    expect(helps()).toBe(false);
  });

  it('rolls until healed and logs each attempt', () => {
    // 20/60 HP, +5 vs DC 15. Attempt 1: d20 10 = 15 success, 2d8 8+8 = 16.
    // Attempt 2: d20 2 = 7 failure. Attempt 3: d20 20 crit, 4d8 = 32.
    initForm({ roll: scripted(10, 8, 8, 2, 20, 8, 8, 8, 8) });
    el<HTMLButtonElement>('roll').click();
    const rows = el('roll-log').children;
    expect(rows).toHaveLength(3);
    expect(rows[0]?.textContent).toContain('20 → 36');
    expect(rows[2]?.textContent).toContain('2:00');
    expect(el('out-attempts').textContent).toBe('3');
    expect(el('out-healed').textContent).toBe('+40');
    expect(el('out-time').textContent).toBe('2 hours 10 min');
    expect(el('roll-status').textContent).toContain('full HP');
    const dialog = el<HTMLDialogElement>('roll-dialog');
    expect(dialog.open).toBe(true);

    el<HTMLButtonElement>('roll-close').click();
    expect(dialog.open).toBe(false);
  });

  it('shows a friendly message in the dialog when rolling fails', () => {
    initForm({ roll: scripted() });
    el<HTMLButtonElement>('roll').click();
    expect(el<HTMLDialogElement>('roll-dialog').open).toBe(true);
    expect(el('roll-status').textContent).toContain('could not be made');
    expect(el('roll-totals').hidden).toBe(true);
  });
});

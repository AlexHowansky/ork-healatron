/** Writes healing results into the Results panel (textContent only). */
import {
  describeChange,
  formatAverage,
  formatClock,
  formatDuration,
  formatModifier,
  formatSigned,
} from '../format';
import type { AverageHealing, Attempt, Simulation } from '../rules/healing';
import { DEGREE_NAMES, type Degree } from '../rules/types';
import { byId } from './dom';

const pct = (p: number): string => `${Math.round(p * 100)}%`;

const DEGREE_CLASS: Readonly<Record<Degree, string>> = Object.freeze({
  criticalSuccess: 'cs',
  success: 's',
  failure: 'f',
  criticalFailure: 'cf',
});

function text(id: string, value: string): void {
  byId(id, HTMLElement).textContent = value;
}

export interface Summary {
  readonly dc: number;
  readonly checkBonus: number;
  readonly missingHp: number;
  readonly upgrades: boolean;
  readonly average: AverageHealing;
  /** Expected minutes to full HP at the average rate; null if never. */
  readonly minutesToHeal: number | null;
}

function renderOdds(s: Summary): void {
  const { odds } = s.average;
  const bar = byId('odds-bar', HTMLElement);
  const list = byId('odds-list', HTMLUListElement);
  const items = (Object.keys(DEGREE_CLASS) as Degree[]).map((degree) => {
    const cls = DEGREE_CLASS[degree];
    const seg = bar.querySelector<HTMLElement>(`.${cls}`);
    if (seg) seg.style.flexGrow = String(odds[degree]);
    const li = document.createElement('li');
    li.className = cls;
    const name = document.createElement('span');
    name.textContent = DEGREE_NAMES[degree];
    const value = document.createElement('strong');
    value.textContent = pct(odds[degree]);
    li.append(name, value);
    return li;
  });
  list.replaceChildren(...items);
  text(
    'out-check',
    `Rolling d20 ${formatModifier(s.checkBonus)} vs DC ${s.dc}` +
      (s.upgrades ? '; a success counts as a critical success.' : '.'),
  );
}

export function renderSummary(s: Summary): void {
  const a = s.average;
  text('out-dc', String(s.dc));
  text('out-bonus', formatSigned(s.checkBonus));
  text('out-missing', String(s.missingHp));
  text('out-per-hour', formatSigned(a.perHour));
  renderOdds(s);
  text('s-label', s.upgrades ? 'Success (counts as critical)' : 'Success');
  text('avg-cs', formatSigned(a.criticalSuccess));
  text('avg-s', formatSigned(s.upgrades ? a.criticalSuccess : a.success));
  text('avg-f', '0');
  text('avg-cf', formatSigned(-a.criticalFailureDamage));
  text('avg-attempt', formatSigned(a.perAttempt));
  text('avg-interval', formatDuration(a.minutesPerAttempt));
  text(
    'avg-heal-time',
    s.minutesToHeal === null
      ? 'Never (no net healing on average)'
      : formatDuration(s.minutesToHeal),
  );
  const note = byId('avg-note', HTMLElement);
  note.hidden = a.surgeryDamage === 0;
  note.textContent =
    a.surgeryDamage === 0
      ? ''
      : `Risky Surgery also deals 1d8 damage (average ` +
        `${formatAverage(a.surgeryDamage)}) every attempt; the average per ` +
        `attempt includes it.`;
}

/** Blank the outputs while the inputs are invalid. */
export function clearSummary(): void {
  for (const id of [
    'out-dc',
    'out-bonus',
    'out-missing',
    'out-per-hour',
    'avg-cs',
    'avg-s',
    'avg-f',
    'avg-cf',
    'avg-attempt',
    'avg-interval',
    'avg-heal-time',
  ]) {
    text(id, '-');
  }
  byId('odds-list', HTMLUListElement).replaceChildren();
  text('out-check', '');
  for (const seg of byId('odds-bar', HTMLElement).children) {
    (seg as HTMLElement).style.flexGrow = '0';
  }
  byId('avg-note', HTMLElement).hidden = true;
}

function cell(
  tag: 'td' | 'th',
  main: string,
  detail?: string,
  cls?: string,
): HTMLTableCellElement {
  const el = document.createElement(tag);
  if (tag === 'th') el.scope = 'row';
  const first = document.createElement('span');
  first.textContent = main;
  if (cls) first.className = cls;
  el.append(first);
  if (detail) {
    const small = document.createElement('span');
    small.className = 'detail';
    small.textContent = detail;
    el.append(small);
  }
  return el;
}

/** HP rolled for the attempt (before capping at 0 and max HP). */
function resultText(a: Attempt): string {
  if (a.degree === 'failure') return 'No effect';
  return `${formatSigned(a.change)} HP`;
}

function attemptRow(a: Attempt): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const bonus = a.checkTotal - a.d20;
  tr.append(
    cell('th', String(a.number)),
    cell('td', formatClock(a.startMinute)),
    cell(
      'td',
      DEGREE_NAMES[a.degree],
      `${a.d20} ${formatModifier(bonus)} = ${a.checkTotal}`,
      `degree ${DEGREE_CLASS[a.degree]}`,
    ),
    cell('td', resultText(a), describeChange(a)),
    cell('td', `${a.hpBefore} → ${a.hpAfter}`),
  );
  return tr;
}

const END_MESSAGES = Object.freeze({
  full: 'The target is at full HP.',
  down: 'The target was brought down to 0 HP and is dying.',
  limit: 'Stopped after too many attempts without reaching full HP.',
});

export function renderSimulation(sim: Simulation, maxHp: number): void {
  const status =
    sim.attempts.length === 0
      ? 'The target is already at full HP.'
      : `${END_MESSAGES[sim.end]} Final HP ${sim.endHp} / ${maxHp}.`;
  text('roll-status', status);
  text('out-attempts', String(sim.attempts.length));
  text('out-healed', formatSigned(sim.healed));
  text('out-time', formatDuration(sim.minutes));
  byId('roll-totals', HTMLElement).hidden = false;
  byId('roll-log', HTMLElement).replaceChildren(
    ...sim.attempts.map(attemptRow),
  );
  byId('roll-log-wrap', HTMLElement).hidden = sim.attempts.length === 0;
}

/** Show only a message in the roll results (e.g. when the rolls failed). */
export function renderSimulationError(message: string): void {
  text('roll-status', message);
  byId('roll-totals', HTMLElement).hidden = true;
  byId('roll-log', HTMLElement).replaceChildren();
  byId('roll-log-wrap', HTMLElement).hidden = true;
}

/** Text formatting for results; pure, no DOM. */
import type { Attempt } from './rules/healing';

/** "10 min", "1 hour", "2 hours 30 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0)
    parts.push(`${h.toLocaleString('en-US')} ${h === 1 ? 'hour' : 'hours'}`);
  if (m > 0 || h === 0) parts.push(`${m} min`);
  return parts.join(' ');
}

/** Clock offset from the start, "0:00", "1:10", "25:00". */
export function formatClock(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const m = total % 60;
  return `${Math.floor(total / 60)}:${String(m).padStart(2, '0')}`;
}

/** Signed whole or one-decimal number: "+12", "−3.5", "0". */
export function formatSigned(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  if (rounded === 0) return '0';
  const abs = Math.abs(rounded).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
  return rounded > 0 ? `+${abs}` : `−${abs}`;
}

/** Average as a number with at most one decimal. */
export function formatAverage(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('en-US', {
    maximumFractionDigits: 1,
  });
}

export function formatModifier(n: number): string {
  return n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`;
}

/** How the attempt's HP change was worked out; empty for a plain failure. */
export function describeChange(a: Attempt): string {
  const parts: string[] = [];
  if (a.surgeryDamage !== null) {
    parts.push(`surgery 1d8 (${a.surgeryDamage}) damage`);
  }
  const dice = `${a.dice.length}d8 (${a.dice.join(', ')})`;
  if (a.degree === 'criticalFailure') {
    parts.push(`${dice} damage`);
  } else if (a.degree !== 'failure') {
    let text = a.tierBonus > 0 ? `${dice} + ${a.tierBonus}` : dice;
    if (a.doubled) text = `(${text}) × 2`;
    if (a.flatBonus > 0) text += ` + ${a.flatBonus}`;
    parts.push(text);
  }
  return parts.join('; ');
}

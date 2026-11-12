/**
 * Fair dice from the browser's cryptographic random source. Rejection
 * sampling avoids the bias of a plain modulo.
 */
const RANGE = 2 ** 32;

export function rollDie(sides: number): number {
  if (!Number.isInteger(sides) || sides < 1) {
    throw new RangeError(`Invalid die size ${sides}`);
  }
  const limit = RANGE - (RANGE % sides);
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return (value % sides) + 1;
}

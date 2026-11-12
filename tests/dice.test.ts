import { describe, expect, it } from 'vitest';
import { rollDie } from '../src/dice';

describe('rollDie', () => {
  it('rolls within range and hits every face', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const r = rollDie(8);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(8);
      seen.add(r);
    }
    expect(seen.size).toBe(8);
  });

  it('rejects bad die sizes', () => {
    expect(() => rollDie(0)).toThrow(RangeError);
    expect(() => rollDie(2.5)).toThrow(RangeError);
  });
});

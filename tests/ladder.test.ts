/**
 * The distance-ladder model's shape, checked against itself.
 *
 * `physics.test.ts` runs the sanity block, which pins the model to the figures
 * the prose quotes. This checks the identities the sim and the prose lean on:
 * parallax is AU over distance exactly, the distance modulus is zero at 10 pc,
 * the H₀ offset and its inverse agree, and the rungs come back in ladder order.
 */
import { describe, expect, it } from 'vitest';
import { AU, H0_PLANCK_2018, PARSEC } from '@/physics/constants';
import { RUNGS, distanceModulus, inferredH0, offsetForH0Ratio, parallaxAngle, rungsAt } from '@/physics/ladder';

describe('ladder', () => {
  it('makes parallax × distance equal to 1 AU exactly', () => {
    for (const d of [PARSEC, 1.3 * PARSEC, 8.2e3 * PARSEC, 1e9 * PARSEC]) {
      expect(parallaxAngle(d) * d).toBe(AU);
    }
  });

  it('puts the distance modulus at zero at 10 pc, exactly', () => {
    expect(distanceModulus(10 * PARSEC)).toBe(0);
  });

  it('inverts the H₀ offset and its ratio', () => {
    for (const ratio of [0.9, 1, 1.1]) {
      const back = inferredH0(H0_PLANCK_2018, offsetForH0Ratio(ratio)) / H0_PLANCK_2018;
      expect(Math.abs(back / ratio - 1), `ratio ${ratio}`).toBeLessThanOrEqual(1e-12);
    }
  });

  it('returns rungs in ladder order', () => {
    const order = RUNGS.map((rung) => rung.id);
    for (let e = Math.log10(PARSEC); e <= Math.log10(1e9 * PARSEC) + 1e-9; e += 0.05) {
      const ids = rungsAt(10 ** e).map((rung) => rung.id);
      const positions = ids.map((id) => order.indexOf(id));
      expect(positions, `at 10^${e.toFixed(2)} m`).toEqual([...positions].sort((a, b) => a - b));
    }
  });
});

/**
 * The H II region model's shape, checked against itself.
 *
 * `physics.test.ts` runs the sanity block, which pins the model to the figures
 * the prose quotes. This checks the scalings the prose and the sim lean on
 * across the whole of both sliders: the Strömgren radius goes as Q^(1/3) and
 * n^(−2/3), the lit mass as Q/n, and Spitzer's expansion only ever grows.
 */
import { describe, expect, it } from 'vitest';
import { JULIAN_YEAR, PARSEC } from '@/physics/constants';
import { expansionRadius, ionizedMass, stromgrenRadius } from '@/physics/nebula';

const Q0 = 1e49;
const N0 = 1e8;
const EXACT = 1e-12;

describe('nebula', () => {
  it('scales the Strömgren radius as Q^(1/3), exactly', () => {
    for (const k of [1e-4, 0.1, 3, 10]) {
      const ratio = stromgrenRadius(k * Q0, N0) / stromgrenRadius(Q0, N0);
      expect(Math.abs(ratio / k ** (1 / 3) - 1), `Q × ${k}`).toBeLessThan(EXACT);
    }
  });

  it('scales the Strömgren radius as n^(−2/3), exactly', () => {
    for (const k of [0.01, 0.5, 10, 1000]) {
      const ratio = stromgrenRadius(Q0, k * N0) / stromgrenRadius(Q0, N0);
      expect(Math.abs(ratio / k ** (-2 / 3) - 1), `n × ${k}`).toBeLessThan(EXACT);
    }
  });

  it('lights a mass proportional to Q / n', () => {
    const base = ionizedMass(stromgrenRadius(Q0, N0), N0);
    const pairs: [number, number][] = [
      [10, 1],
      [1, 10],
      [1e-3, 1e-2],
      [100, 1000],
    ];
    for (const [q, n] of pairs) {
      const mass = ionizedMass(stromgrenRadius(q * Q0, n * N0), n * N0);
      expect(Math.abs(mass / base / (q / n) - 1), `Q × ${q}, n × ${n}`).toBeLessThan(1e-9);
    }
  });

  it('only ever grows the region with time', () => {
    for (const R of [0.01 * PARSEC, 3.15 * PARSEC, 100 * PARSEC]) {
      let previous = expansionRadius(R, 0);
      expect(previous).toBe(R);
      for (let e = 0; e <= 8; e += 0.05) {
        const radius = expansionRadius(R, 10 ** e * JULIAN_YEAR);
        expect(radius, `R_S = ${(R / PARSEC).toPrecision(3)} pc at 10^${e.toFixed(2)} yr`).toBeGreaterThan(previous);
        previous = radius;
      }
    }
  });
});

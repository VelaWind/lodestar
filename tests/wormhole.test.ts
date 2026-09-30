/**
 * The wormhole model's shape, checked against itself.
 *
 * `physics.test.ts` runs the sanity block, which pins the model to the figures
 * the prose quotes. This checks the scalings the sim and the copy lean on
 * across the whole slider: the negative mass grows in step with the throat,
 * the throat density falls as its square, the matching Casimir gap grows as
 * its square root, and the embedding surface climbs steadily away from the
 * throat.
 */
import { describe, expect, it } from 'vitest';
import { casimirGapForThroat, embeddingHeight, exoticMass, throatDensity } from '@/physics/wormhole';

/** Throat radii across the slider, a millimetre to 10¹³ m (about seventy AU), one decade apart. */
const RADII = Array.from({ length: 17 }, (_, i) => 10 ** (i - 3));

describe('wormhole', () => {
  it('needs negative mass in step with the throat', () => {
    for (const b0 of RADII) {
      expect(exoticMass(b0)).toBeLessThan(0);
      expect(exoticMass(10 * b0) / exoticMass(b0), `b0 = ${b0}`).toBeCloseTo(10, 10);
    }
  });

  it('thins its throat density as the square of the throat', () => {
    for (const b0 of RADII) {
      expect(throatDensity(b0)).toBeLessThan(0);
      expect(throatDensity(10 * b0) / throatDensity(b0), `b0 = ${b0}`).toBeCloseTo(0.01, 12);
    }
  });

  it('widens the matching Casimir gap as the square root of the throat', () => {
    for (const b0 of RADII) {
      expect(casimirGapForThroat(100 * b0) / casimirGapForThroat(b0), `b0 = ${b0}`).toBeCloseTo(10, 10);
    }
  });

  it('climbs steadily away from the throat', () => {
    for (const b0 of [1e-3, 1, 6.371e6]) {
      let previous = -Infinity;
      for (let k = 0; k <= 200; k += 1) {
        const z = embeddingHeight(b0 * (1 + k * 0.02), b0);
        expect(z, `b0 = ${b0}, r = ${1 + k * 0.02} b0`).toBeGreaterThan(previous);
        previous = z;
      }
      expect(embeddingHeight(b0, b0)).toBe(0);
    }
  });
});

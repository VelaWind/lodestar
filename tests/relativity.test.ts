/**
 * The time-dilation model's shape, checked against itself.
 *
 * `physics.test.ts` runs the sanity block, which pins the model to the figures
 * the prose quotes. This checks the properties the sim depends on across both
 * sliders: the cancellation-free clock deficit agrees with the naive form
 * wherever the naive form is trustworthy, stays positive and rising down to
 * walking pace where the naive form collapses, and the gravitational rate
 * climbs from zero at the horizon.
 */
import { describe, expect, it } from 'vitest';
import { C, M_DEMO_BH } from '@/physics/constants';
import { schwarzschildRadius } from '@/physics/blackhole';
import { clockDeficit, gravitationalRate, lorentzFactor } from '@/physics/relativity';

describe('relativity', () => {
  it('agrees with 1 − 1/γ where that form is well conditioned', () => {
    for (let beta = 0.01; beta <= 0.9 + 1e-9; beta += 0.01) {
      const v = beta * C;
      const naive = 1 - 1 / lorentzFactor(v);
      // 1e-12, or the naive form's own rounding error where that is larger: its
      // subtraction from 1 leaves about ε / (1 − 1/γ) of relative error, 4e-12
      // at β = 0.01. The disagreement there is the naive form's, not this one's.
      const tolerance = Math.max(1e-12, (4 * Number.EPSILON) / naive);
      expect(Math.abs(clockDeficit(v) / naive - 1), `β = ${beta.toFixed(2)}`).toBeLessThanOrEqual(tolerance);
    }
  });

  it('keeps the clock deficit positive and rising from walking pace up', () => {
    let previous = 0;
    for (let e = 0; e <= Math.log10(0.99999 * C) + 1e-9; e += 0.01) {
      const deficit = clockDeficit(Math.min(0.99999 * C, 10 ** e));
      expect(deficit, `v = 10^${e.toFixed(2)} m/s`).toBeGreaterThan(previous);
      previous = deficit;
    }
    // At 1 m/s the naive form is lost in rounding; this one is not.
    expect(clockDeficit(1)).toBeGreaterThan(5e-18);
  });

  it('raises the clock rate with distance, from zero at the horizon', () => {
    const rs = schwarzschildRadius(M_DEMO_BH);
    expect(gravitationalRate(M_DEMO_BH, rs)).toBe(0);
    let previous = 0;
    for (let e = 0.001; e <= 7; e += 0.01) {
      const rate = gravitationalRate(M_DEMO_BH, rs * 10 ** e);
      expect(rate, `r = 10^${e.toFixed(3)} r_s`).toBeGreaterThan(previous);
      previous = rate;
    }
  });
});

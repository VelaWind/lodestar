/**
 * The fusion model's shape, checked against itself.
 *
 * `physics.test.ts` runs the sanity block, which pins the model to the solar
 * figures the prose quotes. This checks the properties the sim's top panel
 * depends on: the two factors move in opposite directions, their product peaks
 * where the Gamow formula says, and the rate scales with density and hydrogen
 * fraction exactly as its formula is written.
 */
import { describe, expect, it } from 'vitest';
import { EV } from '@/physics/constants';
import {
  PP_GAMOW_ENERGY,
  boltzmannFraction,
  gamowPeak,
  ppEnergyRate,
  tunnellingProbability,
} from '@/physics/fusion';

const keV = 1e3 * EV;

describe('fusion', () => {
  it('makes tunnelling more likely at every higher energy from 1 to 100 keV', () => {
    let previous = 0;
    for (let E = 1; E <= 100; E += 0.25) {
      const p = tunnellingProbability(PP_GAMOW_ENERGY, E * keV);
      expect(p, `P not rising at ${E} keV`).toBeGreaterThan(previous);
      previous = p;
    }
  });

  it('makes each higher energy rarer', () => {
    for (const T of [1e6, 1.57e7, 1e8]) {
      let previous = Infinity;
      for (let E = 0; E <= 100; E += 0.25) {
        const f = boltzmannFraction(E * keV, T);
        // Strictly falling while representable; at 10⁶ K the factor underflows
        // to exactly 0 past about 60 keV, and 0 then stays 0.
        if (previous > 0) expect(f, `f not falling at ${E} keV, T = ${T} K`).toBeLessThan(previous);
        else expect(f).toBe(0);
        previous = f;
      }
    }
  });

  it('peaks the product within 3% of the Gamow peak', () => {
    for (const T of [1e7, 3e7]) {
      let best = 0;
      let bestE = 0;
      for (let E = 0.01; E <= 100; E += 0.001) {
        const product = boltzmannFraction(E * keV, T) * tunnellingProbability(PP_GAMOW_ENERGY, E * keV);
        if (product > best) {
          best = product;
          bestE = E;
        }
      }
      const E0 = gamowPeak(PP_GAMOW_ENERGY, T) / keV;
      expect(Math.abs(bestE / E0 - 1), `T = ${T} K: grid peak ${bestE} keV vs E₀ ${E0} keV`).toBeLessThan(0.03);
    }
  });

  it('scales the pp rate as ρ¹ and X² exactly', () => {
    const T = 1.57e7;
    const base = ppEnergyRate(1e5, 0.3, T);
    expect(ppEnergyRate(2e5, 0.3, T) / base).toBeCloseTo(2, 12);
    expect(ppEnergyRate(1e5, 0.6, T) / base).toBeCloseTo(4, 12);
    expect(ppEnergyRate(3e5, 0.9, T) / base).toBeCloseTo(27, 10);
  });
});

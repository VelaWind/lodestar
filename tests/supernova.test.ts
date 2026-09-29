/**
 * The supernova model's shape, checked against itself.
 *
 * `physics.test.ts` runs the sanity block, which pins the model to the figures
 * the prose quotes. This checks the properties the sim depends on across the
 * whole slider: fates only ever get heavier with mass, no remnant outweighs its
 * star, and the magnitude formula and its inverse agree.
 */
import { describe, expect, it } from 'vitest';
import { M_IA_PEAK, M_SUN } from '@/physics/constants';
import {
  apparentMagnitude,
  distanceForMagnitude,
  fate,
  remnantMass,
  type Fate,
} from '@/physics/supernova';

const ORDER: Fate[] = ['white-dwarf', 'neutron-star', 'black-hole'];

describe('supernova', () => {
  it('never returns an earlier fate for a larger mass', () => {
    let previous = 0;
    for (let e = Math.log10(0.5); e <= Math.log10(100) + 1e-9; e += 0.001) {
      const index = ORDER.indexOf(fate(10 ** e * M_SUN));
      expect(index, `fate went backwards at ${(10 ** e).toFixed(3)} M☉`).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
    expect(previous, 'the sweep should end in the heaviest fate').toBe(ORDER.length - 1);
  });

  it('never leaves a remnant heavier than the star', () => {
    // It jumps at the fate boundaries by design; it must never exceed M.
    for (let e = Math.log10(0.5); e <= Math.log10(100) + 1e-9; e += 0.001) {
      const M = 10 ** e * M_SUN;
      expect(remnantMass(M), `remnant exceeds the star at ${(10 ** e).toFixed(3)} M☉`).toBeLessThanOrEqual(M);
    }
  });

  it('inverts apparent magnitude and distance', () => {
    for (const m of [-13, 0, 20]) {
      const back = apparentMagnitude(M_IA_PEAK, distanceForMagnitude(M_IA_PEAK, m));
      expect(Math.abs(back - m) / Math.max(1, Math.abs(m)), `m = ${m} came back as ${back}`).toBeLessThanOrEqual(1e-9);
    }
  });
});

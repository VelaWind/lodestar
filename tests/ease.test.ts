/**
 * The shared easing helper every canvas tween runs on.
 *
 * It was copied into six sims before it moved to `src/motion/ease.ts`; these
 * pin the properties those tweens depend on, so the one copy cannot drift.
 */
import { describe, expect, it } from 'vitest';
import { eased } from '@/motion/ease';
import { EASE } from '@/motion/tokens';

describe('eased', () => {
  it('starts at 0 and ends at 1 on every token curve', () => {
    for (const curve of Object.values(EASE)) {
      expect(eased(curve, 0)).toBeCloseTo(0, 6);
      expect(eased(curve, 1)).toBeCloseTo(1, 6);
    }
  });

  it('is the identity on the linear curve', () => {
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) expect(eased(EASE.linear, p)).toBeCloseTo(p, 6);
  });

  it('never runs backwards', () => {
    for (const curve of Object.values(EASE)) {
      let previous = -Infinity;
      for (let i = 0; i <= 100; i += 1) {
        const y = eased(curve, i / 100);
        expect(y).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = y;
      }
    }
  });

  it('decelerates on `out` and is symmetric on `inOut`', () => {
    expect(eased(EASE.out, 0.5)).toBeGreaterThan(0.5);
    for (const p of [0.1, 0.3, 0.45]) {
      expect(eased(EASE.inOut, p) + eased(EASE.inOut, 1 - p)).toBeCloseTo(1, 5);
    }
  });
});

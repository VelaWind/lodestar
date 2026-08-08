/**
 * The starfield's arithmetic, and the one thing about it that is not a matter
 * of taste: how bright it is allowed to get behind text.
 *
 * The drawing is checked the same way every sim's drawing is checked — against
 * the recording context in `tests/helpers/`, which draws nothing and remembers
 * everything. A single NaN in a canvas path silently drops the rest of it with
 * no error anywhere, and that stub is how this repo finds those.
 *
 * The contrast block at the bottom is the part worth reading. It recomputes the
 * WCAG ratios from the actual token colours and the actual `MAX_ALPHA` rather
 * than asserting a number somebody wrote in a comment once, so raising the cap
 * fails the suite instead of quietly failing readers.
 */
import { describe, expect, it } from 'vitest';

import {
  AREA_PER_STAR,
  MAX_ALPHA,
  MAX_STARS,
  MIN_STARS,
  PARALLAX,
  STAR_COLOR,
  drawStars,
  generateStars,
  starCount,
} from '@/visual/stars';
import { DISTANCE } from '@/motion/tokens';
import { describeRecord, nonFiniteDraws, recordingContext } from './helpers/recordingContext';
import { INK, INK_DIM, INK_FAINT, VOID_900, composite, contrast } from './helpers/contrast';

/** The viewports the clamp is specified against, plus the two common desktops. */
const PHONE = { width: 320, height: 568 };
const UHD = { width: 3840, height: 2160 };
const LAPTOP = { width: 1280, height: 800 };

const SEED = 0x10de57a2;

describe('generateStars', () => {
  it('is deterministic for a fixed seed', () => {
    const a = generateStars(SEED, LAPTOP.width, LAPTOP.height);
    const b = generateStars(SEED, LAPTOP.width, LAPTOP.height);

    expect(a).toHaveLength(b.length);
    // Deep equality across every field, not just the count: a generator that
    // drew its coordinates in a different order would still match on length.
    expect(a).toEqual(b);
  });

  it('produces a different field for a different seed', () => {
    const a = generateStars(SEED, LAPTOP.width, LAPTOP.height);
    const b = generateStars(SEED + 1, LAPTOP.width, LAPTOP.height);
    expect(a).not.toEqual(b);
  });

  it('keeps every coordinate, radius and alpha finite and in bounds', () => {
    for (const { width, height } of [PHONE, LAPTOP, UHD]) {
      const stars = generateStars(SEED, width, height);

      for (const star of stars) {
        expect(Number.isFinite(star.x)).toBe(true);
        expect(Number.isFinite(star.y)).toBe(true);
        expect(Number.isFinite(star.radius)).toBe(true);
        expect(Number.isFinite(star.baseAlpha)).toBe(true);
        expect(Number.isFinite(star.twinklePhase)).toBe(true);

        expect(star.x).toBeGreaterThanOrEqual(0);
        expect(star.x).toBeLessThanOrEqual(width);
        expect(star.y).toBeGreaterThanOrEqual(0);
        expect(star.y).toBeLessThanOrEqual(height);

        expect(star.radius).toBeGreaterThan(0);
        expect(star.baseAlpha).toBeGreaterThan(0);
        // The ceiling the contrast argument rests on.
        expect(star.baseAlpha).toBeLessThanOrEqual(MAX_ALPHA);

        expect([0, 1, 2]).toContain(star.depth);
      }
    }
  });

  it('respects the [80, 420] clamp at both ends', () => {
    // 320 × 568 = 181 760 px², which is 20 stars by area alone — floored to 80.
    expect(starCount(PHONE.width, PHONE.height)).toBe(MIN_STARS);
    expect(generateStars(SEED, PHONE.width, PHONE.height)).toHaveLength(MIN_STARS);

    // 3840 × 2160 = 8 294 400 px², which is 922 by area — capped at 420.
    expect(starCount(UHD.width, UHD.height)).toBe(MAX_STARS);
    expect(generateStars(SEED, UHD.width, UHD.height)).toHaveLength(MAX_STARS);
  });

  it('scales with area between the clamps', () => {
    const expected = Math.round((LAPTOP.width * LAPTOP.height) / AREA_PER_STAR);
    expect(expected).toBeGreaterThan(MIN_STARS);
    expect(expected).toBeLessThan(MAX_STARS);
    expect(starCount(LAPTOP.width, LAPTOP.height)).toBe(expected);
  });

  it('puts more stars in the far layers than the near ones', () => {
    const stars = generateStars(SEED, UHD.width, UHD.height);
    const counts = [0, 0, 0];
    for (const star of stars) counts[star.depth] = (counts[star.depth] ?? 0) + 1;

    expect(counts[0]).toBeGreaterThan(counts[1] ?? 0);
    expect(counts[1]).toBeGreaterThan(counts[2] ?? 0);
    // Nearer layers are brighter and larger, which is what reads as depth.
    const meanAlpha = (depth: 0 | 1 | 2) => {
      const layer = stars.filter((s) => s.depth === depth);
      return layer.reduce((sum, s) => sum + s.baseAlpha, 0) / layer.length;
    };
    expect(meanAlpha(2)).toBeGreaterThan(meanAlpha(1));
    expect(meanAlpha(1)).toBeGreaterThan(meanAlpha(0));
  });
});

describe('drawStars', () => {
  /** The extremes the component can hand it: both offsets at full travel. */
  const OFFSETS = [
    [0, 0],
    [DISTANCE.drift, -DISTANCE.drift],
    [-DISTANCE.drift, DISTANCE.drift * 2],
  ] as const;

  it('draws only finite geometry, at every offset and both twinkle states', () => {
    for (const { width, height } of [PHONE, LAPTOP, UHD]) {
      const stars = generateStars(SEED, width, height);

      for (const [offsetX, offsetY] of OFFSETS) {
        for (const twinkle of [false, true]) {
          for (const timeMs of [0, 16, 5_000, 3_600_000]) {
            const { ctx, records } = recordingContext();
            drawStars(ctx, stars, offsetX, offsetY, timeMs, twinkle);

            expect(records).toHaveLength(stars.length);
            const bad = nonFiniteDraws(records);
            expect(
              bad.length,
              `non-finite draw at ${width}×${height} offset ${offsetX},${offsetY} t=${timeMs}: ${bad
                .slice(0, 3)
                .map(describeRecord)
                .join(' · ')}`,
            ).toBe(0);
          }
        }
      }
    }
  });

  it('never sets an alpha above MAX_ALPHA, twinkling or not', () => {
    const stars = generateStars(SEED, LAPTOP.width, LAPTOP.height);

    for (const twinkle of [false, true]) {
      for (const timeMs of [0, 250, 1_500, 12_345]) {
        const { ctx } = recordingContext();
        // The stub holds `globalAlpha` as a plain property, so a defined
        // accessor records every value the draw loop assigns to it.
        const alphas: number[] = [];
        let current = 1;
        Object.defineProperty(ctx, 'globalAlpha', {
          get: () => current,
          set: (value: number) => {
            current = value;
            alphas.push(value);
          },
        });

        drawStars(ctx, stars, 0, 0, timeMs, twinkle);

        // One per star, plus the reset to 1 at the end.
        expect(alphas).toHaveLength(stars.length + 1);
        expect(alphas[alphas.length - 1]).toBe(1);
        for (let i = 0; i < alphas.length - 1; i += 1) {
          const alpha = alphas[i] ?? Number.NaN;
          expect(Number.isFinite(alpha)).toBe(true);
          expect(alpha).toBeGreaterThan(0);
          expect(alpha).toBeLessThanOrEqual(MAX_ALPHA);
        }
        // Twinkling only ever removes light.
        if (!twinkle) expect(Math.max(...alphas.slice(0, -1))).toBeLessThanOrEqual(MAX_ALPHA);
      }
    }
  });

  it('moves nearer layers further than far ones', () => {
    const stars = generateStars(SEED, LAPTOP.width, LAPTOP.height);
    const still = recordingContext();
    const shifted = recordingContext();

    drawStars(still.ctx, stars, 0, 0, 0, false);
    drawStars(shifted.ctx, stars, 100, 0, 0, false);

    // Records come out in star order, so index i is star i in both runs.
    const shiftFor = (depth: 0 | 1 | 2) => {
      const i = stars.findIndex((s) => s.depth === depth);
      return (shifted.records[i]?.x0 ?? 0) - (still.records[i]?.x0 ?? 0);
    };

    expect(shiftFor(0)).toBeCloseTo(100 * PARALLAX[0], 6);
    expect(shiftFor(1)).toBeCloseTo(100 * PARALLAX[1], 6);
    expect(shiftFor(2)).toBeCloseTo(100 * PARALLAX[2], 6);
  });

  it('leaves the context usable, with alpha reset', () => {
    const { ctx } = recordingContext();
    drawStars(ctx, generateStars(SEED, LAPTOP.width, LAPTOP.height), 0, 0, 0, true);
    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.fillStyle).toBe(STAR_COLOR);
  });
});

/* ---------------------------------------------------------------- contrast */

describe('starfield contrast', () => {
  /**
   * Two of the brightest stars overlapping. Source-over twice is
   * `1 − (1 − a)²`, and at ~420 stars in a laptop viewport an overlapping pair
   * is not a freak event — it is roughly one pair per screen.
   */
  const WORST_ALPHA = 1 - (1 - MAX_ALPHA) ** 2;

  it('keeps body prose at AA over the brightest possible star', () => {
    const single = composite(STAR_COLOR, VOID_900, MAX_ALPHA);
    const overlap = composite(STAR_COLOR, VOID_900, WORST_ALPHA);

    expect(contrast(INK_DIM, single)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(INK_DIM, overlap)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps every other text tone at AA too', () => {
    const overlap = composite(STAR_COLOR, VOID_900, WORST_ALPHA);
    for (const tone of [INK, INK_DIM, INK_FAINT]) {
      expect(contrast(tone, overlap)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reports the worst case, so a regression is readable in the diff', () => {
    const overlap = composite(STAR_COLOR, VOID_900, WORST_ALPHA);
    const table = {
      'ink over void-900': Number(contrast(INK, VOID_900).toFixed(2)),
      'ink over worst star': Number(contrast(INK, overlap).toFixed(2)),
      'ink-dim over void-900': Number(contrast(INK_DIM, VOID_900).toFixed(2)),
      'ink-dim over worst star': Number(contrast(INK_DIM, overlap).toFixed(2)),
      'ink-faint over void-900': Number(contrast(INK_FAINT, VOID_900).toFixed(2)),
      'ink-faint over worst star': Number(contrast(INK_FAINT, overlap).toFixed(2)),
    };
    console.log('starfield worst-case contrast', table);
    expect(table['ink-dim over worst star']).toBeGreaterThanOrEqual(4.5);
  });
});

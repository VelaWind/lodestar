/**
 * The starfield, as arithmetic. No DOM, no canvas element, no React.
 *
 * Named `stars.ts` rather than `starfield.ts`, which is what it wants to be
 * called: the component beside it is `Starfield.tsx`, and on a case-insensitive
 * filesystem the two stems collide — both `tsc` and Rollup resolve
 * `@/visual/Starfield` to this file and then report that it does not export a
 * `Starfield`. Verified, not guessed. The split is honest anyway: this module is
 * the stars, that one is the canvas they are painted on.
 *
 * This is decorative and makes no claim to be a sky. Nothing here is a real
 * catalogue position, a real magnitude or a real colour temperature, and it is
 * deliberately kept out of `src/physics/` so that it can never be mistaken for
 * one — the promise the site makes about its numbers belongs to the sims, and
 * the way to keep that promise credible is to make the ornament obviously
 * ornamental.
 *
 * Two constraints shaped the rest of it:
 *
 *   - **Deterministic.** Stars come from a seeded generator, so a given seed and
 *     viewport always produce the same field. That is what makes it testable at
 *     all, and it also means a resize regenerates the *same* sky rather than
 *     reshuffling it under the reader.
 *   - **Bounded brightness.** `MAX_ALPHA` is not a taste setting. Body prose is
 *     painted straight over this canvas with no panel behind it, so every star
 *     is background for text, and the cap is what keeps that text at WCAG AA.
 *     See the note on `MAX_ALPHA` before changing it.
 */

/** One star, in CSS pixels, in the coordinate space of the canvas it belongs to. */
export interface Star {
  x: number;
  y: number;
  radius: number;
  depth: 0 | 1 | 2;
  baseAlpha: number;
  /** Radians, fixed per star, so neighbours do not pulse in unison. */
  twinklePhase: number;
}

/** CSS px² of viewport per star, before the clamp. */
export const AREA_PER_STAR = 9000;
export const MIN_STARS = 80;
export const MAX_STARS = 420;

/** How much of the scroll and pointer offset each depth layer takes. */
export const PARALLAX = [0.15, 0.35, 0.7] as const;

/**
 * The alpha of the brightest possible star pixel.
 *
 * Derived, not chosen. Prose on this site is `ink-dim` (#98a2b8) and the muted
 * UI tone is `ink-faint` (#858ea2), both painted over `void-900` (#06080d) with
 * nothing between them and this canvas. A star behind a glyph lightens that
 * glyph's background and therefore *lowers* the contrast ratio of light text on
 * a dark page. At this cap the worst case — two of the brightest stars
 * overlapping directly behind the most muted text on the site — still clears
 * 4.5:1. Raising it breaks WCAG AA before it looks noticeably better; the
 * existing radial wash in `AppShell` runs at 0.07 for the same reason.
 *
 * `tests/starfield.test.ts` recomputes the ratios rather than trusting this
 * comment.
 */
export const MAX_ALPHA = 0.07;

/** Pale blue-white. Kept as one string so the draw loop sets `fillStyle` once. */
export const STAR_COLOR = '#dfe9ff';

/**
 * Per-depth generation ranges. `weight` is the share of stars in each layer:
 * mostly far and faint, a few near and bright, which is what reads as depth.
 * Nearer layers are larger and brighter, and the alpha ranges are expressed as
 * fractions of `MAX_ALPHA` so the contrast cap has exactly one source.
 */
const DEPTH_LAYERS = [
  { weight: 0.52, radius: [0.4, 0.8], alpha: [0.32, 0.55] },
  { weight: 0.33, radius: [0.7, 1.1], alpha: [0.55, 0.78] },
  { weight: 0.15, radius: [1.0, 1.5], alpha: [0.78, 1.0] },
] as const;

/**
 * How deeply a star dims at the bottom of its twinkle, as a fraction of its own
 * base alpha. Twinkling only ever *removes* light — a star is at `baseAlpha` at
 * its brightest and never above it, which is what lets `MAX_ALPHA` be a real
 * ceiling rather than an average.
 */
const TWINKLE_DEPTH = 0.45;

/** Radians per millisecond. A full cycle every ~7 seconds. */
const TWINKLE_RATE = 0.0009;

const TAU = Math.PI * 2;

/**
 * mulberry32 — 32 bits of state, one multiply-xor round, uniform on [0, 1).
 *
 * Inlined rather than depended on. It is nine lines, it has no cryptographic
 * job to do, and a decorative background is not a reason to add a package.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** How many stars a viewport of this size gets, area-scaled and clamped. */
export function starCount(width: number, height: number): number {
  const byArea = Math.round((width * height) / AREA_PER_STAR);
  return Math.min(MAX_STARS, Math.max(MIN_STARS, byArea));
}

/**
 * The field for one viewport. Same seed and size in, same stars out — always.
 *
 * Every coordinate lands inside `[0, width] × [0, height]`. The draw step shifts
 * stars by at most a few tens of pixels for parallax and does not wrap, so the
 * field thins very slightly at whichever edge it is pulled away from; that is
 * cheaper and quieter than wrapping, which makes stars pop in and out at the
 * seam.
 */
export function generateStars(seed: number, width: number, height: number): Star[] {
  const random = mulberry32(seed);
  const total = starCount(width, height);
  const stars: Star[] = new Array<Star>(total);

  for (let i = 0; i < total; i += 1) {
    // Pick the layer first: the draws that follow have to come from the same
    // stream in the same order every time, or determinism is only skin deep.
    const roll = random();
    // Starts at the last layer, so a `roll` that rounding leaves above the final
    // cumulative weight lands somewhere real instead of falling off the end.
    let depth: 0 | 1 | 2 = 2;
    let cumulative = 0;
    for (let d = 0; d < DEPTH_LAYERS.length; d += 1) {
      cumulative += DEPTH_LAYERS[d]?.weight ?? 0;
      if (roll < cumulative) {
        depth = d as 0 | 1 | 2;
        break;
      }
    }

    const layer = DEPTH_LAYERS[depth] ?? DEPTH_LAYERS[0];
    const [rMin, rMax] = layer.radius;
    const [aMin, aMax] = layer.alpha;

    stars[i] = {
      x: random() * width,
      y: random() * height,
      radius: rMin + random() * (rMax - rMin),
      depth,
      baseAlpha: MAX_ALPHA * (aMin + random() * (aMax - aMin)),
      twinklePhase: random() * TAU,
    };
  }

  return stars;
}

/**
 * Paint the field, offset for parallax and modulated for twinkle.
 *
 * Runs up to sixty times a second for the life of the page, so it allocates
 * nothing: no closures, no destructuring of the star, no `for…of`, no `map` or
 * `filter`, and — the one that actually matters — no per-star colour string.
 * `fillStyle` is a string assignment and would mint one object per star per
 * frame; setting the colour once and varying `globalAlpha`, which is a number,
 * is what keeps this off the garbage collector entirely.
 */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  offsetX: number,
  offsetY: number,
  timeMs: number,
  twinkle: boolean,
): void {
  ctx.fillStyle = STAR_COLOR;

  for (let i = 0; i < stars.length; i += 1) {
    const star = stars[i];
    if (!star) continue;

    const parallax = PARALLAX[star.depth] ?? 0;

    let alpha = star.baseAlpha;
    if (twinkle) {
      // 0…1, so the star sits between `(1 − TWINKLE_DEPTH) × baseAlpha` and
      // `baseAlpha`. Never brighter than its base — see MAX_ALPHA.
      const wave = 0.5 + 0.5 * Math.sin(timeMs * TWINKLE_RATE + star.twinklePhase);
      alpha = star.baseAlpha * (1 - TWINKLE_DEPTH + TWINKLE_DEPTH * wave);
    }

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(star.x + offsetX * parallax, star.y + offsetY * parallax, star.radius, 0, TAU);
    ctx.fill();
  }

  // Explicit, rather than `save`/`restore` around the loop: this canvas has one
  // writer and the pair would cost a state push per frame for nothing.
  ctx.globalAlpha = 1;
}

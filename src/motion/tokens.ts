/**
 * The vocabulary every later visual pass animates in.
 *
 * The point of this file is not that these particular numbers are special — it
 * is that there is exactly one place they can be changed. A reveal that eases
 * over 400 ms and a hover that settles over 150 ms should still read as one
 * hand; they only do that if the durations come from a shared set rather than
 * from whatever each call site felt like typing. So: no literal duration,
 * easing or offset anywhere in `src/motion/` or in the passes that build on it.
 * If a value is missing here, add it here.
 *
 * Units are fixed and unitless in the types: `DURATION` is milliseconds,
 * `DISTANCE` is CSS pixels, `EASE` is the four control-point coordinates of a
 * cubic Bézier in the order `x1, y1, x2, y2`. That tuple shape is the one
 * Framer Motion takes directly as an `ease` array, and it serialises to CSS as
 * `cubic-bezier(x1, y1, x2, y2)` — the same four numbers either way, which is
 * why the tokens can back a CSS transition and a Framer transition at once.
 */

/**
 * Milliseconds. `instant` exists so "no animation" can be spelled with a token
 * rather than by omitting the transition, which keeps reduced-motion branches
 * shaped like the normal ones.
 */
export const DURATION = {
  instant: 0,
  fast: 150,
  base: 250,
  slow: 400,
  ambient: 800,
} as const;

/** Cubic Bézier control points, `[x1, y1, x2, y2]`. */
export type Bezier = readonly [number, number, number, number];

/**
 * `out` decelerates hard — the curve for anything arriving (entrances,
 * reveals, tooltips). `inOut` is symmetric, for anything moving between two
 * states it will move back from. `linear` is the identity curve, for continuous
 * ambient motion where an ease would make a loop visibly pulse.
 */
export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  linear: [0, 0, 1, 1],
} as const satisfies Record<string, Bezier>;

/**
 * CSS pixels of travel. Deliberately small: an entrance that moves further than
 * `drift` stops reading as the element settling into place and starts reading
 * as the element flying in from somewhere else.
 */
export const DISTANCE = {
  nudge: 4,
  rise: 16,
  drift: 32,
} as const;

export type DurationToken = keyof typeof DURATION;
export type EaseToken = keyof typeof EASE;
export type DistanceToken = keyof typeof DISTANCE;

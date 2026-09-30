/**
 * Slider grids that pass exactly through a param's default.
 *
 * A range input only stops at `min + k · step`. When a default is a physical
 * anchor (the Earth's mass, ten Suns, 410 Mpc) that grid usually misses it, and
 * the first arrow press or drag snaps the reader a fraction of a step away.
 * For a log slider the fix is to keep the default, the maximum and the number
 * of steps, and nudge the minimum by a fraction of a step so the default lands
 * on step `index`. The modules use it only where that nudge is under 1%.
 *
 * Pure arithmetic on SI values; the Param type is unchanged.
 */

/**
 * The minimum, in the param's SI unit, that puts `defaultValue` exactly on step
 * `index` of `steps` equal log steps ending at `max`.
 *
 *     log d = log min + index · (log max − log min) / steps
 */
export function logMinThrough(defaultValue: number, max: number, steps: number, index: number): number {
  const ld = Math.log10(defaultValue);
  const lmax = Math.log10(max);
  return 10 ** ((steps * ld - index * lmax) / (steps - index));
}

/**
 * The step, in decades, of `steps` equal log steps from `min` to `max`, shrunk
 * by one part in 10¹² so that (max − min) / step rounds up to `steps` and the
 * input can reach its maximum. The shrink is small enough that a default on the
 * grid stays on it to a part in 10⁹ of a step.
 */
export function logStep(min: number, max: number, steps: number): number {
  return ((Math.log10(max) - Math.log10(min)) / steps) * (1 - 1e-12);
}

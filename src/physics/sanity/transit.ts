/**
 * `verifyTransitModel`, the checks on `../transit.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  AU,
  M_SUN,
  R_EARTH,
  R_JUPITER,
  R_SUN,
} from '../constants';
import {
  lightCurve,
  transitDepth,
  transitDuration,
  transitProbability,
  transitShape,
} from '../transit';
import {
  relativeError,
  significant,
  type CheckResult,
  type CheckBlock,
  toleranced,
  asserted,
  emit,
} from './core';

/**
 * Cross-validates the transit model.
 *
 * Outside the five-check count for the same reason as the rest. Six checks, and
 * the third of them is the one that matters most structurally: it reaches the
 * orbital period through `kepler.ts` rather than recomputing the third law, so a
 * correct duration here proves the reuse path end to end rather than proving
 * that two copies of the same formula agree with each other.
 *
 *   1. Jupiter across the Sun: about 1% of the disc.
 *   2. Earth across the Sun: 84 parts per million — the number that says why
 *      finding another Earth needs a space telescope.
 *   3. Earth's transit lasts about 13 hours.
 *   4. One observer in 213 is aligned well enough to see it at all.
 *   5. The light curve is its own trapezoid: integrating the flux deficit over a
 *      whole orbit has to equal depth x (full + total) / 2 by geometry, which
 *      catches a wrong shoulder length or an ingress that starts at the wrong
 *      contact.
 *   6. The domain guard returns NaN rather than throwing when the orbit is
 *      inside the star, which the sliders can reach.
 */
export function verifyTransitModel(): CheckBlock {
  const results: CheckResult[] = [];

  const report = (
    name: string,
    formula: string,
    detail: string,
    error: number,
    tolerance: number,
  ) => {
    results.push(toleranced(name, formula, detail, error, tolerance));
  };

  /* 1 - Jupiter across the Sun. */
  const jupiterDepth = transitDepth(R_JUPITER, R_SUN) * 100;
  report(
    'Transit depth, Jupiter across the Sun',
    'delta = (R_p / R_star)^2',
    `computed ${significant(jupiterDepth)}%  ·  expected 1.01%`,
    relativeError(jupiterDepth, 1.01),
    // 1.01%, not the 1.05% quoted from equatorial radii: `R_JUPITER` here is the
    // volumetric mean, matching `R_EARTH`, and the difference is 2.3% in radius
    // and twice that in depth. The constant's comment carries the full story.
    0.02,
  );

  /* 2 - Earth across the Sun, in parts per million. */
  const earthDepthPpm = transitDepth(R_EARTH, R_SUN) * 1e6;
  report(
    'Transit depth, Earth across the Sun',
    'delta = (R_p / R_star)^2',
    `computed ${significant(earthDepthPpm)} ppm  ·  expected 84 ppm`,
    relativeError(earthDepthPpm, 84),
    0.02,
  );

  /* 3 - duration, through kepler.ts's period(). */
  const earthHours = transitDuration(M_SUN, R_SUN, R_EARTH, AU) / 3600;
  report(
    "Transit duration, Earth across the Sun, via kepler.ts period()",
    'T = (P / pi) arcsin((R_star + R_p) / a)',
    `computed ${significant(earthHours)} h  ·  expected 13 h`,
    relativeError(earthHours, 13),
    0.05,
  );

  /* 4 - geometric probability. */
  const earthProbability = transitProbability(R_SUN, R_EARTH, AU) * 100;
  report(
    'Transit probability, Earth around the Sun',
    'p = (R_star + R_p) / a',
    `computed ${significant(earthProbability)}%  ·  expected 0.47%  ·  ` +
      `one aligned observer in ${Math.round(100 / earthProbability)}`,
    relativeError(earthProbability, 0.47),
    0.05,
  );

  /* 5 - the light curve integrates to its own trapezoid. */
  const shape = transitShape(M_SUN, R_SUN, R_JUPITER, 0.05 * AU);
  const steps = 200_000;
  const dt = shape.period / steps;
  let deficit = 0;
  for (let i = 0; i < steps; i += 1) {
    // Midpoint rule, starting half a step in, sweeping one whole orbit.
    const t = -shape.period / 2 + (i + 0.5) * dt;
    deficit += (1 - lightCurve(shape, t)) * dt;
  }
  const trapezoid = shape.depth * ((shape.full + shape.total) / 2);
  report(
    'Light curve area equals its trapezoid',
    'integral (1 - F) dt = delta (T_full + T_total) / 2',
    `integrated ${significant(deficit)} s  ·  closed form ${significant(trapezoid)} s  ·  ` +
      `depth ${significant(shape.depth * 100)}%, full ${significant(shape.full / 3600)} h, ` +
      `total ${significant(shape.total / 3600)} h`,
    relativeError(deficit, trapezoid),
    0.001,
  );

  /* 6 - the domain guard, at a distance inside the stellar radius. */
  const inside = 0.5 * R_SUN;
  const guarded = transitDuration(M_SUN, R_SUN, R_JUPITER, inside);
  const guardedShape = transitShape(M_SUN, R_SUN, R_JUPITER, inside);
  const flux = lightCurve(guardedShape, 0);
  const guardOk =
    Number.isNaN(guarded) &&
    guardedShape.transits === false &&
    flux === 1 &&
    transitProbability(R_SUN, R_JUPITER, inside) === 1;
  results.push(
    asserted(
      'Orbit inside the star returns NaN rather than throwing',
      'R_star + R_p >= a  =>  no transit',
      `duration ${String(guarded)}  ·  transits ${String(guardedShape.transits)}  ·  ` +
        `flux at mid ${String(flux)}  ·  probability clamped to ` +
        `${String(transitProbability(R_SUN, R_JUPITER, inside))}`,
      guardOk,
    ),
  );

  return emit('transit checks', results);
}

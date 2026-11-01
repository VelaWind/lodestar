/**
 * `verifyScaleLadder`, the checks on `../scale.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import { scaleAnchors } from '@/content/modules/scale-of-the-universe';
import { AU } from '../constants';
import { decadesBetween, lightTravelTime } from '../scale';
import {
  TIGHT,
  LOOSE,
  relativeError,
  significant,
  type CheckResult,
  type CheckBlock,
  toleranced,
  asserted,
  emit,
} from './core';

/**
 * Cross-validates the scale ladder.
 *
 * Also outside the five-check count. Three checks:
 *
 *   1. Light travel time from the Sun to Earth, through `scale.ts`. A deliberate
 *      duplicate of check 5 above by a different route — that check computes
 *      AU/C inline, this one goes through the function every readout in the
 *      module calls, so the two agree only if the shared function is right.
 *   2. The height of the ladder: proton to observable universe is ~41.7 decades.
 *      One number that fails if any of the constants, the CODATA-cited literals,
 *      or the arithmetic building either end anchor has slipped.
 *   3. The ladder is a ladder: every rung finite, strictly positive, and
 *      strictly larger than the one below it. The sim's zoom direction and the
 *      "decades above the previous anchor" readout both assume monotonicity, so
 *      an out-of-order anchor would render a transition that runs backwards.
 */
export function verifyScaleLadder(): CheckBlock {
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

  /* 1 — Sun to Earth, via scale.ts rather than inline arithmetic. */
  const sunToEarth = lightTravelTime(AU);
  report(
    'Light travel time, Sun to Earth, via lightTravelTime()',
    't = d / c',
    `computed ${significant(sunToEarth)} s ` +
      `(${Math.floor(sunToEarth / 60)} min ${(sunToEarth % 60).toFixed(1)} s)  ·  expected 500 s`,
    relativeError(sunToEarth, 500),
    // The skill states this one as "about 8 minutes 20 seconds", so the same
    // relaxed tolerance check 5 uses applies here for the same reason.
    LOOSE,
  );

  /* 2 — the height of the ladder. */
  const first = scaleAnchors[0];
  const last = scaleAnchors[scaleAnchors.length - 1];
  const height = first && last ? decadesBetween(first.size, last.size) : NaN;
  report(
    'Ladder height: proton to observable universe',
    'n = log₁₀(b / a)',
    `computed ${significant(height)} decades  ·  expected 41.7 decades`,
    relativeError(height, 41.7),
    TIGHT,
  );

  /* 3 — every rung finite, positive, and strictly above the one below. */
  let broken = 0;
  const detail: string[] = [];
  scaleAnchors.forEach((anchor, i) => {
    const below = i > 0 ? scaleAnchors[i - 1] : undefined;
    const ok =
      Number.isFinite(anchor.size) &&
      anchor.size > 0 &&
      (below === undefined || anchor.size > below.size);
    if (!ok) {
      broken += 1;
      detail.push(`${anchor.id}=${anchor.size}`);
    }
  });
  const ordered = broken === 0;
  results.push(
    asserted(
      'Anchors finite, positive and strictly increasing',
      's₀ < s₁ < … < s₉,  all finite and > 0',
      `${scaleAnchors.length} anchors, ${broken} broken` +
        `${detail.length > 0 ? ` (${detail.join(', ')})` : ''}` +
        `  ·  span ${significant(first?.size ?? NaN)} m → ${significant(last?.size ?? NaN)} m`,
      ordered,
    ),
  );

  return emit('scale ladder checks', results);
}

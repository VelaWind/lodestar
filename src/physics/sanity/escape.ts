/**
 * `verifyEscapeIntegrator`, the checks on `../escape.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import { M_EARTH, R_EARTH } from '../constants';
import { apexAltitude, integrateFlight, timestepFor } from '../escape';
import { relativeError, significant, type CheckBlock } from './core';

/**
 * Cross-validates the trajectory integrator against the closed form.
 *
 * `apexAltitude` solves energy conservation directly; the animation instead
 * integrates dv/dt = −GM/r² step by step. Those are independent routes to the
 * same number, so disagreement means one of them is wrong — and since the
 * readout uses the closed form while the picture uses the integrator, a reader
 * would see a trajectory that peaks somewhere other than the labelled apex.
 *
 * Kept out of the five-check count above: that list is the skill's, this is
 * ours. Tolerance is 1%, comfortably tighter than any visible discrepancy.
 */
export function verifyEscapeIntegrator(): CheckBlock {
  const v0 = 8000; // m/s — below Earth's threshold, so there is an apex to find
  const closedForm = apexAltitude(M_EARTH, R_EARTH, v0);
  const dt = timestepFor(M_EARTH, R_EARTH);
  // Integrate with generous headroom so the apex is never clipped by the cap.
  const flight = integrateFlight(M_EARTH, R_EARTH, v0, dt, closedForm * 4);
  const integrated = flight.peakAltitude;

  const error = relativeError(integrated, closedForm);
  const passed = Math.abs(error) <= 0.01;
  const name = 'apex altitude: closed form vs integrator';
  const detail =
    `closed form ${significant(closedForm / 1000)} km` +
    `  ·  integrated ${significant(integrated / 1000)} km`;

  // The one block that is a single check, so it logs as one line without a
  // summary header — and carries a second body line naming the conditions.
  const line =
    `${passed ? 'PASS' : 'FAIL'}  ${name}\n` +
    `      r_max = 1 / (1/R − v₀²/2GM),  against velocity Verlet on dv/dt = −GM/r²\n` +
    `      Earth M/R, v₀ = ${v0 / 1000} km/s, dt = ${significant(dt)} s\n` +
    `      ${detail}` +
    `  ·  Δ ${(error * 100).toFixed(4)}%  ·  tolerance ±1.0%`;

  console[passed ? 'info' : 'warn'](`[lodestar] ${line}`);

  return { title: name, results: [{ name, passed, detail, line }], failures: passed ? 0 : 1 };
}

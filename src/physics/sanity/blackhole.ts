/**
 * `verifyBlackHoleModel`, the checks on `../blackhole.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  PERSON_HEIGHT,
  evaporationTime,
  hawkingTemperature,
  schwarzschildRadius,
  tidalAccelerationAtHorizon,
} from '../blackhole';
import { JULIAN_YEAR, M_SUN } from '../constants';
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
 * Cross-validates the Schwarzschild black hole model.
 *
 * Outside the five-check count for the same reason as the others: that list is
 * the skill's, this is ours. Four checks, each aimed at a different way this
 * code could be wrong.
 *
 *   1. r_s of one solar mass, through `schwarzschildRadius()`. A deliberate
 *      duplicate of check 4 above by a different route — that one computes
 *      2GM/c² inline, this one goes through the function every readout in the
 *      module calls, so a unit slip inside `blackhole.ts` cannot hide behind a
 *      check that never touches it.
 *   2. Hawking temperature of one solar mass, 6.17 × 10⁻⁸ K. This is the check
 *      that ħ is right: T_H is the only quantity in the module carrying ħ and
 *      k_B, and taking h for ħ (or the reverse) misses by exactly 2π, which
 *      nothing else here would catch.
 *   3. Evaporation time of one solar mass, ~10⁶⁷ years. Asserted as an exponent
 *      rather than a value, because the estimate itself is only good to a factor
 *      of a few — see `evaporationTime`. What it does catch is the M³ scaling and
 *      the 5120π coefficient: any slip in either moves the exponent by more than
 *      the one decade of slack allowed here.
 *   4. Tidal acceleration at the horizon, stellar-mass against supermassive.
 *      Δa ∝ 1/M², so a 4.15 × 10⁶ M_☉ hole is gentler at its horizon than a
 *      10 M_☉ one by (M₂/M₁)² — eleven orders of magnitude. Checking the ratio
 *      against that closed form tests the mass dependence rather than a single
 *      number, and the second half of the check pins the physical claim the
 *      module makes: at a supermassive horizon the stretch is weaker than
 *      standing on Earth.
 */
export function verifyBlackHoleModel(): CheckBlock {
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

  /* 1 — r_s of the Sun, via blackhole.ts rather than inline arithmetic. */
  const rsSunKm = schwarzschildRadius(M_SUN) / 1000;
  report(
    'Schwarzschild radius of one solar mass, via schwarzschildRadius()',
    'r_s = 2GM / c²',
    `computed ${significant(rsSunKm)} km  ·  expected 2.95 km`,
    relativeError(rsSunKm, 2.95),
    // The skill states this one as "about 2.95 km", so the relaxed tolerance
    // applies for the same reason it does in check 4 above.
    LOOSE,
  );

  /* 2 — Hawking temperature of the Sun: the ħ check. */
  const tHawkingSun = hawkingTemperature(M_SUN);
  report(
    'Hawking temperature of one solar mass',
    'T_H = ħc³ / (8π G M k_B)',
    `computed ${significant(tHawkingSun)} K  ·  expected 6.17e-8 K`,
    relativeError(tHawkingSun, 6.17e-8),
    TIGHT,
  );

  /* 3 — evaporation time of the Sun, asserted as an exponent. */
  const evapYears = evaporationTime(M_SUN) / JULIAN_YEAR;
  const evapExponent = Math.floor(Math.log10(evapYears));
  const evapOk = evapExponent >= 66 && evapExponent <= 68;
  results.push(
    asserted(
      'Evaporation time of one solar mass',
      't = 5120π G²M³ / (ħc⁴)',
      `computed ${significant(evapYears)} yr (10^${evapExponent})  ·  ` +
        `expected order 10^67 yr  ·  accepted 10^66 – 10^68` +
        `  ·  photons-only estimate, good to a factor of a few`,
      evapOk,
    ),
  );

  /* 4 — tidal acceleration at the horizon: the 1/M² scaling, and the verdict. */
  const mStellar = 10 * M_SUN;
  const mSupermassive = 4.15e6 * M_SUN; // Sgr A*, GRAVITY 2022
  const tidalStellar = tidalAccelerationAtHorizon(mStellar, PERSON_HEIGHT);
  const tidalSupermassive = tidalAccelerationAtHorizon(mSupermassive, PERSON_HEIGHT);
  const ratio = tidalStellar / tidalSupermassive;
  const ratioClosedForm = (mSupermassive / mStellar) ** 2;

  report(
    'Tidal acceleration at the horizon scales as 1/M²',
    'Δa = 2GM·h / r_s³  ∝  1/M²',
    `10 M_☉ ${significant(tidalStellar)} m/s²  ·  ` +
      `4.15e6 M_☉ ${significant(tidalSupermassive)} m/s²  ·  ` +
      `ratio ${significant(ratio)} (${Math.log10(ratio).toFixed(1)} decades)  ·  ` +
      `closed form (M₂/M₁)² = ${significant(ratioClosedForm)}`,
    relativeError(ratio, ratioClosedForm),
    TIGHT,
  );

  const gentle = tidalSupermassive < 9.80665;
  results.push(
    asserted(
      "A supermassive horizon stretches you less than Earth's surface pulls",
      `Δa(4.15e6 M_☉, h = ${PERSON_HEIGHT} m)  <  g₀ = 9.80665 m/s²`,
      `computed ${significant(tidalSupermassive)} m/s²  ·  ` +
        `${significant(tidalSupermassive / 9.80665)} g`,
      gentle,
    ),
  );

  return emit('black hole checks', results);
}

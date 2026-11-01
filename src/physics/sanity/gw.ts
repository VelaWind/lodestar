/**
 * `verifyGravitationalWaveModel`, the checks on `../gw.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import { C, G, M_SUN } from '../constants';
import {
  chirpMass,
  fCutoff,
  fOfTimeToMerger,
  inspiralPhase,
  strainAmplitude,
  timeToMerger,
} from '../gw';
import {
  TIGHT,
  relativeError,
  significant,
  type CheckResult,
  type CheckBlock,
  toleranced,
  asserted,
  emit,
} from './core';

/**
 * Cross-validates the gravitational-wave inspiral model.
 *
 * Outside the five-check count for the same reason as the rest: that list is the
 * skill's, this is ours. Five checks, each aimed at a different way this code
 * could be wrong, with GW150914's published masses as the worked case.
 *
 *   1. Chirp mass of 36 + 29 M_☉ ≈ 28.1 M_☉. The exponents 3/5 and 1/5 are easy
 *      to transpose and the result stays plausible when they are; the published
 *      figure catches it.
 *   2. Strain at the default distance, evaluated at 100 Hz, is of order 10⁻²¹.
 *      Asserted as an exponent rather than a value — the amplitude formula is
 *      for an optimally oriented source, which a real detection only ever falls
 *      short of, so demanding better than an order of magnitude would be testing
 *      a best case against a specific one.
 *   3. Time to merger for a 28 M_☉ chirp mass, against the published length of
 *      the chirp this is modelled on: LIGO's observed GW150914 signal ran about
 *      0.2 s from 35 Hz. Asserted at that frequency and against that number,
 *      0.15–0.3 s, rather than the order-of-magnitude 0.1–1 s from 30 Hz it used
 *      to be — the point of the check is the f^(-8/3) scaling and the (GM_c/c³)
 *      factor, and a decade-wide window would pass with either of them wrong by
 *      a factor of three. One check, not two: the same claim at 30 Hz adds a
 *      second reading of one number rather than a second thing that can fail.
 *   4. The cutoff frequency against c³/(6^(3/2)πGM) worked out inline. `fCutoff`
 *      reaches its answer through `fGWAtSeparation`, which is where the factor
 *      of two between orbital and wave frequency lives; computing the closed
 *      form independently here is what makes a dropped factor of two visible
 *      rather than merely halving a number nobody has an independent value for.
 *   5. The analytic phase against a numerical integration of 2πf dt. The closed
 *      form in `inspiralPhase` is the one piece of this file that is not a
 *      direct transcription of a standard result, and it is what the waveform's
 *      every cycle depends on.
 */
export function verifyGravitationalWaveModel(): CheckBlock {
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

  /* GW150914's published component masses, and the module's default distance. */
  const m1 = 36 * M_SUN;
  const m2 = 29 * M_SUN;
  const distance = 1.26e25; // m, 408 Mpc: GW150914's 410 Mpc, rounded
  const mc = chirpMass(m1, m2);

  /* 1 — chirp mass. */
  report(
    'Chirp mass of GW150914 (36 + 29 M_☉)',
    'M_c = (m₁m₂)^(3/5) / (m₁+m₂)^(1/5)',
    `computed ${significant(mc / M_SUN)} M_☉  ·  expected 28.1 M_☉`,
    relativeError(mc / M_SUN, 28.1),
    TIGHT * 10, // ±1%: the published figure is quoted to three figures
  );

  /* 2 — strain at 100 Hz, asserted as an order of magnitude. */
  const h100 = strainAmplitude(mc, 100, distance);
  const hExponent = Math.floor(Math.log10(h100));
  const hOk = hExponent === -21;
  results.push(
    asserted(
      'Strain of GW150914 at the default 408 Mpc, evaluated at 100 Hz',
      'h = (4/d)(GM_c/c²)^(5/3)(πf/c)^(2/3)',
      `computed ${significant(h100)} (10^${hExponent})  ·  expected order 10^-21` +
        `  ·  optimally oriented, so the order is the claim`,
      hOk,
    ),
  );

  /* 3 — time to merger from 35 Hz, against the observed chirp. */
  const tau35 = timeToMerger(mc, 35);
  const tauOk = tau35 >= 0.15 && tau35 <= 0.3;
  results.push(
    asserted(
      `Time to merger from 35 Hz at M_c = ${significant(mc / M_SUN)} M_☉`,
      'τ = (5/256)(πf)^(-8/3)(GM_c/c³)^(-5/3)',
      `computed ${significant(tau35)} s  ·  accepted 0.15 – 0.3 s` +
        `  ·  the observed GW150914 chirp ran ~0.2 s from 35 Hz`,
      tauOk,
    ),
  );

  /* 4 — cutoff frequency against the closed form, worked out independently. */
  const cutoff = fCutoff(m1, m2);
  const cutoffClosedForm = C ** 3 / (6 ** 1.5 * Math.PI * G * (m1 + m2));
  report(
    'Cutoff frequency vs c³/(6^(3/2)πGM), computed independently',
    'f_cut = f_GW(r_isco),  r_isco = 6GM/c²',
    `via fGWAtSeparation ${significant(cutoff)} Hz  ·  ` +
      `closed form ${significant(cutoffClosedForm)} Hz  ·  ` +
      `a dropped factor of 2 would read ${significant(cutoffClosedForm / 2)} Hz`,
    relativeError(cutoff, cutoffClosedForm),
    0.2,
  );

  /* 5 — analytic phase against a numerical integration of 2πf dt. */
  const tauEnd = timeToMerger(mc, cutoff);
  const tauStart = timeToMerger(mc, cutoff / 2); // the last octave, ~7.7 cycles
  const steps = 200_000;
  const dTau = (tauStart - tauEnd) / steps;
  let integrated = 0;
  for (let i = 0; i < steps; i += 1) {
    // Midpoint rule, integrating forward in time: dΦ = 2πf dt = −2πf dτ.
    const tau = tauStart - (i + 0.5) * dTau;
    integrated += 2 * Math.PI * fOfTimeToMerger(mc, tau) * dTau;
  }
  const analytic = inspiralPhase(mc, tauEnd) - inspiralPhase(mc, tauStart);
  report(
    'Waveform phase: closed form vs numerical ∫2πf dt',
    'Φ(t) = −2[(t_c − t)/(5GM_c/c³)]^(5/8)',
    `closed form ${significant(analytic)} rad  ·  integrated ${significant(integrated)} rad  ·  ` +
      `${significant(analytic / (2 * Math.PI))} cycles over the last octave`,
    relativeError(integrated, analytic),
    TIGHT,
  );

  return emit('gravitational wave checks', results);
}

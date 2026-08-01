/**
 * Dev-only self-test for the physics layer.
 *
 * The `physics-accuracy` skill lists five known values that any correct
 * simulation must be able to reproduce: "If a sim cannot reproduce these, the
 * sim is wrong — not the constants." This module is that list, executable, so a
 * bad constant or a unit slip surfaces on page load rather than in a readout
 * nobody double-checked.
 *
 * Every formula below is the standard physics form from the skill's "Formula
 * conventions" section, translated directly so the two read as the same thing.
 * Angles are radians internally and converted only for display.
 *
 * Called once from `main.tsx` behind `import.meta.env.DEV`. Nothing here runs
 * in a production build.
 */
import { scaleAnchors } from '@/content/modules/scale-of-the-universe';
import { AU, C, G, JULIAN_YEAR, M_EARTH, M_SUN, R_EARTH, R_SUN } from './constants';
import {
  PERSON_HEIGHT,
  evaporationTime,
  hawkingTemperature,
  schwarzschildRadius,
  tidalAccelerationAtHorizon,
} from './blackhole';
import { apexAltitude, integrateFlight, timestepFor } from './escape';
import {
  chirpMass,
  fCutoff,
  fOfTimeToMerger,
  inspiralPhase,
  strainAmplitude,
  timeToMerger,
} from './gw';
import { decadesBetween, lightTravelTime } from './scale';
import {
  apoapsisDistance,
  period,
  periapsisDistance,
  specificAngularMomentum,
  stateAt,
  visViva,
} from './kepler';

/**
 * Default tolerance. The skill states ±0.1% for the orbital period, and the
 * same precision is achievable for escape velocity.
 */
const TIGHT = 0.001;

/**
 * Relaxed tolerance for the three checks whose expected value the skill states
 * as "about" — 0.53°, 2.95 km, 8 minutes 20 seconds. Those are quoted to two or
 * three significant figures, so demanding 0.1% would be testing the rounding of
 * the target rather than the correctness of the computation.
 */
const LOOSE = 0.01;

interface Check {
  /** The formula in standard physics form, for the log line. */
  formula: string;
  name: string;
  computed: number;
  expected: number;
  unit: string;
  tolerance: number;
  /** Optional second rendering, e.g. seconds as minutes-and-seconds. */
  gloss?: (value: number) => string;
}

const CHECKS: Check[] = [
  {
    name: "Earth's orbital period",
    formula: 'T = 2π√(a³ / (G·M_SUN))',
    computed: (2 * Math.PI * Math.sqrt(AU ** 3 / (G * M_SUN))) / 86_400,
    expected: 365.25,
    unit: 'days',
    tolerance: TIGHT,
  },
  {
    name: "Sun's angular size from Earth",
    formula: 'θ = 2·arctan(R_SUN / AU)',
    // Computed in radians, converted to degrees for display only.
    computed: (2 * Math.atan(R_SUN / AU) * 180) / Math.PI,
    expected: 0.53,
    unit: '°',
    tolerance: LOOSE,
  },
  {
    name: "Escape velocity, Earth's surface",
    formula: 'v = √(2·G·M_EARTH / R_EARTH)',
    computed: Math.sqrt((2 * G * M_EARTH) / R_EARTH) / 1000,
    // The skill quotes 11.2 km/s; that is this same value at 3 s.f. Asserting
    // against the rounded figure at ±0.1% would test the rounding rather than
    // the computation, so the target is the exact value the skill's own
    // constants produce and the tolerance stays tight.
    expected: 11.186,
    unit: 'km/s',
    tolerance: TIGHT,
  },
  {
    name: 'Schwarzschild radius of one solar mass',
    formula: 'r_s = 2·G·M_SUN / c²',
    computed: (2 * G * M_SUN) / C ** 2 / 1000,
    expected: 2.95,
    unit: 'km',
    tolerance: LOOSE,
  },
  {
    name: 'Light travel time, Sun to Earth',
    formula: 't = AU / c',
    computed: AU / C,
    expected: 500, // 8 minutes 20 seconds
    unit: 's',
    tolerance: LOOSE,
    gloss: (s) => `${Math.floor(s / 60)} min ${(s % 60).toFixed(1)} s`,
  },
];

/** Fractional difference between computed and expected. */
function relativeError(computed: number, expected: number): number {
  return (computed - expected) / expected;
}

function significant(value: number): string {
  return Number(value.toPrecision(6)).toString();
}

/**
 * Runs the five sanity checks and logs computed vs expected for each. Returns
 * the number of failures so a caller could escalate; nothing does today.
 */
export function runSanityChecks(): number {
  const lines: string[] = [];
  let failures = 0;

  for (const check of CHECKS) {
    const error = relativeError(check.computed, check.expected);
    const passed = Math.abs(error) <= check.tolerance;
    if (!passed) failures += 1;

    const gloss = check.gloss ? ` (${check.gloss(check.computed)})` : '';
    lines.push(
      `${passed ? 'PASS' : 'FAIL'}  ${check.name}\n` +
        `      ${check.formula}\n` +
        `      computed ${significant(check.computed)} ${check.unit}${gloss}` +
        `  ·  expected ${check.expected} ${check.unit}` +
        `  ·  Δ ${(error * 100).toFixed(4)}%` +
        `  ·  tolerance ±${(check.tolerance * 100).toFixed(1)}%`,
    );
  }

  const summary = `physics sanity checks — ${CHECKS.length - failures}/${CHECKS.length} passed`;

  // eslint-disable-next-line no-console
  console[failures > 0 ? 'warn' : 'info'](
    `[lodestar] ${summary}\n${lines.join('\n')}`,
  );

  return failures;
}

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
export function verifyEscapeIntegrator(): number {
  const v0 = 8000; // m/s — below Earth's threshold, so there is an apex to find
  const closedForm = apexAltitude(M_EARTH, R_EARTH, v0);
  const dt = timestepFor(M_EARTH, R_EARTH);
  // Integrate with generous headroom so the apex is never clipped by the cap.
  const flight = integrateFlight(M_EARTH, R_EARTH, v0, dt, closedForm * 4);
  const integrated = flight.peakAltitude;

  const error = relativeError(integrated, closedForm);
  const passed = Math.abs(error) <= 0.01;

  // eslint-disable-next-line no-console
  console[passed ? 'info' : 'warn'](
    `[lodestar] ${passed ? 'PASS' : 'FAIL'}  apex altitude: closed form vs integrator\n` +
      `      r_max = 1 / (1/R − v₀²/2GM),  against semi-implicit Euler on dv/dt = −GM/r²\n` +
      `      Earth M/R, v₀ = ${v0 / 1000} km/s, dt = ${significant(dt)} s\n` +
      `      closed form ${significant(closedForm / 1000)} km` +
      `  ·  integrated ${significant(integrated / 1000)} km` +
      `  ·  Δ ${(error * 100).toFixed(4)}%  ·  tolerance ±1.0%`,
  );

  return passed ? 0 : 1;
}

/**
 * Cross-validates the Kepler orbit model.
 *
 * Kept out of the five-check count above for the same reason as the escape
 * integrator: that list is the skill's, this is ours. Three checks, each aimed
 * at a different way this code could be wrong.
 *
 *   1. Earth's period, through the *new* module's code path. This duplicates
 *      check 1 above deliberately — the point is that `period()` and the sim
 *      that calls it reproduce the same 365.25 days the constants do, so a unit
 *      slip inside `kepler.ts` cannot hide behind a check that never touches it.
 *   2. Kepler's second law, numerically. Specific angular momentum r²·dν/dt must
 *      be constant around the orbit and equal to the closed form √(GM·a(1−e²)).
 *      Sampled at e = 0.97 — the eccentricity slider's maximum, so the check
 *      covers the whole range a reader can actually reach. Speed there varies by
 *      a factor of sixty-six between the apsides and a broken anomaly conversion
 *      has nowhere to hide. dν/dt is a central difference over T/10⁶, small
 *      enough that truncation error is ~10⁻⁷ and large enough that cancellation
 *      is ~10⁻¹².
 *   3. Vis-viva against angular momentum at the apsides. At periapsis and
 *      apoapsis, and nowhere else, velocity is perpendicular to the radius, so
 *      v·r there is exactly h. Two independent formulas — one from energy, one
 *      from angular momentum — that must agree.
 */
export function verifyKeplerModel(): number {
  const TAU = 2 * Math.PI;
  const lines: string[] = [];
  let failures = 0;

  const report = (
    name: string,
    formula: string,
    detail: string,
    error: number,
    tolerance: number,
  ) => {
    const passed = Math.abs(error) <= tolerance;
    if (!passed) failures += 1;
    lines.push(
      `${passed ? 'PASS' : 'FAIL'}  ${name}\n` +
        `      ${formula}\n` +
        `      ${detail}` +
        `  ·  Δ ${(error * 100).toFixed(4)}%` +
        `  ·  tolerance ±${(tolerance * 100).toFixed(1)}%`,
    );
  };

  /* 1 — Earth's period, via kepler.ts rather than inline arithmetic. */
  const earthDays = period(M_SUN, AU) / 86_400;
  report(
    "Earth's period from period(M_SUN, AU)",
    'T = 2π√(a³ / GM)',
    `computed ${significant(earthDays)} days  ·  expected 365.25 days`,
    relativeError(earthDays, 365.25),
    TIGHT,
  );

  /* 2 — r²·dν/dt constant around one orbit at high eccentricity. */
  const e = 0.97;
  const a = AU;
  const T = period(M_SUN, a);
  const hClosed = specificAngularMomentum(M_SUN, a, e);
  const delta = T / 1e6; // central-difference half-step, s
  let worstH = 0;
  let hMin = Infinity;
  let hMax = 0;

  for (let i = 0; i < 360; i += 1) {
    const t = (i / 360) * T;
    const before = stateAt(M_SUN, a, e, t - delta);
    const after = stateAt(M_SUN, a, e, t + delta);
    const here = stateAt(M_SUN, a, e, t);

    // ν advances monotonically; unwrap the one sample that crosses 2π → 0.
    let dNu = after.nu - before.nu;
    while (dNu <= -Math.PI) dNu += TAU;
    while (dNu > Math.PI) dNu -= TAU;

    const h = here.r ** 2 * (dNu / (2 * delta));
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
    const error = relativeError(h, hClosed);
    if (Math.abs(error) > Math.abs(worstH)) worstH = error;
  }

  report(
    `Kepler's second law: r²·dν/dt constant at e = ${e}`,
    'h = r²·dν/dt  =  √(GM·a(1 − e²))',
    `360 samples over one orbit, spread ${significant((hMax / hMin - 1) * 100)}%  ·  ` +
      `worst vs closed form ${significant(worstH * 100)}%`,
    worstH,
    TIGHT,
  );

  /* 3 — vis-viva at the apsides against the same h. */
  const rPeri = periapsisDistance(a, e);
  const rApo = apoapsisDistance(a, e);
  const hPeri = visViva(M_SUN, a, rPeri) * rPeri;
  const hApo = visViva(M_SUN, a, rApo) * rApo;
  const apsisError = Math.max(
    Math.abs(relativeError(hPeri, hClosed)),
    Math.abs(relativeError(hApo, hClosed)),
  );

  report(
    'vis-viva at the apsides vs angular momentum',
    'v_p·r_p = v_a·r_a = h,   v = √(GM(2/r − 1/a))',
    `v_p·r_p ${significant(hPeri / 1e15)}  ·  v_a·r_a ${significant(hApo / 1e15)}  ·  ` +
      `h ${significant(hClosed / 1e15)}  (×10¹⁵ m²/s)`,
    apsisError,
    TIGHT,
  );

  const summary = `kepler orbit checks — ${lines.length - failures}/${lines.length} passed`;

  // eslint-disable-next-line no-console
  console[failures > 0 ? 'warn' : 'info'](`[lodestar] ${summary}\n${lines.join('\n')}`);

  return failures;
}

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
export function verifyBlackHoleModel(): number {
  const lines: string[] = [];
  let failures = 0;

  const report = (
    name: string,
    formula: string,
    detail: string,
    error: number,
    tolerance: number,
  ) => {
    const passed = Math.abs(error) <= tolerance;
    if (!passed) failures += 1;
    lines.push(
      `${passed ? 'PASS' : 'FAIL'}  ${name}\n` +
        `      ${formula}\n` +
        `      ${detail}` +
        `  ·  Δ ${(error * 100).toFixed(4)}%` +
        `  ·  tolerance ±${(tolerance * 100).toFixed(1)}%`,
    );
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
  if (!evapOk) failures += 1;
  lines.push(
    `${evapOk ? 'PASS' : 'FAIL'}  Evaporation time of one solar mass\n` +
      `      t = 5120π G²M³ / (ħc⁴)\n` +
      `      computed ${significant(evapYears)} yr (10^${evapExponent})  ·  ` +
      `expected order 10^67 yr  ·  accepted 10^66 – 10^68` +
      `  ·  photons-only estimate, good to a factor of a few`,
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
  if (!gentle) failures += 1;
  lines.push(
    `${gentle ? 'PASS' : 'FAIL'}  A supermassive horizon stretches you less than Earth's surface pulls\n` +
      `      Δa(4.15e6 M_☉, h = ${PERSON_HEIGHT} m)  <  g₀ = 9.80665 m/s²\n` +
      `      computed ${significant(tidalSupermassive)} m/s²  ·  ` +
      `${significant(tidalSupermassive / 9.80665)} g`,
  );

  const summary = `black hole checks — ${lines.length - failures}/${lines.length} passed`;

  // eslint-disable-next-line no-console
  console[failures > 0 ? 'warn' : 'info'](`[lodestar] ${summary}\n${lines.join('\n')}`);

  return failures;
}

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
 *      sky- and orientation-averaged, so demanding better than an order of
 *      magnitude would be testing an average against a specific.
 *   3. Time to merger from 30 Hz for a 28 M_☉ chirp mass is a fraction of a
 *      second. LIGO's observed GW150914 chirp lasted about 0.2 s from 35 Hz, so
 *      anything outside 0.1–1 s from 30 Hz means the f^(-8/3) scaling or the
 *      (GM_c/c³) factor is wrong.
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
export function verifyGravitationalWaveModel(): number {
  const lines: string[] = [];
  let failures = 0;

  const report = (
    name: string,
    formula: string,
    detail: string,
    error: number,
    tolerance: number,
  ) => {
    const passed = Math.abs(error) <= tolerance;
    if (!passed) failures += 1;
    lines.push(
      `${passed ? 'PASS' : 'FAIL'}  ${name}\n` +
        `      ${formula}\n` +
        `      ${detail}` +
        `  ·  Δ ${(error * 100).toFixed(4)}%` +
        `  ·  tolerance ±${(tolerance * 100).toFixed(1)}%`,
    );
  };

  /* GW150914's published component masses, and the module's default distance. */
  const m1 = 36 * M_SUN;
  const m2 = 29 * M_SUN;
  const distance = 1.26e25; // m, ≈410 Mpc
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
  if (!hOk) failures += 1;
  lines.push(
    `${hOk ? 'PASS' : 'FAIL'}  Strain of GW150914 at 410 Mpc, evaluated at 100 Hz\n` +
      `      h = (4/d)(GM_c/c²)^(5/3)(πf/c)^(2/3)\n` +
      `      computed ${significant(h100)} (10^${hExponent})  ·  expected order 10^-21` +
      `  ·  sky- and orientation-averaged, so the order is the claim`,
  );

  /* 3 — time to merger from 30 Hz, asserted as a range. */
  const tau30 = timeToMerger(mc, 30);
  const tauOk = tau30 >= 0.1 && tau30 <= 1;
  if (!tauOk) failures += 1;
  lines.push(
    `${tauOk ? 'PASS' : 'FAIL'}  Time to merger from 30 Hz at M_c = ${significant(mc / M_SUN)} M_☉\n` +
      `      τ = (5/256)(πf)^(-8/3)(GM_c/c³)^(-5/3)\n` +
      `      computed ${significant(tau30)} s  ·  accepted 0.1 – 1 s` +
      `  ·  the observed GW150914 chirp ran ~0.2 s from 35 Hz`,
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

  const summary = `gravitational wave checks — ${lines.length - failures}/${lines.length} passed`;

  // eslint-disable-next-line no-console
  console[failures > 0 ? 'warn' : 'info'](`[lodestar] ${summary}\n${lines.join('\n')}`);

  return failures;
}

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
export function verifyScaleLadder(): number {
  const lines: string[] = [];
  let failures = 0;

  const report = (
    name: string,
    formula: string,
    detail: string,
    error: number,
    tolerance: number,
  ) => {
    const passed = Math.abs(error) <= tolerance;
    if (!passed) failures += 1;
    lines.push(
      `${passed ? 'PASS' : 'FAIL'}  ${name}\n` +
        `      ${formula}\n` +
        `      ${detail}` +
        `  ·  Δ ${(error * 100).toFixed(4)}%` +
        `  ·  tolerance ±${(tolerance * 100).toFixed(1)}%`,
    );
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
  if (!ordered) failures += 1;
  lines.push(
    `${ordered ? 'PASS' : 'FAIL'}  Anchors finite, positive and strictly increasing\n` +
      `      s₀ < s₁ < … < s₉,  all finite and > 0\n` +
      `      ${scaleAnchors.length} anchors, ${broken} broken` +
      `${detail.length > 0 ? ` (${detail.join(', ')})` : ''}` +
      `  ·  span ${significant(first?.size ?? NaN)} m → ${significant(last?.size ?? NaN)} m`,
  );

  const summary = `scale ladder checks — ${lines.length - failures}/${lines.length} passed`;

  // eslint-disable-next-line no-console
  console[failures > 0 ? 'warn' : 'info'](`[lodestar] ${summary}\n${lines.join('\n')}`);

  return failures;
}

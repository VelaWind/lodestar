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
import {
  AU,
  C,
  G,
  H0_PLANCK_2018,
  H_ALPHA_AIR,
  JULIAN_YEAR,
  KM_S_PER_MPC,
  M_EARTH,
  M_JUPITER,
  M_MOON,
  M_SUN,
  R_EARTH,
  R_JUPITER,
  R_MOON,
  R_SUN,
  T_CMB,
  V_SUN_CMB,
  Z_RECOMBINATION,
  EV,
  K_B,
  M_ELECTRON,
  OMEGA_M,
  RHO_SUN_CORE,
  T_SUN_CORE,
  X_SUN_CORE,
  L_SUN,
  M_IA_PEAK,
  M_NS_TYPICAL,
  PARSEC,
  R_NS,
  ARCSEC,
  D_LMC,
  D_PROXIMA,
  M_DEMO_BH,
  R_GPS,
  AGE_UNIVERSE,
  MEGATON_TNT,
  NUCLEAR_DENSITY,
  PROTON_RADIUS,
  H0_SH0ES_2022,
  A_EARTH,
  A_MARS,
  A_VENUS,
  SEFF_MAXGH,
  SEFF_MOIST,
  CRAB_F0,
  CRAB_F1,
  FASTEST_PULSAR_FREQUENCY,
  G_STANDARD,
  NS_MASS_HEAVIEST,
} from './constants';
import {
  PERSON_HEIGHT,
  evaporationTime,
  hawkingTemperature,
  schwarzschildRadius,
  tidalAccelerationAtHorizon,
} from './blackhole';
import { GASES, gasById, jeansParameter, retentionVerdict } from './atmosphere';
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
  cmbTemperatureAtRedshift,
  dipoleAmplitude,
  hubbleTime,
  lineOfSightVelocity,
  observedWavelength,
  photonNumberDensity,
  planckSpectralRadiance,
  planckSpectralRadianceWavelength,
  recessionVelocity,
  redshiftAtTemperature,
  redshiftFromVelocity,
  wienPeakWavelength,
} from './cosmology';
import {
  freezeOutTime,
  lcdmTimeAtScaleFactor,
  radiationDensityParameter,
  radiationTimeAtTemperature,
  scaleFactorAtTime,
  stitchTime,
  temperatureAtTime,
} from './earlyuniverse';
import {
  PP_BARRIER,
  PP_GAMOW_ENERGY,
  boltzmannFraction,
  gamowPeak,
  gamowWindowWidth,
  ppEnergyRate,
  temperatureExponent,
  tunnellingProbability,
} from './fusion';
import {
  apparentMagnitude,
  collapseEnergy,
  distanceForMagnitude,
  fate,
  MAG_NAKED_EYE,
  mainSequenceLifetime,
  mainSequenceLuminosity,
  remnantMass,
  typeIaPeakLuminosity,
} from './supernova';
import {
  equilibriumTemperature,
  massFromLuminosity,
  stellarFlux,
  surfaceTemperatureEarthLike,
  zoneEdge,
  zoneVerdict,
} from './habitable';
import {
  expansionRadius,
  frontThickness,
  ionizedMass,
  recombinationTime,
  stromgrenRadius,
} from './nebula';
import {
  apparentMagnitude as ladderApparentMagnitude,
  distanceModulus,
  inferredH0,
  leavittAbsoluteMagnitude,
  offsetForH0Ratio,
  parallaxAngle,
  parallaxFractionalError,
  peculiarVelocityShare,
  rungsAt,
} from './ladder';
import {
  circularOrbitSpeed,
  clockDeficit,
  gpsDailyOffsets,
  gravitationalDeficit,
  gravitationalRate,
  lorentzFactor,
  twinTrip,
} from './relativity';
import {
  emissionBand,
  finalSecondEnergy,
  hawkingPower,
  massEvaporatingIn,
  massForHawkingTemperature,
} from './hawking';
import {
  casimirDensity,
  casimirGapForThroat,
  embeddingHeight,
  exoticMass,
  throatDensity,
} from './wormhole';
import {
  characteristicAge,
  collapses,
  compactness,
  densityOverNuclear,
  equatorialSpeedFraction,
  escapeSpeedFraction,
  keplerFrequency,
  meanDensity,
  spinDownPower,
  surfaceGravity,
  surfaceRedshift,
  teaspoonMass,
} from './neutronstar';
import {
  lightCurve,
  transitDepth,
  transitDuration,
  transitProbability,
  transitShape,
} from './transit';
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

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/**
 * One check's outcome.
 *
 * `line` is the exact string the dev console prints, carried on the result
 * rather than rebuilt by the caller. The browser output and the committed test
 * suite therefore read the same characters, and a check cannot pass in one place
 * while reporting something else in the other.
 */
export interface CheckResult {
  name: string;
  passed: boolean;
  /** Computed against expected, without the PASS/FAIL prefix. */
  detail: string;
  /** The console line, verbatim. */
  line: string;
}

/** A group of checks that logs as a single console message. */
export interface CheckBlock {
  title: string;
  results: CheckResult[];
  failures: number;
}

function head(name: string, formula: string, detail: string, passed: boolean): string {
  return `${passed ? 'PASS' : 'FAIL'}  ${name}\n      ${formula}\n      ${detail}`;
}

/** A check stated as a tolerance on a relative error. */
function toleranced(
  name: string,
  formula: string,
  detail: string,
  error: number,
  tolerance: number,
): CheckResult {
  const passed = Math.abs(error) <= tolerance;
  return {
    name,
    passed,
    detail,
    line:
      `${head(name, formula, detail, passed)}` +
      `  ·  Δ ${(error * 100).toFixed(4)}%` +
      `  ·  tolerance ±${(tolerance * 100).toFixed(1)}%`,
  };
}

/** A check stated as a plain predicate: an order of magnitude, a range, an ordering. */
function asserted(name: string, formula: string, detail: string, passed: boolean): CheckResult {
  return { name, passed, detail, line: head(name, formula, detail, passed) };
}

/** Logs a block exactly as it has always been logged, and returns it. */
function emit(title: string, results: CheckResult[]): CheckBlock {
  const failures = results.reduce((n, r) => n + (r.passed ? 0 : 1), 0);
  const summary = `${title} — ${results.length - failures}/${results.length} passed`;

  console[failures > 0 ? 'warn' : 'info'](
    `[lodestar] ${summary}\n${results.map((r) => r.line).join('\n')}`,
  );

  return { title, results, failures };
}

/**
 * Runs the five sanity checks and logs computed vs expected for each. Returns
 * the block so a caller can escalate — `main.tsx` only wants the console output,
 * `tests/physics.test.ts` asserts on every result.
 */
export function runSanityChecks(): CheckBlock {
  const results = CHECKS.map((check) => {
    const gloss = check.gloss ? ` (${check.gloss(check.computed)})` : '';
    return toleranced(
      check.name,
      check.formula,
      `computed ${significant(check.computed)} ${check.unit}${gloss}` +
        `  ·  expected ${check.expected} ${check.unit}`,
      relativeError(check.computed, check.expected),
      check.tolerance,
    );
  });

  return emit('physics sanity checks', results);
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
export function verifyKeplerModel(): CheckBlock {
  const TAU = 2 * Math.PI;
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

  return emit('kepler orbit checks', results);
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

/**
 * Cross-validates the atmospheric retention model.
 *
 * Outside the five-check count for the same reason as the rest. Five checks,
 * against bodies whose atmospheres we can look up.
 *
 * Two of them do not say what a first guess would say, and the reasons are the
 * interesting part rather than a fudge:
 *
 *   - Helium on Earth comes out *marginal*, not lost. That is the right answer.
 *     Earth is losing helium continuously, which is why the world has a helium
 *     supply problem, but losing it over geologic time is exactly what the band
 *     between the two thresholds means; rounding it down to "lost" would claim
 *     the atmosphere contains none.
 *   - The Moon comes out able to hold CO2, at a ratio of 6.2 against a threshold
 *     of 6. The Moon is of course airless, and that is not a contradiction: this
 *     criterion covers thermal escape only, and the Moon is airless because
 *     nothing resupplies it and because non-thermal losses, sputtering and
 *     solar-wind pickup, have run for four and a half billion years. So the
 *     check asserts what the criterion is entitled to claim: the Moon cannot
 *     hold the light gases and does not clear the bar for N2 or O2.
 */
export function verifyAtmosphereModel(): CheckBlock {
  const results: CheckResult[] = [];

  /** Every gas ratio at one body, for the detail line. */
  const ratios = (bodyMass: number, radius: number, t: number) =>
    GASES.map(
      (gas) =>
        `GASID ${significant(retentionVerdict(bodyMass, radius, t, gas.mass).ratio)}`.replace(
          'GASID',
          gas.id,
        ),
    ).join('  ·  ');

  const verdictOf = (bodyMass: number, radius: number, t: number, id: string) =>
    retentionVerdict(bodyMass, radius, t, gasById(id).mass);

  /* 1 - Earth at a representative exosphere temperature. */
  const earthT = 1000;
  const earthHolds = ['N2', 'O2', 'CO2'].every(
    (id) => verdictOf(M_EARTH, R_EARTH, earthT, id).verdict === 'retains',
  );
  const earthSheds = ['H2', 'He'].every(
    (id) => verdictOf(M_EARTH, R_EARTH, earthT, id).verdict !== 'retains',
  );
  results.push(
    asserted(
      'Earth holds nitrogen, oxygen and carbon dioxide, and not hydrogen or helium',
      'v_esc / v_th  vs  6 (retains) and 4.5 (loses)',
      `${ratios(M_EARTH, R_EARTH, earthT)}  ·  at T = ${earthT} K  ·  He is ` +
        `${verdictOf(M_EARTH, R_EARTH, earthT, 'He').verdict}: Earth's helium loss is real and ongoing`,
      earthHolds && earthSheds,
    ),
  );

  /* 2 - the Moon, dayside.

     390 K is the dayside surface, and for the Moon that *is* the exobase: with
     no atmosphere above it there is no exosphere to be hotter than the ground.
     The number matters more here than anywhere else in this file, because the
     module's layer 4 quotes the verdict it produces. */
  const moonT = 390;
  const moonSheds = ['H2', 'He', 'H2O'].every(
    (id) => verdictOf(M_MOON, R_MOON, moonT, id).verdict === 'loses',
  );
  const moonNoHeavies = ['N2', 'O2'].every(
    (id) => verdictOf(M_MOON, R_MOON, moonT, id).verdict !== 'retains',
  );
  // The claim the copy makes, asserted rather than left to the detail line.
  const moonKeepsCo2 = verdictOf(M_MOON, R_MOON, moonT, 'CO2').verdict === 'retains';
  results.push(
    asserted(
      'The Moon sheds the light gases, is marginal for N2 and O2, and narrowly keeps CO2',
      'v_esc / v_th  vs  6 (retains) and 4.5 (loses)',
      `${ratios(M_MOON, R_MOON, moonT)}  ·  at T = ${moonT} K, the dayside surface  ·  ` +
        `CO2 sits at ${significant(verdictOf(M_MOON, R_MOON, moonT, 'CO2').ratio)}, just over ` +
        `the threshold: thermal escape is not why the Moon is airless`,
      moonSheds && moonNoHeavies && moonKeepsCo2,
    ),
  );

  /* 3 - Jupiter keeps the lightest gas there is. */
  const jupiter = verdictOf(M_JUPITER, R_JUPITER, 1000, 'H2');
  results.push(
    asserted(
      'Jupiter retains hydrogen',
      'v_esc / v_th  >=  6',
      `ratio ${significant(jupiter.ratio)}  ·  v_esc ` +
        `${significant(jupiter.escapeSpeed / 1000)} km/s  ·  v_th ` +
        `${significant(jupiter.thermalSpeed / 1000)} km/s  ·  verdict ${jupiter.verdict}`,
      jupiter.verdict === 'retains',
    ),
  );

  /* 4 - Titan: small, but cold enough that it does not matter. */
  const titan = verdictOf(1.3452e23, 2.575e6, 150, 'N2');
  results.push(
    asserted(
      'A Titan-sized body at 150 K retains nitrogen',
      'v_esc / v_th  >=  6',
      `ratio ${significant(titan.ratio)}  ·  v_esc ` +
        `${significant(titan.escapeSpeed / 1000)} km/s  ·  v_th ` +
        `${significant(titan.thermalSpeed / 1000)} km/s  ·  cold beats small`,
      titan.verdict === 'retains',
    ),
  );

  /* 5 - the model moves the way the algebra says it must. */
  const light = gasById('H2').mass;
  const heavy = gasById('CO2').mass;
  let monotonicInT = true;
  let monotonicInMass = true;
  for (let t = 100; t <= 2400; t += 100) {
    const hotter = jeansParameter(M_EARTH, R_EARTH, t + 100, light);
    if (!(hotter < jeansParameter(M_EARTH, R_EARTH, t, light))) monotonicInT = false;
    if (!(jeansParameter(M_EARTH, R_EARTH, t, heavy) > jeansParameter(M_EARTH, R_EARTH, t, light))) {
      monotonicInMass = false;
    }
  }
  const lightRatio = retentionVerdict(M_EARTH, R_EARTH, 1000, light).ratio;
  const heavyRatio = retentionVerdict(M_EARTH, R_EARTH, 1000, heavy).ratio;
  results.push(
    asserted(
      'The escape parameter falls with temperature and rises with molecular mass',
      'lambda = G M m / (R k_B T)',
      `24 steps from 100 K to 2500 K  ·  H2 ratio ${significant(lightRatio)} < ` +
        `CO2 ratio ${significant(heavyRatio)}  ·  heavier is held, hotter is lost`,
      monotonicInT && monotonicInMass && lightRatio < heavyRatio,
    ),
  );

  return emit('atmosphere checks', results);
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

/**
 * The expansion module's numbers, against the worked example in its layer 5.
 *
 * The Coma Cluster at 100 Mpc and Planck's H₀ is the sim's default and the
 * math layer's worked example, so these are the exact figures a reader sees
 * printed there: 6 740 km/s, z = 0.0225, Hα at 671.0 nm, a 14.5-billion-year
 * Hubble time. Andromeda is the other end: close enough that its own motion
 * beats the expansion, so the same functions have to produce a blueshift.
 */
export function verifyCosmologyModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the unit conversion everything else rests on. */
  const h0 = 67.4 * KM_S_PER_MPC;
  results.push(
    toleranced(
      '67.4 km/s/Mpc in SI',
      'H₀ = 67.4 × 10³ m/s / 10⁶ pc',
      `computed ${significant(h0)} s⁻¹  ·  expected 2.184e-18 s⁻¹`,
      relativeError(h0, 2.184e-18),
      TIGHT,
    ),
  );

  /* 2 — Hubble time at Planck's value. */
  const tH = hubbleTime(H0_PLANCK_2018) / JULIAN_YEAR / 1e9;
  results.push(
    toleranced(
      'Hubble time at H₀ = 67.4 km/s/Mpc',
      't_H = 1 / H₀',
      `computed ${significant(tH)} Gyr  ·  expected 14.5 Gyr`,
      relativeError(tH, 14.5),
      LOOSE,
    ),
  );

  /* 3–5 — the Coma Cluster, 100 Mpc (3.0857e24 m), no peculiar velocity. */
  const comaD = 3.0857e24;
  const comaV = recessionVelocity(H0_PLANCK_2018, comaD);
  results.push(
    toleranced(
      'Coma recession velocity',
      'v = H₀ d',
      `computed ${significant(comaV / 1e3)} km/s  ·  expected 6740 km/s`,
      relativeError(comaV / 1e3, 6740),
      0.005,
    ),
  );
  const comaZ = redshiftFromVelocity(lineOfSightVelocity(H0_PLANCK_2018, comaD, 0));
  results.push(
    toleranced(
      'Coma redshift',
      'z = v / c',
      `computed ${significant(comaZ)}  ·  expected 0.0225`,
      relativeError(comaZ, 0.0225),
      0.005,
    ),
  );
  const comaLambda = observedWavelength(H_ALPHA_AIR, comaZ) * 1e9;
  results.push(
    asserted(
      'Coma Hα observed wavelength',
      'λ_obs = λ_rest (1 + z)',
      `computed ${comaLambda.toFixed(3)} nm  ·  expected 671.0 ± 0.1 nm`,
      Math.abs(comaLambda - 671.0) <= 0.1,
    ),
  );

  /* 6 — Andromeda: 2.4e22 m, approaching at 110 km/s. A blueshift. */
  const m31V = lineOfSightVelocity(H0_PLANCK_2018, 2.4e22, -1.1e5);
  const m31Lambda = observedWavelength(H_ALPHA_AIR, redshiftFromVelocity(m31V)) * 1e9;
  results.push(
    asserted(
      'Andromeda is blueshifted',
      'v = H₀ d + v_pec < 0  ⇒  λ_obs < λ_rest',
      `v = ${significant(m31V / 1e3)} km/s  ·  λ_obs = ${m31Lambda.toFixed(3)} nm` +
        `  ·  lab ${(H_ALPHA_AIR * 1e9).toFixed(2)} nm`,
      m31V < 0 && m31Lambda < H_ALPHA_AIR * 1e9,
    ),
  );

  /* 7 — the linear redshift refuses a speed it has no meaning at. */
  const throwsAt = (v: number) => {
    try {
      redshiftFromVelocity(v);
      return false;
    } catch {
      return true;
    }
  };
  const refuses = throwsAt(C) && throwsAt(-C) && throwsAt(1.5 * C) && !throwsAt(0.999 * C);
  results.push(
    asserted(
      'redshiftFromVelocity throws at |v| ≥ c',
      '|v| ≥ c  ⇒  RangeError',
      `c, −c and 1.5c ${refuses ? 'rejected' : 'NOT all rejected'}; 0.999c accepted`,
      refuses,
    ),
  );

  return emit('cosmology checks', results);
}

/**
 * The microwave background module's numbers, against its layer-5 worked
 * example and the published measurements behind it.
 *
 * Today's sky: Wien's peak at 1.063 mm, a 3.362 mK dipole at the Solar
 * System's 369.82 km/s, 411 photons per cubic centimetre, and a B_ν peak of
 * about 384 MJy/sr near 160 GHz. Last scattering: 2973 K at z_*. Both forms of
 * Planck's law are checked against each other, because the sim plots one and
 * the readout quotes the other.
 */
export function verifyCmbModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — Wien's peak today. */
  const peak = wienPeakWavelength(T_CMB);
  results.push(
    toleranced(
      'Wien peak wavelength at T₀',
      'λ_peak = b / T',
      `computed ${significant(peak * 1e3)} mm  ·  expected 1.063 mm`,
      relativeError(peak, 1.063e-3),
      TIGHT,
    ),
  );

  /* 2 — B_ν near its peak today. */
  const bnu = planckSpectralRadiance(1.602e11, T_CMB);
  results.push(
    toleranced(
      'B_ν at 160.2 GHz, T₀',
      'B_ν = (2hν³/c²) / expm1(hν/kT)',
      `computed ${significant(bnu)} W m⁻² Hz⁻¹ sr⁻¹  ·  expected 3.84e-18`,
      relativeError(bnu, 3.84e-18),
      LOOSE,
    ),
  );

  /* 3 — B_λ at Wien's peak today. */
  const blam = planckSpectralRadianceWavelength(1.063e-3, T_CMB);
  results.push(
    toleranced(
      'B_λ at 1.063 mm, T₀',
      'B_λ = (2hc²/λ⁵) / expm1(hc/λkT)',
      `computed ${significant(blam)} W m⁻³ sr⁻¹  ·  expected 6.17e-4`,
      relativeError(blam, 6.17e-4),
      LOOSE,
    ),
  );

  /* 4 — the two forms agree: B_ν(c/λ) = B_λ(λ) · λ² / c. */
  const cases: [number, number][] = [
    [1e-3, T_CMB],
    [1e-6, 3000],
  ];
  const worst = Math.max(
    ...cases.map(([lambda, T]) => {
      const perFrequency = planckSpectralRadiance(C / lambda, T);
      const perWavelength = (planckSpectralRadianceWavelength(lambda, T) * lambda ** 2) / C;
      return Math.abs(relativeError(perFrequency, perWavelength));
    }),
  );
  results.push(
    asserted(
      'B_ν and B_λ agree',
      'B_ν(c/λ) = B_λ(λ) · λ² / c',
      `worst relative difference ${worst.toExponential(2)} at (1 mm, T₀) and (1 µm, 3000 K)  ·  limit 1e-9`,
      worst <= 1e-9,
    ),
  );

  /* 5 — the kinematic dipole. */
  const dipole = dipoleAmplitude(T_CMB, V_SUN_CMB);
  results.push(
    toleranced(
      'Dipole amplitude at 369.82 km/s',
      'ΔT = T v / c',
      `computed ${significant(dipole * 1e3)} mK  ·  expected 3.362 mK`,
      relativeError(dipole, 3.362e-3),
      TIGHT,
    ),
  );

  /* 6 — photons per cubic metre. */
  const n = photonNumberDensity(T_CMB);
  results.push(
    toleranced(
      'Photon number density at T₀',
      'n_γ = 16π ζ(3) (kT / hc)³',
      `computed ${significant(n)} m⁻³  ·  expected 4.11e8 m⁻³`,
      relativeError(n, 4.11e8),
      0.005,
    ),
  );

  /* 7 — the temperature at last scattering. */
  const tStar = cmbTemperatureAtRedshift(Z_RECOMBINATION);
  results.push(
    toleranced(
      'Temperature at z_*',
      'T = T₀ (1 + z)',
      `computed ${significant(tStar)} K  ·  expected 2973 K`,
      relativeError(tStar, 2973),
      TIGHT,
    ),
  );

  /* 8 — a temperature colder than today has no redshift. */
  const throwsAt = (T: number) => {
    try {
      redshiftAtTemperature(T);
      return false;
    } catch {
      return true;
    }
  };
  const refuses = throwsAt(T_CMB * 0.999) && throwsAt(0) && !throwsAt(T_CMB);
  results.push(
    asserted(
      'redshiftAtTemperature throws below T₀',
      'T < T₀  ⇒  RangeError',
      `0.999 T₀ and 0 K ${refuses ? 'rejected' : 'NOT both rejected'}; T₀ accepted`,
      refuses,
    ),
  );

  /* 9 — both forms survive the far radio end, where hν ≪ kT. */
  const radioNu = planckSpectralRadiance(C / 1, T_CMB);
  const radioLambda = planckSpectralRadianceWavelength(1, T_CMB);
  const healthy = (x: number) => Number.isFinite(x) && x > 0;
  results.push(
    asserted(
      'Planck functions finite and positive at λ = 1 m, T₀',
      'expm1 keeps the Rayleigh–Jeans tail',
      `B_ν = ${significant(radioNu)}  ·  B_λ = ${significant(radioLambda)}`,
      healthy(radioNu) && healthy(radioLambda),
    ),
  );

  return emit('microwave background checks', results);
}

/**
 * The early-universe module's history, against the landmarks it quotes.
 *
 * Ten billion kelvin at one second; about six trillion at a microsecond; the
 * quark–hadron step near ten microseconds; the electron freezing out near
 * three seconds; recombination near 378 000 years; matter–radiation equality
 * near z = 3400; today at 13.80 Gyr. Then the two joins the model depends on:
 * the radiation formula and the ΛCDM integral must agree where they hand over,
 * and the time-to-scale-factor inverse must come back to a = 1 today.
 *
 * Ranges rather than tolerances where the target is a published range: the
 * step approximation to g_* is good to a few percent, not to a part in 10³.
 */
export function verifyEarlyUniverseModel(): CheckBlock {
  const results: CheckResult[] = [];
  const within = (x: number, lo: number, hi: number) => x >= lo && x <= hi;

  /* 1 — one second in. */
  const tOne = temperatureAtTime(1);
  results.push(
    asserted(
      'Temperature at one second',
      'kT = (90ħ³c⁵ / 32π³G g_*)^(1/4) / √t',
      `computed ${significant(tOne)} K  ·  expected 9.7e9 … 1.03e10 K`,
      within(tOne, 9.7e9, 1.03e10),
    ),
  );

  /* 2 — one microsecond in. */
  const tMicro = temperatureAtTime(1e-6);
  results.push(
    asserted(
      'Temperature at one microsecond',
      'kT = (90ħ³c⁵ / 32π³G g_*)^(1/4) / √t',
      `computed ${significant(tMicro)} K  ·  expected 5.5e12 … 7.5e12 K`,
      within(tMicro, 5.5e12, 7.5e12),
    ),
  );

  /* 3 — the quark–hadron step. */
  const tQcd = radiationTimeAtTemperature((170e6 * EV) / K_B);
  results.push(
    asserted(
      'Time at kT = 170 MeV',
      't = √(90ħ³c⁵ / 32π³G g_*) / (kT)²',
      `computed ${significant(tQcd)} s  ·  expected 8e-6 … 2.5e-5 s`,
      within(tQcd, 8e-6, 2.5e-5),
    ),
  );

  /* 4 — the electron stops being made. */
  const tElectron = freezeOutTime(M_ELECTRON * C ** 2);
  results.push(
    asserted(
      'Electron freeze-out time',
      't_f = t(kT = m_e c²)',
      `computed ${significant(tElectron)} s  ·  expected 2.6 … 3.1 s`,
      within(tElectron, 2.6, 3.1),
    ),
  );

  /* 5 — the age today. */
  const age = lcdmTimeAtScaleFactor(1) / JULIAN_YEAR / 1e9;
  results.push(
    toleranced(
      'Age at a = 1',
      't = ∫₀¹ da / (a H(a))',
      `computed ${significant(age)} Gyr  ·  expected 13.80 Gyr`,
      relativeError(age, 13.8),
      0.005,
    ),
  );

  /* 6 — last scattering. */
  const tRecombination = lcdmTimeAtScaleFactor(1 / (1 + Z_RECOMBINATION)) / JULIAN_YEAR;
  results.push(
    toleranced(
      'Age at z_*',
      't = ∫₀^a da / (a H(a)),  a = 1/(1 + z_*)',
      `computed ${significant(tRecombination)} yr  ·  expected 3.78e5 yr`,
      relativeError(tRecombination, 3.78e5),
      0.03,
    ),
  );

  /* 7 — matter–radiation equality. */
  const zEq = 1 / (radiationDensityParameter() / OMEGA_M) - 1;
  results.push(
    asserted(
      'Redshift of matter–radiation equality',
      '1 + z_eq = Ω_m / Ω_r',
      `computed ${significant(zEq)}  ·  expected 3300 … 3550`,
      within(zEq, 3300, 3550),
    ),
  );

  /* 8 — the two models agree where they hand over. */
  const stitch = stitchTime();
  const jump = Math.abs(temperatureAtTime(stitch * 1.01) / temperatureAtTime(stitch * 0.99) - 1);
  results.push(
    asserted(
      'Continuity at the radiation–ΛCDM stitch',
      '|T(1.01 t_s) / T(0.99 t_s) − 1| < 3%',
      `stitch at ${significant(stitch)} s  ·  difference ${(jump * 100).toFixed(3)}%`,
      jump < 0.03,
    ),
  );

  /* 9 — the far end comes back to today. */
  const aNow = scaleFactorAtTime(lcdmTimeAtScaleFactor(1));
  results.push(
    asserted(
      'Scale factor today round-trips to 1',
      'a(t(a = 1)) = 1',
      `computed ${aNow.toFixed(7)}  ·  expected 1 ± 1e-4`,
      Math.abs(aNow - 1) <= 1e-4,
    ),
  );

  return emit('early universe checks', results);
}

/**
 * The fusion module's numbers, against its layer-5 worked example.
 *
 * Two protons: a Gamow energy of 493 keV and a Coulomb barrier of 1.03 MeV at
 * 1.4 fm. The Sun's centre: a Gamow peak near 6.1 keV and 6.6 keV wide, where a
 * collision tunnels about one time in ten thousand and about one proton in a
 * hundred has the energy; a pp rate of order 10⁻³ W/kg, rising as about T⁴.
 * Ranges where the target is an order of magnitude, tolerances where the
 * worked example quotes a figure.
 */
export function verifyFusionModel(): CheckBlock {
  const results: CheckResult[] = [];
  const within = (x: number, lo: number, hi: number) => x >= lo && x <= hi;
  const keV = (joules: number) => joules / EV / 1e3;

  /* 1 — the Gamow energy for two protons. */
  results.push(
    toleranced(
      'Gamow energy, p + p',
      'E_G = 2 m_r c² (π α Z₁Z₂)²,  m_r = m_p / 2',
      `computed ${significant(keV(PP_GAMOW_ENERGY))} keV  ·  expected 493 keV`,
      relativeError(keV(PP_GAMOW_ENERGY), 493),
      0.01,
    ),
  );

  /* 2 — the Coulomb barrier at the edge of the nuclear well. */
  results.push(
    toleranced(
      'Coulomb barrier, p + p at 1.4 fm',
      'V = Z₁Z₂e² / (4π ε₀ r)',
      `computed ${significant(keV(PP_BARRIER) / 1e3)} MeV  ·  expected 1.03 MeV`,
      relativeError(keV(PP_BARRIER) / 1e3, 1.03),
      0.01,
    ),
  );

  /* 3 — the Gamow peak at the Sun's centre. */
  const peak = gamowPeak(PP_GAMOW_ENERGY, T_SUN_CORE);
  results.push(
    toleranced(
      'Gamow peak at the solar core',
      'E₀ = (E_G (kT)² / 4)^(1/3)',
      `computed ${significant(keV(peak))} keV  ·  expected 6.1 keV`,
      relativeError(keV(peak), 6.1),
      0.03,
    ),
  );

  /* 4 — tunnelling at that peak. */
  const tunnel = tunnellingProbability(PP_GAMOW_ENERGY, peak);
  results.push(
    asserted(
      'Tunnelling probability at the Gamow peak',
      'P = exp(−√(E_G / E₀))',
      `computed ${significant(tunnel)}  ·  expected 1.0e-4 … 1.5e-4`,
      within(tunnel, 1.0e-4, 1.5e-4),
    ),
  );

  /* 5 — the Boltzmann factor at that peak. */
  const boltzmann = boltzmannFraction(peak, T_SUN_CORE);
  results.push(
    asserted(
      'Boltzmann factor at the Gamow peak',
      'f = exp(−E₀ / kT)',
      `computed ${significant(boltzmann)}  ·  expected 0.009 … 0.013`,
      within(boltzmann, 0.009, 0.013),
    ),
  );

  /* 6 — the width of the window. */
  const width = gamowWindowWidth(peak, T_SUN_CORE);
  results.push(
    toleranced(
      'Gamow window width at the solar core',
      'Δ = 4 √(E₀ kT / 3)',
      `computed ${significant(keV(width))} keV  ·  expected 6.6 keV`,
      relativeError(keV(width), 6.6),
      0.05,
    ),
  );

  /* 7 — the pp rate at the centre. */
  const rate = ppEnergyRate(RHO_SUN_CORE, X_SUN_CORE, T_SUN_CORE);
  results.push(
    asserted(
      'pp energy rate at the solar core',
      'ε = 0.241 ρ X² T₆^(−2/3) exp(−33.80 T₆^(−1/3))',
      `computed ${significant(rate)} W/kg  ·  expected 3e-4 … 3e-2 W/kg`,
      within(rate, 3e-4, 3e-2),
    ),
  );

  /* 8 — its temperature sensitivity. */
  const nu = temperatureExponent(T_SUN_CORE);
  results.push(
    asserted(
      'Temperature exponent of the pp rate',
      'ν = −2/3 + (33.80 / 3) T₆^(−1/3)',
      `computed ${significant(nu)}  ·  expected 3.5 … 4.5`,
      within(nu, 3.5, 4.5),
    ),
  );

  return emit('fusion checks', results);
}

/**
 * The supernova module's numbers, against the anchors its prose quotes.
 *
 * The Sun: ten billion years, one solar luminosity, a white dwarf of half a
 * solar mass. The three fates at 1, 10 and 30 M☉. A neutron star's collapse
 * releasing about 3 × 10⁴⁶ J. A Type Ia peaking near 1.6 × 10³⁶ W, reading
 * −19.3 at 10 pc and −13.2 at Betelgeuse's 168 pc, and fading to the naked-eye
 * limit at about 1.15 Mpc.
 */
export function verifySupernovaModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the Sun's lifetime. */
  const lifetime = mainSequenceLifetime(M_SUN) / JULIAN_YEAR / 1e9;
  results.push(
    toleranced(
      'Main-sequence lifetime of the Sun',
      't_MS = 10¹⁰ yr · (M / M☉)^(−2.5)',
      `computed ${significant(lifetime)} Gyr  ·  expected 10 Gyr`,
      relativeError(lifetime, 10),
      TIGHT,
    ),
  );

  /* 2 — the Sun's luminosity. */
  const luminosity = mainSequenceLuminosity(M_SUN) / L_SUN;
  results.push(
    toleranced(
      'Main-sequence luminosity of the Sun',
      'L = L☉ · (M / M☉)^3.5',
      `computed ${significant(luminosity)} L☉  ·  expected 1 L☉`,
      relativeError(luminosity, 1),
      TIGHT,
    ),
  );

  /* 3 — the three fates. */
  const fates = [fate(M_SUN), fate(10 * M_SUN), fate(30 * M_SUN)];
  results.push(
    asserted(
      'Fates at 1, 10 and 30 M☉',
      'cuts at 8 and 20 M☉',
      `computed ${fates.join(', ')}  ·  expected white-dwarf, neutron-star, black-hole`,
      fates.join() === 'white-dwarf,neutron-star,black-hole',
    ),
  );

  /* 4 — the Sun's white dwarf. */
  const remnant = remnantMass(M_SUN) / M_SUN;
  results.push(
    toleranced(
      'White-dwarf mass left by the Sun',
      'M_f = (0.109 M_i/M☉ + 0.394) M☉',
      `computed ${significant(remnant)} M☉  ·  expected 0.503 M☉`,
      relativeError(remnant, 0.503),
      LOOSE,
    ),
  );

  /* 5 — a neutron star's binding energy. */
  const binding = collapseEnergy(M_NS_TYPICAL, R_NS);
  results.push(
    asserted(
      'Binding energy of a 1.4 M☉, 12 km neutron star',
      'E = 3 G M² / (5 R)',
      `computed ${significant(binding)} J  ·  expected 2.3e46 … 2.9e46 J`,
      binding >= 2.3e46 && binding <= 2.9e46,
    ),
  );

  /* 6 — a Type Ia at peak. */
  const peak = typeIaPeakLuminosity();
  results.push(
    toleranced(
      'Type Ia peak luminosity',
      'L = L☉ · 10^(−0.4 (M_Ia − M_bol,☉))',
      `computed ${significant(peak)} W  ·  expected 1.6e36 W`,
      relativeError(peak, 1.6e36),
      0.05,
    ),
  );

  /* 7 — at 10 pc, apparent equals absolute. */
  const at10 = apparentMagnitude(M_IA_PEAK, 10 * PARSEC);
  results.push(
    asserted(
      'Type Ia at 10 pc',
      'm = M + 5 log₁₀(d / 10 pc)',
      `computed ${at10.toFixed(4)}  ·  expected −19.3 ± 0.001`,
      Math.abs(at10 - M_IA_PEAK) <= 0.001,
    ),
  );

  /* 8 — at Betelgeuse's distance. */
  const at168 = apparentMagnitude(M_IA_PEAK, 168 * PARSEC);
  results.push(
    asserted(
      'Type Ia at 168 pc',
      'm = M + 5 log₁₀(d / 10 pc)',
      `computed ${at168.toFixed(3)}  ·  expected −13.2 ± 0.1`,
      Math.abs(at168 - -13.2) <= 0.1,
    ),
  );

  /* 9 — where a Type Ia fades to the naked-eye limit. */
  const nakedEye = distanceForMagnitude(M_IA_PEAK, MAG_NAKED_EYE) / PARSEC / 1e6;
  results.push(
    toleranced(
      'Naked-eye distance for a Type Ia',
      'd = 10 pc · 10^((m − M) / 5)',
      `computed ${significant(nakedEye)} Mpc  ·  expected 1.15 Mpc`,
      relativeError(nakedEye, 1.15),
      0.03,
    ),
  );

  return emit('supernova checks', results);
}

/**
 * The habitable-zone model against the figures the module quotes.
 *
 * Earth's flux and temperatures, Venus's and Mars's equilibrium temperatures,
 * the Sun's conservative zone edges, the verdicts for the three planets, and
 * the edge's square-root scaling with luminosity.
 */
export function verifyHabitableModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the solar constant from L☉. */
  const flux = stellarFlux(L_SUN, AU);
  results.push(
    toleranced(
      'Stellar flux at 1 AU',
      'S = L / (4π d²)',
      `computed ${significant(flux)} W/m²  ·  expected 1361 W/m²`,
      relativeError(flux, 1361),
      0.005,
    ),
  );

  /* 2 — Earth with no atmosphere. */
  const earth = equilibriumTemperature(L_SUN, AU, A_EARTH);
  results.push(
    asserted(
      'Equilibrium temperature of Earth',
      'T_eq = ((1 − A) L / (16 π σ d²))^(1/4)',
      `computed ${significant(earth)} K  ·  expected 255 ± 1 K`,
      Math.abs(earth - 255) <= 1,
    ),
  );

  /* 3 — Earth with its greenhouse. */
  const surface = surfaceTemperatureEarthLike(earth);
  results.push(
    asserted(
      'Surface temperature of Earth',
      'T = T_eq + 33 K',
      `computed ${significant(surface)} K  ·  expected 288 ± 1 K`,
      Math.abs(surface - 288) <= 1,
    ),
  );

  /* 4 — Venus, colder than Earth for all its closeness. */
  const venus = equilibriumTemperature(L_SUN, 0.723 * AU, A_VENUS);
  results.push(
    asserted(
      'Equilibrium temperature of Venus',
      'T_eq at 0.723 AU, A = 0.77',
      `computed ${significant(venus)} K  ·  expected 227 ± 2 K`,
      Math.abs(venus - 227) <= 2,
    ),
  );

  /* 5 — Mars. */
  const mars = equilibriumTemperature(L_SUN, 1.524 * AU, A_MARS);
  results.push(
    asserted(
      'Equilibrium temperature of Mars',
      'T_eq at 1.524 AU, A = 0.25',
      `computed ${significant(mars)} K  ·  expected 210 ± 2 K`,
      Math.abs(mars - 210) <= 2,
    ),
  );

  /* 6 — the Sun's conservative inner edge. */
  const inner = zoneEdge(L_SUN, SEFF_MOIST) / AU;
  results.push(
    toleranced(
      'Inner edge of the Sun’s zone',
      'd = 1 AU · √((L / L☉) / S_eff), S_eff = 1.014',
      `computed ${significant(inner)} AU  ·  expected 0.993 AU`,
      relativeError(inner, 0.993),
      0.005,
    ),
  );

  /* 7 — and its outer edge. */
  const outer = zoneEdge(L_SUN, SEFF_MAXGH) / AU;
  results.push(
    toleranced(
      'Outer edge of the Sun’s zone',
      'd = 1 AU · √((L / L☉) / S_eff), S_eff = 0.343',
      `computed ${significant(outer)} AU  ·  expected 1.707 AU`,
      relativeError(outer, 1.707),
      0.005,
    ),
  );

  /* 8 — the verdicts for Earth, Venus and Mars. */
  const verdicts = [zoneVerdict(L_SUN, AU), zoneVerdict(L_SUN, 0.723 * AU), zoneVerdict(L_SUN, 1.524 * AU)];
  results.push(
    asserted(
      'Verdicts at 1, 0.723 and 1.524 AU',
      'conservative band, then optimistic, then side',
      `computed ${verdicts.join(', ')}  ·  expected inside, too-hot, inside`,
      verdicts.join() === 'inside,too-hot,inside',
    ),
  );

  /* 9 — a star a hundred times fainter: the zone ten times closer. */
  const dim = zoneEdge(0.01 * L_SUN, SEFF_MOIST) / AU;
  results.push(
    toleranced(
      'Inner edge for a 0.01 L☉ star',
      'd ∝ √L',
      `computed ${significant(dim)} AU  ·  expected 0.0993 AU`,
      relativeError(dim, 0.0993),
      0.005,
    ),
  );

  /* 10 — the mass–luminosity rule gives the Sun back exactly. */
  const sunMass = massFromLuminosity(L_SUN) / M_SUN;
  results.push(
    toleranced(
      'Mass of a 1 L☉ star',
      'M = M☉ · (L / L☉)^(1/3.5)',
      `computed ${significant(sunMass)} M☉  ·  expected 1 M☉`,
      relativeError(sunMass, 1),
      1e-9,
    ),
  );

  /* 11 — a red dwarf a hundred times fainter. */
  const dwarfMass = massFromLuminosity(0.01 * L_SUN) / M_SUN;
  results.push(
    asserted(
      'Mass of a 0.01 L☉ star',
      'M = M☉ · (L / L☉)^(1/3.5)',
      `computed ${significant(dwarfMass)} M☉  ·  expected 0.25 … 0.29 M☉`,
      dwarfMass >= 0.25 && dwarfMass <= 0.29,
    ),
  );

  return emit('habitable-zone checks', results);
}

/**
 * The H II region model against the figures the module quotes.
 *
 * The worked example's Strömgren radius, Orion's core, the ionized mass,
 * the recombination time, the front's thickness, and Spitzer's expansion at
 * the start and after a million years.
 */
export function verifyNebulaModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — an O7 star in diffuse gas. */
  const diffuse = stromgrenRadius(1e49, 1e8) / PARSEC;
  results.push(
    toleranced(
      'Strömgren radius, 1e49 s⁻¹ in 1e8 m⁻³',
      'R_S = (3 Q / (4π n² α_B))^(1/3)',
      `computed ${significant(diffuse)} pc  ·  expected 3.15 pc`,
      relativeError(diffuse, 3.15),
      0.02,
    ),
  );

  /* 2 — the same star in Orion's core. */
  const core = stromgrenRadius(1e49, 1e10) / PARSEC;
  results.push(
    toleranced(
      'Strömgren radius, 1e49 s⁻¹ in 1e10 m⁻³',
      'R_S ∝ n^(−2/3)',
      `computed ${significant(core)} pc  ·  expected 0.146 pc`,
      relativeError(core, 0.146),
      0.02,
    ),
  );

  /* 3 — the gas it lights. */
  const mass = ionizedMass(stromgrenRadius(1e49, 1e8), 1e8) / M_SUN;
  results.push(
    asserted(
      'Ionized mass, 1e49 s⁻¹ in 1e8 m⁻³',
      'M = (4/3) π R³ n m_p',
      `computed ${significant(mass)} M☉  ·  expected 300 … 350 M☉`,
      mass >= 300 && mass <= 350,
    ),
  );

  /* 4 — how fast it would fade. */
  const fade = recombinationTime(1e8) / JULIAN_YEAR;
  results.push(
    toleranced(
      'Recombination time at 1e8 m⁻³',
      't_rec = 1 / (n α_B)',
      `computed ${significant(fade)} yr  ·  expected 1220 yr`,
      relativeError(fade, 1220),
      0.03,
    ),
  );

  /* 5 — how sharp the edge is. */
  const front = frontThickness(1e8);
  results.push(
    asserted(
      'Ionization-front thickness at 1e8 m⁻³',
      'ℓ = 1 / (n σ)',
      `computed ${significant(front)} m  ·  expected 1e13 … 2e13 m`,
      front >= 1e13 && front <= 2e13,
    ),
  );

  /* 6 — Spitzer's law starts at the Strömgren radius. */
  const R = 3.15 * PARSEC;
  const start = expansionRadius(R, 0);
  results.push(
    asserted(
      'Spitzer expansion at t = 0',
      'R(0) = R_S',
      `computed ${start === R ? 'R exactly' : significant(start / PARSEC) + ' pc'}  ·  expected R exactly`,
      start === R,
    ),
  );

  /* 7 — and triples it in a million years. */
  const later = expansionRadius(R, 1e6 * JULIAN_YEAR) / PARSEC;
  results.push(
    toleranced(
      'Spitzer expansion of 3.15 pc at 1 Myr',
      'R(t) = R_S (1 + 7 c_s t / (4 R_S))^(4/7)',
      `computed ${significant(later)} pc  ·  expected 9.3 pc`,
      relativeError(later, 9.3),
      0.03,
    ),
  );

  return emit('nebula checks', results);
}

/**
 * The distance-ladder model against the figures the module quotes.
 *
 * Parallax at 100 pc and Gaia's precision at 1 kpc, the Leavitt law at 10 and
 * 30 days, the LMC's distance modulus, a Type Ia at 100 Mpc and a Cepheid in
 * Virgo, the offset that turns Planck's H₀ into SH0ES's and back, the share of
 * a galaxy's own motion at 50 Mpc, and which rung reaches the LMC.
 */
export function verifyLadderModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — one hundredth of an arcsecond at 100 pc, the parsec's definition. */
  const p100 = parallaxAngle(100 * PARSEC) / ARCSEC;
  results.push(
    toleranced(
      'Parallax at 100 pc',
      'p = 1 AU / d',
      `computed ${significant(p100)} arcsec  ·  expected 0.0100 arcsec`,
      relativeError(p100, 0.01),
      TIGHT,
    ),
  );

  /* 2 — Gaia's precision at 1 kpc. */
  const precision = parallaxFractionalError(1000 * PARSEC);
  results.push(
    toleranced(
      'Gaia parallax precision at 1 kpc',
      'σ_p / p, σ_p = 20 µas',
      `computed ${significant(precision)}  ·  expected 0.020`,
      relativeError(precision, 0.02),
      LOOSE,
    ),
  );

  /* 3 — the Leavitt law's zero point is its value at 10 days. */
  const m10 = leavittAbsoluteMagnitude(10);
  results.push(
    asserted(
      'Leavitt law at 10 days',
      'M_V = a + b (log₁₀ P − 1)',
      `computed ${m10}  ·  expected −4.05 exactly`,
      m10 === -4.05,
    ),
  );

  /* 4 — a 30-day Cepheid. */
  const m30 = leavittAbsoluteMagnitude(30);
  results.push(
    asserted(
      'Leavitt law at 30 days',
      'M_V = −4.05 − 2.43 (log₁₀ 30 − 1)',
      `computed ${m30.toFixed(4)}  ·  expected −5.209 ± 0.005`,
      Math.abs(m30 - -5.209) <= 0.005,
    ),
  );

  /* 5 — the LMC anchor. */
  const muLmc = distanceModulus(D_LMC);
  results.push(
    asserted(
      'Distance modulus of the LMC',
      'μ = 5 log₁₀(d / 10 pc)',
      `computed ${muLmc.toFixed(4)}  ·  expected 18.477 ± 0.002`,
      Math.abs(muLmc - 18.477) <= 0.002,
    ),
  );

  /* 6 — a Type Ia at 100 Mpc. */
  const mIa = ladderApparentMagnitude(M_IA_PEAK, 100e6 * PARSEC);
  results.push(
    asserted(
      'Type Ia at 100 Mpc',
      'm = M + μ',
      `computed ${mIa.toFixed(3)}  ·  expected 15.70 ± 0.01`,
      Math.abs(mIa - 15.7) <= 0.01,
    ),
  );

  /* 7 — a 30-day Cepheid in the Virgo Cluster. */
  const mCeph = ladderApparentMagnitude(leavittAbsoluteMagnitude(30), 16.5e6 * PARSEC);
  results.push(
    asserted(
      '30-day Cepheid at 16.5 Mpc',
      'm = M + μ',
      `computed ${mCeph.toFixed(3)}  ·  expected 25.88 ± 0.02`,
      Math.abs(mCeph - 25.88) <= 0.02,
    ),
  );

  /* 8 — the offset that turns Planck's H₀ into SH0ES's. */
  const tension = inferredH0(H0_PLANCK_2018, 0.1747);
  results.push(
    toleranced(
      'H₀ from Planck with δ = 0.1747 mag',
      'H₀,ladder = H₀,true · 10^(δ/5)',
      `computed ${significant(tension / KM_S_PER_MPC)} km/s/Mpc  ·  expected 73.04 km/s/Mpc`,
      relativeError(tension, H0_SH0ES_2022),
      TIGHT,
    ),
  );

  /* 9 — and the offset from the ratio. */
  const offset = offsetForH0Ratio(73.04 / 67.4);
  results.push(
    asserted(
      'Offset for 73.04 / 67.4',
      'δ = 5 log₁₀(ratio)',
      `computed ${offset.toFixed(5)} mag  ·  expected 0.1746 ± 0.001`,
      Math.abs(offset - 0.1746) <= 0.001,
    ),
  );

  /* 10 — where a galaxy's own motion stops mattering. */
  const share = peculiarVelocityShare(H0_PLANCK_2018, 50e6 * PARSEC);
  results.push(
    toleranced(
      'Peculiar-velocity share at 50 Mpc',
      'v_pec / (H₀ d)',
      `computed ${significant(share)}  ·  expected 0.089`,
      relativeError(share, 0.089),
      0.02,
    ),
  );

  /* 11 — only Cepheids reach the LMC. */
  const rungs = rungsAt(D_LMC).map((rung) => rung.id);
  results.push(
    asserted(
      'Rungs at the LMC',
      'd within [dMin, dMax]',
      `computed ${rungs.join(', ') || 'none'}  ·  expected cepheids`,
      rungs.join() === 'cepheids',
    ),
  );

  /* 12 — and only Cepheids reach the Galactic centre, past parallax's few-percent range. */
  const centre = rungsAt(8.2e3 * PARSEC).map((rung) => rung.id);
  results.push(
    asserted(
      'Rungs at the Galactic centre',
      'd within [dMin, dMax]',
      `computed ${centre.join(', ') || 'none'}  ·  expected cepheids`,
      centre.join() === 'cepheids',
    ),
  );

  return emit('distance-ladder checks', results);
}

/**
 * The time-dilation model against the figures the module quotes.
 *
 * The Lorentz factor at 0.8 c and 0.998 c, the clock deficit at motorway
 * speed (where the naive 1 − 1/γ cancels to nothing), the twin trip to
 * Proxima, the GPS orbit and its daily clock budget, clocks at 1.5 and 1.01
 * Schwarzschild radii, and the deficit at Earth's surface.
 */
export function verifyRelativityModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the twin example's speed. */
  const g8 = lorentzFactor(0.8 * C);
  results.push(
    asserted(
      'Lorentz factor at 0.8 c',
      'γ = 1 / √(1 − v²/c²)',
      `computed ${g8.toFixed(6)}  ·  expected 1.66667 ± 1e-5`,
      Math.abs(g8 - 1.66667) <= 1e-5,
    ),
  );

  /* 2 — a cosmic-ray muon's speed. */
  const g998 = lorentzFactor(0.998 * C);
  results.push(
    toleranced(
      'Lorentz factor at 0.998 c',
      'γ = 1 / √(1 − v²/c²)',
      `computed ${significant(g998)}  ·  expected 15.82`,
      relativeError(g998, 15.82),
      TIGHT,
    ),
  );

  /* 3 — motorway speed, where the naive form returns rounding noise. */
  const d30 = clockDeficit(30);
  results.push(
    toleranced(
      'Clock deficit at 30 m/s',
      '1 − 1/γ = β² / (1 + √(1 − β²))',
      `computed ${significant(d30)}  ·  expected 5.0e-15`,
      relativeError(d30, 5.0e-15),
      LOOSE,
    ),
  );

  /* 4 and 5 — the round trip to Proxima at 0.8 c. */
  const trip = twinTrip(D_PROXIMA, 0.8 * C);
  const home = trip.home_s / JULIAN_YEAR;
  const aboard = trip.traveller_s / JULIAN_YEAR;
  results.push(
    toleranced(
      'Twin trip to Proxima at 0.8 c, at home',
      '2d / v',
      `computed ${significant(home)} yr  ·  expected 10.62 yr`,
      relativeError(home, 10.62),
      0.005,
    ),
  );
  results.push(
    toleranced(
      'Twin trip to Proxima at 0.8 c, on board',
      '2d / (γ v)',
      `computed ${significant(aboard)} yr  ·  expected 6.37 yr`,
      relativeError(aboard, 6.37),
      0.005,
    ),
  );

  /* 6 — the GPS orbit. */
  const vGps = circularOrbitSpeed(M_EARTH, R_GPS);
  results.push(
    toleranced(
      'GPS orbital speed',
      'v = √(G M / r)',
      `computed ${significant(vGps)} m/s  ·  expected 3874 m/s`,
      relativeError(vGps, 3874),
      0.005,
    ),
  );

  /* 7, 8 and 9 — the GPS clock budget per day. */
  const gps = gpsDailyOffsets();
  results.push(
    toleranced(
      'GPS clock loss from speed, per day',
      '−(1 − 1/γ) × 1 day',
      `computed ${significant(gps.speed_s * 1e6)} µs  ·  expected −7.21 µs`,
      relativeError(gps.speed_s * 1e6, -7.21),
      LOOSE,
    ),
  );
  results.push(
    toleranced(
      'GPS clock gain from height, per day',
      '(deficit at R⊕ − deficit at r_GPS) × 1 day',
      `computed ${significant(gps.gravity_s * 1e6)} µs  ·  expected +45.7 µs`,
      relativeError(gps.gravity_s * 1e6, 45.7),
      LOOSE,
    ),
  );
  results.push(
    toleranced(
      'GPS clock net, per day',
      'speed + height',
      `computed ${significant(gps.net_s * 1e6)} µs  ·  expected +38.5 µs`,
      relativeError(gps.net_s * 1e6, 38.5),
      LOOSE,
    ),
  );

  /* 10 — at the photon sphere of a 10 M☉ black hole. */
  const rs = schwarzschildRadius(M_DEMO_BH);
  const at15 = gravitationalRate(M_DEMO_BH, 1.5 * rs);
  results.push(
    asserted(
      'Clock rate at 1.5 r_s',
      'dτ/dt = √(1 − r_s / r)',
      `computed ${at15.toFixed(6)}  ·  expected 0.5774 ± 1e-4`,
      Math.abs(at15 - 0.5774) <= 1e-4,
    ),
  );

  /* 11 — just outside the horizon. */
  const at101 = gravitationalRate(M_DEMO_BH, 1.01 * rs);
  results.push(
    toleranced(
      'Clock rate at 1.01 r_s',
      'dτ/dt = √(1 − r_s / r)',
      `computed ${significant(at101)}  ·  expected 0.0995`,
      relativeError(at101, 0.0995),
      0.005,
    ),
  );

  /* 12 — Earth's surface against far away. */
  const earth = gravitationalDeficit(M_EARTH, R_EARTH);
  results.push(
    toleranced(
      'Gravitational deficit at Earth’s surface',
      'x / (1 + √(1 − x)), x = r_s / R⊕',
      `computed ${significant(earth)}  ·  expected 6.96e-10`,
      relativeError(earth, 6.96e-10),
      LOOSE,
    ),
  );

  return emit('time-dilation checks', results);
}

/**
 * The Hawking-radiation model against the figures the module quotes.
 *
 * The Sun's temperature (the ħ check, again, through the function this module
 * shares with black holes), the mass as warm as the microwave background, the
 * mountain-mass hole of the worked example (size, temperature, power, lifetime
 * and what it emits), the mass finishing now and in one second, and the energy
 * of that last second.
 */
export function verifyHawkingModel(): CheckBlock {
  const results: CheckResult[] = [];
  const check = (name: string, formula: string, computed: number, expected: number, unit: string, tolerance: number) =>
    results.push(
      toleranced(
        name,
        formula,
        `computed ${significant(computed)}${unit ? ` ${unit}` : ''}  ·  expected ${expected}${unit ? ` ${unit}` : ''}`,
        relativeError(computed, expected),
        tolerance,
      ),
    );

  /* 1 — the Sun's mass. */
  check('Hawking temperature of one solar mass', 'T_H = ħc³ / (8π G M k)', hawkingTemperature(M_SUN), 6.17e-8, 'K', 0.005);

  /* 2 — the crossover with today's microwave background. */
  check(
    'Mass as warm as the microwave background',
    'M = ħc³ / (8π G k T_CMB)',
    massForHawkingTemperature(T_CMB),
    4.5e22,
    'kg',
    LOOSE,
  );

  /* 3 to 6 — the worked example, a mountain's mass. */
  const mountain = 1e12;
  check('Schwarzschild radius of 10¹² kg', 'r_s = 2GM / c²', schwarzschildRadius(mountain), 1.485e-15, 'm', 0.005);
  check('Hawking temperature of 10¹² kg', 'T_H = ħc³ / (8π G M k)', hawkingTemperature(mountain), 1.227e11, 'K', 0.005);
  check('Hawking power of 10¹² kg, photons', 'P = ħc⁶ / (15360π G² M²)', hawkingPower(mountain), 3.57e8, 'W', LOOSE);
  check(
    'Evaporation time of 10¹² kg, photons',
    't = 5120π G²M³ / (ħc⁴)',
    evaporationTime(mountain) / JULIAN_YEAR,
    2.66e12,
    'yr',
    LOOSE,
  );

  /* 7 and 8 — the holes finishing now, and within a second. */
  check(
    'Mass evaporating in the age of the universe, photons',
    'M = (t ħc⁴ / (5120π G²))^(1/3)',
    massEvaporatingIn(AGE_UNIVERSE),
    1.73e11,
    'kg',
    LOOSE,
  );
  check('Mass evaporating in one second, photons', 'M = (t ħc⁴ / (5120π G²))^(1/3)', massEvaporatingIn(1), 2.28e5, 'kg', 0.02);

  /* 9 — the last second, in megatons of TNT. */
  check('Energy of the last second', 'E = M(1 s) c² / 1 Mt', finalSecondEnergy() / MEGATON_TNT, 4.9e6, 'Mt', 0.03);

  /* 10 — what the mountain-mass hole emits. */
  const band = emissionBand(mountain);
  results.push(
    asserted(
      'Emission at 10¹² kg',
      'kT = k T_H against the rest energies',
      `computed "${band}"  ·  expected "plus electrons and positrons"`,
      band === 'plus electrons and positrons',
    ),
  );

  return emit('hawking-radiation checks', results);
}

/**
 * The wormhole model against the figures the module quotes.
 *
 * The exotic mass of a one-metre throat, in kilograms and in Jupiters, and of
 * a kilometre throat in Suns; the density at a one-metre throat, and against
 * nuclear density; the Casimir density at a micron; the plate gap that
 * matches the throat, in metres and in proton radii, with the round trip back
 * through casimirDensity; and the embedding surface at the throat and at two
 * throat radii.
 */
export function verifyWormholeModel(): CheckBlock {
  const results: CheckResult[] = [];
  const check = (name: string, formula: string, computed: number, expected: number, unit: string, tolerance: number) =>
    results.push(
      toleranced(
        name,
        formula,
        `computed ${significant(computed)}${unit ? ` ${unit}` : ''}  ·  expected ${expected}${unit ? ` ${unit}` : ''}`,
        relativeError(computed, expected),
        tolerance,
      ),
    );

  /* 1 to 3 — the negative mass, at one metre and one kilometre. */
  check('Exotic mass of a one-metre throat', 'M = −(π/2) c² b₀ / G', exoticMass(1), -2.12e27, 'kg', LOOSE);
  check('Exotic mass of a one-metre throat, in Jupiters', 'M / M_J', exoticMass(1) / M_JUPITER, -1.11, '', LOOSE);
  check('Exotic mass of a one-kilometre throat, in Suns', 'M / M☉', exoticMass(1000) / M_SUN, -1.06, '', LOOSE);

  /* 4 and 5 — the density at a one-metre throat. */
  check('Throat density at one metre', 'ρ = −c² / (8π G b₀²)', throatDensity(1), -5.36e25, 'kg/m³', LOOSE);
  check('Throat density at one metre, against nuclear density', 'ρ / ρ_nuc', throatDensity(1) / NUCLEAR_DENSITY, -2.3e8, '', 0.03);

  /* 6 — the Casimir density at a micron. */
  check('Casimir density at 1 µm', 'ρ = −π² ħ / (720 c a⁴)', casimirDensity(1e-6), -4.82e-21, 'kg/m³', LOOSE);

  /* 7 to 9 — the plate gap that matches a one-metre throat. */
  const gap = casimirGapForThroat(1);
  check('Casimir gap matching a one-metre throat', 'a = (8π³ ħ G b₀² / (720 c³))^(1/4)', gap, 3.08e-18, 'm', 0.02);
  const protons = gap / PROTON_RADIUS;
  results.push(
    asserted(
      'Casimir gap in proton radii',
      'a / r_p within [0.003, 0.005]',
      `computed ${significant(protons)}  ·  expected between 0.003 and 0.005`,
      protons >= 0.003 && protons <= 0.005,
    ),
  );
  const roundTrip = casimirDensity(gap) / throatDensity(1);
  results.push(
    asserted(
      'Casimir density at that gap equals the throat density',
      'ρ_Casimir(a) / ρ(b₀) = 1',
      `computed ${roundTrip.toPrecision(12)}  ·  expected 1 ± 1e-9`,
      Math.abs(roundTrip - 1) <= 1e-9,
    ),
  );

  /* 10 and 11 — the embedding surface. */
  const atThroat = embeddingHeight(1, 1);
  results.push(
    asserted(
      'Embedding height at the throat',
      'z = b₀ arccosh(r / b₀), r = b₀',
      `computed ${atThroat}  ·  expected exactly 0`,
      atThroat === 0,
    ),
  );
  check('Embedding height at two throat radii', 'z = b₀ arccosh(2)', embeddingHeight(2, 1), 1.317, 'b₀', TIGHT);

  return emit('wormhole checks', results);
}

/**
 * The neutron-star model against the figures the module quotes.
 *
 * At 1.4 M☉ and 12 km: the mean density and its ratio to nuclear saturation
 * density (Lattimer & Prakash 2016, ρ_s ≃ 2.7 × 10¹⁴ g cm⁻³), a teaspoon of it,
 * the surface gravity, the escape speed, the compactness and the surface
 * redshift. The equator's speed for the Crab and for the 716 Hz pulsar, and the
 * Keplerian limit (Haensel et al. 2009). The Crab's spin-down power and
 * characteristic age against the ATNF catalogue's own derived values (EDOT
 * 4.5 × 10³⁸ erg/s, AGE 1.26 × 10³ yr), computed here from its F0 and F1. And
 * two orderings: the fastest known pulsar spins below the limit, and the
 * collapse threshold sits above the heaviest measured star.
 */
export function verifyNeutronStarModel(): CheckBlock {
  const results: CheckResult[] = [];
  const check = (name: string, formula: string, computed: number, expected: number, unit: string, tolerance: number) =>
    results.push(
      toleranced(
        name,
        formula,
        `computed ${significant(computed)}${unit ? ` ${unit}` : ''}  ·  expected ${expected}${unit ? ` ${unit}` : ''}`,
        relativeError(computed, expected),
        tolerance,
      ),
    );
  const M = M_NS_TYPICAL;

  /* 1 to 3 — density. */
  check('Mean density, 1.4 M☉ and 12 km', 'ρ̄ = M / (4/3 π R³)', meanDensity(M), 3.85e17, 'kg/m³', 0.005);
  check('Mean density over nuclear saturation density', 'ρ̄ / ρ_s, ρ_s = 2.7e17 kg/m³', densityOverNuclear(M), 1.42, '', 0.005);
  check('A teaspoon (5 mL) at the mean density', 'm = ρ̄ × 5 × 10⁻⁶ m³', teaspoonMass(M), 1.92e12, 'kg', 0.005);

  /* 4 to 7 — gravity. */
  check('Surface gravity, in g', 'g = GM / (R² √(1 − 2GM/Rc²)) / g₀', surfaceGravity(M) / G_STANDARD, 1.625e11, 'g', 0.005);
  check('Escape speed, as a fraction of c', 'v / c = √(2GM / Rc²)', escapeSpeedFraction(M), 0.587, '', 0.005);
  check('Compactness', 'β = GM / (R c²)', compactness(M), 0.1723, '', TIGHT);
  check('Gravitational redshift from the surface', 'z = 1/√(1 − 2β) − 1', surfaceRedshift(M), 0.2352, '', TIGHT);

  /* 8 to 10 — spin. */
  const crabP = 1 / CRAB_F0;
  check('Equatorial speed of the Crab, as a fraction of c', 'v / c = 2πR / (P c)', equatorialSpeedFraction(crabP), 7.53e-3, '', 0.005);
  check(
    'Equatorial speed at 716 Hz, as a fraction of c',
    'v / c = 2πR f / c',
    equatorialSpeedFraction(1 / FASTEST_PULSAR_FREQUENCY),
    0.180,
    '',
    0.005,
  );
  check(
    'Keplerian frequency, 1.4 M☉ and 12 km',
    'f_K = 1.08 kHz (M/M☉)^½ (R/10 km)^(−3/2)',
    keplerFrequency(M),
    972,
    'Hz',
    0.005,
  );

  /* 11 and 12 — the Crab's spin-down, against the catalogue's derived values. */
  const crabPdot = -CRAB_F1 / CRAB_F0 ** 2;
  check(
    'Crab spin-down power, against ATNF EDOT',
    'Ė = 4π² I Ṗ / P³, I = 10³⁸ kg m²',
    spinDownPower(crabP, crabPdot),
    4.5e31,
    'W',
    LOOSE,
  );
  check(
    'Crab characteristic age, against ATNF AGE',
    'τ = P / (2Ṗ)',
    characteristicAge(crabP, crabPdot) / JULIAN_YEAR,
    1.26e3,
    'yr',
    0.005,
  );

  /* 13 and 14 — orderings the module's prose depends on. */
  const fastest = FASTEST_PULSAR_FREQUENCY;
  const limit = keplerFrequency(M);
  results.push(
    asserted(
      'The fastest known pulsar spins below the Keplerian limit',
      '716 Hz < f_K(1.4 M☉, 12 km)',
      `computed ${fastest} Hz against ${significant(limit)} Hz`,
      fastest < limit,
    ),
  );
  results.push(
    asserted(
      'The collapse threshold sits above the heaviest measured neutron star',
      '2.08 M☉ is stable; 2.4 M☉ collapses',
      `collapses(2.08 M☉) = ${collapses(NS_MASS_HEAVIEST)}  ·  collapses(2.4 M☉) = ${collapses(2.4 * M_SUN)}`,
      !collapses(NS_MASS_HEAVIEST) && collapses(2.4 * M_SUN),
    ),
  );

  return emit('neutron-star checks', results);
}

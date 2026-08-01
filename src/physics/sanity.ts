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
import { AU, C, G, M_EARTH, M_SUN, R_EARTH, R_SUN } from './constants';
import { apexAltitude, integrateFlight, timestepFor } from './escape';
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

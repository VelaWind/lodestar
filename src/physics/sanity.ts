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
import { AU, C, G, M_EARTH, M_SUN, R_EARTH, R_SUN } from './constants';
import { apexAltitude, integrateFlight, timestepFor } from './escape';

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

/**
 * The five known values the `physics-accuracy` skill names: if a simulation
 * cannot reproduce these, the simulation is wrong, not the constants.
 */
import {
  AU,
  C,
  G,
  M_EARTH,
  M_SUN,
  R_EARTH,
  R_SUN,
} from '../constants';
import {
  TIGHT,
  LOOSE,
  relativeError,
  significant,
  type CheckBlock,
  toleranced,
  emit,
} from './core';

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

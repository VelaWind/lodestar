/**
 * Two-body Kepler orbits. SI base units throughout: metres, kilograms, seconds,
 * metres per second, and radians for every angle.
 *
 * This module is the single source of truth for the kepler-orbits module's
 * numbers. The canvas animation, every readout, and the math layer's equations
 * all call these functions — per the physics-accuracy skill, the sim's
 * calculation and the displayed equation must be one shared function or they
 * will drift.
 *
 * Geometry convention, fixed once here and relied on by the sim: the focus is
 * the origin, periapsis lies along +x, motion is counter-clockwise, and t = 0 is
 * periapsis passage. The ellipse's *centre* is therefore at (−a·e, 0) — the star
 * sits at a focus, not in the middle, which is the whole point of the first law.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import { G } from './constants';

/** Full turn, in radians. Angles are radians internally, always. */
const TAU = 2 * Math.PI;

/** Newton is converged well inside double precision at this residual. */
const KEPLER_TOL = 1e-13;
const KEPLER_MAX_ITER = 60;
/** Bisection halves the bracket each pass; 80 exhausts double precision. */
const BISECTION_ITER = 80;

function normalizeAngle(angle: number): number {
  const wrapped = angle % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

/**
 *     T² = 4π²a³ / (GM)     ⟹     T = 2π√(a³ / GM)
 *
 * Orbital period, seconds. Independent of eccentricity — the third law cares
 * only about the semi-major axis, which is why a comet on a wild ellipse and a
 * circular orbit of the same `a` come back on the same schedule.
 *
 * @param M central mass, kg
 * @param a semi-major axis, m
 */
export function period(M: number, a: number): number {
  if (!(M > 0) || !(a > 0)) return NaN;
  return TAU * Math.sqrt(a ** 3 / (G * M));
}

/**
 *     n = 2π / T = √(GM / a³)
 *
 * Mean motion — the average angular rate, rad/s. The mean anomaly is `n·t`.
 */
export function meanMotion(M: number, a: number): number {
  if (!(M > 0) || !(a > 0)) return NaN;
  return Math.sqrt((G * M) / a ** 3);
}

/**
 *     h = √(GM · a(1 − e²))
 *
 * Specific angular momentum, m²/s. Constant along the orbit; the second law is
 * exactly the statement that r²·dν/dt = h never changes.
 */
export function specificAngularMomentum(M: number, a: number, e: number): number {
  if (!(M > 0) || !(a > 0) || !(e >= 0) || e >= 1) return NaN;
  return Math.sqrt(G * M * a * (1 - e ** 2));
}

/**
 *     r_p = a(1 − e)
 *
 * Periapsis distance from the focus, m — the closest approach.
 */
export function periapsisDistance(a: number, e: number): number {
  return a * (1 - e);
}

/**
 *     r_a = a(1 + e)
 *
 * Apoapsis distance from the focus, m — the farthest point.
 */
export function apoapsisDistance(a: number, e: number): number {
  return a * (1 + e);
}

/**
 *     v² = GM(2/r − 1/a)     ⟹     v = √(GM(2/r − 1/a))
 *
 * Vis-viva: orbital speed, m/s, at distance `r` from the focus. Falls straight
 * out of energy conservation — the specific orbital energy −GM/2a is fixed by
 * `a` alone, so speed is a function of where you are in the orbit and nothing
 * else. Returns NaN for an `r` the orbit never reaches.
 *
 * @param M central mass, kg
 * @param a semi-major axis, m
 * @param r current distance from the focus, m
 */
export function visViva(M: number, a: number, r: number): number {
  if (!(M > 0) || !(a > 0) || !(r > 0)) return NaN;
  const vSquared = G * M * (2 / r - 1 / a);
  return vSquared > 0 ? Math.sqrt(vSquared) : NaN;
}

/**
 *     M_anom = E − e·sin E
 *
 * Kepler's equation, solved for the eccentric anomaly `E` given the mean
 * anomaly. There is no closed form; this is Newton–Raphson on
 * f(E) = E − e·sin E − M_anom, with f′(E) = 1 − e·cos E.
 *
 * The fallback matters. Newton is fast but not unconditionally convergent for
 * eccentric orbits: near periapsis at high `e`, f′ approaches 1 − e and a step
 * can overshoot into a region that oscillates instead of settling. So if Newton
 * has not converged within its iteration budget, this hands off to bisection,
 * which cannot fail here: f is strictly increasing for e < 1 (f′ = 1 − e·cos E
 * > 0), and E − M_anom = e·sin E is bounded by e, so [M_anom − 1, M_anom + 1]
 * always brackets the single root.
 *
 * @param meanAnomaly rad, any value — wrapped internally
 * @param e eccentricity, 0 ≤ e < 1
 * @returns eccentric anomaly E, rad, in [0, 2π)
 */
export function solveKepler(meanAnomaly: number, e: number): number {
  if (!(e > 0)) return normalizeAngle(meanAnomaly); // circle: E = M_anom
  if (e >= 1) return NaN; // this module is bound orbits only

  const mAnom = normalizeAngle(meanAnomaly);

  // Standard starting guesses. Below e ≈ 0.8, E ≈ M_anom is close enough that
  // Newton converges in a handful of passes; above it, π is the safer start
  // because it sits on the side of the curve where the iteration contracts.
  let E = e < 0.8 ? mAnom : Math.PI;

  for (let i = 0; i < KEPLER_MAX_ITER; i += 1) {
    const f = E - e * Math.sin(E) - mAnom;
    const fPrime = 1 - e * Math.cos(E);
    if (!(Math.abs(fPrime) > 1e-14)) break; // stationary — hand to bisection
    const next = E - f / fPrime;
    if (Math.abs(next - E) < KEPLER_TOL) return normalizeAngle(next);
    E = next;
  }

  let lo = mAnom - 1;
  let hi = mAnom + 1;
  for (let i = 0; i < BISECTION_ITER; i += 1) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) - mAnom > 0) hi = mid;
    else lo = mid;
  }
  return normalizeAngle((lo + hi) / 2);
}

/** Where the orbiting body is, and how fast, at one instant. */
export interface OrbitState {
  /** Seconds since periapsis passage. */
  t: number;
  /** Eccentric anomaly, rad. */
  E: number;
  /** True anomaly — angle from periapsis as seen from the focus, rad. */
  nu: number;
  /** Distance from the focus, m. */
  r: number;
  /** Position in the orbital plane, m, focus at the origin, periapsis on +x. */
  x: number;
  y: number;
  /** Orbital speed, m/s, from vis-viva. */
  speed: number;
}

/**
 *     r = a(1 − e·cos E)
 *     tan(ν/2) = √((1+e)/(1−e)) · tan(E/2)
 *
 * Position and speed at time `t` after periapsis. The half-angle form of the
 * true anomaly is used rather than an arccos of the standard relation: it is
 * quadrant-correct through `atan2` on its own, with no sign patching around
 * apoapsis, and it stays well conditioned at high eccentricity.
 *
 * @param M central mass, kg
 * @param a semi-major axis, m
 * @param e eccentricity, 0 ≤ e < 1
 * @param t seconds since periapsis passage
 */
export function stateAt(M: number, a: number, e: number, t: number): OrbitState {
  const E = solveKepler(meanMotion(M, a) * t, e);
  const r = a * (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
  return { t, E, nu, r, x: r * Math.cos(nu), y: r * Math.sin(nu), speed: visViva(M, a, r) };
}

/** The ellipse the orbit traces. Everything in metres, focus at the origin. */
export interface OrbitGeometry {
  semiMajor: number;
  /** b = a√(1 − e²) */
  semiMinor: number;
  /** c = a·e — how far the focus sits from the ellipse's centre. */
  focusOffset: number;
  periapsis: number;
  apoapsis: number;
}

/**
 *     b = a√(1 − e²),    c = a·e
 *
 * Ellipse geometry for drawing. Kept here rather than in the sim so that the
 * picture and the numbers cannot disagree about where the focus is.
 */
export function orbitGeometry(a: number, e: number): OrbitGeometry {
  return {
    semiMajor: a,
    semiMinor: a * Math.sqrt(Math.max(0, 1 - e ** 2)),
    focusOffset: a * e,
    periapsis: periapsisDistance(a, e),
    apoapsis: apoapsisDistance(a, e),
  };
}

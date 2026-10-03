/**
 * Dark matter in a disc galaxy: the rotation curve of a thin exponential disc
 * of stars and gas, a cored isothermal halo, and the two together.
 *
 * SI in, SI out: kilograms, metres, seconds. Solar masses, kiloparsecs, km/s
 * and millions of years are display formats, applied by the sim.
 *
 * The model, and what it leaves out:
 *
 *   - Visible matter is one razor-thin exponential disc, Σ(R) = Σ₀ e^(−R/R_d),
 *     holding all the stars and cold gas. The Milky Way's bulge and bar (about
 *     a third of its stars) and its gas disc (which is about twice as extended
 *     as the stars) are folded into it. Its circular speed is Freeman's (1970)
 *     closed form in modified Bessel functions.
 *   - The halo is spherical, a "pseudo-isothermal" sphere with a flat core,
 *     ρ(r) = ρ₀ / (1 + r²/r_c²), described by the speed it tends to far out,
 *     v_∞² = 4πGρ₀r_c², and a fixed core radius r_c.
 *   - Orbits are circular, in the disc's plane.
 *   - The two add in quadrature, because their accelerations add.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import { G, HALO_CORE_RADIUS, KM_S_PER_MPC, OMEGA_B_H2, OMEGA_C_H2 } from './constants';

/* ------------------------------------------------------------------ */
/* Modified Bessel functions                                            */
/* ------------------------------------------------------------------ */

/** The Euler–Mascheroni constant, γ. */
const EULER_GAMMA = 0.577_215_664_901_532_9;

/** Below this argument K₀ and K₁ use their series; above it, the integral. */
const K_SERIES_LIMIT = 2;

/**
 *     I₀(x) = Σ (x²/4)ᵏ / (k!)²
 *
 * Modified Bessel function of the first kind, order 0. Every term is positive,
 * so the series is accurate to rounding at any x the disc needs.
 */
export function besselI0(x: number): number {
  const q = (x * x) / 4;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 500; k += 1) {
    term *= q / (k * k);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return sum;
}

/**
 *     I₁(x) = (x/2) Σ (x²/4)ᵏ / (k! (k+1)!)
 */
export function besselI1(x: number): number {
  const q = (x * x) / 4;
  let term = x / 2;
  let sum = term;
  for (let k = 1; k < 500; k += 1) {
    term *= q / (k * (k + 1));
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-17) break;
  }
  return sum;
}

/**
 *     K_ν(x) = ∫₀^∞ exp(−x cosh t) cosh(νt) dt
 *
 * The integral form, for x above `K_SERIES_LIMIT`. The integrand is smooth and
 * falls off double-exponentially, so the trapezoid rule converges
 * exponentially fast in the step: for x > 2, h = 0.1 agrees with mpmath to
 * 5 × 10⁻¹⁶ (h = 0.2 to 6 × 10⁻¹³, h = 0.3 only to 10⁻⁵).
 */
function besselKIntegral(nu: number, x: number): number {
  const h = 0.1;
  let sum = 0.5 * Math.exp(-x);
  for (let k = 1; k < 100_000; k += 1) {
    const t = k * h;
    const value = Math.exp(-x * Math.cosh(t)) * Math.cosh(nu * t);
    sum += value;
    if (value < sum * 1e-18) break;
  }
  return sum * h;
}

/**
 *     K₀(x) = −(ln(x/2) + γ) I₀(x) + Σₖ₌₁ Hₖ (x²/4)ᵏ / (k!)²,   Hₖ = 1 + ½ + … + 1/k
 *
 * Modified Bessel function of the second kind, order 0, x > 0. The series
 * loses digits to cancellation at large x, where the integral takes over.
 */
export function besselK0(x: number): number {
  if (!(x > 0)) return NaN;
  if (x > K_SERIES_LIMIT) return besselKIntegral(0, x);
  const q = (x * x) / 4;
  let term = 1;
  let harmonic = 0;
  let sum = 0;
  for (let k = 1; k < 200; k += 1) {
    term *= q / (k * k);
    harmonic += 1 / k;
    sum += term * harmonic;
    if (term * harmonic < 1e-18) break;
  }
  return -(Math.log(x / 2) + EULER_GAMMA) * besselI0(x) + sum;
}

/**
 *     K₁(x) = 1/x + ln(x/2) I₁(x) − (x/4) Σₖ₌₀ [ψ(k+1) + ψ(k+2)] (x²/4)ᵏ / (k! (k+1)!)
 *
 * Order 1, x > 0, with ψ the digamma function: ψ(1) = −γ, ψ(n+1) = ψ(n) + 1/n.
 */
export function besselK1(x: number): number {
  if (!(x > 0)) return NaN;
  if (x > K_SERIES_LIMIT) return besselKIntegral(1, x);
  const q = (x * x) / 4;
  let term = 1;
  let psi1 = -EULER_GAMMA;
  let psi2 = 1 - EULER_GAMMA;
  let sum = psi1 + psi2;
  for (let k = 1; k < 200; k += 1) {
    term *= q / (k * (k + 1));
    psi1 += 1 / k;
    psi2 += 1 / (k + 1);
    sum += term * (psi1 + psi2);
    if (term < 1e-20) break;
  }
  return 1 / x + Math.log(x / 2) * besselI1(x) - (x / 4) * sum;
}

/* ------------------------------------------------------------------ */
/* The visible disc                                                     */
/* ------------------------------------------------------------------ */

/**
 *     v²(R) = 4πG Σ₀ R_d y² [I₀(y)K₀(y) − I₁(y)K₁(y)],   y = R / 2R_d,   Σ₀ = M / 2πR_d²
 *
 * Circular speed in the plane of a razor-thin exponential disc, m/s (Freeman
 * 1970, ApJ 160, 811). It peaks at R ≈ 2.15 R_d and falls toward the
 * Keplerian √(GM/R) far outside the disc. Zero at the centre.
 *
 * @param R radius in the disc's plane, m
 * @param M the disc's total mass, kg
 * @param Rd its scale length, m
 */
export function discSpeed(R: number, M: number, Rd: number): number {
  if (!(R > 0) || !(M > 0) || !(Rd > 0)) return 0;
  const y = R / (2 * Rd);
  const sigma0 = M / (2 * Math.PI * Rd * Rd);
  const bessel = besselI0(y) * besselK0(y) - besselI1(y) * besselK1(y);
  return Math.sqrt(Math.max(0, 4 * Math.PI * G * sigma0 * Rd * y * y * bessel));
}

/**
 *     F(y) = 2y² [I₀(y)K₀(y) − I₁(y)K₁(y)],   so   v_disc² = (GM / R_d) · F(R / 2R_d)
 *
 * The disc's rotation curve in dimensionless form: one curve for every mass
 * and scale length, which is what makes it worth tabulating.
 */
export function discShape(y: number): number {
  if (!(y > 0)) return 0;
  return Math.max(0, 2 * y * y * (besselI0(y) * besselK0(y) - besselI1(y) * besselK1(y)));
}

/**
 * The table's range and step in y = R/2R_d. Outside it, `discShape` itself is
 * used: below 0.2, where F ~ y² ln y has too much curvature for the cubic (the
 * error reached 6 × 10⁻⁶ at y = 0.05) and the series converge in a few terms.
 */
const SHAPE_Y_MIN = 0.2;
const SHAPE_Y_MAX = 20;
const SHAPE_STEP = 0.005;
let shapeTable: Float64Array | null = null;

function tabulatedShape(y: number): number {
  if (!(y >= SHAPE_Y_MIN) || y >= SHAPE_Y_MAX) return discShape(y);
  if (!shapeTable) {
    const n = Math.ceil((SHAPE_Y_MAX - SHAPE_Y_MIN) / SHAPE_STEP) + 3;
    shapeTable = new Float64Array(n);
    // One knot either side of the range, for the cubic's end intervals.
    for (let i = 0; i < n; i += 1) shapeTable[i] = discShape(SHAPE_Y_MIN + (i - 1) * SHAPE_STEP);
  }
  // Catmull–Rom cubic through the four knots around y.
  const u = (y - SHAPE_Y_MIN) / SHAPE_STEP;
  const i = Math.floor(u) + 1;
  const t = u - Math.floor(u);
  const p0 = shapeTable[i - 1]!;
  const p1 = shapeTable[i]!;
  const p2 = shapeTable[i + 1]!;
  const p3 = shapeTable[i + 2]!;
  return (
    p1 +
    0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
  );
}

/**
 * `discSpeed` from a table of `discShape`, built once, m/s: for drawing, where
 * a slider drag needs hundreds of speeds a frame. It agrees with `discSpeed`
 * to better than a part in a million (tested); the readouts use `discSpeed`.
 */
export function discSpeedTabulated(R: number, M: number, Rd: number): number {
  if (!(R > 0) || !(M > 0) || !(Rd > 0)) return 0;
  return Math.sqrt(((G * M) / Rd) * tabulatedShape(R / (2 * Rd)));
}

/**
 *     M(<R) = M [1 − (1 + R/R_d) e^(−R/R_d)]
 *
 * The disc's mass inside radius R, kg: inside a cylinder, since the disc is flat.
 */
export function discMassWithin(R: number, M: number, Rd: number): number {
  if (!(R > 0) || !(M > 0) || !(Rd > 0)) return 0;
  const x = R / Rd;
  return M * (1 - (1 + x) * Math.exp(-x));
}

/* ------------------------------------------------------------------ */
/* The dark halo                                                        */
/* ------------------------------------------------------------------ */

/**
 *     v²(r) = v_∞² [1 − (r_c/r) arctan(r/r_c)]
 *
 * Circular speed in a cored isothermal halo, m/s: rising linearly through the
 * core, then flattening toward v_∞. ρ ∝ r⁻² far out is what makes it flat.
 *
 * @param r radius, m
 * @param vInf the halo's asymptotic speed, m/s; 0 removes the halo
 * @param rc its core radius, m
 */
export function haloSpeed(r: number, vInf: number, rc = HALO_CORE_RADIUS): number {
  if (!(r > 0) || !(vInf > 0) || !(rc > 0)) return 0;
  const u = r / rc;
  return vInf * Math.sqrt(1 - Math.atan(u) / u);
}

/**
 *     M(<r) = v_h(r)² r / G
 *
 * The halo's mass inside a sphere of radius r, kg. Exact, because the halo is
 * spherical.
 */
export function haloMassWithin(r: number, vInf: number, rc = HALO_CORE_RADIUS): number {
  const v = haloSpeed(r, vInf, rc);
  return (v * v * r) / G;
}

/**
 *     ρ₀ = v_∞² / (4πG r_c²)
 *
 * The halo's central density, kg/m³.
 */
export function haloCentralDensity(vInf: number, rc = HALO_CORE_RADIUS): number {
  return (vInf * vInf) / (4 * Math.PI * G * rc * rc);
}

/* ------------------------------------------------------------------ */
/* Together                                                             */
/* ------------------------------------------------------------------ */

/** A galaxy: the visible disc's mass and scale length, and the halo's asymptotic speed. */
export interface Galaxy {
  /** Mass of stars and gas in the disc, kg. */
  M: number;
  /** Disc scale length, m. */
  Rd: number;
  /** Halo asymptotic speed, m/s. */
  vInf: number;
}

/** The three curves at one radius, m/s. */
export interface CurvePoint {
  visible: number;
  halo: number;
  total: number;
}

/**
 *     v_total = √(v_disc² + v_halo²)
 *
 * The rotation curve at radius R, m/s: the one function the drawing, the
 * stars' motion and every readout read. `tabulated` takes the disc's speed from
 * the table rather than the Bessel functions directly, for drawing: the two
 * agree to a part in a million, far below a pixel or a printed digit.
 */
export function rotationCurve(R: number, galaxy: Galaxy, tabulated = false): CurvePoint {
  const visible = tabulated ? discSpeedTabulated(R, galaxy.M, galaxy.Rd) : discSpeed(R, galaxy.M, galaxy.Rd);
  const halo = haloSpeed(R, galaxy.vInf);
  return { visible, halo, total: Math.hypot(visible, halo) };
}

/**
 *     T = 2πR / v
 *
 * One circular orbit at radius R and speed v, s.
 */
export function orbitalPeriod(R: number, v: number): number {
  if (!(R > 0) || !(v > 0)) return Infinity;
  return (2 * Math.PI * R) / v;
}

/**
 *     M(<r) = v² r / G
 *
 * The mass a circular speed implies inside radius r, kg, if that mass were
 * spherical. For a flattened disc it is only an estimate: an exponential disc
 * pulls up to about 35% harder in its plane than the equivalent sphere beyond
 * about one scale length, and weaker inside it (v²/(GM(<R)/R) is 0.76 at
 * 0.5 R_d, 1 at 0.89 R_d, 1.345 at its peak near 2.9 R_d, 1.04 at 12 R_d).
 */
export function dynamicalMass(r: number, v: number): number {
  return (v * v * r) / G;
}

/** What the readouts show at the marker's radius. */
export interface MarkerReadout {
  /** Circular speed with the halo, m/s. */
  withHalo: number;
  /** Circular speed from the visible disc alone, m/s. */
  visibleOnly: number;
  /** Disc mass inside the radius (a cylinder), kg. */
  visibleMass: number;
  /** Halo mass inside the radius (a sphere), kg. */
  darkMass: number;
  /** visibleMass + darkMass, kg. */
  totalMass: number;
  /** darkMass / visibleMass, dimensionless. */
  darkToVisible: number;
  /** One orbit at the speed with the halo, s. */
  period: number;
  /** One orbit at the visible-only speed, s. */
  periodVisibleOnly: number;
}

export function markerReadout(R: number, galaxy: Galaxy): MarkerReadout {
  const point = rotationCurve(R, galaxy);
  const visibleMass = discMassWithin(R, galaxy.M, galaxy.Rd);
  const darkMass = haloMassWithin(R, galaxy.vInf);
  return {
    withHalo: point.total,
    visibleOnly: point.visible,
    visibleMass,
    darkMass,
    totalMass: visibleMass + darkMass,
    darkToVisible: visibleMass > 0 ? darkMass / visibleMass : NaN,
    period: orbitalPeriod(R, point.total),
    periodVisibleOnly: orbitalPeriod(R, point.visible),
  };
}

/* ------------------------------------------------------------------ */
/* The cosmic budget                                                    */
/* ------------------------------------------------------------------ */

/** Dark matter's mass over ordinary matter's, cosmic average (Planck 2018). */
export function cosmicDarkToBaryon(): number {
  return OMEGA_C_H2 / OMEGA_B_H2;
}

/** Dark matter's share of all matter, cold dark matter plus baryons (Planck 2018). */
export function cosmicDarkFraction(): number {
  return OMEGA_C_H2 / (OMEGA_C_H2 + OMEGA_B_H2);
}

/**
 *     Ω = (Ω h²) / h²,   h = H₀ / (100 km/s/Mpc)
 *
 * A density parameter from its physical density and H₀ in SI (s⁻¹).
 */
export function densityParameter(omegaH2: number, H0: number): number {
  const h = H0 / (100 * KM_S_PER_MPC);
  return omegaH2 / (h * h);
}

/**
 * Neutron stars and pulsars: density, gravity, escape, redshift, spin, the
 * mass-shedding limit, spin-down, and which beams a distant observer sees.
 *
 * SI in, SI out: kilograms, metres, seconds, radians. Solar masses, g, and
 * fractions of c are display formats, applied by the sim.
 *
 * One fixed radius, `R_NS` (12 km), for every mass. The real radius
 * depends on the equation of state of matter above nuclear density, which is
 * not known, so this file uses no mass–radius formula; the module discloses it
 * as its main approximation. Every function that needs a radius takes it as an
 * argument defaulting to that value, so the sanity checks can exercise others.
 *
 * Outside the star the geometry is exactly Schwarzschild for a non-rotating
 * star, so the escape speed, surface gravity and redshift below are the full
 * general-relativistic results at areal (circumferential) radius R, not
 * Newtonian approximations. Spin is ignored in them; at the fastest spins on
 * the slider it would flatten the star and change all three by percents.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import {
  C,
  G,
  KEPLER_FREQUENCY_COEFFICIENT,
  M_SUN,
  NS_MASS_COLLAPSE,
  NS_MOMENT_OF_INERTIA,
  R_NS,
  NUCLEAR_SATURATION_DENSITY,
  TEASPOON,
} from './constants';

/* ------------------------------------------------------------------ */
/* Bulk                                                                 */
/* ------------------------------------------------------------------ */

/**
 *     ρ̄ = M / (4/3 π R³)
 *
 * Mean density, kg/m³: the mass over the flat-space volume of a sphere of
 * areal radius R. (The proper volume inside a compact star is larger, so this
 * is a convention, the one used whenever a mean neutron-star density is quoted.)
 *
 * @param M mass, kg
 * @param R radius, m
 */
export function meanDensity(M: number, R = R_NS): number {
  if (!(M > 0) || !(R > 0)) return NaN;
  return M / ((4 / 3) * Math.PI * R ** 3);
}

/** Mean density as a multiple of nuclear saturation density, dimensionless. */
export function densityOverNuclear(M: number, R = R_NS): number {
  return meanDensity(M, R) / NUCLEAR_SATURATION_DENSITY;
}

/** The mass of a metric teaspoon (5 mL) of matter at the mean density, kg. */
export function teaspoonMass(M: number, R = R_NS): number {
  return meanDensity(M, R) * TEASPOON;
}

/* ------------------------------------------------------------------ */
/* Gravity                                                              */
/* ------------------------------------------------------------------ */

/**
 *     β = GM / (R c²)
 *
 * Compactness, dimensionless: half of r_s/R. A black hole's horizon has
 * β = 1/2, so β/0.5 is how far the star is toward being one.
 */
export function compactness(M: number, R = R_NS): number {
  if (!(M > 0) || !(R > 0)) return NaN;
  return (G * M) / (R * C ** 2);
}

/**
 *     g = GM / (R² √(1 − 2GM/(Rc²)))
 *
 * Surface gravity, m/s²: the proper acceleration of an observer standing on
 * the surface, what a scale there would read per kilogram. The square root is
 * the general-relativistic correction; it makes g about 24% larger than the
 * Newtonian GM/R² at 1.4 M☉ and 12 km.
 */
export function surfaceGravity(M: number, R = R_NS): number {
  const rsOverR = 2 * compactness(M, R);
  if (!(rsOverR < 1)) return NaN;
  return (G * M) / (R ** 2 * Math.sqrt(1 - rsOverR));
}

/** The Newtonian surface gravity GM/R², m/s², for comparison in the prose. */
export function surfaceGravityNewtonian(M: number, R = R_NS): number {
  if (!(M > 0) || !(R > 0)) return NaN;
  return (G * M) / R ** 2;
}

/**
 *     v_esc / c = √(2GM / (R c²))
 *
 * Escape speed as a fraction of c. In general relativity this is the speed an
 * observer standing on the surface measures for something launched straight
 * up that just escapes, with R the areal radius: the same formula as Newton's,
 * as the escape-velocity module explains, with a different meaning.
 */
export function escapeSpeedFraction(M: number, R = R_NS): number {
  return Math.sqrt(2 * compactness(M, R));
}

/**
 *     z = 1/√(1 − 2GM/(Rc²)) − 1
 *
 * Gravitational redshift of light leaving the surface, dimensionless: how much
 * longer every wavelength is when it reaches a distant observer, and the same
 * factor by which a surface clock runs slow.
 */
export function surfaceRedshift(M: number, R = R_NS): number {
  const rsOverR = 2 * compactness(M, R);
  if (!(rsOverR < 1)) return NaN;
  return 1 / Math.sqrt(1 - rsOverR) - 1;
}

/** Whether a star of this mass is above the module's collapse threshold. */
export function collapses(M: number): boolean {
  return M > NS_MASS_COLLAPSE;
}

/* ------------------------------------------------------------------ */
/* Spin                                                                 */
/* ------------------------------------------------------------------ */

/**
 *     v / c = 2πR / (P c)
 *
 * Equatorial surface speed as a fraction of c, for spin period P.
 */
export function equatorialSpeedFraction(P: number, R = R_NS): number {
  if (!(P > 0) || !(R > 0)) return NaN;
  return (2 * Math.PI * R) / (P * C);
}

/**
 *     f_K = 1.08 kHz × (M/M☉)^½ × (R/10 km)^(−3/2)
 *
 * The Keplerian (mass-shedding) spin frequency, Hz: spin faster and the
 * equator moves faster than orbital speed there, and the star sheds matter.
 * Haensel et al. 2009's fit to full general-relativistic models of rotating
 * stars, good to a few percent for 0.5 M☉ < M < 0.9 M_max. It is about 0.59 of
 * the naive Newtonian √(GM/R³)/2π for the same M and R, because a star spun
 * that fast bulges at the equator, which lowers the gravity there.
 */
export function keplerFrequency(M: number, R = R_NS): number {
  if (!(M > 0) || !(R > 0)) return NaN;
  return KEPLER_FREQUENCY_COEFFICIENT * Math.sqrt(M / M_SUN) * (R / 1e4) ** -1.5;
}

/** The shortest spin period before mass shedding, s: 1 / f_K. */
export function breakupPeriod(M: number, R = R_NS): number {
  return 1 / keplerFrequency(M, R);
}

/**
 *     R_LC = c / Ω = cP / 2π
 *
 * The light-cylinder radius, m: the distance from the spin axis at which
 * something turning with the star would move at the speed of light. The
 * magnetic field cannot co-rotate beyond it.
 */
export function lightCylinderRadius(P: number): number {
  if (!(P > 0)) return NaN;
  return (C * P) / (2 * Math.PI);
}

/**
 *     Ė = −I Ω Ω̇ = 4π² I Ṗ / P³
 *
 * Spin-down power, W: the rate the star loses rotational energy as it slows,
 * with the conventional moment of inertia I = 10³⁸ kg m².
 *
 * @param P spin period, s
 * @param Pdot period derivative, s/s
 */
export function spinDownPower(P: number, Pdot: number, I = NS_MOMENT_OF_INERTIA): number {
  if (!(P > 0)) return NaN;
  return (4 * Math.PI ** 2 * I * Pdot) / P ** 3;
}

/**
 *     τ_c = P / (2Ṗ)
 *
 * Characteristic age, s: the age a pulsar would have if it had slowed from a
 * much shorter period by pure magnetic-dipole braking all its life.
 */
export function characteristicAge(P: number, Pdot: number): number {
  if (!(P > 0) || !(Pdot > 0)) return NaN;
  return P / (2 * Pdot);
}

/**
 *     t = P / ((n − 1) Ṗ) × [1 − (P₀/P)^(n−1)]
 *
 * Spin-down age, s, for a braking index n (Ω̇ ∝ Ωⁿ, constant) and a birth
 * period P₀. With n = 3 and P₀ → 0 it is the characteristic age.
 *
 * @param n braking index, dimensionless, > 1
 * @param P0 birth spin period, s
 */
export function spinDownAge(P: number, Pdot: number, n: number, P0: number): number {
  if (!(P > 0) || !(Pdot > 0) || !(n > 1) || !(P0 >= 0)) return NaN;
  return (P / ((n - 1) * Pdot)) * (1 - (P0 / P) ** (n - 1));
}

/* ------------------------------------------------------------------ */
/* Beams                                                                */
/* ------------------------------------------------------------------ */

/**
 * Half-width of each radio beam, rad: 10°, fixed. A model choice, disclosed:
 * real beams are wider for faster pulsars and narrower for slow ones.
 */
export const BEAM_HALF_WIDTH = (10 * Math.PI) / 180;

/**
 *     cos θ = cos α cos ζ + sin α sin ζ cos φ
 *
 * Angle between the line of sight and the magnetic axis, rad, at rotation
 * phase φ: α is the magnetic tilt from the spin axis, ζ the angle between the
 * spin axis and the line of sight. The second pole points the opposite way,
 * at π − θ.
 */
export function beamAngle(alpha: number, zeta: number, phase: number): number {
  const c = Math.cos(alpha) * Math.cos(zeta) + Math.sin(alpha) * Math.sin(zeta) * Math.cos(phase);
  return Math.acos(Math.min(1, Math.max(-1, c)));
}

/**
 * Tolerance on the beam edge, rad. A setting placed exactly on the edge (45°
 * tilt seen from 35°) lands a part in 10¹⁶ either side of it in floating
 * point; this puts it inside, the same way in the verdict, the trace and the
 * drawing.
 */
const EDGE_TOLERANCE = 1e-9;

/**
 * Whether an angle from a beam's axis is inside that beam, the one test every
 * beam decision in the module uses.
 */
export function insideBeam(angle: number, halfWidth = BEAM_HALF_WIDTH): boolean {
  return angle <= halfWidth + EDGE_TOLERANCE;
}

/**
 * What a distant observer at ζ receives from a star tilted α, from the same
 * `beamAngle` the drawing uses. The first pole's angle from the line of sight
 * is smallest at φ = 0, |ζ − α|, and largest at φ = π, ζ + α; the second pole's
 * angle, π − θ, is smallest at φ = π, |π − ζ − α|, and largest at φ = 0,
 * π − |ζ − α|.
 *
 *   - `first`, `second`: the beam reaches the line of sight at some phase.
 *   - `alwaysOn`: the line of sight never leaves a beam, so the received signal
 *     never drops to zero. For ζ and α up to 90° only the first beam can do
 *     this, when ζ + α is within the half-width.
 *   - `modulated`: the received signal changes over a turn at all, which needs
 *     the pole to move relative to the line of sight, sin α sin ζ > 0.
 *
 * A pulse, the pulsar's on–off flash, is a beam that is reached but left again.
 */
export function beamVisibility(
  alpha: number,
  zeta: number,
  halfWidth = BEAM_HALF_WIDTH,
): { first: boolean; second: boolean; alwaysOn: boolean; modulated: boolean } {
  const atZero = beamAngle(alpha, zeta, 0);
  const atPi = beamAngle(alpha, zeta, Math.PI);
  const first = insideBeam(atZero, halfWidth);
  const second = insideBeam(Math.PI - atPi, halfWidth);
  const alwaysOn = insideBeam(atPi, halfWidth) || insideBeam(Math.PI - atZero, halfWidth);
  return { first, second, alwaysOn, modulated: Math.sin(alpha) * Math.sin(zeta) > EDGE_TOLERANCE };
}

/**
 * Which beams give pulses: reached during a turn and left again. A line of
 * sight that never leaves a beam sees a signal that is always on, not a pulse.
 */
export function beamsSeen(alpha: number, zeta: number, halfWidth = BEAM_HALF_WIDTH): {
  first: boolean;
  second: boolean;
} {
  const v = beamVisibility(alpha, zeta, halfWidth);
  return { first: v.first && !v.alwaysOn, second: v.second && !v.alwaysOn };
}

/** Pulses per second a distant observer receives: one per pulsing beam per turn. */
export function pulsesPerSecond(P: number, alpha: number, zeta: number): number {
  if (!(P > 0)) return NaN;
  const seen = beamsSeen(alpha, zeta);
  return (Number(seen.first) + Number(seen.second)) / P;
}

/**
 * The received radio intensity at rotation phase φ, 0 to 1, for the pulse
 * trace: each beam a Gaussian in its angle from the line of sight, σ half the
 * half-width, cut off at the beam edge by `insideBeam`. Shape only; real pulse
 * profiles vary from pulsar to pulsar.
 */
export function beamIntensity(alpha: number, zeta: number, phase: number, halfWidth = BEAM_HALF_WIDTH): number {
  const theta = beamAngle(alpha, zeta, phase);
  const sigma = halfWidth / 2;
  const lobe = (angle: number) => (insideBeam(angle, halfWidth) ? Math.exp(-(angle ** 2) / (2 * sigma ** 2)) : 0);
  return Math.min(1, lobe(theta) + lobe(Math.PI - theta));
}

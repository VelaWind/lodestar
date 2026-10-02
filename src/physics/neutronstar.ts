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
 * Which beams sweep across the line of sight during a rotation. The first
 * pole's axis traces a cone of half-angle α around the spin axis, so its
 * closest approach to a line of sight at ζ is |ζ − α|; the second pole's is
 * |ζ − (π − α)|. A beam gives pulses if that is within its half-width and its
 * farthest point, ζ + α (or 2π − ζ − α), is not: a line of sight that never
 * leaves the beam sees a steady glow, not a pulse. For ζ and α up to 90° only
 * the first beam can be steady.
 */
export function beamsSeen(alpha: number, zeta: number, halfWidth = BEAM_HALF_WIDTH): {
  first: boolean;
  second: boolean;
} {
  return {
    first: Math.abs(zeta - alpha) <= halfWidth && !steadyBeam(alpha, zeta, halfWidth),
    second: Math.abs(zeta - (Math.PI - alpha)) <= halfWidth && 2 * Math.PI - zeta - alpha > halfWidth,
  };
}

/**
 * Whether the line of sight stays inside the first beam all the way round,
 * ζ + α ≤ half-width: a beam lying close along the spin axis, seen from close
 * to that axis, glows steadily and does not pulse.
 */
export function steadyBeam(alpha: number, zeta: number, halfWidth = BEAM_HALF_WIDTH): boolean {
  return zeta + alpha <= halfWidth;
}

/** Pulses per second a distant observer receives: one per visible beam per turn. */
export function pulsesPerSecond(P: number, alpha: number, zeta: number): number {
  if (!(P > 0)) return NaN;
  const seen = beamsSeen(alpha, zeta);
  return (Number(seen.first) + Number(seen.second)) / P;
}

/**
 * The received radio intensity at rotation phase φ, 0 to 1, for the pulse
 * trace: each beam a Gaussian in its angle from the line of sight, cut off at
 * the beam edge. Shape only; real pulse profiles vary from pulsar to pulsar.
 */
export function beamIntensity(alpha: number, zeta: number, phase: number, halfWidth = BEAM_HALF_WIDTH): number {
  const theta = beamAngle(alpha, zeta, phase);
  const sigma = halfWidth / 2;
  const lobe = (angle: number) => (angle <= halfWidth ? Math.exp(-(angle ** 2) / (2 * sigma ** 2)) : 0);
  return Math.min(1, lobe(theta) + lobe(Math.PI - theta));
}

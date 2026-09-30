/**
 * The cosmic distance ladder: parallax, the Leavitt law, the distance modulus,
 * and what a calibration error on the standard candles does to H₀.
 *
 * SI in, SI out: distances in m, angles in rad, H₀ in s⁻¹. Magnitudes are
 * dimensionless and logarithmic; periods are in days because the Leavitt law
 * is defined in them. Light-years, parsecs, arcseconds and km/s/Mpc are
 * display formats, applied by the sim.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import {
  AU,
  GAIA_PARALLAX_SIGMA,
  LEAVITT_SLOPE,
  LEAVITT_ZERO_POINT,
  MEGAPARSEC,
  PARSEC,
  V_PEC_TYPICAL,
} from './constants';

/**
 * Parallax angle, rad, in the small-angle limit.
 *
 *     p = 1 AU / d
 *
 * @param d_m distance, m
 */
export function parallaxAngle(d_m: number): number {
  return AU / d_m;
}

/**
 * Fractional error of a Gaia parallax at a distance (dimensionless): the
 * mission's bright-star precision over the angle itself.
 *
 * @param d_m distance, m
 */
export function parallaxFractionalError(d_m: number): number {
  return GAIA_PARALLAX_SIGMA / parallaxAngle(d_m);
}

/**
 * A Cepheid's absolute V magnitude from its period, by the Leavitt law.
 *
 *     M_V = a + b (log₁₀ P − 1)
 *
 * @param P_days pulsation period, days
 */
export function leavittAbsoluteMagnitude(P_days: number): number {
  return LEAVITT_ZERO_POINT + LEAVITT_SLOPE * (Math.log10(P_days) - 1);
}

/** Ten parsecs, m: where apparent and absolute magnitude agree. */
const TEN_PARSECS = 10 * PARSEC;

/**
 * Distance modulus (dimensionless, magnitudes).
 *
 *     μ = m − M = 5 log₁₀(d / 10 pc)
 *
 * @param d_m distance, m
 */
export function distanceModulus(d_m: number): number {
  return 5 * Math.log10(d_m / TEN_PARSECS);
}

/**
 * Apparent magnitude of an object of known absolute magnitude at a distance.
 * No extinction.
 *
 * @param M_abs absolute magnitude
 * @param d_m   distance, m
 */
export function apparentMagnitude(M_abs: number, d_m: number): number {
  return M_abs + distanceModulus(d_m);
}

/**
 * The expansion rate a ladder reports when its candles' assumed absolute
 * magnitude is off by δ, s⁻¹. δ > 0 means the candles were assumed fainter
 * than they are: they are placed too close, so the same recession speeds imply
 * a faster expansion.
 *
 *     H₀,ladder = H₀,true · 10^(δ/5)
 *
 * @param H0_true_s the true expansion rate, s⁻¹
 * @param delta_mag the calibration offset, magnitudes
 */
export function inferredH0(H0_true_s: number, delta_mag: number): number {
  return H0_true_s * 10 ** (delta_mag / 5);
}

/**
 * The calibration offset that multiplies H₀ by a ratio, magnitudes: the
 * inverse of `inferredH0`.
 *
 *     δ = 5 log₁₀(H₀,ladder / H₀,true)
 *
 * @param ratio H₀,ladder / H₀,true (dimensionless)
 */
export function offsetForH0Ratio(ratio: number): number {
  return 5 * Math.log10(ratio);
}

/**
 * How large a typical galaxy's own motion is against its recession
 * (dimensionless): V_pec / (H₀ d).
 *
 * @param H0_s expansion rate, s⁻¹
 * @param d_m  distance, m
 */
export function peculiarVelocityShare(H0_s: number, d_m: number): number {
  return V_PEC_TYPICAL / (H0_s * d_m);
}

/** The Cepheid the readouts follow: a 30-day pulsator, typical of those seen in distant galaxies. */
export const CEPHEID_PERIOD_DAYS = 30;

export interface Rung {
  id: 'parallax' | 'cepheids' | 'type-ia' | 'hubble-flow';
  label: string;
  /** Nearest distance the method is drawn to reach, m. */
  dMin_m: number;
  /** Farthest, m. */
  dMax_m: number;
}

/**
 * The ladder's rungs, bottom to top, with the distances each is drawn to
 * cover. Display constants of order-of-magnitude precision, disclosed beside
 * the sim: where a method stops depends on the telescope, the target and the
 * precision wanted.
 */
export const RUNGS: readonly Rung[] = [
  { id: 'parallax', label: 'Parallax (Gaia)', dMin_m: 1 * PARSEC, dMax_m: 10e3 * PARSEC },
  { id: 'cepheids', label: 'Cepheids', dMin_m: 1e3 * PARSEC, dMax_m: 50 * MEGAPARSEC },
  { id: 'type-ia', label: 'Type Ia supernovae', dMin_m: 10 * MEGAPARSEC, dMax_m: 3e3 * MEGAPARSEC },
  { id: 'hubble-flow', label: 'Hubble flow', dMin_m: 50 * MEGAPARSEC, dMax_m: 3e3 * MEGAPARSEC },
];

/**
 * Every rung whose range contains a distance, in ladder order.
 *
 * @param d_m distance, m
 */
export function rungsAt(d_m: number): Rung[] {
  return RUNGS.filter((rung) => d_m >= rung.dMin_m && d_m <= rung.dMax_m);
}

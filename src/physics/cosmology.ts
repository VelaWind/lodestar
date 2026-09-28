/**
 * The expansion of the universe, in the linear regime.
 *
 * SI in, SI out: distances in metres, speeds in m/s, the Hubble constant in
 * s⁻¹, wavelengths in metres, times in seconds. km/s/Mpc, nanometres and years
 * are display formats applied by the sim, never passed in here.
 *
 * The sim, its readouts, the math layer's worked example and the sanity block
 * all read these functions, so the picture and the equation cannot drift apart.
 *
 * Every relation below is the small-z one the module discloses beside its sim:
 * z = v/c rather than 1 + z = a(t₀)/a(t_emit), and light travel time as d/c
 * rather than a lookback time integrated through the expansion history.
 */
import { C } from './constants';

/**
 * Recession velocity, m/s: the Hubble–Lemaître law.
 *
 *     v = H₀ d
 *
 * @param H0_s Hubble constant, s⁻¹
 * @param d_m  proper distance now, m
 */
export function recessionVelocity(H0_s: number, d_m: number): number {
  return H0_s * d_m;
}

/**
 * Line-of-sight velocity, m/s: recession plus the galaxy's own motion.
 *
 *     v = H₀ d + v_pec
 *
 * Positive is away from us.
 *
 * @param H0_s    Hubble constant, s⁻¹
 * @param d_m     proper distance now, m
 * @param vPec_ms peculiar velocity along the line of sight, m/s, positive away
 */
export function lineOfSightVelocity(H0_s: number, d_m: number, vPec_ms: number): number {
  return recessionVelocity(H0_s, d_m) + vPec_ms;
}

/**
 * Redshift from a line-of-sight velocity, dimensionless: the small-z form.
 *
 *     z = v / c
 *
 * Throws at |v| ≥ c. The linear relation is meaningless there, and returning a
 * z of 1 or more from it would print a number that looks like a result.
 *
 * @param v_ms line-of-sight velocity, m/s, positive away
 */
export function redshiftFromVelocity(v_ms: number): number {
  if (!(Math.abs(v_ms) < C)) {
    throw new RangeError(`redshiftFromVelocity: |v| = ${Math.abs(v_ms)} m/s is not below c`);
  }
  return v_ms / C;
}

/**
 * Observed wavelength, m.
 *
 *     λ_obs = λ_rest (1 + z)
 *
 * @param lambdaRest_m laboratory (rest) wavelength, m
 * @param z            redshift, dimensionless; negative for a blueshift
 */
export function observedWavelength(lambdaRest_m: number, z: number): number {
  return lambdaRest_m * (1 + z);
}

/**
 * Light travel time, s: `t = d / c`.
 *
 * Re-exported from the scale module rather than written again, so the site has
 * one light-travel-time function. Takes the distance in metres.
 */
export { lightTravelTime } from './scale';

/**
 * Hubble time, s: the age the universe would have if it had always expanded at
 * today's rate.
 *
 *     t_H = 1 / H₀
 *
 * @param H0_s Hubble constant, s⁻¹
 */
export function hubbleTime(H0_s: number): number {
  return 1 / H0_s;
}

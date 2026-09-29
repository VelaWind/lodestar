/**
 * The expansion of the universe, in the linear regime, and the cosmic
 * microwave background it has been cooling.
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
import { B_WIEN, C, H, K_B, T_CMB, ZETA_3 } from './constants';

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

/* ------------------------------------------------------------------ */
/* The cosmic microwave background                                     */
/* ------------------------------------------------------------------ */

/**
 * Radiation temperature at a redshift, K: expansion stretches every wavelength
 * by 1 + z, so a blackbody stays one with its temperature scaled by the same
 * factor.
 *
 *     T(z) = T₀ (1 + z)
 *
 * @param z redshift, dimensionless
 */
export function cmbTemperatureAtRedshift(z: number): number {
  return T_CMB * (1 + z);
}

/**
 * Redshift at which the radiation had a given temperature, dimensionless: the
 * inverse of `cmbTemperatureAtRedshift`.
 *
 *     z = T / T₀ − 1
 *
 * Throws below T₀. A temperature colder than today's belongs to the future,
 * where this relation says nothing, and a negative z would read as a result.
 *
 * @param T_K radiation temperature, K
 */
export function redshiftAtTemperature(T_K: number): number {
  if (!(T_K >= T_CMB)) {
    throw new RangeError(`redshiftAtTemperature: ${T_K} K is below today's ${T_CMB} K`);
  }
  return T_K / T_CMB - 1;
}

/**
 * Scale factor at which the radiation had a given temperature, dimensionless,
 * with a = 1 today.
 *
 *     a = T₀ / T
 *
 * @param T_K radiation temperature, K
 */
export function scaleFactorAtTemperature(T_K: number): number {
  return T_CMB / T_K;
}

/**
 * Wavelength of the peak of B_λ, m: Wien's displacement law.
 *
 *     λ_peak = b / T
 *
 * This is the maximum per unit *wavelength*. The maximum per unit frequency,
 * of B_ν, falls at a longer wavelength (about 1.76 times longer); the two
 * curves are different functions and peak in different places.
 *
 * @param T_K temperature, K
 */
export function wienPeakWavelength(T_K: number): number {
  return B_WIEN / T_K;
}

/**
 * Planck's law per unit frequency, W m⁻² Hz⁻¹ sr⁻¹.
 *
 *     B_ν = (2hν³ / c²) / (exp(hν / kT) − 1)
 *
 * `expm1` rather than `exp(x) − 1`: in the Rayleigh–Jeans tail x is small and
 * the subtraction would throw away the digits that matter. At very large x
 * `expm1` overflows to Infinity and the result is an honest 0.
 *
 * @param nu_Hz frequency, Hz
 * @param T_K   temperature, K
 */
export function planckSpectralRadiance(nu_Hz: number, T_K: number): number {
  const x = (H * nu_Hz) / (K_B * T_K);
  return (2 * H * nu_Hz ** 3) / C ** 2 / Math.expm1(x);
}

/**
 * Planck's law per unit wavelength, W m⁻³ sr⁻¹.
 *
 *     B_λ = (2hc² / λ⁵) / (exp(hc / λkT) − 1)
 *
 * Related to `planckSpectralRadiance` by B_ν(c/λ) = B_λ(λ) · λ² / c; the unit
 * suite checks that identity to machine precision.
 *
 * @param lambda_m wavelength, m
 * @param T_K      temperature, K
 */
export function planckSpectralRadianceWavelength(lambda_m: number, T_K: number): number {
  const x = (H * C) / (lambda_m * K_B * T_K);
  return (2 * H * C ** 2) / lambda_m ** 5 / Math.expm1(x);
}

/**
 * Number density of blackbody photons, m⁻³.
 *
 *     n_γ = 16π ζ(3) (kT / hc)³
 *
 * @param T_K temperature, K
 */
export function photonNumberDensity(T_K: number): number {
  return 16 * Math.PI * ZETA_3 * ((K_B * T_K) / (H * C)) ** 3;
}

/**
 * Amplitude of the kinematic dipole, K: how much hotter the sky is straight
 * ahead than its average, to first order in v/c.
 *
 *     ΔT = T v / c
 *
 * @param T_K  radiation temperature, K
 * @param v_ms observer speed relative to the CMB rest frame, m/s
 */
export function dipoleAmplitude(T_K: number, v_ms: number): number {
  return (T_K * v_ms) / C;
}

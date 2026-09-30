/**
 * Emission nebulae: how far a hot star's ultraviolet ionizes the gas around it,
 * how much gas that is, how fast it would fade, how sharp its edge is, and how
 * the ionized bubble expands.
 *
 * SI in, SI out: photon rates in s⁻¹, number densities in m⁻³, lengths in m,
 * masses in kg, times in s. Parsecs, light-years, per cm³, solar masses and
 * years are display formats, applied by the sim.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import { ALPHA_B, C_S_HII, M_PROTON, SIGMA_PHOTO_H } from './constants';

/**
 * Strömgren radius, m: the sphere in which recombinations, at n² α_B per unit
 * volume, use up the star's ionizing photons exactly.
 *
 *     R_S = (3 Q / (4π n² α_B))^(1/3)
 *
 * Uniform, fully ionized, pure hydrogen; disclosed beside the sim.
 *
 * @param Q_s  ionizing photon rate, s⁻¹
 * @param n_m3 hydrogen number density, m⁻³
 */
export function stromgrenRadius(Q_s: number, n_m3: number): number {
  return ((3 * Q_s) / (4 * Math.PI * n_m3 ** 2 * ALPHA_B)) ** (1 / 3);
}

/**
 * Mass of the ionized gas, kg.
 *
 *     M = (4/3) π R³ n m_p
 *
 * @param R_m  radius of the ionized sphere, m
 * @param n_m3 hydrogen number density, m⁻³
 */
export function ionizedMass(R_m: number, n_m3: number): number {
  return (4 / 3) * Math.PI * R_m ** 3 * n_m3 * M_PROTON;
}

/**
 * Recombination time, s: how long a proton waits, on average, for an electron.
 *
 *     t_rec = 1 / (n α_B)
 *
 * @param n_m3 hydrogen number density, m⁻³
 */
export function recombinationTime(n_m3: number): number {
  return 1 / (n_m3 * ALPHA_B);
}

/**
 * Thickness of the ionization front, m: one photon mean free path in neutral
 * gas at the threshold cross-section.
 *
 *     ℓ = 1 / (n σ)
 *
 * @param n_m3 hydrogen number density, m⁻³
 */
export function frontThickness(n_m3: number): number {
  return 1 / (n_m3 * SIGMA_PHOTO_H);
}

/**
 * Radius of an expanding H II region, m: Spitzer's solution for the
 * pressure-driven phase, with the ionized gas's sound speed C_S_HII.
 *
 *     R(t) = R_S (1 + 7 c_s t / (4 R_S))^(4/7)
 *
 * @param R_S_m the initial (Strömgren) radius, m
 * @param t_s   time since the star switched on, s
 */
export function expansionRadius(R_S_m: number, t_s: number): number {
  return R_S_m * (1 + (7 * C_S_HII * t_s) / (4 * R_S_m)) ** (4 / 7);
}

export interface EmissionLine {
  /** The line's name as astronomers write it: "Hα", "[O III]". */
  label: string;
  /** Wavelength in air, m. */
  wavelength_m: number;
  /** Intensity relative to Hβ (dimensionless). */
  relative: number;
}

/**
 * The bright visible lines of an H II region, with intensities relative to Hβ.
 *
 * Illustrative, not computed: typical ratios for an Orion-like region
 * (compare O'Dell 2001, ARA&A 39, 99), rounded. They change in reality with
 * temperature, density and abundance; the sim scales only their overall
 * brightness, and says so beside the sim.
 */
export const EMISSION_LINES: readonly EmissionLine[] = [
  { label: 'Hβ', wavelength_m: 486.1e-9, relative: 1.0 },
  { label: '[O III]', wavelength_m: 495.9e-9, relative: 1.2 },
  { label: '[O III]', wavelength_m: 500.7e-9, relative: 3.6 },
  { label: '[N II]', wavelength_m: 654.8e-9, relative: 0.3 },
  { label: 'Hα', wavelength_m: 656.3e-9, relative: 2.86 },
  { label: '[N II]', wavelength_m: 658.3e-9, relative: 0.9 },
  { label: '[S II]', wavelength_m: 671.6e-9, relative: 0.2 },
  { label: '[S II]', wavelength_m: 673.1e-9, relative: 0.15 },
];

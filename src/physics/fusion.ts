/**
 * Why the Sun shines: the Coulomb barrier, quantum tunnelling through it, and
 * the proton–proton reaction rate that results.
 *
 * SI in, SI out: energies in J, temperatures in K, distances in m, masses in
 * kg, densities in kg/m³, rates in W/kg. keV and MeV are display formats,
 * applied by the sim.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import {
  ALPHA,
  C,
  E_CHARGE,
  EPSILON_0,
  FEMTOMETRE,
  K_B,
  M_PROTON,
} from './constants';

/**
 * Electrical potential energy of two nuclei at a separation, J.
 *
 *     V = Z₁ Z₂ e² / (4π ε₀ r)
 *
 * @param Z1  charge number of the first nucleus
 * @param Z2  charge number of the second
 * @param r_m separation, m
 */
export function coulombBarrier(Z1: number, Z2: number, r_m: number): number {
  return (Z1 * Z2 * E_CHARGE ** 2) / (4 * Math.PI * EPSILON_0 * r_m);
}

/**
 * Where a collision at a given energy turns back classically, m: the separation
 * at which the Coulomb potential equals the energy. The inverse of
 * `coulombBarrier` in r; the sim uses it to end the Gamow-peak line on the
 * barrier curve.
 *
 * @param Z1  charge number of the first nucleus
 * @param Z2  charge number of the second
 * @param E_J collision energy, J
 */
export function classicalTurningPoint(Z1: number, Z2: number, E_J: number): number {
  return (Z1 * Z2 * E_CHARGE ** 2) / (4 * Math.PI * EPSILON_0 * E_J);
}

/**
 * The Gamow energy, J: the energy scale of Coulomb tunnelling.
 *
 *     E_G = 2 m_r c² (π α Z₁ Z₂)²
 *
 * @param Z1          charge number of the first nucleus
 * @param Z2          charge number of the second
 * @param mReduced_kg reduced mass of the pair, kg
 */
export function gamowEnergy(Z1: number, Z2: number, mReduced_kg: number): number {
  return 2 * mReduced_kg * C ** 2 * (Math.PI * ALPHA * Z1 * Z2) ** 2;
}

/**
 * The Gamow peak, J: the collision energy at which fusion is most likely, where
 * the rising tunnelling probability and the falling Boltzmann tail multiply to
 * their largest product.
 *
 *     E₀ = (E_G (kT)² / 4)^(1/3)
 *
 * @param E_G_J Gamow energy, J
 * @param T_K   temperature, K
 */
export function gamowPeak(E_G_J: number, T_K: number): number {
  return ((E_G_J * (K_B * T_K) ** 2) / 4) ** (1 / 3);
}

/**
 * Width of the Gamow window, J: the 1/e full width of the Gaussian that
 * approximates the peak.
 *
 *     Δ = 4 √(E₀ kT / 3)
 *
 * @param E0_J Gamow peak, J
 * @param T_K  temperature, K
 */
export function gamowWindowWidth(E0_J: number, T_K: number): number {
  return 4 * Math.sqrt((E0_J * K_B * T_K) / 3);
}

/**
 * Chance that a collision at energy E tunnels through the Coulomb barrier
 * (dimensionless), in the Gamow approximation.
 *
 *     P = exp(−√(E_G / E))
 *
 * @param E_G_J Gamow energy, J
 * @param E_J   collision energy, J
 */
export function tunnellingProbability(E_G_J: number, E_J: number): number {
  return Math.exp(-Math.sqrt(E_G_J / E_J));
}

/**
 * The Boltzmann factor at energy E (dimensionless): how the number of particles
 * with that energy falls off in a gas at temperature T.
 *
 *     f = exp(−E / kT)
 *
 * @param E_J energy, J
 * @param T_K temperature, K
 */
export function boltzmannFraction(E_J: number, T_K: number): number {
  return Math.exp(-E_J / (K_B * T_K));
}

/**
 * Coefficients of the proton–proton rate fit, in the form Carroll & Ostlie give
 * (An Introduction to Modern Astrophysics, eq. 10.46), with the screening
 * factor f, the branching correction ψ and the higher-order correction C set to
 * 1. The first is W/kg per (kg/m³), the second dimensionless.
 */
const PP_RATE_COEFFICIENT = 0.241;
const PP_RATE_EXPONENT = 33.8;

/** Temperature in millions of kelvin, as the fit is written. Display-free: a pure rescale. */
function inMillions(T_K: number): number {
  return T_K / 1e6;
}

/**
 * Energy released by the proton–proton chain per kilogram of gas, W/kg.
 *
 *     ε = 0.241 ρ X² T₆^(−2/3) exp(−33.80 T₆^(−1/3)),   T₆ = T / 10⁶ K
 *
 * @param rho_kgm3 density, kg/m³
 * @param X        hydrogen mass fraction, dimensionless
 * @param T_K      temperature, K
 */
export function ppEnergyRate(rho_kgm3: number, X: number, T_K: number): number {
  const T6 = inMillions(T_K);
  return (
    PP_RATE_COEFFICIENT * rho_kgm3 * X ** 2 * T6 ** (-2 / 3) *
    Math.exp(-PP_RATE_EXPONENT * T6 ** (-1 / 3))
  );
}

/**
 * How steeply the pp rate depends on temperature (dimensionless): the local
 * power-law index of `ppEnergyRate` in T.
 *
 *     ν = d ln ε / d ln T = −2/3 + (33.80 / 3) T₆^(−1/3)
 *
 * @param T_K temperature, K
 */
export function temperatureExponent(T_K: number): number {
  return -2 / 3 + (PP_RATE_EXPONENT / 3) * inMillions(T_K) ** (-1 / 3);
}

/** The Gamow energy for two protons, J: reduced mass m_p / 2. About 493 keV. */
export const PP_GAMOW_ENERGY = gamowEnergy(1, 1, M_PROTON / 2);

/** The Coulomb barrier between two protons at 1.4 fm, where the strong force takes over, J. About 1.03 MeV. */
export const PP_BARRIER = coulombBarrier(1, 1, 1.4 * FEMTOMETRE);

/** Where the nuclear well begins, m: the separation `PP_BARRIER` is quoted at. */
export const PP_WELL_RADIUS = 1.4 * FEMTOMETRE;

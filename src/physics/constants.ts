/**
 * Canonical physical constants. SI base units, always.
 *
 * These are defined once, here, and imported everywhere else. Never inline a
 * constant at a call site and never round one at the point of use — rounding is
 * a display concern and belongs in `lib/format.ts`.
 *
 * Never hardcode a *derived* number either. A module that needs Earth's orbital
 * period computes it from `G`, `M_SUN`, and the semi-major axis; it does not
 * paste in 365.25.
 *
 * Sources: values follow CODATA (2018) for the measured physical constants and
 * the IAU (2015 Resolution B3) nominal values for solar and terrestrial
 * quantities. When adding a constant, cite its source in a comment. When a
 * figure is uncertain or disputed (the Hubble constant, exoplanet masses), note
 * the uncertainty rather than presenting a picked number as settled.
 *
 * This file exports constants and nothing else — no helpers, no conversions.
 */

// Exact by definition
export const C = 299_792_458; // m/s, speed of light
export const AU = 1.495_978_707e11; // m
export const LIGHT_YEAR = 9.460_730_472_5808e15; // m (c × Julian year)
export const JULIAN_YEAR = 3.155_76e7; // s
export const H = 6.626_070_15e-34; // J·s, Planck
/**
 * Reduced Planck constant, J·s. Derived from `H`, not pasted in: ħ = h/2π is a
 * definition, so writing 1.054_571_817e-34 here would be hardcoding a derived
 * number — and would leave two values that could disagree in the last digits.
 */
export const H_BAR = H / (2 * Math.PI);
export const K_B = 1.380_649e-23; // J/K, Boltzmann
/**
 * Unified atomic mass unit, kg — one twelfth of a carbon-12 atom at rest.
 *
 * Molecular masses are given as a multiple of this so the count of nucleons
 * stays visible at the point of use: nitrogen is 28.014 AMU, not 4.65e-26 kg.
 *
 * Source: CODATA 2018, m_u = 1.660 539 066 60(50) x 10^-27 kg.
 */
export const AMU = 1.660_539_066_60e-27;

// Measured
export const G = 6.674_30e-11; // m³ kg⁻¹ s⁻², gravitational
export const PARSEC = 3.085_677_581e16; // m
export const SIGMA_SB = 5.670_374_419e-8; // W m⁻² K⁻⁴, Stefan–Boltzmann

// Bodies
export const M_SUN = 1.988_4e30; // kg
export const R_SUN = 6.957e8; // m
export const L_SUN = 3.828e26; // W
export const M_EARTH = 5.972_2e24; // kg
export const R_EARTH = 6.371e6; // m, mean radius
/**
 * Jupiter's radius, m — the *volumetric mean*, matching how `R_EARTH` above is
 * defined, so the two planetary radii in this file mean the same kind of thing.
 *
 * Not the IAU nominal equatorial radius, which is 7.149_2e7 m (2015 Resolution
 * B3); Jupiter is oblate enough that the difference is 2.3%, and it shows up
 * squared in a transit depth — 1.01% of the Sun's disc with this figure against
 * 1.06% with the equatorial one. The exoplanet literature quotes planet radii in
 * equatorial R_J, so a figure taken from a paper is on the other convention;
 * `physics/transit.ts` says so where it matters.
 *
 * Source: NASA Jupiter Fact Sheet (D. R. Williams, NASA GSFC), volumetric mean
 * radius 69 911 km.
 */
export const R_JUPITER = 6.991_1e7; // m, volumetric mean radius
/**
 * Jupiter's mass, kg.
 *
 * What is actually measured is the mass *parameter* GM, to far better precision
 * than either factor alone: the IAU 2015 Resolution B3 nominal value is
 * GM^N_J = 1.266_865_3e17 m^3 s^-2, and this is that divided by G. The division
 * inherits G's uncertainty, which is why planetary dynamics is done in GM and
 * why a mass in kilograms is the least precise form of this number.
 */
export const M_JUPITER = 1.898_13e27;

// Scale
export const OBSERVABLE_UNIVERSE_RADIUS = 4.4e26; // m, ≈46.5 billion ly

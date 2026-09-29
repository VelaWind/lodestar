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
/**
 * Wien displacement constant, m·K: λ_peak = b / T for the peak of B_λ.
 *
 * Source: CODATA 2018, b = 2.897 771 955… × 10⁻³ m·K (exact, since h, c and
 * k_B are exact in the 2019 SI).
 */
export const B_WIEN = 2.897_771_955e-3;
/** m. 10⁶ parsecs, derived from `PARSEC` above rather than pasted (IAU 2015 Resolution B2). */
export const MEGAPARSEC = 1e6 * PARSEC;
export const SIGMA_SB = 5.670_374_419e-8; // W m⁻² K⁻⁴, Stefan–Boltzmann

// Bodies
export const M_SUN = 1.988_4e30; // kg
export const R_SUN = 6.957e8; // m
export const L_SUN = 3.828e26; // W
export const M_EARTH = 5.972_2e24; // kg
export const R_EARTH = 6.371e6; // m, mean radius
/**
 * The Moon, which the atmospheres module leans on twice: once for the retention
 * criterion it narrowly passes, and once as Titan’s near-twin in gravity.
 *
 * Both were inlined in `physics/sanity.ts` until the copy started quoting the
 * verdict they produce. A figure a reader can check has to come from one place.
 *
 * Source: NASA Moon Fact Sheet (D. R. Williams, NASA GSFC) — mass 7.346e22 kg,
 * volumetric mean radius 1737.4 km.
 */
export const M_MOON = 7.346e22; // kg
export const R_MOON = 1.737_4e6; // m, volumetric mean radius
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

// Cosmology
/**
 * One km/s/Mpc, the unit the Hubble constant is quoted in, expressed in s⁻¹.
 * Derived from `MEGAPARSEC`, not pasted: 1 km/s per megaparsec is 10³ m/s
 * divided by 10⁶ pc.
 */
export const KM_S_PER_MPC = 1e3 / MEGAPARSEC;
/**
 * Hubble constant from the cosmic microwave background, s⁻¹.
 *
 * Disputed, and the dispute is the point: this early-universe value and the
 * distance-ladder one below differ by about 5σ (the "Hubble tension"). Neither
 * is presented as settled; the module's slider covers both.
 *
 * Source: Planck Collaboration 2020, "Planck 2018 results VI: Cosmological
 * parameters", A&A 641, A6 — H₀ = 67.4 ± 0.5 km/s/Mpc.
 */
export const H0_PLANCK_2018 = 67.4 * KM_S_PER_MPC;
/**
 * Hubble constant from Cepheid-calibrated Type Ia supernovae, s⁻¹.
 *
 * Source: Riess et al. 2022, "A Comprehensive Measurement of the Local Value of
 * the Hubble Constant", ApJL 934, L7 (SH0ES) — 73.04 ± 1.04 km/s/Mpc.
 */
export const H0_SH0ES_2022 = 73.04 * KM_S_PER_MPC;
/**
 * Hydrogen Balmer-alpha (Hα, H I n = 3 → 2), wavelength in air, m.
 *
 * Source: NIST Atomic Spectra Database, H I lines — 656.28 nm (air).
 */
export const H_ALPHA_AIR = 656.28e-9;
/**
 * Temperature of the cosmic microwave background today, K.
 *
 * Source: Fixsen 2009, "The Temperature of the Cosmic Microwave Background",
 * ApJ 707, 916 — T₀ = 2.7255 ± 0.0006 K.
 */
export const T_CMB = 2.7255;
/**
 * Redshift of last scattering, z_* (dimensionless).
 *
 * Source: Planck Collaboration 2020, "Planck 2018 results VI: Cosmological
 * parameters", A&A 641, A6 — z_* = 1089.92 ± 0.25.
 */
export const Z_RECOMBINATION = 1089.92;
/**
 * The Solar System's speed relative to the CMB rest frame, m/s.
 *
 * Source: Planck Collaboration 2020, "Planck 2018 results I: Overview", A&A 641,
 * A1 — 369.82 ± 0.11 km/s.
 */
export const V_SUN_CMB = 3.6982e5;

// Mathematics
/**
 * Apéry's constant, ζ(3), dimensionless. It sets the photon number density of
 * blackbody radiation: n_γ = 16π ζ(3) (kT / hc)³.
 */
export const ZETA_3 = 1.202_056_903_159_594_2;

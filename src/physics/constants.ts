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
/** J per electronvolt, exact since the 2019 SI redefinition (CODATA 2018). */
export const EV = 1.602_176_634e-19;
/**
 * Elementary charge, C, exact (CODATA 2018). The same number as `EV` above,
 * which is this charge times one volt; kept as its own constant because it is
 * a different quantity with a different unit, and a formula should say which it
 * means.
 */
export const E_CHARGE = 1.602_176_634e-19;
/** Vacuum permittivity, F/m. Source: CODATA 2018, 8.854 187 8128(13) × 10⁻¹² F/m. */
export const EPSILON_0 = 8.854_187_8128e-12;
/** Fine-structure constant, dimensionless. Source: CODATA 2018, 7.297 352 5693(11) × 10⁻³. */
export const ALPHA = 7.297_352_5693e-3;
/** One femtometre, m: the scale of nuclei. A unit, not a measurement. */
export const FEMTOMETRE = 1e-15;
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

/** Electron rest mass, kg. Source: CODATA 2018, 9.109 383 7015(28) × 10⁻³¹ kg. */
export const M_ELECTRON = 9.109_383_7015e-31;
/** Proton rest mass, kg. Source: CODATA 2018, 1.672 621 923 69(51) × 10⁻²⁷ kg. */
export const M_PROTON = 1.672_621_923_69e-27;

// Bodies
export const M_SUN = 1.988_4e30; // kg
export const R_SUN = 6.957e8; // m
/**
 * The Sun's centre, from the standard solar model: temperature (K), density
 * (kg/m³, 150 g/cm³) and hydrogen mass fraction (dimensionless, depleted from
 * the primordial ~0.71 by 4.6 billion years of fusion).
 *
 * Source: Bahcall, Serenelli & Basu 2005, "New Solar Opacities, Abundances,
 * Helioseismology, and Neutrino Fluxes", ApJ 621, L85.
 */
export const T_SUN_CORE = 1.57e7;
export const RHO_SUN_CORE = 1.5e5;
export const X_SUN_CORE = 0.34;
export const L_SUN = 3.828e26; // W
/**
 * Absolute bolometric magnitude of the Sun (dimensionless). Source: IAU 2015
 * Resolution B2, M_bol,☉ = 4.74 (the zero point that pairs with L_SUN above).
 */
export const M_BOL_SUN = 4.74;
/**
 * The Sun's main-sequence lifetime, s: 10 billion years, rounded. The anchor of
 * the t ∝ M^(−2.5) scaling the supernova module uses.
 */
export const T_MS_SUN = 1e10 * JULIAN_YEAR;

// Stellar endpoints
/**
 * Chandrasekhar limit, kg, rounded to 1.4 M☉: the most mass electron
 * degeneracy pressure can support. 1.44 M☉ for a carbon–oxygen white dwarf
 * (Y_e = 0.5). Source: Chandrasekhar 1931, ApJ 74, 81.
 */
export const M_CHANDRASEKHAR = 1.4 * M_SUN;
/** A typical neutron-star mass, kg: about 1.4 M☉, the peak of the measured distribution. */
export const M_NS_TYPICAL = 1.4 * M_SUN;
/**
 * Neutron-star radius, m: about 12 km. Source: NICER pulsar measurements
 * (Riley et al. 2021, Miller et al. 2021, PSR J0740+6620), R ≈ 12–13 km.
 */
export const R_NS = 1.2e4;
/**
 * Peak absolute B magnitude of a Type Ia supernova (dimensionless). Source:
 * Richardson et al. 2014, "Absolute-magnitude Distributions of Supernovae",
 * AJ 147, 118 — mean M_B ≈ −19.3.
 */
export const M_IA_PEAK = -19.3;
/**
 * Upper initial mass for a white-dwarf fate, kg: about 8 M☉. Source: Smartt
 * 2009, "Progenitors of Core-Collapse Supernovae", ARA&A 47, 63 (8 ± 1 M☉).
 */
export const MASS_WD_MAX = 8 * M_SUN;
/**
 * Upper initial mass for a neutron-star fate, kg: about 20 M☉, and uncertain.
 * Source: Smartt 2009 and 2015 (the red supergiant problem: no core-collapse
 * progenitor above about 18 M☉ identified).
 */
export const MASS_NS_MAX = 20 * M_SUN;

// Habitable zone
/**
 * Total solar irradiance at 1 AU, W/m²: the IAU 2015 nominal value. Source:
 * Prša et al. 2016, "Nominal Values for Selected Solar and Planetary
 * Quantities: IAU 2015 Resolution B3", AJ 152, 41. L_SUN / (4π AU²) gives
 * 1361.2 W/m², consistent with it; this is the reference Earth's flux ratios
 * are quoted against.
 */
export const S_SUN = 1361;
/**
 * Bond albedos (dimensionless), rounded: Earth 0.30, Venus 0.77, Mars 0.25.
 * Source: NASA Planetary Fact Sheets (Williams, NSSDCA).
 */
export const A_EARTH = 0.3;
export const A_VENUS = 0.77;
export const A_MARS = 0.25;
/** Earth's greenhouse warming, K: the 288 K mean surface less the 255 K equilibrium temperature. */
export const GREENHOUSE_EARTH = 33;
/*
 * Habitable-zone edges as effective stellar flux, in units of Earth's (S_eff,
 * dimensionless), for a Sun-like star (T_eff = 5780 K). Source: Kopparapu et
 * al. 2013, ApJ 765, 131, with the erratum's corrected inner edges (ApJ 770,
 * 82). Conservative: the moist-greenhouse inner edge and the maximum-greenhouse
 * outer edge. Optimistic: recent Venus and early Mars.
 */
export const SEFF_MOIST = 1.014;
export const SEFF_MAXGH = 0.343;
export const SEFF_RECENT_VENUS = 1.776;
export const SEFF_EARLY_MARS = 0.32;

// H II regions
/**
 * Hydrogen case-B recombination coefficient at 10⁴ K, m³/s (2.59 × 10⁻¹³
 * cm³/s): recombinations to every level but the ground state. Source: Hummer
 * & Storey 1987, "Recombination-line intensities for hydrogenic ions. I",
 * MNRAS 224, 801.
 */
export const ALPHA_B = 2.59e-19;
/**
 * Hydrogen photoionization cross-section at the 13.6 eV threshold, m²
 * (6.3 × 10⁻¹⁸ cm²). Source: the hydrogenic threshold value, as tabulated in
 * Osterbrock & Ferland, "Astrophysics of Gaseous Nebulae" (2006), §2.1.
 */
export const SIGMA_PHOTO_H = 6.3e-22;
/**
 * Ionizing photon rate of an O7 V star, s⁻¹, rounded from log Q ≈ 48.9.
 * Source: Sternberg, Hoffmann & Pauldrach 2003, "Ionizing Photon Emission
 * Rates from O- and Early B-Type Stars and Clusters", ApJ 599, 1333.
 */
export const Q_O7V = 1e49;
/** Typical H II region electron temperature, K: the forbidden-line thermostat keeps them near 10⁴ K. */
export const T_HII = 1e4;
/**
 * Isothermal sound speed of ionized gas at 10⁴ K, m/s, rounded: √(k T / μ m_H)
 * is 1.3 × 10⁴ m/s for pure ionized hydrogen (μ = 0.5) and 1.2 × 10⁴ m/s with
 * cosmic helium (μ ≈ 0.6); the conventional round 10 km/s of Spitzer's
 * expansion law is used here.
 */
export const C_S_HII = 1.0e4;

// Distance ladder
/** One arcsecond in radians, exact: π / (180 × 3600). */
export const ARCSEC = Math.PI / 648_000;
/**
 * Leavitt law in V, M_V = a + b (log₁₀ P − 1) with P in days: slope b in
 * magnitudes per dex of period, zero point a the absolute magnitude at 10 days.
 * Source: Benedict et al. 2007, "Hubble Space Telescope Fine Guidance Sensor
 * Parallaxes of Galactic Cepheid Variable Stars: Period-Luminosity Relations",
 * AJ 133, 1810 (b = −2.43 ± 0.12, a = −4.05 ± 0.02).
 */
export const LEAVITT_SLOPE = -2.43;
export const LEAVITT_ZERO_POINT = -4.05;
/**
 * Gaia DR3 parallax precision for bright stars (G ≲ 15), rad: about 20 µas.
 * Source: Gaia Collaboration 2023, "Gaia Data Release 3: Summary of the
 * content and survey properties", A&A 674, A1.
 */
export const GAIA_PARALLAX_SIGMA = 20e-6 * ARCSEC;
/**
 * Distance to the Large Magellanic Cloud, m: 49.59 ± 0.55 kpc from detached
 * eclipsing binaries. Source: Pietrzyński et al. 2019, "A distance to the
 * Large Magellanic Cloud that is precise to one per cent", Nature 567, 200.
 */
export const D_LMC = 49.59e3 * PARSEC;
/** A typical galaxy peculiar velocity, m/s: about 300 km/s against the Hubble flow. */
export const V_PEC_TYPICAL = 3e5;

// Time dilation
/** One day, s, exact: 24 × 3600. */
export const DAY_S = 86_400;
/**
 * GPS orbital radius (semi-major axis), m: 26 560 km, about 20 200 km above the
 * surface. Source: Ashby 2003, "Relativity in the Global Positioning System",
 * Living Rev. Relativ. 6, 1.
 */
export const R_GPS = 2.656e7;
/**
 * Distance to Proxima Centauri, m: 4.2465 light-years (Gaia DR3 parallax
 * 768.07 mas). Source: Gaia Collaboration 2023, A&A 674, A1.
 */
export const D_PROXIMA = 4.2465 * LIGHT_YEAR;
/** The time-dilation sim's black hole, kg: ten solar masses, non-spinning, a typical stellar remnant. */
export const M_DEMO_BH = 10 * M_SUN;
/** Mean muon lifetime at rest, s. Source: Particle Data Group, Review of Particle Physics (2024). */
export const MUON_LIFETIME = 2.1969811e-6;

// Hawking radiation
/**
 * Age of the universe, s: 13.80 billion years. Source: Planck Collaboration
 * 2020, "Planck 2018 results VI: Cosmological parameters", A&A 641, A6 —
 * 13.787 ± 0.020 Gyr, rounded to the figure the modules quote.
 */
export const AGE_UNIVERSE = 13.8e9 * JULIAN_YEAR;
/** One megaton of TNT, J: 4.184 × 10¹⁵, by definition (a thousand tonnes at 4.184 GJ each). */
export const MEGATON_TNT = 4.184e15;
/** Electron rest energy, J. Source: CODATA 2018, m_e c² = 0.510 998 950 00(15) MeV. */
export const E_ELECTRON_REST = 0.51099895e6 * EV;
/** Muon rest energy, J. Source: CODATA 2018, m_μ c² = 105.658 3755(23) MeV. */
export const E_MUON_REST = 105.6583755e6 * EV;
/**
 * The QCD scale, J: about 200 MeV, the rough temperature above which a hot
 * body emits quarks and gluons rather than only leptons and photons. An order
 * of magnitude, not a measurement (Λ_QCD ≈ 200–300 MeV; PDG 2024, "Quantum
 * chromodynamics").
 */
export const E_QCD = 200e6 * EV;

// Wormholes
/** Proton charge radius, m. Source: CODATA 2018, r_p = 0.8414(19) fm. */
export const PROTON_RADIUS = 0.8414e-15;
/**
 * Nuclear density, kg/m³, rounded: the density inside a heavy nucleus. The
 * saturation density of nuclear matter is 0.14–0.16 nucleons per fm³, which is
 * 2.3–2.7 × 10¹⁷ kg/m³; the lower, commonly quoted round figure is used, since
 * it serves only as a comparison ("a few hundred million times" in the module).
 */
export const NUCLEAR_DENSITY = 2.3e17;

export const M_EARTH = 5.972_2e24; // kg
export const R_EARTH = 6.371e6; // m, IUGG mean radius (6371.0 km); NASA Earth Fact Sheet
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
/**
 * Orbital semi-major axes of Mercury and Neptune, m. Sources: NASA Mercury
 * Fact Sheet (D. R. Williams, NASA GSFC), 57.909 × 10⁶ km; and for Neptune the
 * J2000 mean element from JPL's "Approximate Positions of the Planets"
 * (Standish & Williams), 30.069 922 76 AU, the conventional 30.07 AU. Neptune's
 * osculating semi-major axis wanders; NASA's fact sheet quotes 30.18 AU for a
 * different epoch, so the mean element is the one to use for a fixed figure.
 */
export const A_MERCURY = 5.790_9e10;
export const A_NEPTUNE = 30.069_922_76 * AU;

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
 * One-sigma uncertainties on the two H₀ values above, s⁻¹: Planck 2018's
 * ± 0.5 km/s/Mpc (Planck Collaboration 2020, A&A 641, A6, TT,TE,EE+lowE+lensing)
 * and SH0ES 2022's ± 1.04 km/s/Mpc (Riess et al. 2022).
 */
export const H0_PLANCK_2018_SIGMA = 0.5 * KM_S_PER_MPC;
export const H0_SH0ES_2022_SIGMA = 1.04 * KM_S_PER_MPC;
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
/**
 * Matter density today, as a fraction of the critical density (dimensionless).
 *
 * Source: Planck Collaboration 2020, "Planck 2018 results VI", A&A 641, A6,
 * TT,TE,EE+lowE+lensing — Ω_m = 0.3153 ± 0.0073.
 */
export const OMEGA_M = 0.315;
/**
 * Dark-energy density today, as a fraction of the critical density
 * (dimensionless). Source: Planck 2018 VI — Ω_Λ = 0.6847 ± 0.0073.
 */
export const OMEGA_LAMBDA = 0.685;
/**
 * Effective number of neutrino species (dimensionless): three, raised slightly
 * by their incomplete decoupling before electron–positron annihilation.
 *
 * Source: Akita & Yamaguchi 2020, "A precision calculation of relic neutrino
 * decoupling", JCAP 08, 012 — N_eff = 3.044.
 */
export const N_EFF = 3.044;

// Mathematics
/**
 * Apéry's constant, ζ(3), dimensionless. It sets the photon number density of
 * blackbody radiation: n_γ = 16π ζ(3) (kT / hc)³.
 */
export const ZETA_3 = 1.202_056_903_159_594_2;

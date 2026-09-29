/**
 * Supernovae: what a star becomes by its birth mass, and how bright a Type Ia
 * looks at a distance.
 *
 * SI in, SI out: masses in kg, times in s, luminosities in W, distances in m,
 * energies in J. Magnitudes are dimensionless by nature. Solar units, years and
 * light-years are display formats, applied by the sim.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import {
  G,
  L_SUN,
  M_BOL_SUN,
  M_IA_PEAK,
  MASS_NS_MAX,
  MASS_WD_MAX,
  M_NS_TYPICAL,
  M_SUN,
  PARSEC,
  T_MS_SUN,
} from './constants';

/* ------------------------------------------------------------------ */
/* The main sequence                                                   */
/* ------------------------------------------------------------------ */

/**
 * Main-sequence lifetime, s: the time a star fuses hydrogen steadily.
 *
 *     t_MS = 10¹⁰ yr · (M / M☉)^(−2.5)
 *
 * A power law, good to about a factor of two between 0.5 and 20 M☉; the sim
 * discloses it.
 *
 * @param M_kg initial mass, kg
 */
export function mainSequenceLifetime(M_kg: number): number {
  return T_MS_SUN * (M_kg / M_SUN) ** -2.5;
}

/**
 * Main-sequence luminosity, W.
 *
 *     L = L☉ · (M / M☉)^3.5
 *
 * @param M_kg initial mass, kg
 */
export function mainSequenceLuminosity(M_kg: number): number {
  return L_SUN * (M_kg / M_SUN) ** 3.5;
}

/* ------------------------------------------------------------------ */
/* Fates                                                               */
/* ------------------------------------------------------------------ */

export type Fate = 'white-dwarf' | 'neutron-star' | 'black-hole';

/**
 * What a star of a given birth mass becomes, cut sharply at MASS_WD_MAX (8 M☉)
 * and MASS_NS_MAX (20 M☉). The real boundaries are uncertain and depend on
 * composition and rotation; the sim discloses the sharp cuts.
 *
 * @param M_kg initial mass, kg
 */
export function fate(M_kg: number): Fate {
  if (M_kg < MASS_WD_MAX) return 'white-dwarf';
  if (M_kg < MASS_NS_MAX) return 'neutron-star';
  return 'black-hole';
}

/**
 * The initial–final mass relation for white dwarfs, M_f = 0.109 M_i + 0.394 M☉
 * (Kalirai et al. 2008, ApJ 676, 594): slope dimensionless, intercept in M☉.
 */
const IFMR_SLOPE = 0.109;
const IFMR_INTERCEPT = 0.394;

/** Share of a black-hole progenitor's mass left in the hole: a third, uncertain, disclosed. */
const BLACK_HOLE_FRACTION = 1 / 3;

/**
 * Mass of what the star leaves behind, kg.
 *
 *   - White dwarf: (0.109 M/M☉ + 0.394) M☉, Kalirai et al. 2008.
 *   - Neutron star: a typical 1.4 M☉, whatever the progenitor.
 *   - Black hole: a third of the birth mass. Rough: mass loss before collapse
 *     and fallback during it are both poorly known.
 *
 * Jumps at the fate boundaries by design; never exceeds M.
 *
 * @param M_kg initial mass, kg
 */
export function remnantMass(M_kg: number): number {
  switch (fate(M_kg)) {
    case 'white-dwarf':
      return (IFMR_SLOPE * (M_kg / M_SUN) + IFMR_INTERCEPT) * M_SUN;
    case 'neutron-star':
      return M_NS_TYPICAL;
    case 'black-hole':
      return M_kg * BLACK_HOLE_FRACTION;
  }
}

/**
 * Gravitational binding energy released as a core collapses to a uniform
 * sphere, J.
 *
 *     E = 3 G M² / (5 R)
 *
 * @param M_ns_kg mass of the collapsed object, kg
 * @param R_m     its radius, m
 */
export function collapseEnergy(M_ns_kg: number, R_m: number): number {
  return (3 * G * M_ns_kg ** 2) / (5 * R_m);
}

/** What each fate means, for the readout. */
export const FATE_LABELS: Record<Fate, string> = {
  'white-dwarf': 'White dwarf, after a planetary nebula. No supernova.',
  'neutron-star': 'Neutron star, in a core-collapse supernova.',
  'black-hole': 'Black hole, in a supernova or a silent collapse.',
};

/* ------------------------------------------------------------------ */
/* Type Ia brightness                                                  */
/* ------------------------------------------------------------------ */

/**
 * Peak luminosity of a Type Ia, W, from its peak absolute magnitude.
 *
 *     L = L☉ · 10^(−0.4 (M_Ia − M_bol,☉))
 *
 * Treats the B-band magnitude −19.3 as bolometric, which it is not quite (a
 * bolometric correction of a few tenths of a magnitude applies); good to tens
 * of percent, which is what the sanity check asks.
 */
export function typeIaPeakLuminosity(): number {
  return L_SUN * 10 ** (-0.4 * (M_IA_PEAK - M_BOL_SUN));
}

/*
 * Reference apparent magnitudes the brightness panel is read against. Display
 * landmarks rather than physics: the full Moon's mean −12.7 and Venus at its
 * brightest, −4.6 (Allen's Astrophysical Quantities, 4th ed., §12); +6, the
 * conventional naked-eye limit under a dark sky; and about +31, the faintest
 * point sources reached by the Hubble and JWST deep fields.
 */
export const MAG_FULL_MOON = -12.7;
export const MAG_VENUS = -4.6;
export const MAG_NAKED_EYE = 6;
export const MAG_SPACE_TELESCOPE = 31;

/** Ten parsecs, m: the distance at which apparent and absolute magnitude agree. */
const TEN_PARSECS = 10 * PARSEC;

/**
 * Apparent magnitude of an object at a distance (dimensionless).
 *
 *     m = M + 5 log₁₀(d / 10 pc)
 *
 * No extinction.
 *
 * @param M_abs absolute magnitude
 * @param d_m   distance, m
 */
export function apparentMagnitude(M_abs: number, d_m: number): number {
  return M_abs + 5 * Math.log10(d_m / TEN_PARSECS);
}

/**
 * Distance at which an object of absolute magnitude M_abs appears at apparent
 * magnitude m, m: the inverse of `apparentMagnitude`.
 *
 *     d = 10 pc · 10^((m − M) / 5)
 *
 * @param M_abs absolute magnitude
 * @param m     apparent magnitude
 */
export function distanceForMagnitude(M_abs: number, m: number): number {
  return TEN_PARSECS * 10 ** ((m - M_abs) / 5);
}

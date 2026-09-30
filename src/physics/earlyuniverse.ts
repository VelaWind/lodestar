/**
 * The early universe: temperature, time and scale factor from the first
 * microsecond to today.
 *
 * SI in, SI out: temperatures in K, times in s, energies in J. Electronvolts
 * appear only where a boundary is quoted in them, converted through `EV` at
 * the point of definition, and in the sim's display.
 *
 * Two models, stitched at kT = 0.1 MeV (about two minutes in):
 *
 *   - Before the stitch, the radiation-era relation between time and
 *     temperature, t = √(90 ħ³ c⁵ / (32 π³ G g_*)) / (kT)², with g_* switched
 *     in steps. Matter and dark energy are negligible this early.
 *   - After it, the standard ΛCDM expansion integrated numerically with the
 *     Planck 2018 densities, and T = T₀ / a.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import {
  C,
  EV,
  G,
  H0_PLANCK_2018,
  H_BAR,
  K_B,
  OMEGA_LAMBDA,
  OMEGA_M,
  T_CMB,
} from './constants';
import { scaleFactorAtTemperature as scaleFactorFromCmbTemperature } from './cosmology';

/* ------------------------------------------------------------------ */
/* Degrees of freedom                                                  */
/* ------------------------------------------------------------------ */

export interface GStarRow {
  /** The row applies at and above this kT, J. */
  kTmin_J: number;
  /** Energy-density degrees of freedom, g_*. */
  gStar: number;
  /** Entropy degrees of freedom, g_s. */
  gS: number;
}

/**
 * g_* and g_s, hottest first.
 *
 * Massless neutrinos, three species; each heavy particle switched off as a step
 * near its mass, and the lattice-QCD crossover treated as a step at 170 MeV.
 * Above 175 GeV the whole standard model is relativistic (106.75); the top
 * quark drops out below that (96.25), the Higgs below 125 GeV (95.25), the W
 * and Z below about 90 GeV (86.25), the bottom quark below 4.5 GeV (75.75), and
 * the charm quark and tau together below about 1.5 GeV (61.75). Cumulative
 * values and thresholds follow Husdal 2016, "On Effective Degrees of Freedom in
 * the Early Universe", Galaxies 4, 78 (arXiv:1609.04979), rounded to the
 * particle masses.
 *
 * Below 1.5 GeV: photons, gluons, u, d, s quarks, electrons, muons and
 * neutrinos (61.75). Down to 100 MeV: pions in place of quarks and gluons
 * (17.25). Down to 0.5 MeV: photons, electrons and neutrinos (10.75). Below:
 * photons, plus neutrinos at (4/11)^(1/3) of the photon temperature (3.36 for
 * energy, 3.91 for entropy). The real functions are smooth; the sim's
 * approximation disclosure says so, and where the time stalls at each step.
 */
export const G_STAR: readonly GStarRow[] = [
  { kTmin_J: 175e9 * EV, gStar: 106.75, gS: 106.75 },
  { kTmin_J: 125e9 * EV, gStar: 96.25, gS: 96.25 },
  { kTmin_J: 90e9 * EV, gStar: 95.25, gS: 95.25 },
  { kTmin_J: 4.5e9 * EV, gStar: 86.25, gS: 86.25 },
  { kTmin_J: 1.5e9 * EV, gStar: 75.75, gS: 75.75 },
  { kTmin_J: 170e6 * EV, gStar: 61.75, gS: 61.75 },
  { kTmin_J: 100e6 * EV, gStar: 17.25, gS: 17.25 },
  { kTmin_J: 0.5e6 * EV, gStar: 10.75, gS: 10.75 },
  { kTmin_J: 0, gStar: 3.36, gS: 3.91 },
];

/** The coldest row: the degrees of freedom today. */
const TODAY_ROW = G_STAR[G_STAR.length - 1] as GStarRow;

function rowAt(T_K: number): GStarRow {
  const kT = K_B * T_K;
  return G_STAR.find((row) => kT >= row.kTmin_J) ?? TODAY_ROW;
}

/** g_* at a temperature (dimensionless). @param T_K temperature, K */
export function gStarAt(T_K: number): number {
  return rowAt(T_K).gStar;
}

/** g_s at a temperature (dimensionless). @param T_K temperature, K */
export function gSAt(T_K: number): number {
  return rowAt(T_K).gS;
}

/* ------------------------------------------------------------------ */
/* Radiation era                                                       */
/* ------------------------------------------------------------------ */

/**
 * The radiation-era coefficient √(90 ħ³ c⁵ / (32 π³ G g_*)), J² s: time is this
 * divided by (kT)².
 *
 * @param gStar energy-density degrees of freedom, dimensionless
 */
function radiationCoefficient(gStar: number): number {
  return Math.sqrt((90 * H_BAR ** 3 * C ** 5) / (32 * Math.PI ** 3 * G * gStar));
}

/**
 * Time since the Big Bang at which the radiation-dominated universe had a
 * given temperature, s.
 *
 *     t = √(90 ħ³ c⁵ / (32 π³ G g_*(T))) / (kT)²
 *
 * @param T_K temperature, K
 */
export function radiationTimeAtTemperature(T_K: number): number {
  return radiationCoefficient(gStarAt(T_K)) / (K_B * T_K) ** 2;
}

/** The temperature range the radiation-era inverse searches, K. */
const RADIATION_T_MIN = 1e6;
const RADIATION_T_MAX = 1e14;

/**
 * The inverse of `radiationTimeAtTemperature`, K, by bisection in log T over
 * [10⁶, 10¹⁴] K. Time falls monotonically as temperature rises (g_* only ever
 * steps up with T), so bisection is safe; at a step in g_* the time jumps, and
 * a time inside that jump resolves to the step's temperature.
 *
 * @param t_s time since the Big Bang, s
 */
export function radiationTemperatureAtTime(t_s: number): number {
  let lo = Math.log10(RADIATION_T_MIN);
  let hi = Math.log10(RADIATION_T_MAX);
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    // Hotter is earlier: if the midpoint's time is later than t, go hotter.
    if (radiationTimeAtTemperature(10 ** mid) > t_s) lo = mid;
    else hi = mid;
  }
  return 10 ** ((lo + hi) / 2);
}

/**
 * Scale factor at a radiation temperature, dimensionless, a = 1 today.
 *
 *     a = (T₀ / T) · (g_s,today / g_s(T))^(1/3)
 *
 * Entropy conservation: g_s a³ T³ is constant. The second factor is 1 after
 * electron–positron annihilation and (3.91 / 10.75)^(1/3) ≈ 0.71 before.
 *
 * @param T_K photon temperature, K
 */
export function scaleFactorAtTemperature(T_K: number): number {
  return scaleFactorFromCmbTemperature(T_K) * (TODAY_ROW.gS / gSAt(T_K)) ** (1 / 3);
}

/* ------------------------------------------------------------------ */
/* ΛCDM                                                                */
/* ------------------------------------------------------------------ */

/**
 * Radiation density today as a fraction of the critical density,
 * dimensionless — derived, not quoted.
 *
 *     Ω_r = (π²/30) g_*,today (k T₀)⁴ / (ħc)³  ÷  ρ_crit c²,   ρ_crit = 3 H₀² / (8πG)
 */
export function radiationDensityParameter(): number {
  const energyDensity =
    ((Math.PI ** 2 / 30) * TODAY_ROW.gStar * (K_B * T_CMB) ** 4) / (H_BAR * C) ** 3;
  const criticalEnergyDensity = ((3 * H0_PLANCK_2018 ** 2) / (8 * Math.PI * G)) * C ** 2;
  return energyDensity / criticalEnergyDensity;
}

const OMEGA_R = radiationDensityParameter();

/**
 * Hubble parameter at a scale factor, s⁻¹.
 *
 *     H(a) = H₀ √(Ω_r a⁻⁴ + Ω_m a⁻³ + Ω_Λ)
 *
 * @param a scale factor, dimensionless, a = 1 today
 */
export function hubbleAt(a: number): number {
  return H0_PLANCK_2018 * Math.sqrt(OMEGA_R / a ** 4 + OMEGA_M / a ** 3 + OMEGA_LAMBDA);
}

/** Below this scale factor the integral is taken analytically. */
const A_ANALYTIC = 1e-9;
/** Simpson panels in ln a above it. Even, as Simpson's rule needs. */
const SIMPSON_PANELS = 4000;

/**
 * Time since the Big Bang at a scale factor, s.
 *
 *     t(a) = ∫₀^a da′ / (a′ H(a′))
 *
 * Below a = 10⁻⁹ radiation is all that matters and t = a² / (2 H₀ √Ω_r)
 * exactly; above it, Simpson's rule in ln a with 4000 panels.
 *
 * @param a scale factor, dimensionless
 */
export function lcdmTimeAtScaleFactor(a: number): number {
  const early = (x: number) => x ** 2 / (2 * H0_PLANCK_2018 * Math.sqrt(OMEGA_R));
  if (a <= A_ANALYTIC) return early(a);

  const x0 = Math.log(A_ANALYTIC);
  const x1 = Math.log(a);
  const h = (x1 - x0) / SIMPSON_PANELS;
  const f = (x: number) => 1 / hubbleAt(Math.exp(x));
  let sum = f(x0) + f(x1);
  for (let i = 1; i < SIMPSON_PANELS; i += 1) sum += (i % 2 === 1 ? 4 : 2) * f(x0 + i * h);
  return early(A_ANALYTIC) + (h / 3) * sum;
}

const A_SEARCH_MIN = 1e-12;
const A_SEARCH_MAX = 1.01;

/**
 * The inverse of `lcdmTimeAtScaleFactor`, dimensionless, by bisection in log a
 * over [10⁻¹², 1.01].
 *
 * @param t_s time since the Big Bang, s
 */
export function lcdmScaleFactorAtTime(t_s: number): number {
  let lo = Math.log10(A_SEARCH_MIN);
  let hi = Math.log10(A_SEARCH_MAX);
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (lcdmTimeAtScaleFactor(10 ** mid) < t_s) lo = mid;
    else hi = mid;
  }
  return 10 ** ((lo + hi) / 2);
}

/* ------------------------------------------------------------------ */
/* The stitched history                                                */
/* ------------------------------------------------------------------ */

/** Where the two models hand over: kT = 0.1 MeV, in K. */
export const STITCH_TEMPERATURE_K = (0.1e6 * EV) / K_B;

/** The time of the hand-over, s: about two minutes. */
export function stitchTime(): number {
  return radiationTimeAtTemperature(STITCH_TEMPERATURE_K);
}

const STITCH_TIME = stitchTime();

/**
 * Photon temperature at a time since the Big Bang, K.
 *
 * @param t_s time since the Big Bang, s
 */
export function temperatureAtTime(t_s: number): number {
  return t_s < STITCH_TIME ? radiationTemperatureAtTime(t_s) : T_CMB / lcdmScaleFactorAtTime(t_s);
}

/**
 * Scale factor at a time since the Big Bang, dimensionless, a = 1 today.
 *
 * @param t_s time since the Big Bang, s
 */
export function scaleFactorAtTime(t_s: number): number {
  return t_s < STITCH_TIME
    ? scaleFactorAtTemperature(radiationTemperatureAtTime(t_s))
    : lcdmScaleFactorAtTime(t_s);
}

/**
 * Time since the Big Bang at which the photons had a given temperature, s: the
 * inverse of `temperatureAtTime`, going the cheap way round on each branch.
 * Hotter than the stitch, the radiation formula directly; cooler, the ΛCDM
 * integral at a = T₀ / T. The sim uses it to place epoch boundaries and the
 * point where a particle's line meets the curve.
 *
 * @param T_K photon temperature, K
 */
export function timeAtTemperature(T_K: number): number {
  return T_K > STITCH_TEMPERATURE_K
    ? radiationTimeAtTemperature(T_K)
    : lcdmTimeAtScaleFactor(T_CMB / T_K);
}

/**
 * When the universe cooled below a particle's rest energy, s: the moment kT
 * fell to mc², by the radiation-era relation.
 *
 * @param E_J rest energy mc², J
 */
export function freezeOutTime(E_J: number): number {
  return radiationTimeAtTemperature(E_J / K_B);
}

/* ------------------------------------------------------------------ */
/* Epochs                                                              */
/* ------------------------------------------------------------------ */

export interface EpochRow {
  /** The epoch applies at and below this kT, J; Infinity for the hottest. */
  kTmax_J: number;
  id: string;
  title: string;
  description: string;
}

/** What the universe contained, hottest first. */
export const EPOCHS: readonly EpochRow[] = [
  {
    kTmax_J: Infinity,
    id: 'quark-gluon-plasma',
    title: 'Quark–gluon plasma',
    description: 'Quarks and gluons roam free. No protons yet.',
  },
  {
    kTmax_J: 170e6 * EV,
    id: 'hadrons',
    title: 'Protons and neutrons form',
    description: 'Quarks lock into protons and neutrons.',
  },
  {
    kTmax_J: 100e6 * EV,
    id: 'hot-soup',
    title: 'Hot soup',
    description: 'Protons, neutrons, electrons, positrons, neutrinos and light, all trading places.',
  },
  {
    kTmax_J: 0.8e6 * EV,
    id: 'neutrinos-leave',
    title: 'Neutrinos leave',
    description: 'Neutrinos stop interacting; positrons annihilate with electrons.',
  },
  {
    kTmax_J: 0.08e6 * EV,
    id: 'nucleosynthesis',
    title: 'Nucleosynthesis',
    description: 'Deuterium survives at last, and helium forms within minutes.',
  },
  {
    kTmax_J: 0.03e6 * EV,
    id: 'radiation-era',
    title: 'Radiation era',
    description: 'A glowing plasma of nuclei, electrons and light. Light still outweighs matter.',
  },
  {
    kTmax_J: 0.8 * EV,
    id: 'matter-era',
    title: 'Matter takes over',
    description: 'Matter now sets the pace of expansion; the plasma still scatters light.',
  },
  {
    kTmax_J: 0.256 * EV,
    id: 'dark-ages',
    title: 'Dark ages',
    description: 'Atoms form and the background light is released. Neutral gas, no stars.',
  },
  {
    kTmax_J: 5e-3 * EV,
    id: 'stars',
    title: 'Stars and galaxies',
    description: 'First stars a hundred million years in; then galaxies; then us.',
  },
];

/**
 * The epoch at a temperature: the coldest row whose upper bound kT still
 * reaches.
 *
 * @param T_K temperature, K
 */
export function epochAt(T_K: number): EpochRow {
  const kT = K_B * T_K;
  let found = EPOCHS[0] as EpochRow;
  for (const row of EPOCHS) {
    if (kT <= row.kTmax_J) found = row;
  }
  return found;
}

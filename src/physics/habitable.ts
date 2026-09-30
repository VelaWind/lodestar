/**
 * The habitable zone: how much starlight reaches a planet, how warm that makes
 * it, and where around a star liquid water is possible.
 *
 * SI in, SI out: luminosities in W, distances in m, temperatures in K, fluxes in
 * W/m². Albedo and S_eff are dimensionless by nature. Solar luminosities, AU and
 * degrees Celsius are display formats, applied by the sim.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import {
  AU,
  GREENHOUSE_EARTH,
  L_SUN,
  M_SUN,
  SEFF_EARLY_MARS,
  SEFF_MAXGH,
  SEFF_MOIST,
  SEFF_RECENT_VENUS,
  SIGMA_SB,
} from './constants';

/**
 * Starlight falling on each square metre at a distance, W/m².
 *
 *     S = L / (4π d²)
 *
 * @param L_W luminosity of the star, W
 * @param d_m distance from the star, m
 */
export function stellarFlux(L_W: number, d_m: number): number {
  return L_W / (4 * Math.PI * d_m ** 2);
}

/**
 * Equilibrium temperature of a fast-rotating airless sphere, K: absorbed
 * starlight on the disc πR² balances blackbody emission from the sphere 4πR².
 *
 *     T_eq = ((1 − A) L / (16 π σ d²))^(1/4)
 *
 * @param L_W luminosity of the star, W
 * @param d_m distance from the star, m
 * @param A   Bond albedo, dimensionless, 0 to 1
 */
export function equilibriumTemperature(L_W: number, d_m: number, A: number): number {
  return (((1 - A) * L_W) / (16 * Math.PI * SIGMA_SB * d_m ** 2)) ** 0.25;
}

/**
 * Surface temperature with Earth's greenhouse warming added, K: a flat 33 K
 * offset, disclosed beside the sim.
 *
 * @param T_eq_K equilibrium temperature, K
 */
export function surfaceTemperatureEarthLike(T_eq_K: number): number {
  return T_eq_K + GREENHOUSE_EARTH;
}

/**
 * Distance of a habitable-zone edge, m.
 *
 *     d_edge = 1 AU · √((L / L☉) / S_eff)
 *
 * @param L_W  luminosity of the star, W
 * @param sEff the edge's flux in units of Earth's, dimensionless
 */
export function zoneEdge(L_W: number, sEff: number): number {
  return AU * Math.sqrt(L_W / L_SUN / sEff);
}

/**
 * A main-sequence star's mass from its luminosity, kg: the mass–luminosity
 * rule L ∝ M^3.5 turned around, good to about a factor of two and disclosed
 * beside the sim. Used only for the year readout.
 *
 *     M = M☉ · (L / L☉)^(1/3.5)
 *
 * @param L_W luminosity of the star, W
 */
export function massFromLuminosity(L_W: number): number {
  return M_SUN * (L_W / L_SUN) ** (1 / 3.5);
}

export type Verdict = 'inside' | 'optimistic' | 'too-hot' | 'too-cold';

/**
 * Where a planet sits against a Sun-like star's zone edges (Kopparapu et al.
 * 2013): inside the conservative band, in the optimistic extension on either
 * side, or beyond it. Edges count as inside.
 *
 * @param L_W luminosity of the star, W
 * @param d_m distance from the star, m
 */
export function zoneVerdict(L_W: number, d_m: number): Verdict {
  if (d_m >= zoneEdge(L_W, SEFF_MOIST) && d_m <= zoneEdge(L_W, SEFF_MAXGH)) return 'inside';
  if (d_m >= zoneEdge(L_W, SEFF_RECENT_VENUS) && d_m <= zoneEdge(L_W, SEFF_EARLY_MARS)) return 'optimistic';
  return d_m < zoneEdge(L_W, SEFF_RECENT_VENUS) ? 'too-hot' : 'too-cold';
}

/** What each verdict means, for the readout. */
export const VERDICT_LABELS: Record<Verdict, string> = {
  inside: 'Yes: in the zone. Liquid water is possible with the right atmosphere.',
  optimistic: 'At the edge: in the optimistic zone only. Venus or early Mars territory.',
  'too-hot': 'No: too hot. Any ocean would boil away.',
  'too-cold': 'No: too cold. Water freezes even with a thick atmosphere.',
};

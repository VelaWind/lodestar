/**
 * Hawking radiation: the inverses of the black-hole temperature and lifetime,
 * the power a hole radiates, what it is hot enough to emit, and whether it is
 * warmer or colder than the microwave background.
 *
 * SI in, SI out: masses in kg, temperatures in K, times in s, powers in W,
 * energies in J. Years, eV and "megatons" are display formats, applied by the
 * sim.
 *
 * `schwarzschildRadius`, `hawkingTemperature` and `evaporationTime` live in
 * `./blackhole` and are reused here, not restated: the black-holes module
 * quotes the same temperature and lifetime, and one copy of each formula is
 * the only way the two modules can never disagree.
 *
 * Photons only, as `evaporationTime` is: the power below is the one whose
 * integral gives that lifetime, so the two are consistent by construction.
 * A real hole also emits gravitons; neutrinos, which have mass, only once it is
 * hotter than their rest energy (lighter than about 10²¹ kg); and heavier
 * particles once hotter still. The module discloses the cost by mass: about
 * twofold for a cold hole near a solar mass, tenfold or more for a hot one.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import { hawkingTemperature } from './blackhole';
import { C, E_ELECTRON_REST, E_MUON_REST, E_QCD, G, H_BAR, K_B, T_CMB } from './constants';

/**
 * The mass whose Hawking temperature is T, kg: the inverse of
 * `hawkingTemperature`.
 *
 *     M = ħc³ / (8π G k T)
 *
 * @param T_K temperature, K
 */
export function massForHawkingTemperature(T_K: number): number {
  if (!(T_K > 0)) return NaN;
  return (H_BAR * C ** 3) / (8 * Math.PI * G * K_B * T_K);
}

/**
 * Power a hole radiates as light, W.
 *
 *     P = ħc⁶ / (15360 π G² M²)
 *
 * The photons-only coefficient that makes −dM/dt = P/c² integrate to
 * `evaporationTime`'s 5120π G²M³/(ħc⁴): with P = A/M², the lifetime is
 * M³c²/(3A), and A = ħc⁶/(15360π G²) gives exactly that.
 *
 * @param M_kg mass, kg
 */
export function hawkingPower(M_kg: number): number {
  if (!(M_kg > 0)) return NaN;
  return (H_BAR * C ** 6) / (15360 * Math.PI * G ** 2 * M_kg ** 2);
}

/**
 * The mass that evaporates completely in time t, kg: the inverse of
 * `evaporationTime`.
 *
 *     M = (t ħc⁴ / (5120π G²))^(1/3)
 *
 * @param t_s time, s
 */
export function massEvaporatingIn(t_s: number): number {
  if (!(t_s > 0)) return NaN;
  return Math.cbrt((t_s * H_BAR * C ** 4) / (5120 * Math.PI * G ** 2));
}

/**
 * The energy a hole releases in its last second, J: the rest energy of the
 * mass that evaporates in one second.
 *
 *     E = M(1 s) c²
 */
export function finalSecondEnergy(): number {
  return massEvaporatingIn(1) * C ** 2;
}

/**
 * What a hole is hot enough to emit, by kT against each particle's rest energy
 * (J), coolest first. Each band switches on sharply at its threshold, as the
 * module discloses; real emission turns on over a few times that temperature.
 */
export const EMISSION_BANDS: readonly { threshold_J: number; label: string }[] = [
  { threshold_J: 0, label: 'light, neutrinos and gravitons' },
  { threshold_J: E_ELECTRON_REST, label: 'plus electrons and positrons' },
  { threshold_J: E_MUON_REST, label: 'plus muons' },
  { threshold_J: E_QCD, label: 'plus quarks and gluons, which become pions and protons' },
];

/**
 * The emission band for a hole of mass M: the hottest band whose threshold
 * kT = k · T_H(M) has reached.
 *
 * @param M_kg mass, kg
 */
export function emissionBand(M_kg: number): string {
  const kT = K_B * hawkingTemperature(M_kg);
  let band = EMISSION_BANDS[0]!.label;
  for (const { threshold_J, label } of EMISSION_BANDS) if (kT >= threshold_J) band = label;
  return band;
}

/**
 * Whether a hole of mass M, sitting in today's microwave background, loses more
 * than it absorbs. Hotter than the background, it shrinks; colder, it grows.
 *
 * @param M_kg mass, kg
 */
export function netWithCMB(M_kg: number): 'shrinking' | 'growing' {
  return hawkingTemperature(M_kg) > T_CMB ? 'shrinking' : 'growing';
}

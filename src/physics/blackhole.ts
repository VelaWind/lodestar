/**
 * Schwarzschild black holes. SI base units throughout: kilograms in; metres,
 * metres per second squared, kelvin and seconds out.
 *
 * Every function here is closed form. There is no integrator and no state — a
 * Schwarzschild hole is described completely by its mass, so every quantity the
 * module shows is one line of algebra from `M`. That is also why the sim is a
 * diagram rather than an animation.
 *
 * This module is the single source of truth for the black-holes module's
 * numbers. The canvas, every readout, the sanity checks and the math layer's
 * equations all call these functions — per the physics-accuracy skill, the sim's
 * calculation and the displayed equation must be one shared function or they
 * will drift.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 *
 * What this file assumes, everywhere, without repeating it per function:
 * the hole is *Schwarzschild* — non-rotating, uncharged, isolated, in vacuum.
 * Real holes spin, and spin is not a small correction: for a maximally rotating
 * Kerr hole the prograde ISCO falls from 3 r_s to 0.5 r_s and the photon orbit
 * with it, which is why accretion efficiency runs from 5.7% to 42% across the
 * same mass range. The module discloses this beside the sim.
 */
import { C, G, H_BAR, K_B } from './constants';

/**
 * Height of the person the tidal readout is computed for, m.
 *
 * NCD-RisC 2016 global mean adult height is ≈1.70 m (men) / 1.59 m (women); 1.7
 * is the round figure the module quotes. It lives here rather than being passed
 * in ad hoc so the sim readout and the sanity check evaluate the same person.
 */
export const PERSON_HEIGHT = 1.7; // m

/**
 *     r_s = 2GM / c²
 *
 * Schwarzschild radius — the event horizon, m. Not a surface: it is the radius
 * at which every future-directed path leads inward. Spacetime there is locally
 * unremarkable for a large enough hole; nothing about the horizon is felt as a
 * boundary by something crossing it.
 *
 * @param M mass, kg
 */
export function schwarzschildRadius(M: number): number {
  if (!(M > 0)) return NaN;
  return (2 * G * M) / C ** 2;
}

/**
 *     r_ph = 3GM / c² = 1.5 · r_s
 *
 * Photon sphere, m — the radius at which light orbits in a circle. The orbit is
 * unstable in the radial direction, so no photon stays on it; what the reader
 * sees in an image of a hole is the photon *ring*, light that lingered near this
 * radius and escaped. Its apparent size on the sky is not this radius but the
 * shadow radius √27 GM/c² ≈ 2.6 r_s, enlarged by the hole's own lensing.
 *
 * @param M mass, kg
 */
export function photonSphereRadius(M: number): number {
  return 1.5 * schwarzschildRadius(M);
}

/**
 *     r_isco = 6GM / c² = 3 · r_s
 *
 * Innermost stable circular orbit, m. Inside it, circular orbits still exist but
 * any inward nudge grows rather than oscillating, so orbiting matter spirals in.
 * This is the inner edge of a thin accretion disc, and the binding energy there
 * — 5.7% of rest mass for a non-rotating hole — is what makes accretion the most
 * efficient sustained energy source in astrophysics, an order above fusion.
 *
 * @param M mass, kg
 */
export function iscoRadius(M: number): number {
  return 3 * schwarzschildRadius(M);
}

/**
 *     Δa = 2GM·h / r³,  evaluated at r = r_s
 *
 * Difference in gravitational acceleration between a person's head and feet at
 * the horizon, m/s². Radial separation `h`, aligned with the fall.
 *
 * The coefficient is the Newtonian tidal expression, and stating why it is used
 * at a horizon matters: for radial separations in Schwarzschild geometry it is
 * not an approximation to the relativistic answer, it *is* the relativistic
 * answer. The radial component of the Riemann tensor in the orthonormal frame of
 * a radially free-falling observer is R^r̂_t̂r̂t̂ = −2GM/(c²r³), so geodesic
 * deviation gives exactly Δa = 2GM·h/r³ — the same 2GM/r³ as Newton, with no
 * relativistic correction factor, at any r including r_s. (The tangential
 * components are −GM/r³, squeezing rather than stretching; the module quotes the
 * radial one because it is the larger and the one that kills.)
 *
 * What *is* approximate: h is treated as small compared with r, the person is
 * treated as rigid and momentarily static in the falling frame, and internal
 * structure is ignored. Those hold well for a human at a stellar-mass horizon,
 * where the answer is fatal by seven orders of magnitude and precision is beside
 * the point.
 *
 * Note the mass dependence, which is the counter-intuitive part of the module:
 * Δa ∝ M/r_s³ ∝ 1/M². Bigger holes are gentler at the horizon.
 *
 * @param M mass, kg
 * @param h head-to-foot separation, m
 */
export function tidalAccelerationAtHorizon(M: number, h: number): number {
  if (!(M > 0) || !(h > 0)) return NaN;
  const rs = schwarzschildRadius(M);
  return (2 * G * M * h) / rs ** 3;
}

/**
 *     T_H = ħc³ / (8π G M k_B)
 *
 * Hawking temperature, K — the temperature of the thermal radiation the horizon
 * emits, as measured by a distant observer. Inversely proportional to mass: a
 * stellar-mass hole is colder than the cosmic microwave background by eight
 * orders of magnitude, which is why no astrophysical hole is evaporating today.
 * They all absorb the CMB faster than they radiate.
 *
 * @param M mass, kg
 */
export function hawkingTemperature(M: number): number {
  if (!(M > 0)) return NaN;
  return (H_BAR * C ** 3) / (8 * Math.PI * G * M * K_B);
}

/**
 *     t_evap = 5120 π G² M³ / (ħ c⁴)
 *
 * Evaporation time, s — how long a hole of mass `M` takes to radiate itself away
 * completely, starting now and left entirely alone.
 *
 * This is the Page-type estimate for a hole emitting photons only, integrated
 * from the Stefan–Boltzmann power of a horizon at T_H. It is order-of-magnitude,
 * not a prediction: the coefficient rises once other massless species are
 * included, and falls again as a shrinking hole heats past the mass thresholds
 * where it can emit electrons, then hadrons — Page's full accounting for a
 * non-rotating hole is roughly a factor of two to three faster than the
 * photons-only figure. Greybody factors and the final, non-semiclassical phase
 * are not modelled at all.
 *
 * It also ignores everything the hole is sitting in. For any hole this module
 * can display, the number is counterfactual: absorbing the CMB alone outweighs
 * Hawking emission by many orders of magnitude, so a real hole of this mass is
 * growing, and the clock below does not start until the universe has cooled
 * past its temperature.
 *
 * @param M mass, kg
 */
export function evaporationTime(M: number): number {
  if (!(M > 0)) return NaN;
  return (5120 * Math.PI * G ** 2 * M ** 3) / (H_BAR * C ** 4);
}

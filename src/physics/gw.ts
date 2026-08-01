/**
 * Gravitational waves from a compact binary inspiral. SI base units throughout:
 * kilograms and metres in; hertz, seconds, radians and dimensionless strain out.
 *
 * Everything here is the Newtonian quadrupole approximation — the leading-order
 * result, closed form in every case, with no post-Newtonian corrections and no
 * merger or ringdown. That is a real limit and not a small one near the end of
 * the inspiral: the waveform this file produces is honest up to roughly the
 * innermost stable circular orbit and stops there, which is where numerical
 * relativity begins. The module discloses it beside the sim.
 *
 * The standing assumptions, stated once rather than per function: the orbit is
 * circular (real binaries circularise long before they reach a detector's band,
 * so this is good late in the inspiral and poor early), the bodies are point
 * masses with no spin, and amplitudes are averaged over sky position and
 * orientation.
 *
 * This module is the single source of truth for the gravitational-waves
 * module's numbers. The canvas, the audio, every readout and the sanity checks
 * all call these functions — per the physics-accuracy skill, the sim's
 * calculation and the displayed equation must be one shared function or they
 * will drift.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import { C, G } from './constants';

/**
 *     M_c = (m₁m₂)^(3/5) / (m₁+m₂)^(1/5)
 *
 * Chirp mass, kg. The one mass combination the leading-order waveform depends
 * on: two binaries with the same chirp mass and different mass ratios sweep
 * through a detector's band identically at this order, which is why a chirp mass
 * is what a detection measures most precisely.
 *
 * @param m1 first mass, kg
 * @param m2 second mass, kg
 */
export function chirpMass(m1: number, m2: number): number {
  if (!(m1 > 0) || !(m2 > 0)) return NaN;
  return (m1 * m2) ** (3 / 5) / (m1 + m2) ** (1 / 5);
}

/**
 *     f_GW = 2 f_orb = (1/π)·√(GM / r³),   M = m₁ + m₂
 *
 * Gravitational-wave frequency at orbital separation `r`, Hz.
 *
 * The factor of two is the physics, not a convention: the mass quadrupole of a
 * binary returns to its initial configuration twice per orbit, so the radiation
 * comes out at twice the orbital frequency. Dropping it is the classic error in
 * this subject and the sanity suite checks for it explicitly.
 *
 * @param m1 first mass, kg
 * @param m2 second mass, kg
 * @param r orbital separation, m
 */
export function fGWAtSeparation(m1: number, m2: number, r: number): number {
  if (!(m1 > 0) || !(m2 > 0) || !(r > 0)) return NaN;
  return Math.sqrt((G * (m1 + m2)) / r ** 3) / Math.PI;
}

/**
 *     r_isco = 6G(m₁+m₂) / c²
 *
 * Separation at which the inspiral model is cut off, m — the Schwarzschild
 * innermost stable circular orbit of the *total* mass. Using the total mass this
 * way is the conventional stand-in for a two-body problem that has no such exact
 * solution; it is a marker, not a derived boundary.
 */
export function iscoSeparation(m1: number, m2: number): number {
  if (!(m1 > 0) || !(m2 > 0)) return NaN;
  return (6 * G * (m1 + m2)) / C ** 2;
}

/**
 *     f_cut = f_GW(r_isco) = c³ / (6^(3/2) π G (m₁+m₂))
 *
 * Cutoff frequency, Hz — where this model stops and reality carries on.
 *
 * This is the conventional end of an inspiral waveform, and it is a stopping
 * point rather than an event: at the ISCO the two bodies plunge, merge and ring
 * down, radiating on past this frequency at amplitudes larger than anything the
 * inspiral formula predicts. GW150914 crosses this cutoff around 68 Hz and the
 * real signal continues to about 250 Hz. Everything after the cutoff is
 * numerical relativity, not algebra, and is not modelled here.
 */
export function fCutoff(m1: number, m2: number): number {
  return fGWAtSeparation(m1, m2, iscoSeparation(m1, m2));
}

/**
 *     τ = (5/256) (πf)^(-8/3) (G M_c / c³)^(-5/3)
 *
 * Time remaining until merger from the moment the wave frequency passes `f`,
 * seconds. Steeply frequency-dependent — τ ∝ f^(-8/3) — which is why a binary
 * spends most of its detectable life at the bottom of the band and crosses the
 * top of it in a fraction of a second.
 *
 * @param mc chirp mass, kg
 * @param f gravitational-wave frequency, Hz
 */
export function timeToMerger(mc: number, f: number): number {
  if (!(mc > 0) || !(f > 0)) return NaN;
  return (5 / 256) * (Math.PI * f) ** (-8 / 3) * ((G * mc) / C ** 3) ** (-5 / 3);
}

/**
 *     f = (1/π) (5 / 256τ)^(3/8) (G M_c / c³)^(-5/8)
 *
 * The inverse of `timeToMerger`: the frequency a binary is radiating at when it
 * has `tau` seconds left. Closed form, so the waveform never has to invert
 * anything numerically.
 *
 * @param mc chirp mass, kg
 * @param tau time to merger, s
 */
export function fOfTimeToMerger(mc: number, tau: number): number {
  if (!(mc > 0) || !(tau > 0)) return NaN;
  return (5 / (256 * tau)) ** (3 / 8) * ((G * mc) / C ** 3) ** (-5 / 8) / Math.PI;
}

/**
 *     h = (4/d) (G M_c / c²)^(5/3) (π f / c)^(2/3)
 *
 * Strain amplitude at distance `d`, dimensionless.
 *
 * Sky- and orientation-averaged: a real detector sees an amplitude that depends
 * on where the source sits in its antenna pattern and how the orbital plane is
 * inclined to the line of sight, varying by a factor of a few either way. This
 * is the order-of-magnitude figure, which is the honest thing to put on a
 * readout — and strain is a fractional length change, so the number is the same
 * whatever units the detector arm is measured in.
 *
 * @param mc chirp mass, kg
 * @param f gravitational-wave frequency, Hz
 * @param d distance to the source, m
 */
export function strainAmplitude(mc: number, f: number, d: number): number {
  if (!(mc > 0) || !(f > 0) || !(d > 0)) return NaN;
  return (4 / d) * ((G * mc) / C ** 2) ** (5 / 3) * ((Math.PI * f) / C) ** (2 / 3);
}

/**
 *     Φ(t) = Φ_c − 2 [ (t_c − t) / (5 G M_c / c³) ]^(5/8)
 *
 * Accumulated wave phase, radians, with `tau` = t_c − t the time still to run
 * and the coalescence phase Φ_c taken as zero (only phase *differences* are
 * observable, and the sim draws one waveform rather than comparing two).
 *
 * This is the analytic integral of 2πf dt, not a numerical one. Integrating the
 * frequency step by step would accumulate error precisely where the waveform is
 * changing fastest — the last few cycles, which are the whole point of the
 * picture — and the closed form costs one exponentiation. The sanity suite
 * cross-checks it against a numerical integration of `fOfTimeToMerger`.
 *
 * @param mc chirp mass, kg
 * @param tau time to merger, s
 */
export function inspiralPhase(mc: number, tau: number): number {
  if (!(mc > 0) || !(tau >= 0)) return NaN;
  return -2 * (tau / (5 * ((G * mc) / C ** 3))) ** (5 / 8);
}

/**
 *     h(t) = A(f(t)) · cos Φ(t)
 *
 * The waveform itself: one strain sample `tau` seconds before merger. Amplitude
 * and frequency both climb as `tau` falls — that simultaneous rise in pitch and
 * volume is the chirp.
 *
 * A single polarisation, averaged over orientation. A real detector output is
 * F₊h₊ + F×h×, with the antenna-pattern factors and the inclination setting how
 * much of each gets through.
 *
 * @param mc chirp mass, kg
 * @param d distance to the source, m
 * @param tau time to merger, s
 */
export function strainAt(mc: number, d: number, tau: number): number {
  if (!(mc > 0) || !(d > 0) || !(tau > 0)) return NaN;
  return strainAmplitude(mc, fOfTimeToMerger(mc, tau), d) * Math.cos(inspiralPhase(mc, tau));
}

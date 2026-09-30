/**
 * Wormholes: the Ellis–Morris–Thorne zero-tidal wormhole, and the Casimir
 * effect it is compared against.
 *
 * SI in, SI out: lengths in m, masses in kg, densities in kg/m³ (an energy
 * density divided by c², so a mass density that can be negative). Jupiters,
 * Suns and proton radii are display comparisons, applied by the sim.
 *
 * The geometry is the Ellis drainhole in Morris and Thorne's form: redshift
 * function Φ = 0 (no tidal stretching, the same gravity everywhere along it)
 * and shape function b(r) = b₀²/r, so the throat is at r = b₀ and the tunnel's
 * circumferential radius at proper distance ℓ from the throat is √(b₀² + ℓ²).
 * Its matter has density ρ(r) = −c² b₀² / (8πG r⁴), which is negative
 * everywhere, falls as r⁻⁴, and integrates over both sides to a total mass of
 * −(π/2) c² b₀ / G.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import { C, G, H_BAR } from './constants';

/**
 * Circumference of the throat, m.
 *
 *     2π b₀
 *
 * @param b0_m throat radius, m (the circumference over 2π)
 */
export function throatCircumference(b0_m: number): number {
  return 2 * Math.PI * b0_m;
}

/**
 * Total mass of the matter holding the throat open, kg: negative.
 *
 *     M_exotic = −(π/2) c² b₀ / G
 *
 * @param b0_m throat radius, m
 */
export function exoticMass(b0_m: number): number {
  if (!(b0_m > 0)) return NaN;
  return (-(Math.PI / 2) * C ** 2 * b0_m) / G;
}

/**
 * Density of that matter at the throat, kg/m³: negative.
 *
 *     ρ = −c² / (8π G b₀²)
 *
 * @param b0_m throat radius, m
 */
export function throatDensity(b0_m: number): number {
  if (!(b0_m > 0)) return NaN;
  return -(C ** 2) / (8 * Math.PI * G * b0_m ** 2);
}

/**
 * The Casimir energy density between ideal parallel plates, as a mass
 * density, kg/m³: negative.
 *
 *     ρ = −π² ħ / (720 c a⁴)
 *
 * (The energy density −π²ħc/(720 a⁴), divided by c².)
 *
 * @param a_m plate separation, m
 */
export function casimirDensity(a_m: number): number {
  if (!(a_m > 0)) return NaN;
  return -(Math.PI ** 2 * H_BAR) / (720 * C * a_m ** 4);
}

/**
 * The plate gap whose Casimir density equals the throat density, m.
 *
 *     π² ħ / (720 c a⁴) = c² / (8π G b₀²)
 *     a = (8π³ ħ G b₀² / (720 c³))^(1/4)
 *
 * @param b0_m throat radius, m
 */
export function casimirGapForThroat(b0_m: number): number {
  if (!(b0_m > 0)) return NaN;
  return ((8 * Math.PI ** 3 * H_BAR * G * b0_m ** 2) / (720 * C ** 3)) ** 0.25;
}

/**
 * Height of the embedding surface above the throat's plane at radius r, m:
 * the funnel the textbook diagram draws, for r ≥ b₀.
 *
 *     z = b₀ arccosh(r / b₀)
 *
 * @param r_m  circumferential radius, m; at least b₀
 * @param b0_m throat radius, m
 */
export function embeddingHeight(r_m: number, b0_m: number): number {
  if (!(b0_m > 0) || !(r_m >= b0_m)) return NaN;
  return b0_m * Math.acosh(r_m / b0_m);
}

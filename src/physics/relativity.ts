/**
 * Time dilation: how much slower a moving clock runs, how much slower a clock
 * runs deep in gravity, the twin trip, and the GPS clock budget.
 *
 * SI in, SI out: speeds in m/s, masses in kg, distances in m, times in s. Rates
 * and deficits are dimensionless. Years, km/s and light-years are display
 * formats, applied by the sim.
 *
 * Every "deficit" is computed in a cancellation-free form. At everyday speeds
 * 1 − 1/γ is about 10⁻¹⁵, and subtracting two numbers that close to 1 in double
 * precision returns 0 or rounding noise; the rearranged forms below keep full
 * relative precision down to walking pace.
 *
 * The sim, its readouts and the sanity block all read these functions.
 */
import { schwarzschildRadius } from './blackhole';
import { C, DAY_S, G, M_EARTH, R_EARTH, R_GPS } from './constants';

/**
 * The Lorentz factor (dimensionless).
 *
 *     γ = 1 / √(1 − v²/c²)
 *
 * @param v_ms speed, m/s; must be below c in magnitude
 */
export function lorentzFactor(v_ms: number): number {
  if (!(Math.abs(v_ms) < C)) throw new RangeError(`lorentzFactor: |v| = ${v_ms} m/s is not below c`);
  const beta = v_ms / C;
  return 1 / Math.sqrt(1 - beta * beta);
}

/**
 * How much slower a moving clock runs, as a fraction (dimensionless):
 * 1 − 1/γ, written without the cancellation.
 *
 *     1 − 1/γ = 1 − √(1 − β²) = β² / (1 + √(1 − β²))
 *
 * @param v_ms speed, m/s; must be below c in magnitude
 */
export function clockDeficit(v_ms: number): number {
  if (!(Math.abs(v_ms) < C)) throw new RangeError(`clockDeficit: |v| = ${v_ms} m/s is not below c`);
  const beta2 = (v_ms / C) ** 2;
  return beta2 / (1 + Math.sqrt(1 - beta2));
}

/**
 * Rate of a clock hovering at r outside a non-rotating mass, against one far
 * away (dimensionless). Zero at or inside the horizon, where no static clock
 * exists.
 *
 *     dτ/dt = √(1 − r_s / r)
 *
 * @param M_kg mass, kg
 * @param r_m  distance from the centre, m
 */
export function gravitationalRate(M_kg: number, r_m: number): number {
  const x = schwarzschildRadius(M_kg) / r_m;
  return x >= 1 ? 0 : Math.sqrt(1 - x);
}

/**
 * How much slower that clock runs, as a fraction (dimensionless), without the
 * cancellation.
 *
 *     1 − √(1 − x) = x / (1 + √(1 − x)),   x = r_s / r
 *
 * @param M_kg mass, kg
 * @param r_m  distance from the centre, m
 */
export function gravitationalDeficit(M_kg: number, r_m: number): number {
  const x = schwarzschildRadius(M_kg) / r_m;
  return x >= 1 ? 1 : x / (1 + Math.sqrt(1 - x));
}

/**
 * Speed of a circular orbit, m/s.
 *
 *     v = √(G M / r)
 *
 * @param M_kg central mass, kg
 * @param r_m  orbit radius, m
 */
export function circularOrbitSpeed(M_kg: number, r_m: number): number {
  return Math.sqrt((G * M_kg) / r_m);
}

/**
 * A round trip to a distance and back at one steady speed, with an instant
 * turnaround: the elapsed time at home and on board, s.
 *
 *     home = 2d / v,   traveller = 2d / (γ v)
 *
 * @param d_m  one-way distance, m
 * @param v_ms speed, m/s
 */
export function twinTrip(d_m: number, v_ms: number): { home_s: number; traveller_s: number } {
  const home_s = (2 * d_m) / v_ms;
  return { home_s, traveller_s: home_s / lorentzFactor(v_ms) };
}

/**
 * The GPS clock budget per day, s: the loss from the satellites' orbital speed
 * (negative), the gain from their height in Earth's gravity (positive), and
 * the net. Circular orbit, non-rotating Earth; the eccentricity and Sagnac
 * corrections Ashby 2003 describes are left to layer 6.
 */
export function gpsDailyOffsets(): { speed_s: number; gravity_s: number; net_s: number } {
  const speed_s = -clockDeficit(circularOrbitSpeed(M_EARTH, R_GPS)) * DAY_S;
  const gravity_s = (gravitationalDeficit(M_EARTH, R_EARTH) - gravitationalDeficit(M_EARTH, R_GPS)) * DAY_S;
  return { speed_s, gravity_s, net_s: speed_s + gravity_s };
}

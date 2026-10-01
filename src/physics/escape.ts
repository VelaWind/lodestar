/**
 * Escape-velocity physics. SI base units throughout: metres, kilograms,
 * seconds, metres per second.
 *
 * This module is the single source of truth for the escape-velocity module's
 * numbers. The canvas animation, the live readouts, and the apex marker all
 * call these functions — per the skill, "keep the simulation's calculation and
 * the math layer's displayed equation reading from one shared function. If they
 * can drift apart, they will."
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import { G } from './constants';

/**
 *     v_esc = √(2GM / r)
 *
 * Escape speed at radius `r` from the centre of a body of mass `M`. Returns
 * m/s. This is the marginal case: an unpowered object launched at exactly this
 * speed arrives at infinity with zero speed left over.
 *
 * @param M gravitating mass, kg
 * @param r distance from the centre, m (the surface radius for a surface launch)
 */
export function vEsc(M: number, r: number): number {
  if (!(M > 0) || !(r > 0)) return NaN;
  return Math.sqrt((2 * G * M) / r);
}

/**
 *     ½v₀² − GM/R = −GM/r_max     ⟹     r_max = 1 / (1/R − v₀²/2GM)
 *
 * Apex *altitude above the surface* for a radial ballistic launch, in closed
 * form from energy conservation. Returns metres, or `Infinity` when the launch
 * speed reaches escape speed and the object never turns around.
 *
 * Derivation: total energy is conserved, so the kinetic energy at launch plus
 * the potential at the surface equals the potential at apex (where speed is
 * zero). Solving for r_max gives the reciprocal form above, which is well
 * behaved right up to the threshold — the denominator goes to zero exactly when
 * v₀ = √(2GM/R).
 *
 * @param M gravitating mass, kg
 * @param R surface radius, m
 * @param v0 launch speed, m/s
 */
export function apexAltitude(M: number, R: number, v0: number): number {
  if (!(M > 0) || !(R > 0) || !(v0 > 0)) return 0;
  if (v0 >= vEsc(M, R)) return Infinity;
  // 1/R − v₀²/2GM, guaranteed positive below the threshold.
  const inverseApex = 1 / R - v0 ** 2 / (2 * G * M);
  if (!(inverseApex > 0)) return Infinity;
  return 1 / inverseApex - R;
}

/**
 *     g(r) = GM / r²
 *
 * Gravitational acceleration magnitude at radius `r`, m/s². Always positive;
 * the integrator applies the inward sign.
 */
export function gravity(M: number, r: number): number {
  return (G * M) / r ** 2;
}

/** State of a radial ballistic flight. Altitudes are above the surface. */
export interface FlightState {
  /** Time since launch, s. */
  t: number;
  /** Distance from the body's centre, m. */
  r: number;
  /** Radial speed, m/s. Positive is outward. */
  v: number;
  /** Altitude above the surface, m. Convenience for `r - R`. */
  altitude: number;
  /** True once the projectile has fallen back to the surface. */
  landed: boolean;
}

export function initialState(R: number, v0: number): FlightState {
  return { t: 0, r: R, v: v0, altitude: 0, landed: false };
}

/**
 * One velocity-Verlet (kick–drift–kick leapfrog) step on
 *
 *     dv/dt = −GM/r²,    dr/dt = v
 *
 *     v½ = v − g(r)·dt/2,   r′ = r + v½·dt,   v′ = v½ − g(r′)·dt/2
 *
 * Each step opens with a half kick, so position and velocity stay in step: the
 * velocity a state carries is the velocity *at* its position. That removes the
 * first-step energy offset the earlier semi-implicit Euler start carried (it
 * advanced the launch with a full kick, costing about v₀·g·dt of energy at the
 * outset), which near the escape threshold, where the apex goes as
 * 1/(1 − v₀²/v_esc²), turned into a drawn peak short by up to a tenth. The
 * scheme is symplectic and time-reversible, so energy error stays bounded over
 * long flights instead of drifting, and it is second-order in dt.
 *
 * `dt` is a fixed physics timestep in seconds — never the frame delta. Playback
 * speed is handled by taking more steps per frame, not by enlarging `dt`.
 *
 * Returns a new state; does not mutate its argument.
 */
export function step(state: FlightState, M: number, R: number, dt: number): FlightState {
  if (state.landed) return state;

  const vHalf = state.v - gravity(M, state.r) * (dt / 2);
  const r = state.r + vHalf * dt;

  if (r <= R) {
    // Came back down. Clamp to the surface rather than tunnelling through it.
    return { t: state.t + dt, r: R, v: vHalf, altitude: 0, landed: true };
  }
  const v = vHalf - gravity(M, r) * (dt / 2);
  return { t: state.t + dt, r, v, altitude: r - R, landed: false };
}

export interface Flight {
  /** Trajectory samples, ascending in `t`. Decimated to stay bounded. */
  samples: FlightState[];
  /** Highest altitude reached, m. Tracked every step, not just at samples. */
  peakAltitude: number;
  /**
   * Integration stopped at the altitude ceiling (or, pathologically, the step
   * cap) rather than because the projectile came back down.
   *
   * This says nothing about whether the projectile *escapes*. Escape is a
   * property of v₀ against √(2GM/R), not of where the frame happens to end —
   * a launch just below the threshold leaves any reasonable frame and still
   * returns. Callers that want the physical question must ask `vEsc`.
   */
  leftFrame: boolean;
  /**
   * Integration ran out of steps before the flight landed or reached the
   * ceiling. A computational limit, never a physical outcome: it says nothing
   * about where the projectile went, and callers must not read it as "left the
   * frame". `timestepForFlight` sizes dt so this does not happen in practice.
   */
  stepCapped: boolean;
  /** Flight time covered, s. */
  duration: number;
}

/** Bounded so a near-threshold flight cannot spin forever. */
export const MAX_STEPS = 2_000_000;

/**
 * Integrates a full flight and returns the sampled trajectory. Used to drive
 * the animation, to draw the static path under `prefers-reduced-motion`, and by
 * the sanity check that cross-validates the integrator against `apexAltitude`'s
 * closed form.
 *
 * Suborbital flights end when the projectile lands. Escaping flights have no
 * natural end, so integration stops at `maxAltitude` — by which point the
 * projectile is off the top of the frame anyway.
 *
 * `peakAltitude` is tracked at every step, so it is exact to the integrator's
 * accuracy regardless of how aggressively samples are decimated.
 *
 * @param maxSamples cap on retained samples; the buffer halves when it fills,
 *   which keeps samples uniformly spaced in time and memory flat
 */
export function integrateFlight(
  M: number,
  R: number,
  v0: number,
  dt: number,
  maxAltitude: number,
  maxSamples = 2048,
): Flight {
  let samples: FlightState[] = [];
  let state = initialState(R, v0);
  let peakAltitude = 0;
  let leftFrame = false;
  let stride = 1;

  samples.push(state);
  for (let i = 1; i <= MAX_STEPS; i += 1) {
    state = step(state, M, R, dt);
    if (state.altitude > peakAltitude) peakAltitude = state.altitude;

    if (i % stride === 0) {
      samples.push(state);
      if (samples.length > maxSamples) {
        // Keep every other sample. Retained steps are multiples of the doubled
        // stride, so spacing stays uniform and future pushes stay in phase.
        const halved: FlightState[] = [];
        for (let k = 0; k < samples.length; k += 2) {
          const kept = samples[k];
          if (kept) halved.push(kept);
        }
        samples = halved;
        stride *= 2;
      }
    }

    if (state.landed) break;
    if (state.altitude >= maxAltitude) {
      leftFrame = true;
      break;
    }
  }

  // Exhausting the step cap without landing or reaching the ceiling means the
  // projectile is still up there, mid-flight. That is the integration's limit,
  // reported as such: it is neither a landing nor leaving the frame.
  const stepCapped = !state.landed && !leftFrame;

  // The final state rarely lands on a stride boundary; keep it regardless so
  // the path reaches the ground (or the frame edge) exactly.
  if (samples[samples.length - 1] !== state) samples.push(state);

  return { samples, peakAltitude, leftFrame, stepCapped, duration: state.t };
}

/**
 *     a = 1 / (2/R − v₀²/GM),   r = a(1 − cos η),   t = √(a³/GM) (η − sin η)
 *
 * Time from launch to landing for a suborbital radial flight, s: up to the apex
 * at r = 2a (η = π) and back down, the degenerate (radial) Kepler orbit. A
 * closed form, so a caller can size the integration before running it.
 * Infinity at or above the escape speed.
 *
 * @param M gravitating mass, kg
 * @param R surface radius, m
 * @param v0 launch speed, m/s
 */
export function flightDuration(M: number, R: number, v0: number): number {
  if (!(M > 0) || !(R > 0) || !(v0 > 0)) return 0;
  const inverseA = 2 / R - v0 ** 2 / (G * M);
  if (!(inverseA > 0)) return Infinity;
  const a = 1 / inverseA;
  const eta0 = Math.acos(1 - R / a);
  const upTime = Math.sqrt(a ** 3 / (G * M)) * (Math.PI - (eta0 - Math.sin(eta0)));
  return 2 * upTime;
}

/**
 * Time for a radial launch to climb from the surface to radius `r`, s, in
 * closed form, on whichever conic the launch speed puts it:
 *
 *     bound (v₀ < v_esc):   a = 1/(2/R − v₀²/GM),  r = a(1 − cos η),   t = √(a³/GM)(η − sin η)
 *     parabolic (v₀ = v_esc):                      t = (2/3)(r^{3/2} − R^{3/2}) / √(2GM)
 *     hyperbolic (v₀ > v_esc): a = 1/(v₀²/GM − 2/R), r = a(cosh H − 1), t = √(a³/GM)(sinh H − H)
 *
 * Infinity if a bound launch never reaches `r`. Checked against the integrator
 * from 10 to 20 km/s on Earth before use. Within a part in 10⁹ of the threshold
 * the conic forms lose precision to cancellation, and the parabolic form, which
 * they both approach, is used instead.
 *
 * @param M gravitating mass, kg
 * @param R surface radius, m
 * @param v0 launch speed, m/s
 * @param r target radius from the body's centre, m
 */
export function timeToRadius(M: number, R: number, v0: number, r: number): number {
  if (!(M > 0) || !(R > 0) || !(v0 >= 0) || !(r >= R)) return NaN;
  const GM = G * M;
  const inverseA = 2 / R - v0 ** 2 / GM;
  if (Math.abs(inverseA) <= 1e-9 * (2 / R)) {
    return ((2 / 3) * (r ** 1.5 - R ** 1.5)) / Math.sqrt(2 * GM);
  }
  if (inverseA > 0) {
    const a = 1 / inverseA;
    if (r > 2 * a) return Infinity;
    const at = (x: number) => {
      const eta = Math.acos(1 - x / a);
      return Math.sqrt(a ** 3 / GM) * (eta - Math.sin(eta));
    };
    return at(r) - at(R);
  }
  const a = -1 / inverseA;
  const at = (x: number) => {
    const H = Math.acosh(1 + x / a);
    return Math.sqrt(a ** 3 / GM) * (Math.sinh(H) - H);
  };
  return at(r) - at(R);
}

/**
 * `timestepFor`, stretched only when the flight would not fit in the step
 * budget. A launch just under the escape speed takes days to come down, and at
 * the body's natural timestep that runs past `MAX_STEPS`; here dt grows just
 * enough for the closed-form time the integration will cover to fit in
 * three-quarters of the budget. That time is the whole flight for one that
 * lands in the frame, and the climb to the frame top, `maxAltitude`, for one
 * that leaves it, escaping or not. On Earth dt stays under a second per step.
 *
 * @param maxAltitude the altitude at which integration will stop, m
 */
export function timestepForFlight(M: number, R: number, v0: number, maxAltitude: number): number {
  const base = timestepFor(M, R);
  const climbing = apexAltitude(M, R, v0) > maxAltitude;
  const duration = climbing ? timeToRadius(M, R, v0, R + maxAltitude) : flightDuration(M, R, v0);
  if (!(duration > 0) || !Number.isFinite(duration)) return base;
  return Math.max(base, duration / (0.75 * MAX_STEPS));
}

/**
 * A physics timestep that resolves the flight regardless of the body's scale.
 *
 * The natural timescale of a radial flight is √(R/g_surface); a fixed dt in
 * seconds that suits Earth would be far too coarse for a 1e10 m body and
 * needlessly fine for an asteroid. Scaling with that timescale keeps step count
 * roughly constant across fourteen decades of mass.
 */
export function timestepFor(M: number, R: number): number {
  const gSurface = gravity(M, R);
  if (!(gSurface > 0)) return 1;
  const characteristic = Math.sqrt(R / gSurface);
  // ~2000 steps across the characteristic time; clamped to keep both ends sane.
  return Math.min(Math.max(characteristic / 2000, 1e-4), 60);
}

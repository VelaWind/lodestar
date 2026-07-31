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
 * One semi-implicit (symplectic) Euler step on
 *
 *     dv/dt = −GM/r²,    dr/dt = v
 *
 * Velocity is updated first and the *new* velocity advances position, which is
 * what makes this symplectic: energy error stays bounded over long flights
 * instead of drifting monotonically the way explicit Euler's does. That matters
 * here because the whole point of the sim is whether the projectile turns
 * around, and an integrator that leaks energy would move the threshold.
 *
 * `dt` is a fixed physics timestep in seconds — never the frame delta. Playback
 * speed is handled by taking more steps per frame, not by enlarging `dt`.
 *
 * Returns a new state; does not mutate its argument.
 */
export function step(state: FlightState, M: number, R: number, dt: number): FlightState {
  if (state.landed) return state;

  const v = state.v - gravity(M, state.r) * dt;
  const r = state.r + v * dt;

  if (r <= R) {
    // Came back down. Clamp to the surface rather than tunnelling through it.
    return { t: state.t + dt, r: R, v, altitude: 0, landed: true };
  }
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
  /** Flight time covered, s. */
  duration: number;
}

/** Bounded so a near-threshold flight cannot spin forever. */
const MAX_STEPS = 2_000_000;

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

  // Exhausting the step cap without landing means the projectile is still up
  // there. Report that as "left the frame" rather than letting a caller read
  // the absence of a landing as a landing.
  if (!state.landed && !leftFrame) leftFrame = true;

  // The final state rarely lands on a stride boundary; keep it regardless so
  // the path reaches the ground (or the frame edge) exactly.
  if (samples[samples.length - 1] !== state) samples.push(state);

  return { samples, peakAltitude, leftFrame, duration: state.t };
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

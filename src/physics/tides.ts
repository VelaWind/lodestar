/**
 * Tides: the Moon's and Sun's differential pull on Earth, and the equilibrium
 * tide it raises.
 *
 * SI in, SI out: kilograms, metres, seconds, radians. Kilometres, hours and
 * fractions of g are display formats, applied by the sim.
 *
 * Geometry: Earth seen from above its North Pole, in a frame that does not
 * rotate with it. The Sun lies along angle 0 and the Moon at the phase angle α
 * (Sun–Earth–Moon), both counted counter-clockwise, both kept in the plane of
 * Earth's equator (zero declination). A point at latitude φ and longitude angle
 * λ sits, projected, at R cos φ (cos λ, sin λ).
 *
 * The equilibrium tide is the shape the ocean surface would take if it could
 * follow the tide-generating potential instantly and everywhere: a rigid Earth,
 * an ocean covering it, no continents, no inertia. Real ocean tides are not
 * this (see the module), but it is the standard first model and the one Newton
 * gave. To leading order in R/d,
 *
 *     h(θ) = (M / M⊕) (R⁴ / d³) P₂(cos θ),   P₂(x) = (3x² − 1)/2,
 *
 * with θ the angle from the point under the body. "Crest" below means h(0), the
 * height of the water above the level it would have with no Moon or Sun, at
 * the point under the body; the low, at θ = 90°, is half that below it.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import { D_MOON, G, M_EARTH, M_MOON, R_EARTH, SIDEREAL_DAY } from './constants';

/* ------------------------------------------------------------------ */
/* The tidal acceleration                                               */
/* ------------------------------------------------------------------ */

/**
 *     a = GM [ (b − p)/|b − p|³ − b/|b|³ ]
 *
 * The exact tidal acceleration at a point p, m/s², from a body of mass M at b,
 * both measured from Earth's centre: the body's pull there minus its pull on
 * the centre, which is what a freely falling Earth does not feel. Planar.
 */
export function tidalAccelerationAt(px: number, py: number, bx: number, by: number, M: number): [number, number] {
  const dx = bx - px;
  const dy = by - py;
  const r3 = Math.hypot(dx, dy) ** 3;
  const b3 = Math.hypot(bx, by) ** 3;
  return [G * M * (dx / r3 - bx / b3), G * M * (dy / r3 - by / b3)];
}

/**
 *     a ≈ 2GMR / d³
 *
 * The leading-order tidal stretch along the line to the body, m/s². Valid when
 * R ≪ d; at the Moon's distance R/d = 0.017 and the exact near-side value is
 * 2.5% larger, the far-side 2.5% smaller.
 */
export function tidalAccelerationApprox(M: number, d: number, R = R_EARTH): number {
  return (2 * G * M * R) / d ** 3;
}

/** The exact tidal acceleration at the point under the body (near side), m/s², along the line to it. */
export function nearSideTide(M: number, d: number, R = R_EARTH): number {
  return G * M * (1 / (d - R) ** 2 - 1 / d ** 2);
}

/** The exact tidal acceleration at the point opposite the body (far side), m/s², away from it. */
export function farSideTide(M: number, d: number, R = R_EARTH): number {
  return G * M * (1 / d ** 2 - 1 / (d + R) ** 2);
}

/* ------------------------------------------------------------------ */
/* The equilibrium tide                                                 */
/* ------------------------------------------------------------------ */

/**
 *     h₀ = (M / M⊕) R⁴ / d³
 *
 * The equilibrium crest, m: the water's height above its undisturbed level at
 * the point under the body, leading order in R/d, rigid Earth.
 */
export function equilibriumCrest(M: number, d: number, R = R_EARTH): number {
  return ((M / M_EARTH) * R ** 4) / d ** 3;
}

/** P₂(x) = (3x² − 1) / 2. */
function legendre2(x: number): number {
  return (3 * x * x - 1) / 2;
}

/**
 *     h = h₀ P₂(cos θ)
 *
 * Equilibrium height, m, at angle θ from the point under the body.
 */
export function equilibriumHeight(crest: number, cosTheta: number): number {
  return crest * legendre2(cosTheta);
}

/**
 * The exact equilibrium height at the point under the body and the point
 * opposite, m, from the full tide-generating potential (not its leading
 * term): the near-side crest is higher than the far-side one by about 2R/d of
 * either, 3.3% at the Moon's distance (the P₃ term).
 *
 *     W(r) = GM [1/|d − r| − 1/d − r·d̂/d²],   h = W / g,   g = GM⊕/R²
 */
export function exactCrests(M: number, d: number, R = R_EARTH): { near: number; far: number } {
  const g = (G * M_EARTH) / R ** 2;
  const near = (G * M * (1 / (d - R) - 1 / d - R / d ** 2)) / g;
  const far = (G * M * (1 / (d + R) - 1 / d + R / d ** 2)) / g;
  return { near, far };
}

/** The sliders and the two bodies' crests. */
export interface TideState {
  /** Sun–Earth–Moon angle, rad: 0 new Moon, π full. */
  phase: number;
  /** The coastal point's latitude, rad. */
  lat: number;
  /** Lunar and solar equilibrium crests, m. */
  lunar: number;
  solar: number;
}

/**
 *     h(λ) = h_M P₂(cos φ cos(λ − α)) + h_S P₂(cos φ cos λ)
 *
 * Equilibrium height, m, at the coastal point of latitude φ and longitude angle
 * λ, with the Moon at α and the Sun at 0, both over the equator. The one
 * function the drawn water, the trace and every height readout use.
 */
export function heightAt(lambda: number, s: TideState): number {
  const c = Math.cos(s.lat);
  return equilibriumHeight(s.lunar, c * Math.cos(lambda - s.phase)) + equilibriumHeight(s.solar, c * Math.cos(lambda));
}

/**
 *     range = (3/2) cos²φ √(h_M² + h_S² + 2 h_M h_S cos 2α)
 *
 * High-to-low range of the equilibrium tide at latitude φ, m. Each body's tide
 * is a constant plus (3/4) h₀ cos²φ cos 2(λ − its angle); the two semidiurnal
 * waves add as vectors.
 */
export function equilibriumRange(s: TideState): number {
  const c2 = Math.cos(s.lat) ** 2;
  return 1.5 * c2 * Math.sqrt(s.lunar ** 2 + s.solar ** 2 + 2 * s.lunar * s.solar * Math.cos(2 * s.phase));
}

/** The spring range (phase 0 or π) and the neap range (phase π/2) at this latitude, m. */
export function springNeap(s: TideState): { spring: number; neap: number } {
  return {
    spring: equilibriumRange({ ...s, phase: 0 }),
    neap: equilibriumRange({ ...s, phase: Math.PI / 2 }),
  };
}

/**
 * The highest equilibrium level the point reaches in a day, m above the
 * undisturbed level: the maximum of `heightAt` over λ, found on a fine grid and
 * refined. The same function as the trace's.
 */
export function highTideHeight(s: TideState): number {
  let best = -Infinity;
  let bestLambda = 0;
  const N = 720;
  for (let i = 0; i < N; i += 1) {
    const lambda = (i / N) * 2 * Math.PI;
    const h = heightAt(lambda, s);
    if (h > best) {
      best = h;
      bestLambda = lambda;
    }
  }
  // Golden-section refinement around the grid's best.
  let lo = bestLambda - (2 * Math.PI) / N;
  let hi = bestLambda + (2 * Math.PI) / N;
  for (let k = 0; k < 40; k += 1) {
    const m1 = hi - (hi - lo) / 1.618_033_988_75;
    const m2 = lo + (hi - lo) / 1.618_033_988_75;
    if (heightAt(m1, s) > heightAt(m2, s)) hi = m2;
    else lo = m1;
  }
  return Math.max(best, heightAt((lo + hi) / 2, s));
}

/* ------------------------------------------------------------------ */
/* Timing                                                               */
/* ------------------------------------------------------------------ */

/**
 *     T_month = 2π √(d³ / G(M⊕ + M_Moon))
 *
 * The Moon's sidereal orbital period at distance d, s (Kepler's third law,
 * circular orbit).
 */
export function siderealMonth(d: number): number {
  return 2 * Math.PI * Math.sqrt(d ** 3 / (G * (M_EARTH + M_MOON)));
}

/**
 *     1 / T_lunar day = 1 / T_sidereal day − 1 / T_month
 *
 * How long Earth takes to turn once relative to the Moon, s: about 24 h 50 min
 * today, longer if the Moon were closer and orbited faster.
 */
export function lunarDay(d: number): number {
  return 1 / (1 / SIDEREAL_DAY - 1 / siderealMonth(d));
}

/** Time between successive lunar high tides, s: half a lunar day. */
export function semidiurnalPeriod(d = D_MOON): number {
  return lunarDay(d) / 2;
}

/* ------------------------------------------------------------------ */
/* Elsewhere                                                            */
/* ------------------------------------------------------------------ */

/**
 *     d_Roche = k R_p (ρ_p / ρ_s)^(1/3)
 *
 * The Roche limit, m: inside it a satellite of density ρ_s is pulled apart by
 * the tide of a primary of radius R_p and density ρ_p. k ≈ 2.44 fluid, 1.26 rigid.
 */
export function rocheLimit(k: number, Rp: number, rhoP: number, rhoS: number): number {
  return k * Rp * Math.cbrt(rhoP / rhoS);
}

/**
 * Transiting exoplanets. SI base units throughout: kilograms and metres in;
 * dimensionless depth, seconds, and a dimensionless flux ratio out.
 *
 * Everything here is closed form, and every function assumes the same idealised
 * geometry, stated once rather than per function: a circular orbit seen exactly
 * edge-on, so the planet crosses the middle of the stellar disc (impact
 * parameter zero); a star whose disc is uniformly bright; a planet that is
 * opaque, spherical, and contributes no light of its own. Real transits are
 * chords rather than diameters and real stellar discs are limb-darkened, both of
 * which the module discloses beside the sim.
 *
 * The orbital period is *not* recomputed here. It comes from `kepler.ts`, which
 * the Kepler orbits module already uses and the sanity suite already checks
 * against Earth's 365.25 days — so a transit duration computed here is wrong
 * only if the third law is wrong everywhere, which is the point of sharing it.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import { period } from './kepler';

/**
 *     δ = (R_p / R_★)²
 *
 * Transit depth: the fraction of the star's light the planet blocks at mid
 * transit, dimensionless. A ratio of areas, which is why the radius ratio is
 * squared — Jupiter is a tenth of the Sun's radius and blocks a hundredth of it.
 *
 * Clamped at 1. The sliders allow a planet radius larger than the star's, which
 * is not astrophysically silly — a 2 R_J planet around a 0.1 R_☉ M dwarf is
 * inside the ranges here, and the formula would return 4. What physically
 * happens there is a total eclipse: the disc cannot be more than fully covered,
 * so the depth saturates and the light curve goes to zero rather than negative.
 *
 * @param rp planet radius, m
 * @param rs stellar radius, m
 */
export function transitDepth(rp: number, rs: number): number {
  if (!(rp > 0) || !(rs > 0)) return NaN;
  return Math.min(1, (rp / rs) ** 2);
}

/**
 *     T = (P / π) · arcsin((R_★ + R_p) / a)
 *
 * Duration of a central transit, seconds — first to fourth contact, the whole
 * time any part of the planet overlaps the disc.
 *
 * Returns NaN when R_★ + R_p ≥ a: the planet would be orbiting inside its own
 * star, arcsin has no value there, and there is no transit to time. Callers get
 * NaN rather than an exception because the sliders can reach that corner and a
 * sim must draw *something* — the exoplanets sim says so on the canvas.
 *
 * @param ms stellar mass, kg
 * @param rs stellar radius, m
 * @param rp planet radius, m
 * @param a orbital distance, m
 */
export function transitDuration(ms: number, rs: number, rp: number, a: number): number {
  if (!(ms > 0) || !(rs > 0) || !(rp > 0) || !(a > 0)) return NaN;
  const sum = rs + rp;
  if (sum >= a) return NaN;
  return (period(ms, a) / Math.PI) * Math.asin(sum / a);
}

/**
 *     p = (R_★ + R_p) / a
 *
 * Geometric probability that a randomly oriented orbit transits at all,
 * dimensionless. The orbital plane has to fall within a narrow band of
 * inclinations for the planet to cross the disc from where we happen to sit, and
 * that band is set by how large the star looks from the planet's distance.
 *
 * This is the reason transit surveys stare at a hundred thousand stars to find a
 * few thousand planets: an Earth at 1 AU transits for one observer in 213.
 *
 * Clamped at 1 for the same reason `transitDepth` is — inside a ≤ R_★ + R_p the
 * ratio exceeds one, and a probability cannot.
 *
 * @param rs stellar radius, m
 * @param rp planet radius, m
 * @param a orbital distance, m
 */
export function transitProbability(rs: number, rp: number, a: number): number {
  if (!(rs > 0) || !(rp > 0) || !(a > 0)) return NaN;
  return Math.min(1, (rs + rp) / a);
}

/**
 * The shape of one transit, computed once so a light curve can be sampled
 * cheaply. All times in seconds, depth dimensionless.
 *
 *     T_total = (P / π) · arcsin((R_★ + R_p) / a)     first to fourth contact
 *     T_full  = (P / π) · arcsin(|R_★ − R_p| / a)     second to third contact
 *     T_in    = (T_total − T_full) / 2                ingress, and egress
 *
 * The absolute value in T_full is what makes the R_p > R_★ case behave: there,
 * "fully overlapping" means the *star* is entirely behind the planet, and the
 * geometry is the same expression mirrored.
 */
export interface TransitShape {
  /** Orbital period, s. */
  period: number;
  /** First to fourth contact, s. NaN when there is no transit. */
  total: number;
  /** Second to third contact — the flat bottom, s. */
  full: number;
  /** Ingress, equal to egress, s. */
  ingress: number;
  /** Fractional loss of light at mid transit. */
  depth: number;
  /** False when the planet's orbit lies inside the star. */
  transits: boolean;
}

export function transitShape(ms: number, rs: number, rp: number, a: number): TransitShape {
  const p = period(ms, a);
  const total = transitDuration(ms, rs, rp, a);
  const depth = transitDepth(rp, rs);

  if (!Number.isFinite(total)) {
    return { period: p, total: NaN, full: NaN, ingress: NaN, depth, transits: false };
  }

  const full = (p / Math.PI) * Math.asin(Math.abs(rs - rp) / a);
  return { period: p, total, full, ingress: (total - full) / 2, depth, transits: true };
}

/**
 *     F(t) = 1                                    outside the transit
 *     F(t) = 1 − δ                                between second and third contact
 *     F(t) = 1 − δ · (T_total/2 − |t|) / T_in     across ingress and egress
 *
 * Relative flux at time `t`, measured in seconds from mid transit and wrapped
 * into one period, so sampling a whole orbit is just sweeping t. Out of transit
 * the star is at full brightness by definition — this is a *relative* curve, and
 * nothing here models the star's actual luminosity.
 *
 * The shoulders are straight lines, which is the model's most visible
 * simplification. A real stellar disc is limb-darkened: dimmer at the edge than
 * the centre, so the planet blocks less light as it first crosses the limb and
 * the corners of this trapezoid are rounded off in every real light curve.
 * Fitting that curvature is how limb-darkening coefficients get measured.
 */
export function lightCurve(shape: TransitShape, t: number): number {
  if (!shape.transits || !(shape.period > 0)) return 1;

  // Fold into [−P/2, P/2): one transit per orbit, centred on t = 0.
  const wrapped = t - shape.period * Math.round(t / shape.period);
  const from = Math.abs(wrapped);

  if (from >= shape.total / 2) return 1;
  if (from <= shape.full / 2) return 1 - shape.depth;

  // A zero-length shoulder would divide by zero; it can only happen if the
  // planet has no radius, in which case there is no transit to shade anyway.
  if (!(shape.ingress > 0)) return 1 - shape.depth;
  return 1 - shape.depth * ((shape.total / 2 - from) / shape.ingress);
}

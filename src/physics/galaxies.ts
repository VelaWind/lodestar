/**
 * Galaxies: a Toomre & Toomre (1972) encounter, and the numbers around it.
 *
 * SI in, SI out: kilograms, metres, seconds, radians. Kiloparsecs, solar
 * masses, km/s and millions of years are display formats, applied by the sim.
 *
 * The encounter is the "restricted three-body" model that first explained
 * tidal tails and bridges:
 *
 *   - Each galaxy is one softened point mass, Φ = −GM / √(r² + ε²), standing for
 *     its core and the halo inside the encounter. The two follow a parabolic
 *     orbit around each other: zero total energy, closest approach r_p.
 *   - Each carries a disc of massless test stars, started on circular orbits.
 *     The stars feel both masses and nothing else: no star-on-star gravity, no
 *     gas, and no dynamical friction, so the two cores never sink together and
 *     merge as real galaxies do.
 *   - Everything is integrated with a kick-drift-kick leapfrog at a fixed step
 *     in simulated time (`ENCOUNTER_STEP`), the cores in eighths of it. The
 *     result is stored step by step, so the sim replays it rather than
 *     integrating as it draws.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import {
  ENCOUNTER_CORE_SUBSTEPS,
  ENCOUNTER_SOFTENING,
  ENCOUNTER_STEP,
  G,
  GALAXY_DISC_RADIUS,
  GALAXY_MAIN_MASS,
  LOCAL_STELLAR_DENSITY,
  R_SUN,
  M_SUN,
  THIN_DISC_SCALE_HEIGHT,
} from './constants';

/* ------------------------------------------------------------------ */
/* Closed forms                                                         */
/* ------------------------------------------------------------------ */

/**
 *     v_p = √(2G(M₁ + M₂) / r_p)
 *
 * Relative speed at closest approach on a parabolic orbit, m/s.
 */
export function pericentreSpeed(M1: number, M2: number, rp: number): number {
  if (!(rp > 0) || !(M1 + M2 > 0)) return NaN;
  return Math.sqrt((2 * G * (M1 + M2)) / rp);
}

/**
 *     Δa ≈ 2GM d / r³
 *
 * The difference in a mass M's pull across a disc of radius d at distance r,
 * near side against centre, m/s²: the tidal stretch.
 */
export function tidalAcceleration(M: number, d: number, r: number): number {
  if (!(r > 0)) return NaN;
  return (2 * G * M * d) / r ** 3;
}

/**
 *     T = 2π √(R³ / GM)
 *
 * One circular orbit of a star at radius R around a point mass M, s. (The sim's
 * softened mass makes inner orbits a little slower: 8% at 3 kpc, 0.3% at 15.)
 */
export function circularPeriod(R: number, M: number): number {
  if (!(R > 0) || !(M > 0)) return NaN;
  return 2 * Math.PI * Math.sqrt(R ** 3 / (G * M));
}

/**
 *     t_enc = r_p / v_p
 *
 * How long the companion lingers near closest approach, s: the time the disc
 * has to respond.
 */
export function encounterTime(M1: number, M2: number, rp: number): number {
  return rp / pericentreSpeed(M1, M2, rp);
}

/**
 *     v_c² = GM R² / (R² + ε²)^(3/2)
 *
 * Circular speed at R in a softened point mass, m/s: what each test star starts with.
 */
export function softenedCircularSpeed(R: number, M: number, eps = ENCOUNTER_SOFTENING): number {
  if (!(R > 0) || !(M > 0)) return 0;
  return Math.sqrt((G * M * R * R) / (R * R + eps * eps) ** 1.5);
}

/**
 * Time for two bodies falling straight toward each other to meet, s: a radial
 * Kepler orbit of total mass M, starting at separation d and closing at speed v.
 *
 *     E = v²/2 − GM/d < 0,   a = −GM / 2E,   r = a(1 − cos η),   t = √(a³/GM) (η − sin η)
 *
 * The meeting is at η = 2π. NaN if the pair is unbound.
 */
export function radialInfallTime(d: number, v: number, M: number): number {
  const E = 0.5 * v * v - (G * M) / d;
  if (!(E < 0)) return NaN;
  const a = (-G * M) / (2 * E);
  const eta0 = 2 * Math.PI - Math.acos(1 - d / a); // on the way in
  return Math.sqrt(a ** 3 / (G * M)) * (2 * Math.PI - (eta0 - Math.sin(eta0)));
}

/**
 * The chance that one star, crossing the other galaxy's disc once, hits a
 * star there, dimensionless:
 *
 *     P = n · 2h · π(2R)² · (1 + v_esc² / v²),   v_esc² = 2G(2M) / (2R)
 *
 * n the number of stars per volume, 2h the path through a disc of scale height
 * h crossed face-on, π(2R)² the area two stars of radius R present to each
 * other, and the last factor gravitational focusing at relative speed v. Stars
 * are taken as Sun-sized, which overstates the typical, smaller, star.
 */
export function crossingCollisionChance(
  v: number,
  n = LOCAL_STELLAR_DENSITY,
  h = THIN_DISC_SCALE_HEIGHT,
  R = R_SUN,
  M = M_SUN,
): number {
  const vEsc2 = (2 * G * 2 * M) / (2 * R);
  return n * 2 * h * Math.PI * (2 * R) ** 2 * (1 + vEsc2 / (v * v));
}

/* ------------------------------------------------------------------ */
/* The encounter                                                        */
/* ------------------------------------------------------------------ */

/** The sliders: companion mass, kg; closest approach, m; disc tilt from prograde, rad. */
export interface EncounterSettings {
  M2: number;
  rp: number;
  tilt: number;
}

/** Test stars in the main disc and in the companion's. */
export const MAIN_STARS = 560;
export const COMPANION_STARS = 240;
/** Rings per disc, from 0.2 to 1 times its radius. */
const RINGS = 12;
/**
 * The run starts with the two at twice their closest distance, where the
 * companion's tide is an eighth of its peak, and ends 2τ after closest approach,
 * while the tails are still near enough to see.
 */
const START_SEPARATION = 2;
const END_TAU = 2;

/**
 * The companion's disc radius, m: the main disc's scaled by √(M₂/M₁), which
 * keeps its stars' circular speeds at the same fraction of their galaxy's.
 */
export function companionDiscRadius(M2: number): number {
  return GALAXY_DISC_RADIUS * Math.sqrt(Math.max(0, M2) / GALAXY_MAIN_MASS);
}

export interface Encounter {
  settings: EncounterSettings;
  /** Simulated time of step 0, s, counted from closest approach (negative). */
  t0: number;
  /** The fixed step, s. */
  dt: number;
  /** Number of steps; there are steps + 1 stored states. */
  steps: number;
  /** Stars in all, main disc first. */
  nStars: number;
  nMain: number;
  /** The two cores at each stored state: x₁, y₁, z₁, x₂, y₂, z₂, m. */
  cores: Float64Array;
  /** Each star's x and y (the orbital plane) at each stored state, m, state-major. */
  xy: Float32Array;
  /** Main-disc stars farther than twice the disc radius from their core, at each state. */
  tail: Float32Array;
  /** The integrated orbit's closest approach, m; the relative speed there, m/s; its time, s. */
  rPeri: number;
  vPeri: number;
  tPeri: number;
  /** Largest drift in the two-body energy over the run, over GM₁M₂/r_p; NaN unless asked for. */
  energyDrift: number;
  /** Largest drift of any star's distance from its own core, relative; NaN unless asked for. */
  radiusDrift: number;
}

export interface EncounterOptions {
  nMain?: number;
  nComp?: number;
  /** Track the two-body energy and the stars' radii, for the sanity checks. */
  diagnostics?: boolean;
}

/** Scratch buffers, kept between runs so a slider drag allocates nothing new for the stars. */
let scratch: { P: Float64Array; V: Float64Array; A: Float64Array; r0: Float64Array; owner: Uint8Array } | null = null;

function buffers(N: number) {
  if (!scratch || scratch.r0.length < N) {
    scratch = {
      P: new Float64Array(N * 3),
      V: new Float64Array(N * 3),
      A: new Float64Array(N * 3),
      r0: new Float64Array(N),
      owner: new Uint8Array(N),
    };
  }
  return scratch;
}

/**
 * Integrates one encounter from two closest-distances apart to 2τ after
 * closest approach, τ = √(2r_p³ / G(M₁+M₂)), and stores every step.
 */
export function simulateEncounter(settings: EncounterSettings, options: EncounterOptions = {}): Encounter {
  const nMain = options.nMain ?? MAIN_STARS;
  const M1 = GALAXY_MAIN_MASS;
  const M2 = Math.max(0, settings.M2);
  const nComp = M2 > 0 ? (options.nComp ?? COMPANION_STARS) : 0;
  const diagnostics = options.diagnostics ?? false;
  const M = M1 + M2;
  const { rp, tilt } = settings;
  const eps2 = ENCOUNTER_SOFTENING ** 2;
  const dt = ENCOUNTER_STEP;

  /*
   * The parabola, relative position companion − main, in the x–y plane with
   * angular momentum along +z: r = r_p(1 + D²), t = τ(D + D³/3), D = tan(ν/2).
   * Starting at r = 2r_p is D = −1.
   */
  const tau = Math.sqrt((2 * rp ** 3) / (G * M));
  const D0 = -Math.sqrt(START_SEPARATION - 1);
  const t0 = tau * (D0 + D0 ** 3 / 3);
  const steps = Math.ceil((END_TAU * tau - t0) / dt);
  const nu = 2 * Math.atan(D0);
  const r0 = rp * (1 + D0 * D0);
  const h = Math.sqrt(2 * G * M * rp);
  const vr = ((G * M) / h) * Math.sin(nu);
  const vt = ((G * M) / h) * (1 + Math.cos(nu));
  // Speed for zero energy in the softened potential, along the parabola's direction.
  const speed = Math.sqrt((2 * G * M) / Math.sqrt(r0 * r0 + eps2));
  const dirx = vr * Math.cos(nu) - vt * Math.sin(nu);
  const diry = vr * Math.sin(nu) + vt * Math.cos(nu);
  const dn = Math.hypot(dirx, diry);
  const relx = r0 * Math.cos(nu);
  const rely = r0 * Math.sin(nu);
  const rvx = (dirx / dn) * speed;
  const rvy = (diry / dn) * speed;

  // Centre-of-mass frame.
  const f1 = -M2 / M;
  const f2 = M1 / M;
  let x1 = f1 * relx, y1 = f1 * rely, z1 = 0, x2 = f2 * relx, y2 = f2 * rely, z2 = 0;
  let u1 = f1 * rvx, v1 = f1 * rvy, w1 = 0, u2 = f2 * rvx, v2 = f2 * rvy, w2 = 0;
  const startCores = [x1, y1, z1, x2, y2, z2];
  const startVels = [u1, v1, w1, u2, v2, w2];

  /* The cores, in substeps, stored at every star step. */
  const cores = new Float64Array((steps + 1) * 6);
  cores.set(startCores, 0);
  const sub = dt / ENCOUNTER_CORE_SUBSTEPS;
  const mu = (M1 * M2) / M;
  const twoBodyEnergy = () => {
    const du = u2 - u1, dv = v2 - v1, dw = w2 - w1;
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    return 0.5 * mu * (du * du + dv * dv + dw * dw) - (G * M1 * M2) / Math.sqrt(dx * dx + dy * dy + dz * dz + eps2);
  };
  const E0 = diagnostics ? twoBodyEnergy() : 0;
  let worstE = 0;
  let rPeri = Infinity;
  let vPeri = NaN;
  let tPeri = NaN;
  const kick = (half: number) => {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const s = dx * dx + dy * dy + dz * dz + eps2;
    const inv = half / (s * Math.sqrt(s));
    u1 += G * M2 * dx * inv; v1 += G * M2 * dy * inv; w1 += G * M2 * dz * inv;
    u2 -= G * M1 * dx * inv; v2 -= G * M1 * dy * inv; w2 -= G * M1 * dz * inv;
  };
  for (let i = 1; i <= steps; i += 1) {
    for (let k = 0; k < ENCOUNTER_CORE_SUBSTEPS; k += 1) {
      kick(0.5 * sub);
      x1 += sub * u1; y1 += sub * v1; z1 += sub * w1;
      x2 += sub * u2; y2 += sub * v2; z2 += sub * w2;
      kick(0.5 * sub);
      const sep = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
      if (sep < rPeri) {
        rPeri = sep;
        vPeri = Math.sqrt((u2 - u1) ** 2 + (v2 - v1) ** 2 + (w2 - w1) ** 2);
        tPeri = t0 + (i - 1) * dt + (k + 1) * sub;
      }
      if (diagnostics) worstE = Math.max(worstE, Math.abs(twoBodyEnergy() - E0));
    }
    const o = i * 6;
    cores[o] = x1; cores[o + 1] = y1; cores[o + 2] = z1;
    cores[o + 3] = x2; cores[o + 4] = y2; cores[o + 5] = z2;
  }

  /*
   * The discs: rings from 0.2 to 1 times the radius, stars per ring in
   * proportion to radius, each on its softened circular orbit. The disc lies in
   * the orbital plane and is turned about the x axis by `tilt`: 0 spins the
   * same way as the orbit (prograde), π the opposite way (retrograde).
   */
  const N = nMain + nComp;
  const { P, V, A, r0: startRadius, owner } = buffers(N);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  let n = 0;
  const seedDisc = (count: number, R: number, Mc: number, which: 0 | 1) => {
    if (count <= 0) return;
    const radii: number[] = [];
    let sum = 0;
    for (let k = 0; k < RINGS; k += 1) {
      const r = R * (0.2 + (0.8 * k) / (RINGS - 1));
      radii.push(r);
      sum += r;
    }
    let placed = 0;
    for (let k = 0; k < RINGS; k += 1) {
      const r = radii[k]!;
      const m = k === RINGS - 1 ? count - placed : Math.round((count * r) / sum);
      placed += m;
      const vc = softenedCircularSpeed(r, Mc);
      for (let j = 0; j < m; j += 1) {
        const ph = (2 * Math.PI * (j + 0.5 * (k % 2))) / m;
        const px = r * Math.cos(ph), py = r * Math.sin(ph);
        const qx = -vc * Math.sin(ph), qy = vc * Math.cos(ph);
        const c = which * 3;
        P[n * 3] = startCores[c]! + px;
        P[n * 3 + 1] = startCores[c + 1]! + py * ct;
        P[n * 3 + 2] = startCores[c + 2]! + py * st;
        V[n * 3] = startVels[c]! + qx;
        V[n * 3 + 1] = startVels[c + 1]! + qy * ct;
        V[n * 3 + 2] = startVels[c + 2]! + qy * st;
        startRadius[n] = r;
        owner[n] = which;
        n += 1;
      }
    }
  };
  seedDisc(nMain, GALAXY_DISC_RADIUS, M1, 0);
  seedDisc(nComp, companionDiscRadius(M2), M2, 1);

  const xy = new Float32Array((steps + 1) * N * 2);
  const tail = new Float32Array(steps + 1);
  const g1 = G * M1;
  const g2 = G * M2;
  const farSquared = (2 * GALAXY_DISC_RADIUS) ** 2;
  let radiusDrift = 0;

  const accelerate = (step: number) => {
    const o = step * 6;
    const ax1 = cores[o]!, ay1 = cores[o + 1]!, az1 = cores[o + 2]!;
    const ax2 = cores[o + 3]!, ay2 = cores[o + 4]!, az2 = cores[o + 5]!;
    for (let i = 0; i < N; i += 1) {
      const k = i * 3;
      const px = P[k]!, py = P[k + 1]!, pz = P[k + 2]!;
      let dx = ax1 - px, dy = ay1 - py, dz = az1 - pz;
      let s = dx * dx + dy * dy + dz * dz + eps2;
      let f = g1 / (s * Math.sqrt(s));
      const ax = f * dx, ay = f * dy, az = f * dz;
      dx = ax2 - px; dy = ay2 - py; dz = az2 - pz;
      s = dx * dx + dy * dy + dz * dz + eps2;
      f = g2 / (s * Math.sqrt(s));
      A[k] = ax + f * dx;
      A[k + 1] = ay + f * dy;
      A[k + 2] = az + f * dz;
    }
  };
  const record = (step: number) => {
    const o = step * 6;
    const cx = cores[o]!, cy = cores[o + 1]!, cz = cores[o + 2]!;
    const base = step * N * 2;
    let far = 0;
    for (let i = 0; i < N; i += 1) {
      const k = i * 3;
      xy[base + i * 2] = P[k]!;
      xy[base + i * 2 + 1] = P[k + 1]!;
      if (i < nMain) {
        const dx = P[k]! - cx, dy = P[k + 1]! - cy, dz = P[k + 2]! - cz;
        if (dx * dx + dy * dy + dz * dz > farSquared) far += 1;
      }
    }
    tail[step] = nMain > 0 ? far / nMain : 0;
    if (diagnostics) {
      for (let i = 0; i < N; i += 1) {
        const c = owner[i]! * 3;
        const dx = P[i * 3]! - cores[o + c]!;
        const dy = P[i * 3 + 1]! - cores[o + c + 1]!;
        const dz = P[i * 3 + 2]! - cores[o + c + 2]!;
        radiusDrift = Math.max(radiusDrift, Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) / startRadius[i]! - 1));
      }
    }
  };

  accelerate(0);
  record(0);
  const halfDt = 0.5 * dt;
  for (let step = 1; step <= steps; step += 1) {
    for (let k = 0; k < N * 3; k += 1) {
      const v = V[k]! + halfDt * A[k]!;
      V[k] = v;
      P[k] = P[k]! + dt * v;
    }
    accelerate(step);
    for (let k = 0; k < N * 3; k += 1) V[k] = V[k]! + halfDt * A[k]!;
    record(step);
  }

  return {
    settings: { M2, rp, tilt },
    t0,
    dt,
    steps,
    nStars: N,
    nMain,
    cores,
    xy,
    tail,
    rPeri,
    vPeri,
    tPeri,
    energyDrift: diagnostics ? worstE / ((G * M1 * M2) / rp) : NaN,
    radiusDrift: diagnostics ? radiusDrift : NaN,
  };
}

/** The number of steps `simulateEncounter` will take for these settings: the run's cost is this times the stars. */
export function encounterSteps(settings: EncounterSettings): number {
  const M = GALAXY_MAIN_MASS + Math.max(0, settings.M2);
  const tau = Math.sqrt((2 * settings.rp ** 3) / (G * M));
  const D0 = -Math.sqrt(START_SEPARATION - 1);
  return Math.ceil((END_TAU * tau - tau * (D0 + D0 ** 3 / 3)) / ENCOUNTER_STEP);
}

/** The stored state nearest simulated time t (s from closest approach), clamped to the run. */
export function stepAt(enc: Encounter, t: number): number {
  return Math.max(0, Math.min(enc.steps, Math.round((t - enc.t0) / enc.dt)));
}

/** Simulated time of the run's last state, s from closest approach. */
export function endTime(enc: Encounter): number {
  return enc.t0 + enc.steps * enc.dt;
}

/** The tidal-tail fraction at simulated time t: main-disc stars beyond twice the disc radius. */
export function tailFractionAt(enc: Encounter, t: number): number {
  return enc.tail[stepAt(enc, t)]!;
}

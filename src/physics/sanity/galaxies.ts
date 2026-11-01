/**
 * `verifyGalaxyModel`, the checks on `../galaxies.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  G,
  JULIAN_YEAR,
  R_SUN,
  D_PROXIMA,
  KILOPARSEC,
  D_ANDROMEDA,
  GALAXY_DISC_RADIUS,
  GALAXY_MAIN_MASS,
  M_LOCAL_GROUP_TIMING,
  M_LOCAL_GROUP_COMBINED,
  D_ALPHA_CEN,
  ENCOUNTER_SOFTENING,
  PING_PONG_DIAMETER,
  V_ANDROMEDA_RADIAL,
} from '../constants';
import {
  circularPeriod,
  crossingCollisionChance,
  pericentreSpeed,
  radialInfallTime,
  simulateEncounter,
  tidalAcceleration,
} from '../galaxies';
import {
  TIGHT,
  relativeError,
  significant,
  type CheckResult,
  type CheckBlock,
  toleranced,
  asserted,
  emit,
} from './core';

/**
 * The galaxy-encounter model against its own invariants and the figures the
 * module quotes.
 *
 * The integrator: two-body energy conserved over the default run, a lone star
 * keeping its circle when the companion's mass is zero, and the integrated
 * closest approach and its speed against the parabolic r_p and
 * √(2G(M₁+M₂)/r_p). Toomre & Toomre's result: at the defaults a prograde disc
 * loses far more stars to its tails than a retrograde one. Then the worked
 * numbers: the tide against the disc's own pull, the angular-speed match at
 * closest approach, a disc star's period, the star-collision chance per
 * crossing, the hook's ping-pong-ball scale, and Andromeda's approach at
 * constant speed against a radial fall with the Local Group timing mass (van
 * der Marel et al. 2012).
 */
export function verifyGalaxyModel(): CheckBlock {
  const results: CheckResult[] = [];
  const check = (name: string, formula: string, computed: number, expected: number, unit: string, tolerance: number) =>
    results.push(
      toleranced(
        name,
        formula,
        `computed ${significant(computed)}${unit ? ` ${unit}` : ''}  ·  expected ${expected}${unit ? ` ${unit}` : ''}`,
        relativeError(computed, expected),
        tolerance,
      ),
    );
  const below = (name: string, formula: string, value: number, limit: number) =>
    results.push(asserted(name, formula, `computed ${significant(value)} against a limit of ${limit}`, value < limit));
  const MYR = 1e6 * JULIAN_YEAR;
  const M1 = GALAXY_MAIN_MASS;
  const defaults = { M2: 0.5 * M1, rp: 20 * KILOPARSEC, tilt: 0 };
  const d = GALAXY_DISC_RADIUS;

  /* 1 to 4 — the integrator. */
  const run = simulateEncounter(defaults, { diagnostics: true });
  below(
    'Two-body energy conserved over the default encounter',
    'max |E − E₀| / (G M₁ M₂ / r_p), leapfrog, 1/8 Myr',
    run.energyDrift,
    1e-5,
  );
  const lone = simulateEncounter({ ...defaults, M2: 0 }, { diagnostics: true });
  below('A star with no companion keeps its circle', 'max |r/r₀ − 1|, leapfrog, 1 Myr steps', lone.radiusDrift, 0.01);
  check('Integrated closest approach against the slider’s r_p', 'min |r₂ − r₁|', run.rPeri / KILOPARSEC, 20, 'kpc', 0.005);
  check(
    'Integrated speed at closest approach against the parabola',
    'v_p = √(2G(M₁+M₂)/r_p)',
    run.vPeri / 1e3,
    pericentreSpeed(M1, defaults.M2, defaults.rp) / 1e3,
    'km/s',
    0.005,
  );

  /* 5 — prograde against retrograde, at the run's end. */
  const retro = simulateEncounter({ ...defaults, tilt: Math.PI });
  const pro = run.tail[run.steps]!;
  const ret = retro.tail[retro.steps]!;
  results.push(
    asserted(
      'At the defaults a prograde disc throws far more stars into tails than a retrograde one',
      'tail(i = 0°) − tail(i = 180°) > 0.2, and over 5 times',
      `prograde ${significant(pro)}  ·  retrograde ${significant(ret)}`,
      pro - ret > 0.2 && pro > 5 * ret,
    ),
  );

  /*
   * 6 and 7 — the tide at the defaults, where d/r_p = 0.75 and the linear
   * formula fails. Computed here directly, not through `tidalAcceleration`:
   * exact near-edge difference over the edge star's own pull, against the
   * hand value 0.5 × 15² × (1/5² − 1/20²) = 4.21875; and with the sim's
   * Plummer softening, as the prose quotes. The linear formula's 0.42 is
   * reported alongside, a tenth of the truth here.
   */
  const rp0 = defaults.rp;
  const exactNear = (G * defaults.M2 * (1 / (rp0 - d) ** 2 - 1 / rp0 ** 2)) / ((G * M1) / d ** 2);
  check('Exact near-edge tide over the edge’s own pull, defaults', 'GM₂[1/(r_p−d)² − 1/r_p²] / (GM₁/d²)', exactNear, 4.21875, '', TIGHT);
  const e2 = ENCOUNTER_SOFTENING ** 2;
  const softPull = (M: number, r: number) => (G * M * r) / (r * r + e2) ** 1.5;
  check(
    'The same with the sim’s softened pulls',
    '[f(r_p−d) − f(r_p)] / f₁(d), f = GMr/(r²+ε²)^{3/2}',
    (softPull(defaults.M2, rp0 - d) - softPull(defaults.M2, rp0)) / softPull(M1, d),
    3.989,
    '',
    0.005,
  );
  results.push(
    asserted(
      'The linear tide formula is far off at the defaults, as the prose says',
      '(2GM₂d/r_p³) / exact < 0.2',
      `linear ${significant(tidalAcceleration(defaults.M2, d, rp0) / ((G * M1) / d ** 2))}  ·  exact ${significant(exactNear)}`,
      tidalAcceleration(defaults.M2, d, rp0) / ((G * M1) / d ** 2) / exactNear < 0.2,
    ),
  );
  const omegaP = pericentreSpeed(M1, defaults.M2, defaults.rp) / defaults.rp;
  const omegaStar = (2 * Math.PI) / circularPeriod(d, M1);
  check('Companion’s angular speed at r_p over the edge stars’', 'Ω_p / Ω_* = (v_p/r_p) / √(GM₁/d³)', omegaP / omegaStar, 1.124, '', 0.005);
  check('Orbital period at the disc’s edge', 'T = 2π √(d³/GM₁)', circularPeriod(d, M1) / MYR, 544, 'Myr', 0.005);

  /* 9 and 10 — the hook and the collision chance. */
  check(
    'Proxima Centauri at ping-pong-ball scale',
    'd × (40 mm / 2R☉)',
    (D_PROXIMA * (PING_PONG_DIAMETER / (2 * R_SUN))) / 1e3,
    1155,
    'km',
    0.005,
  );
  check(
    'Alpha Centauri A at ping-pong-ball scale, a ball not a bead',
    'd × (40 mm / 2R☉); size 40 mm × R_A/R☉',
    (D_ALPHA_CEN * (PING_PONG_DIAMETER / (2 * R_SUN))) / 1e3,
    1187,
    'km',
    0.005,
  );
  check(
    'Chance a star crossing a disc hits another, at 400 km/s',
    'n · 2h · π(2R☉)² · (1 + v_esc²/v²)',
    crossingCollisionChance(400e3),
    1.30e-12,
    '',
    0.01,
  );

  /* 11 and 12 — Andromeda. */
  check(
    'Andromeda’s gap closed at constant speed',
    't = d / v, 765 kpc at 109.3 km/s',
    D_ANDROMEDA / V_ANDROMEDA_RADIAL / (1e3 * MYR),
    6.84,
    'Gyr',
    0.005,
  );
  check(
    'Andromeda’s gap closed by a radial fall, Local Group timing mass',
    'radial Kepler orbit, M = 4.93 × 10¹² M☉',
    radialInfallTime(D_ANDROMEDA, V_ANDROMEDA_RADIAL, M_LOCAL_GROUP_TIMING) / (1e3 * MYR),
    3.09,
    'Gyr',
    0.01,
  );
  check(
    'Andromeda’s gap closed by a radial fall, the combined Local Group mass',
    'radial Kepler orbit, M = 3.17 × 10¹² M☉',
    radialInfallTime(D_ANDROMEDA, V_ANDROMEDA_RADIAL, M_LOCAL_GROUP_COMBINED) / (1e3 * MYR),
    3.52,
    'Gyr',
    0.01,
  );

  /* 16 — closer passes pull out more, at a fixed mass and the same age after closest approach. */
  const at = (rpKpc: number) => simulateEncounter({ ...defaults, rp: rpKpc * KILOPARSEC }, { nMain: 280, nComp: 120 });
  const tails = [10, 20, 30].map((r) => {
    const enc = at(r);
    return enc.tail[enc.steps]!;
  });
  results.push(
    asserted(
      'Closer passes pull more of the disc out, at half the main galaxy’s mass',
      'tail(10 kpc) > tail(20 kpc) > tail(30 kpc), 300 Myr after closest approach',
      `10 kpc ${significant(tails[0]!)}  ·  20 kpc ${significant(tails[1]!)}  ·  30 kpc ${significant(tails[2]!)}`,
      tails[0]! > tails[1]! && tails[1]! > tails[2]!,
    ),
  );

  return emit('galaxy checks', results);
}

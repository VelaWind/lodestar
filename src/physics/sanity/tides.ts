/**
 * `verifyTideModel`, the checks on `../tides.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  AU,
  M_MOON,
  M_SUN,
  R_EARTH,
  A_RING_OUTER,
  D_MOON,
  D_MOON_APOGEE,
  D_MOON_PERIGEE,
  M_SATURN,
  R_SATURN_EQ,
  R_SATURN_MEAN,
  RHO_ICE,
  RHO_ICE_POROUS_MAX,
  RHO_ICE_POROUS_MIN,
  ROCHE_FLUID,
} from '../constants';
import {
  equilibriumCrest,
  equilibriumRange,
  exactCrests,
  farSideTide,
  nearSideTide,
  rocheLimit,
  semidiurnalPeriod,
  springNeap,
  tidalAccelerationApprox,
  tidalAccelerationAt,
} from '../tides';
import {
  relativeError,
  significant,
  type CheckResult,
  type CheckBlock,
  toleranced,
  asserted,
  emit,
} from './core';

/**
 * The tide model against textbook values and against the claims the module's
 * caption makes across the whole slider range.
 *
 * The Sun-to-Moon tide ratio (about 0.46); the exact differential acceleration
 * against 2GMR/d³ on the near and far side, and the sideways squeeze at half of
 * it; the equilibrium crests (lunar 0.36 m, solar 0.16 m above the undisturbed
 * level, leading order, rigid Earth); spring range = lunar + solar and neap =
 * lunar − solar from the code's own combination; the 12.42 h semidiurnal
 * period; the near/far crest asymmetry from the exact potential. Then the
 * whole-range claims: the Moon's own tide grows at every step closer; the spring
 * range does too; the range is greatest at phases 0° and 180° at every distance
 * and latitude; and beyond about 1.3 times the real distance the Sun's tide is
 * the larger. Last, the fluid Roche limit for ice around Saturn, from its mass.
 */
export function verifyTideModel(): CheckBlock {
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
  const DEG = Math.PI / 180;
  const hL = equilibriumCrest(M_MOON, D_MOON);
  const hS = equilibriumCrest(M_SUN, AU);

  /* 1 — the ratio. */
  check('Sun’s tide over the Moon’s', '(M☉/M_Moon)(d_Moon/AU)³', hS / hL, 0.459, '', 0.005);

  /* 2 to 4 — exact against approximate acceleration at today's distance. */
  const approx = tidalAccelerationApprox(M_MOON, D_MOON);
  const nearVec = tidalAccelerationAt(R_EARTH, 0, D_MOON, 0, M_MOON)[0];
  check('Exact near-side tidal acceleration over 2GMR/d³', 'GM[1/(d−R)² − 1/d²] / (2GMR/d³)', nearVec / approx, 1.025, '', 0.002);
  check('Exact far-side tidal acceleration over 2GMR/d³', 'GM[1/d² − 1/(d+R)²] / (2GMR/d³)', farSideTide(M_MOON, D_MOON) / approx, 0.976, '', 0.002);
  const side = tidalAccelerationAt(0, R_EARTH, D_MOON, 0, M_MOON);
  check('Sideways squeeze over the stretch', '|a(90°)| / (2GMR/d³)', Math.hypot(side[0], side[1]) / approx, 0.5, '', 0.002);
  results.push(
    asserted(
      'The vector form and the near-side formula agree',
      'tidalAccelerationAt(R, 0) = nearSideTide',
      `${significant(nearVec)} against ${significant(nearSideTide(M_MOON, D_MOON))}`,
      Math.abs(nearVec / nearSideTide(M_MOON, D_MOON) - 1) < 1e-9,
    ),
  );

  /* 6 and 7 — the crests. */
  check('Lunar equilibrium crest', '(M_Moon/M⊕) R⁴/d³', hL, 0.357, 'm', 0.005);
  check('Solar equilibrium crest', '(M☉/M⊕) R⁴/AU³', hS, 0.164, 'm', 0.005);

  /* 8 and 9 — spring and neap from the code's own combination. */
  const sn = springNeap({ phase: 0, lat: 0, lunar: hL, solar: hS });
  check('Spring range = lunar range + solar range', 'range(α = 0) / (1.5 h_M + 1.5 h_S)', sn.spring / (1.5 * hL + 1.5 * hS), 1, '', 1e-9);
  check('Neap range = lunar range − solar range', 'range(α = 90°) / (1.5 h_M − 1.5 h_S)', sn.neap / (1.5 * hL - 1.5 * hS), 1, '', 1e-9);

  /* 10 — the time between high tides. */
  check('Lunar semidiurnal period', 'half of 1/(1/T_sidereal day − 1/T_month)', semidiurnalPeriod() / 3600, 12.42, 'h', 0.001);

  /* 11 — near and far bulges, exact. */
  const ec = exactCrests(M_MOON, D_MOON);
  check('Near crest over far crest, exact potential', 'h(0°) / h(180°) − 1 ≈ 2R/d', ec.near / ec.far - 1, 0.0337, '', 0.02);

  /* 12 to 15 — the caption's claims across the whole slider range. */
  const latitudes = [0, 15, 30, 45, 60].map((x) => x * DEG);
  let lunarGrows = true;
  let springGrows = true;
  for (let f = 2.0; f > 0.6; f -= 0.01) {
    const far = equilibriumCrest(M_MOON, f * D_MOON);
    const near = equilibriumCrest(M_MOON, (f - 0.01) * D_MOON);
    if (!(near > far)) lunarGrows = false;
    for (const lat of latitudes) {
      const a = springNeap({ phase: 0, lat, lunar: far, solar: hS }).spring;
      const b = springNeap({ phase: 0, lat, lunar: near, solar: hS }).spring;
      if (!(b > a)) springGrows = false;
    }
  }
  results.push(
    asserted(
      'A closer Moon raises a bigger lunar tide at every step of the slider',
      'h_M(d − δ) > h_M(d), 0.6 to 2 times today’s distance',
      `${lunarGrows}`,
      lunarGrows,
    ),
  );
  results.push(
    asserted(
      'A closer Moon gives a bigger spring range at every step and latitude',
      'range(α = 0; d − δ) > range(α = 0; d)',
      `${springGrows}`,
      springGrows,
    ),
  );
  let springAtAlignment = true;
  for (let f = 0.6; f <= 2.0001; f += 0.05) {
    const lunar = equilibriumCrest(M_MOON, f * D_MOON);
    for (const lat of latitudes) {
      const at0 = equilibriumRange({ phase: 0, lat, lunar, solar: hS });
      const at180 = equilibriumRange({ phase: Math.PI, lat, lunar, solar: hS });
      for (let ph = 1; ph < 360; ph += 1) {
        if (ph === 180) continue;
        if (equilibriumRange({ phase: ph * DEG, lat, lunar, solar: hS }) >= at0 - 1e-15) springAtAlignment = false;
      }
      if (Math.abs(at180 - at0) > 1e-12) springAtAlignment = false;
    }
  }
  results.push(
    asserted(
      'The range is greatest at new and full Moon, at every distance and latitude',
      'argmax over α of range = 0° and 180°',
      `${springAtAlignment}`,
      springAtAlignment,
    ),
  );
  const crossover = Math.cbrt((M_MOON / M_SUN) * (AU / D_MOON) ** 3);
  check('Distance, in today’s, beyond which the Sun’s tide is the larger', '(M_Moon/M☉)^(1/3) AU / d_Moon', crossover, 1.296, '', 0.005);

  /* 16 — perigee and apogee: the real range of the lunar tide. */
  check(
    'Lunar tide at perigee over apogee',
    '(d_apogee / d_perigee)³',
    equilibriumCrest(M_MOON, D_MOON_PERIGEE) / equilibriumCrest(M_MOON, D_MOON_APOGEE),
    1.391,
    '',
    0.005,
  );

  /*
   * 17 — Saturn's rings and the Roche limit, from Saturn's mass: R_p ρ_p^(1/3)
   * is (3M / 4π)^(1/3) whatever radius the density goes with, so the mean
   * density comes from the mass and the volumetric mean radius, never from the
   * equatorial one. Quoted in equatorial radii, as ring distances usually are.
   */
  const rhoSaturn = M_SATURN / ((4 / 3) * Math.PI * R_SATURN_MEAN ** 3);
  const rocheAt = (rhoS: number) => rocheLimit(ROCHE_FLUID, R_SATURN_MEAN, rhoSaturn, rhoS);
  const rocheSolid = rocheAt(RHO_ICE);
  check('Fluid Roche limit for solid ice around Saturn, in equatorial radii', '2.44 (3M_S / 4πρ_ice)^(1/3) / R_eq', rocheSolid / R_SATURN_EQ, 2.141, 'R_S', 0.005);
  /* 18 — porous ring ice: the limit moves outside every main ring. */
  const porousNear = rocheAt(RHO_ICE_POROUS_MAX);
  const porousFar = rocheAt(RHO_ICE_POROUS_MIN);
  results.push(
    asserted(
      'The A ring’s outer edge lies outside the solid-ice limit and inside the porous-ice one',
      'd(917) < A-ring edge < d(600) ≤ d(500)',
      `${significant(rocheSolid / R_SATURN_EQ)} < ${significant(A_RING_OUTER / R_SATURN_EQ)} < ${significant(porousNear / R_SATURN_EQ)}–${significant(porousFar / R_SATURN_EQ)} R_S`,
      rocheSolid < A_RING_OUTER && A_RING_OUTER < porousNear && porousNear <= porousFar,
    ),
  );

  return emit('tide checks', results);
}

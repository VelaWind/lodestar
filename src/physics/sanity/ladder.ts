/**
 * `verifyLadderModel`, the checks on `../ladder.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  H0_PLANCK_2018,
  KM_S_PER_MPC,
  M_IA_PEAK,
  PARSEC,
  ARCSEC,
  D_LMC,
  H0_SH0ES_2022,
} from '../constants';
import {
  apparentMagnitude as ladderApparentMagnitude,
  distanceModulus,
  inferredH0,
  leavittAbsoluteMagnitude,
  offsetForH0Ratio,
  parallaxAngle,
  parallaxFractionalError,
  peculiarVelocityShare,
  rungsAt,
} from '../ladder';
import {
  TIGHT,
  LOOSE,
  relativeError,
  significant,
  type CheckResult,
  type CheckBlock,
  toleranced,
  asserted,
  emit,
} from './core';

/**
 * The distance-ladder model against the figures the module quotes.
 *
 * Parallax at 100 pc and Gaia's precision at 1 kpc, the Leavitt law at 10 and
 * 30 days, the LMC's distance modulus, a Type Ia at 100 Mpc and a Cepheid in
 * Virgo, the offset that turns Planck's H₀ into SH0ES's and back, the share of
 * a galaxy's own motion at 50 Mpc, and which rung reaches the LMC.
 */
export function verifyLadderModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — one hundredth of an arcsecond at 100 pc, the parsec's definition. */
  const p100 = parallaxAngle(100 * PARSEC) / ARCSEC;
  results.push(
    toleranced(
      'Parallax at 100 pc',
      'p = 1 AU / d',
      `computed ${significant(p100)} arcsec  ·  expected 0.0100 arcsec`,
      relativeError(p100, 0.01),
      TIGHT,
    ),
  );

  /* 2 — Gaia's precision at 1 kpc. */
  const precision = parallaxFractionalError(1000 * PARSEC);
  results.push(
    toleranced(
      'Gaia parallax precision at 1 kpc',
      'σ_p / p, σ_p = 20 µas',
      `computed ${significant(precision)}  ·  expected 0.020`,
      relativeError(precision, 0.02),
      LOOSE,
    ),
  );

  /* 3 — the Leavitt law's zero point is its value at 10 days. */
  const m10 = leavittAbsoluteMagnitude(10);
  results.push(
    asserted(
      'Leavitt law at 10 days',
      'M_V = a + b (log₁₀ P − 1)',
      `computed ${m10}  ·  expected −4.05 exactly`,
      m10 === -4.05,
    ),
  );

  /* 4 — a 30-day Cepheid. */
  const m30 = leavittAbsoluteMagnitude(30);
  results.push(
    asserted(
      'Leavitt law at 30 days',
      'M_V = −4.05 − 2.43 (log₁₀ 30 − 1)',
      `computed ${m30.toFixed(4)}  ·  expected −5.209 ± 0.005`,
      Math.abs(m30 - -5.209) <= 0.005,
    ),
  );

  /* 5 — the LMC anchor. */
  const muLmc = distanceModulus(D_LMC);
  results.push(
    asserted(
      'Distance modulus of the LMC',
      'μ = 5 log₁₀(d / 10 pc)',
      `computed ${muLmc.toFixed(4)}  ·  expected 18.477 ± 0.002`,
      Math.abs(muLmc - 18.477) <= 0.002,
    ),
  );

  /* 6 — a Type Ia at 100 Mpc. */
  const mIa = ladderApparentMagnitude(M_IA_PEAK, 100e6 * PARSEC);
  results.push(
    asserted(
      'Type Ia at 100 Mpc',
      'm = M + μ',
      `computed ${mIa.toFixed(3)}  ·  expected 15.70 ± 0.01`,
      Math.abs(mIa - 15.7) <= 0.01,
    ),
  );

  /* 7 — a 30-day Cepheid in the Virgo Cluster. */
  const mCeph = ladderApparentMagnitude(leavittAbsoluteMagnitude(30), 16.5e6 * PARSEC);
  results.push(
    asserted(
      '30-day Cepheid at 16.5 Mpc',
      'm = M + μ',
      `computed ${mCeph.toFixed(3)}  ·  expected 25.88 ± 0.02`,
      Math.abs(mCeph - 25.88) <= 0.02,
    ),
  );

  /* 8 — the offset that turns Planck's H₀ into SH0ES's. */
  const tension = inferredH0(H0_PLANCK_2018, 0.1747);
  results.push(
    toleranced(
      'H₀ from Planck with δ = 0.1747 mag',
      'H₀,ladder = H₀,true · 10^(δ/5)',
      `computed ${significant(tension / KM_S_PER_MPC)} km/s/Mpc  ·  expected 73.04 km/s/Mpc`,
      relativeError(tension, H0_SH0ES_2022),
      TIGHT,
    ),
  );

  /* 9 — and the offset from the ratio. */
  const offset = offsetForH0Ratio(73.04 / 67.4);
  results.push(
    asserted(
      'Offset for 73.04 / 67.4',
      'δ = 5 log₁₀(ratio)',
      `computed ${offset.toFixed(5)} mag  ·  expected 0.1746 ± 0.001`,
      Math.abs(offset - 0.1746) <= 0.001,
    ),
  );

  /* 10 — where a galaxy's own motion stops mattering. */
  const share = peculiarVelocityShare(H0_PLANCK_2018, 50e6 * PARSEC);
  results.push(
    toleranced(
      'Peculiar-velocity share at 50 Mpc',
      'v_pec / (H₀ d)',
      `computed ${significant(share)}  ·  expected 0.089`,
      relativeError(share, 0.089),
      0.02,
    ),
  );

  /* 11 — only Cepheids reach the LMC. */
  const rungs = rungsAt(D_LMC).map((rung) => rung.id);
  results.push(
    asserted(
      'Rungs at the LMC',
      'd within [dMin, dMax]',
      `computed ${rungs.join(', ') || 'none'}  ·  expected cepheids`,
      rungs.join() === 'cepheids',
    ),
  );

  /* 12 — and only Cepheids reach the Galactic centre, past parallax's few-percent range. */
  const centre = rungsAt(8.2e3 * PARSEC).map((rung) => rung.id);
  results.push(
    asserted(
      'Rungs at the Galactic centre',
      'd within [dMin, dMax]',
      `computed ${centre.join(', ') || 'none'}  ·  expected cepheids`,
      centre.join() === 'cepheids',
    ),
  );

  return emit('distance-ladder checks', results);
}

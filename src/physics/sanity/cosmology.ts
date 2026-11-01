/**
 * `verifyCosmologyModel`, the checks on `../cosmology.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  C,
  H0_PLANCK_2018,
  H_ALPHA_AIR,
  JULIAN_YEAR,
  KM_S_PER_MPC,
} from '../constants';
import {
  hubbleTime,
  lineOfSightVelocity,
  observedWavelength,
  recessionVelocity,
  redshiftFromVelocity,
} from '../cosmology';
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
 * The expansion module's numbers, against the worked example in its layer 5.
 *
 * The Coma Cluster at 100 Mpc and Planck's H₀ is the sim's default and the
 * math layer's worked example, so these are the exact figures a reader sees
 * printed there: 6 740 km/s, z = 0.0225, Hα at 671.0 nm, a 14.5-billion-year
 * Hubble time. Andromeda is the other end: close enough that its own motion
 * beats the expansion, so the same functions have to produce a blueshift.
 */
export function verifyCosmologyModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the unit conversion everything else rests on. */
  const h0 = 67.4 * KM_S_PER_MPC;
  results.push(
    toleranced(
      '67.4 km/s/Mpc in SI',
      'H₀ = 67.4 × 10³ m/s / 10⁶ pc',
      `computed ${significant(h0)} s⁻¹  ·  expected 2.184e-18 s⁻¹`,
      relativeError(h0, 2.184e-18),
      TIGHT,
    ),
  );

  /* 2 — Hubble time at Planck's value. */
  const tH = hubbleTime(H0_PLANCK_2018) / JULIAN_YEAR / 1e9;
  results.push(
    toleranced(
      'Hubble time at H₀ = 67.4 km/s/Mpc',
      't_H = 1 / H₀',
      `computed ${significant(tH)} Gyr  ·  expected 14.5 Gyr`,
      relativeError(tH, 14.5),
      LOOSE,
    ),
  );

  /* 3–5 — the Coma Cluster, 100 Mpc (3.0857e24 m), no peculiar velocity. */
  const comaD = 3.0857e24;
  const comaV = recessionVelocity(H0_PLANCK_2018, comaD);
  results.push(
    toleranced(
      'Coma recession velocity',
      'v = H₀ d',
      `computed ${significant(comaV / 1e3)} km/s  ·  expected 6740 km/s`,
      relativeError(comaV / 1e3, 6740),
      0.005,
    ),
  );
  const comaZ = redshiftFromVelocity(lineOfSightVelocity(H0_PLANCK_2018, comaD, 0));
  results.push(
    toleranced(
      'Coma redshift',
      'z = v / c',
      `computed ${significant(comaZ)}  ·  expected 0.0225`,
      relativeError(comaZ, 0.0225),
      0.005,
    ),
  );
  const comaLambda = observedWavelength(H_ALPHA_AIR, comaZ) * 1e9;
  results.push(
    asserted(
      'Coma Hα observed wavelength',
      'λ_obs = λ_rest (1 + z)',
      `computed ${comaLambda.toFixed(3)} nm  ·  expected 671.0 ± 0.1 nm`,
      Math.abs(comaLambda - 671.0) <= 0.1,
    ),
  );

  /* 6 — Andromeda: 2.4e22 m, approaching at 110 km/s. A blueshift. */
  const m31V = lineOfSightVelocity(H0_PLANCK_2018, 2.4e22, -1.1e5);
  const m31Lambda = observedWavelength(H_ALPHA_AIR, redshiftFromVelocity(m31V)) * 1e9;
  results.push(
    asserted(
      'Andromeda is blueshifted',
      'v = H₀ d + v_pec < 0  ⇒  λ_obs < λ_rest',
      `v = ${significant(m31V / 1e3)} km/s  ·  λ_obs = ${m31Lambda.toFixed(3)} nm` +
        `  ·  lab ${(H_ALPHA_AIR * 1e9).toFixed(2)} nm`,
      m31V < 0 && m31Lambda < H_ALPHA_AIR * 1e9,
    ),
  );

  /* 7 — the linear redshift refuses a speed it has no meaning at. */
  const throwsAt = (v: number) => {
    try {
      redshiftFromVelocity(v);
      return false;
    } catch {
      return true;
    }
  };
  const refuses = throwsAt(C) && throwsAt(-C) && throwsAt(1.5 * C) && !throwsAt(0.999 * C);
  results.push(
    asserted(
      'redshiftFromVelocity throws at |v| ≥ c',
      '|v| ≥ c  ⇒  RangeError',
      `c, −c and 1.5c ${refuses ? 'rejected' : 'NOT all rejected'}; 0.999c accepted`,
      refuses,
    ),
  );

  return emit('cosmology checks', results);
}

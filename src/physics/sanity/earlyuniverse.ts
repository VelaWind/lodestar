/**
 * `verifyEarlyUniverseModel`, the checks on `../earlyuniverse.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  C,
  JULIAN_YEAR,
  Z_RECOMBINATION,
  EV,
  K_B,
  M_ELECTRON,
  OMEGA_M,
} from '../constants';
import {
  freezeOutTime,
  lcdmTimeAtScaleFactor,
  radiationDensityParameter,
  radiationTimeAtTemperature,
  scaleFactorAtTime,
  stitchTime,
  temperatureAtTime,
} from '../earlyuniverse';
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
 * The early-universe module's history, against the landmarks it quotes.
 *
 * Ten billion kelvin at one second; about six trillion at a microsecond; the
 * quark–hadron step near ten microseconds; the electron freezing out near
 * three seconds; recombination near 378 000 years; matter–radiation equality
 * near z = 3400; today at 13.80 Gyr. Then the two joins the model depends on:
 * the radiation formula and the ΛCDM integral must agree where they hand over,
 * and the time-to-scale-factor inverse must come back to a = 1 today.
 *
 * Ranges rather than tolerances where the target is a published range: the
 * step approximation to g_* is good to a few percent, not to a part in 10³.
 */
export function verifyEarlyUniverseModel(): CheckBlock {
  const results: CheckResult[] = [];
  const within = (x: number, lo: number, hi: number) => x >= lo && x <= hi;

  /* 1 — one second in. */
  const tOne = temperatureAtTime(1);
  results.push(
    asserted(
      'Temperature at one second',
      'kT = (90ħ³c⁵ / 32π³G g_*)^(1/4) / √t',
      `computed ${significant(tOne)} K  ·  expected 9.7e9 … 1.03e10 K`,
      within(tOne, 9.7e9, 1.03e10),
    ),
  );

  /* 2 — one microsecond in. */
  const tMicro = temperatureAtTime(1e-6);
  results.push(
    asserted(
      'Temperature at one microsecond',
      'kT = (90ħ³c⁵ / 32π³G g_*)^(1/4) / √t',
      `computed ${significant(tMicro)} K  ·  expected 5.5e12 … 7.5e12 K`,
      within(tMicro, 5.5e12, 7.5e12),
    ),
  );

  /* 3 — the quark–hadron step. */
  const tQcd = radiationTimeAtTemperature((170e6 * EV) / K_B);
  results.push(
    asserted(
      'Time at kT = 170 MeV',
      't = √(90ħ³c⁵ / 32π³G g_*) / (kT)²',
      `computed ${significant(tQcd)} s  ·  expected 8e-6 … 2.5e-5 s`,
      within(tQcd, 8e-6, 2.5e-5),
    ),
  );

  /* 4 — the electron stops being made. */
  const tElectron = freezeOutTime(M_ELECTRON * C ** 2);
  results.push(
    asserted(
      'Electron freeze-out time',
      't_f = t(kT = m_e c²)',
      `computed ${significant(tElectron)} s  ·  expected 2.6 … 3.1 s`,
      within(tElectron, 2.6, 3.1),
    ),
  );

  /* 5 — the age today. */
  const age = lcdmTimeAtScaleFactor(1) / JULIAN_YEAR / 1e9;
  results.push(
    toleranced(
      'Age at a = 1',
      't = ∫₀¹ da / (a H(a))',
      `computed ${significant(age)} Gyr  ·  expected 13.80 Gyr`,
      relativeError(age, 13.8),
      0.005,
    ),
  );

  /* 6 — last scattering. */
  const tRecombination = lcdmTimeAtScaleFactor(1 / (1 + Z_RECOMBINATION)) / JULIAN_YEAR;
  results.push(
    toleranced(
      'Age at z_*',
      't = ∫₀^a da / (a H(a)),  a = 1/(1 + z_*)',
      `computed ${significant(tRecombination)} yr  ·  expected 3.78e5 yr`,
      relativeError(tRecombination, 3.78e5),
      0.03,
    ),
  );

  /* 7 — matter–radiation equality. */
  const zEq = 1 / (radiationDensityParameter() / OMEGA_M) - 1;
  results.push(
    asserted(
      'Redshift of matter–radiation equality',
      '1 + z_eq = Ω_m / Ω_r',
      `computed ${significant(zEq)}  ·  expected 3300 … 3550`,
      within(zEq, 3300, 3550),
    ),
  );

  /* 8 — the two models agree where they hand over. */
  const stitch = stitchTime();
  const jump = Math.abs(temperatureAtTime(stitch * 1.01) / temperatureAtTime(stitch * 0.99) - 1);
  results.push(
    asserted(
      'Continuity at the radiation–ΛCDM stitch',
      '|T(1.01 t_s) / T(0.99 t_s) − 1| < 3%',
      `stitch at ${significant(stitch)} s  ·  difference ${(jump * 100).toFixed(3)}%`,
      jump < 0.03,
    ),
  );

  /* 9 — the far end comes back to today. */
  const aNow = scaleFactorAtTime(lcdmTimeAtScaleFactor(1));
  results.push(
    asserted(
      'Scale factor today round-trips to 1',
      'a(t(a = 1)) = 1',
      `computed ${aNow.toFixed(7)}  ·  expected 1 ± 1e-4`,
      Math.abs(aNow - 1) <= 1e-4,
    ),
  );

  return emit('early universe checks', results);
}

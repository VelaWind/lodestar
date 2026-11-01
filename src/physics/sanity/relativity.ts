/**
 * `verifyRelativityModel`, the checks on `../relativity.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import { schwarzschildRadius } from '../blackhole';
import {
  C,
  JULIAN_YEAR,
  M_EARTH,
  R_EARTH,
  D_PROXIMA,
  M_DEMO_BH,
  R_GPS,
} from '../constants';
import {
  circularOrbitSpeed,
  clockDeficit,
  gpsDailyOffsets,
  gravitationalDeficit,
  gravitationalRate,
  lorentzFactor,
  twinTrip,
} from '../relativity';
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
 * The time-dilation model against the figures the module quotes.
 *
 * The Lorentz factor at 0.8 c and 0.998 c, the clock deficit at motorway
 * speed (where the naive 1 − 1/γ cancels to nothing), the twin trip to
 * Proxima, the GPS orbit and its daily clock budget, clocks at 1.5 and 1.01
 * Schwarzschild radii, and the deficit at Earth's surface.
 */
export function verifyRelativityModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the twin example's speed. */
  const g8 = lorentzFactor(0.8 * C);
  results.push(
    asserted(
      'Lorentz factor at 0.8 c',
      'γ = 1 / √(1 − v²/c²)',
      `computed ${g8.toFixed(6)}  ·  expected 1.66667 ± 1e-5`,
      Math.abs(g8 - 1.66667) <= 1e-5,
    ),
  );

  /* 2 — a cosmic-ray muon's speed. */
  const g998 = lorentzFactor(0.998 * C);
  results.push(
    toleranced(
      'Lorentz factor at 0.998 c',
      'γ = 1 / √(1 − v²/c²)',
      `computed ${significant(g998)}  ·  expected 15.82`,
      relativeError(g998, 15.82),
      TIGHT,
    ),
  );

  /* 3 — motorway speed, where the naive form returns rounding noise. */
  const d30 = clockDeficit(30);
  results.push(
    toleranced(
      'Clock deficit at 30 m/s',
      '1 − 1/γ = β² / (1 + √(1 − β²))',
      `computed ${significant(d30)}  ·  expected 5.0e-15`,
      relativeError(d30, 5.0e-15),
      LOOSE,
    ),
  );

  /* 4 and 5 — the round trip to Proxima at 0.8 c. */
  const trip = twinTrip(D_PROXIMA, 0.8 * C);
  const home = trip.home_s / JULIAN_YEAR;
  const aboard = trip.traveller_s / JULIAN_YEAR;
  results.push(
    toleranced(
      'Twin trip to Proxima at 0.8 c, at home',
      '2d / v',
      `computed ${significant(home)} yr  ·  expected 10.62 yr`,
      relativeError(home, 10.62),
      0.005,
    ),
  );
  results.push(
    toleranced(
      'Twin trip to Proxima at 0.8 c, on board',
      '2d / (γ v)',
      `computed ${significant(aboard)} yr  ·  expected 6.37 yr`,
      relativeError(aboard, 6.37),
      0.005,
    ),
  );

  /* 6 — the GPS orbit. */
  const vGps = circularOrbitSpeed(M_EARTH, R_GPS);
  results.push(
    toleranced(
      'GPS orbital speed',
      'v = √(G M / r)',
      `computed ${significant(vGps)} m/s  ·  expected 3874 m/s`,
      relativeError(vGps, 3874),
      0.005,
    ),
  );

  /* 7, 8 and 9 — the GPS clock budget per day. */
  const gps = gpsDailyOffsets();
  results.push(
    toleranced(
      'GPS clock loss from speed, per day',
      '−(1 − 1/γ) × 1 day',
      `computed ${significant(gps.speed_s * 1e6)} µs  ·  expected −7.21 µs`,
      relativeError(gps.speed_s * 1e6, -7.21),
      LOOSE,
    ),
  );
  results.push(
    toleranced(
      'GPS clock gain from height, per day',
      '(deficit at R⊕ − deficit at r_GPS) × 1 day',
      `computed ${significant(gps.gravity_s * 1e6)} µs  ·  expected +45.7 µs`,
      relativeError(gps.gravity_s * 1e6, 45.7),
      LOOSE,
    ),
  );
  results.push(
    toleranced(
      'GPS clock net, per day',
      'speed + height',
      `computed ${significant(gps.net_s * 1e6)} µs  ·  expected +38.5 µs`,
      relativeError(gps.net_s * 1e6, 38.5),
      LOOSE,
    ),
  );

  /* 10 — at the photon sphere of a 10 M☉ black hole. */
  const rs = schwarzschildRadius(M_DEMO_BH);
  const at15 = gravitationalRate(M_DEMO_BH, 1.5 * rs);
  results.push(
    asserted(
      'Clock rate at 1.5 r_s',
      'dτ/dt = √(1 − r_s / r)',
      `computed ${at15.toFixed(6)}  ·  expected 0.5774 ± 1e-4`,
      Math.abs(at15 - 0.5774) <= 1e-4,
    ),
  );

  /* 11 — just outside the horizon. */
  const at101 = gravitationalRate(M_DEMO_BH, 1.01 * rs);
  results.push(
    toleranced(
      'Clock rate at 1.01 r_s',
      'dτ/dt = √(1 − r_s / r)',
      `computed ${significant(at101)}  ·  expected 0.0995`,
      relativeError(at101, 0.0995),
      0.005,
    ),
  );

  /* 12 — Earth's surface against far away. */
  const earth = gravitationalDeficit(M_EARTH, R_EARTH);
  results.push(
    toleranced(
      'Gravitational deficit at Earth’s surface',
      'x / (1 + √(1 − x)), x = r_s / R⊕',
      `computed ${significant(earth)}  ·  expected 6.96e-10`,
      relativeError(earth, 6.96e-10),
      LOOSE,
    ),
  );

  return emit('time-dilation checks', results);
}

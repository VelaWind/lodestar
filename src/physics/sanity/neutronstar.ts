/**
 * `verifyNeutronStarModel`, the checks on `../neutronstar.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  JULIAN_YEAR,
  M_SUN,
  M_NS_TYPICAL,
  CRAB_BIRTH_PERIOD,
  CRAB_BRAKING_INDEX,
  CRAB_F0,
  CRAB_F1,
  FASTEST_PULSAR_FREQUENCY,
  G_STANDARD,
  NS_MASS_HEAVIEST,
} from '../constants';
import {
  characteristicAge,
  collapses,
  compactness,
  densityOverNuclear,
  equatorialSpeedFraction,
  escapeSpeedFraction,
  keplerFrequency,
  meanDensity,
  spinDownAge,
  spinDownPower,
  surfaceGravity,
  surfaceRedshift,
  teaspoonMass,
} from '../neutronstar';
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
 * The neutron-star model against the figures the module quotes.
 *
 * At 1.4 M☉ and 12 km: the mean density and its ratio to nuclear saturation
 * density (Lattimer & Prakash 2016, ρ_s ≃ 2.7 × 10¹⁴ g cm⁻³), a teaspoon of it,
 * the surface gravity, the escape speed, the compactness and the surface
 * redshift. The equator's speed for the Crab and for the 716 Hz pulsar, and the
 * Keplerian limit (Haensel et al. 2009). The Crab's spin-down power and
 * characteristic age against the ATNF catalogue's own derived values (EDOT
 * 4.5 × 10³⁸ erg/s, AGE 1.26 × 10³ yr), computed here from its F0 and F1, and
 * its spin-down age with the measured braking index and estimated birth period
 * (Faucher-Giguère & Kaspi 2006) against its true age. And two orderings: the
 * fastest known pulsar spins below the limit, and the collapse threshold sits
 * above the heaviest precisely measured star.
 */
export function verifyNeutronStarModel(): CheckBlock {
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
  const M = M_NS_TYPICAL;

  /* 1 to 3 — density. */
  check('Mean density, 1.4 M☉ and 12 km', 'ρ̄ = M / (4/3 π R³)', meanDensity(M), 3.85e17, 'kg/m³', 0.005);
  check('Mean density over nuclear saturation density', 'ρ̄ / ρ_s, ρ_s = 2.7e17 kg/m³', densityOverNuclear(M), 1.42, '', 0.005);
  check('A teaspoon (5 mL) at the mean density', 'm = ρ̄ × 5 × 10⁻⁶ m³', teaspoonMass(M), 1.92e12, 'kg', 0.005);

  /* 4 to 7 — gravity. */
  check('Surface gravity, in g', 'g = GM / (R² √(1 − 2GM/Rc²)) / g₀', surfaceGravity(M) / G_STANDARD, 1.625e11, 'g', 0.005);
  check('Escape speed, as a fraction of c', 'v / c = √(2GM / Rc²)', escapeSpeedFraction(M), 0.587, '', 0.005);
  check('Compactness', 'β = GM / (R c²)', compactness(M), 0.1723, '', TIGHT);
  check('Gravitational redshift from the surface', 'z = 1/√(1 − 2β) − 1', surfaceRedshift(M), 0.2352, '', TIGHT);

  /* 8 to 10 — spin. */
  const crabP = 1 / CRAB_F0;
  check('Equatorial speed of the Crab, as a fraction of c', 'v / c = 2πR / (P c)', equatorialSpeedFraction(crabP), 7.53e-3, '', 0.005);
  check(
    'Equatorial speed at 716 Hz, as a fraction of c',
    'v / c = 2πR f / c',
    equatorialSpeedFraction(1 / FASTEST_PULSAR_FREQUENCY),
    0.180,
    '',
    0.005,
  );
  check(
    'Keplerian frequency, 1.4 M☉ and 12 km',
    'f_K = 1.08 kHz (M/M☉)^½ (R/10 km)^(−3/2)',
    keplerFrequency(M),
    972,
    'Hz',
    0.005,
  );

  /* 11 and 12 — the Crab's spin-down, against the catalogue's derived values. */
  const crabPdot = -CRAB_F1 / CRAB_F0 ** 2;
  check(
    'Crab spin-down power, against ATNF EDOT',
    'Ė = 4π² I Ṗ / P³, I = 10³⁸ kg m²',
    spinDownPower(crabP, crabPdot),
    4.5e31,
    'W',
    LOOSE,
  );
  check(
    'Crab characteristic age, against ATNF AGE',
    'τ = P / (2Ṗ)',
    characteristicAge(crabP, crabPdot) / JULIAN_YEAR,
    1.26e3,
    'yr',
    0.005,
  );

  /*
   * 13 — the layer-6 explanation of that overestimate. With the measured
   * braking index and the estimated birth period the spin-down age comes to
   * 954 years, against a true age of 937 at the catalogue epoch (SN 1054 to
   * mid-1991): within 2%, where the characteristic age is 34% high.
   */
  check(
    'Crab spin-down age with n = 2.51 and P₀ = 19 ms, against its true age',
    't = P/((n−1)Ṗ) · [1 − (P₀/P)^(n−1)]',
    spinDownAge(crabP, crabPdot, CRAB_BRAKING_INDEX, CRAB_BIRTH_PERIOD) / JULIAN_YEAR,
    1991.5 - 1054.5,
    'yr',
    0.02,
  );

  /* 14 and 15 — orderings the module's prose depends on. */
  const fastest = FASTEST_PULSAR_FREQUENCY;
  const limit = keplerFrequency(M);
  results.push(
    asserted(
      'The fastest known pulsar spins below the Keplerian limit',
      '716 Hz < f_K(1.4 M☉, 12 km)',
      `computed ${fastest} Hz against ${significant(limit)} Hz`,
      fastest < limit,
    ),
  );
  results.push(
    asserted(
      'The collapse threshold sits above the heaviest precisely measured neutron star',
      '2.08 M☉ is stable; 2.4 M☉ collapses',
      `collapses(2.08 M☉) = ${collapses(NS_MASS_HEAVIEST)}  ·  collapses(2.4 M☉) = ${collapses(2.4 * M_SUN)}`,
      !collapses(NS_MASS_HEAVIEST) && collapses(2.4 * M_SUN),
    ),
  );

  return emit('neutron-star checks', results);
}

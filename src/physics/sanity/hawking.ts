/**
 * `verifyHawkingModel`, the checks on `../hawking.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import { evaporationTime, hawkingTemperature, schwarzschildRadius } from '../blackhole';
import {
  JULIAN_YEAR,
  M_SUN,
  T_CMB,
  AGE_UNIVERSE,
  MEGATON_TNT,
} from '../constants';
import {
  emissionBand,
  finalSecondEnergy,
  hawkingPower,
  massEvaporatingIn,
  massForHawkingTemperature,
} from '../hawking';
import {
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
 * The Hawking-radiation model against the figures the module quotes.
 *
 * The Sun's temperature (the ħ check, again, through the function this module
 * shares with black holes), the mass as warm as the microwave background, the
 * mountain-mass hole of the worked example (size, temperature, power, lifetime
 * and what it emits), the mass finishing now and in one second, and the energy
 * of that last second.
 */
export function verifyHawkingModel(): CheckBlock {
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

  /* 1 — the Sun's mass. */
  check('Hawking temperature of one solar mass', 'T_H = ħc³ / (8π G M k)', hawkingTemperature(M_SUN), 6.17e-8, 'K', 0.005);

  /* 2 — the crossover with today's microwave background. */
  check(
    'Mass as warm as the microwave background',
    'M = ħc³ / (8π G k T_CMB)',
    massForHawkingTemperature(T_CMB),
    4.5e22,
    'kg',
    LOOSE,
  );

  /* 3 to 6 — the worked example, a mountain's mass. */
  const mountain = 1e12;
  check('Schwarzschild radius of 10¹² kg', 'r_s = 2GM / c²', schwarzschildRadius(mountain), 1.485e-15, 'm', 0.005);
  check('Hawking temperature of 10¹² kg', 'T_H = ħc³ / (8π G M k)', hawkingTemperature(mountain), 1.227e11, 'K', 0.005);
  check('Hawking power of 10¹² kg, photons', 'P = ħc⁶ / (15360π G² M²)', hawkingPower(mountain), 3.57e8, 'W', LOOSE);
  check(
    'Evaporation time of 10¹² kg, photons',
    't = 5120π G²M³ / (ħc⁴)',
    evaporationTime(mountain) / JULIAN_YEAR,
    2.66e12,
    'yr',
    LOOSE,
  );

  /* 7 and 8 — the holes finishing now, and within a second. */
  check(
    'Mass evaporating in the age of the universe, photons',
    'M = (t ħc⁴ / (5120π G²))^(1/3)',
    massEvaporatingIn(AGE_UNIVERSE),
    1.73e11,
    'kg',
    LOOSE,
  );
  check('Mass evaporating in one second, photons', 'M = (t ħc⁴ / (5120π G²))^(1/3)', massEvaporatingIn(1), 2.28e5, 'kg', 0.02);

  /* 9 — the last second, in megatons of TNT. */
  check('Energy of the last second', 'E = M(1 s) c² / 1 Mt', finalSecondEnergy() / MEGATON_TNT, 4.9e6, 'Mt', 0.03);

  /* 10 — what the mountain-mass hole emits. */
  const band = emissionBand(mountain);
  results.push(
    asserted(
      'Emission at 10¹² kg',
      'kT = k T_H against the rest energies',
      `computed "${band}"  ·  expected "plus electrons and positrons"`,
      band === 'plus electrons and positrons',
    ),
  );

  return emit('hawking-radiation checks', results);
}

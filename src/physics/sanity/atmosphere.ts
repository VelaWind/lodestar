/**
 * `verifyAtmosphereModel`, the checks on `../atmosphere.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  GASES,
  gasById,
  jeansParameter,
  retentionVerdict,
} from '../atmosphere';
import {
  M_EARTH,
  M_JUPITER,
  M_MOON,
  R_EARTH,
  R_JUPITER,
  R_MOON,
} from '../constants';
import {
  significant,
  type CheckResult,
  type CheckBlock,
  asserted,
  emit,
} from './core';

/**
 * Cross-validates the atmospheric retention model.
 *
 * Outside the five-check count for the same reason as the rest. Five checks,
 * against bodies whose atmospheres we can look up.
 *
 * Two of them do not say what a first guess would say, and the reasons are the
 * interesting part rather than a fudge:
 *
 *   - Helium on Earth comes out *marginal*, not lost. That is the right answer.
 *     Earth is losing helium continuously, which is why the world has a helium
 *     supply problem, but losing it over geologic time is exactly what the band
 *     between the two thresholds means; rounding it down to "lost" would claim
 *     the atmosphere contains none.
 *   - The Moon comes out able to hold CO2, at a ratio of 6.2 against a threshold
 *     of 6. The Moon is of course airless, and that is not a contradiction: this
 *     criterion covers thermal escape only, and the Moon is airless because
 *     nothing resupplies it and because non-thermal losses, sputtering and
 *     solar-wind pickup, have run for four and a half billion years. So the
 *     check asserts what the criterion is entitled to claim: the Moon cannot
 *     hold the light gases and does not clear the bar for N2 or O2.
 */
export function verifyAtmosphereModel(): CheckBlock {
  const results: CheckResult[] = [];

  /** Every gas ratio at one body, for the detail line. */
  const ratios = (bodyMass: number, radius: number, t: number) =>
    GASES.map(
      (gas) =>
        `GASID ${significant(retentionVerdict(bodyMass, radius, t, gas.mass).ratio)}`.replace(
          'GASID',
          gas.id,
        ),
    ).join('  ·  ');

  const verdictOf = (bodyMass: number, radius: number, t: number, id: string) =>
    retentionVerdict(bodyMass, radius, t, gasById(id).mass);

  /* 1 - Earth at a representative exosphere temperature. */
  const earthT = 1000;
  const earthHolds = ['N2', 'O2', 'CO2'].every(
    (id) => verdictOf(M_EARTH, R_EARTH, earthT, id).verdict === 'retains',
  );
  const earthSheds = ['H2', 'He'].every(
    (id) => verdictOf(M_EARTH, R_EARTH, earthT, id).verdict !== 'retains',
  );
  results.push(
    asserted(
      'Earth holds nitrogen, oxygen and carbon dioxide, and not hydrogen or helium',
      'v_esc / v_th  vs  6 (retains) and 4.5 (loses)',
      `${ratios(M_EARTH, R_EARTH, earthT)}  ·  at T = ${earthT} K  ·  He is ` +
        `${verdictOf(M_EARTH, R_EARTH, earthT, 'He').verdict}: Earth's helium loss is real and ongoing`,
      earthHolds && earthSheds,
    ),
  );

  /* 2 - the Moon, dayside.

     390 K is the dayside surface, and for the Moon that *is* the exobase: with
     no atmosphere above it there is no exosphere to be hotter than the ground.
     The number matters more here than anywhere else in this file, because the
     module's layer 4 quotes the verdict it produces. */
  const moonT = 390;
  const moonSheds = ['H2', 'He', 'H2O'].every(
    (id) => verdictOf(M_MOON, R_MOON, moonT, id).verdict === 'loses',
  );
  const moonNoHeavies = ['N2', 'O2'].every(
    (id) => verdictOf(M_MOON, R_MOON, moonT, id).verdict !== 'retains',
  );
  // The claim the copy makes, asserted rather than left to the detail line.
  const moonKeepsCo2 = verdictOf(M_MOON, R_MOON, moonT, 'CO2').verdict === 'retains';
  results.push(
    asserted(
      'The Moon sheds the light gases, is marginal for N2 and O2, and narrowly keeps CO2',
      'v_esc / v_th  vs  6 (retains) and 4.5 (loses)',
      `${ratios(M_MOON, R_MOON, moonT)}  ·  at T = ${moonT} K, the dayside surface  ·  ` +
        `CO2 sits at ${significant(verdictOf(M_MOON, R_MOON, moonT, 'CO2').ratio)}, just over ` +
        `the threshold: thermal escape is not why the Moon is airless`,
      moonSheds && moonNoHeavies && moonKeepsCo2,
    ),
  );

  /* 3 - Jupiter keeps the lightest gas there is. */
  const jupiter = verdictOf(M_JUPITER, R_JUPITER, 1000, 'H2');
  results.push(
    asserted(
      'Jupiter retains hydrogen',
      'v_esc / v_th  >=  6',
      `ratio ${significant(jupiter.ratio)}  ·  v_esc ` +
        `${significant(jupiter.escapeSpeed / 1000)} km/s  ·  v_th ` +
        `${significant(jupiter.thermalSpeed / 1000)} km/s  ·  verdict ${jupiter.verdict}`,
      jupiter.verdict === 'retains',
    ),
  );

  /* 4 - Titan: small, but cold enough that it does not matter. */
  const titan = verdictOf(1.3452e23, 2.575e6, 150, 'N2');
  results.push(
    asserted(
      'A Titan-sized body at 150 K retains nitrogen',
      'v_esc / v_th  >=  6',
      `ratio ${significant(titan.ratio)}  ·  v_esc ` +
        `${significant(titan.escapeSpeed / 1000)} km/s  ·  v_th ` +
        `${significant(titan.thermalSpeed / 1000)} km/s  ·  cold beats small`,
      titan.verdict === 'retains',
    ),
  );

  /* 5 - the model moves the way the algebra says it must. */
  const light = gasById('H2').mass;
  const heavy = gasById('CO2').mass;
  let monotonicInT = true;
  let monotonicInMass = true;
  for (let t = 100; t <= 2400; t += 100) {
    const hotter = jeansParameter(M_EARTH, R_EARTH, t + 100, light);
    if (!(hotter < jeansParameter(M_EARTH, R_EARTH, t, light))) monotonicInT = false;
    if (!(jeansParameter(M_EARTH, R_EARTH, t, heavy) > jeansParameter(M_EARTH, R_EARTH, t, light))) {
      monotonicInMass = false;
    }
  }
  const lightRatio = retentionVerdict(M_EARTH, R_EARTH, 1000, light).ratio;
  const heavyRatio = retentionVerdict(M_EARTH, R_EARTH, 1000, heavy).ratio;
  results.push(
    asserted(
      'The escape parameter falls with temperature and rises with molecular mass',
      'lambda = G M m / (R k_B T)',
      `24 steps from 100 K to 2500 K  ·  H2 ratio ${significant(lightRatio)} < ` +
        `CO2 ratio ${significant(heavyRatio)}  ·  heavier is held, hotter is lost`,
      monotonicInT && monotonicInMass && lightRatio < heavyRatio,
    ),
  );

  return emit('atmosphere checks', results);
}

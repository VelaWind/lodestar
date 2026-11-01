/**
 * `verifySupernovaModel`, the checks on `../supernova.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  JULIAN_YEAR,
  M_SUN,
  L_SUN,
  M_IA_PEAK,
  M_NS_TYPICAL,
  PARSEC,
  R_NS,
} from '../constants';
import {
  apparentMagnitude,
  collapseEnergy,
  distanceForMagnitude,
  fate,
  MAG_NAKED_EYE,
  mainSequenceLifetime,
  mainSequenceLuminosity,
  remnantMass,
  typeIaPeakLuminosity,
} from '../supernova';
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
 * The supernova module's numbers, against the anchors its prose quotes.
 *
 * The Sun: ten billion years, one solar luminosity, a white dwarf of half a
 * solar mass. The three fates at 1, 10 and 30 M☉. A neutron star's collapse
 * releasing about 3 × 10⁴⁶ J. A Type Ia peaking near 1.6 × 10³⁶ W, reading
 * −19.3 at 10 pc and −13.2 at Betelgeuse's 168 pc, and fading to the naked-eye
 * limit at about 1.15 Mpc.
 */
export function verifySupernovaModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the Sun's lifetime. */
  const lifetime = mainSequenceLifetime(M_SUN) / JULIAN_YEAR / 1e9;
  results.push(
    toleranced(
      'Main-sequence lifetime of the Sun',
      't_MS = 10¹⁰ yr · (M / M☉)^(−2.5)',
      `computed ${significant(lifetime)} Gyr  ·  expected 10 Gyr`,
      relativeError(lifetime, 10),
      TIGHT,
    ),
  );

  /* 2 — the Sun's luminosity. */
  const luminosity = mainSequenceLuminosity(M_SUN) / L_SUN;
  results.push(
    toleranced(
      'Main-sequence luminosity of the Sun',
      'L = L☉ · (M / M☉)^3.5',
      `computed ${significant(luminosity)} L☉  ·  expected 1 L☉`,
      relativeError(luminosity, 1),
      TIGHT,
    ),
  );

  /* 3 — the three fates. */
  const fates = [fate(M_SUN), fate(10 * M_SUN), fate(30 * M_SUN)];
  results.push(
    asserted(
      'Fates at 1, 10 and 30 M☉',
      'cuts at 8 and 20 M☉',
      `computed ${fates.join(', ')}  ·  expected white-dwarf, neutron-star, black-hole`,
      fates.join() === 'white-dwarf,neutron-star,black-hole',
    ),
  );

  /* 4 — the Sun's white dwarf. */
  const remnant = remnantMass(M_SUN) / M_SUN;
  results.push(
    toleranced(
      'White-dwarf mass left by the Sun',
      'M_f = (0.109 M_i/M☉ + 0.394) M☉',
      `computed ${significant(remnant)} M☉  ·  expected 0.503 M☉`,
      relativeError(remnant, 0.503),
      LOOSE,
    ),
  );

  /* 5 — a neutron star's binding energy. */
  const binding = collapseEnergy(M_NS_TYPICAL, R_NS);
  results.push(
    asserted(
      'Binding energy of a 1.4 M☉, 12 km neutron star',
      'E = 3 G M² / (5 R)',
      `computed ${significant(binding)} J  ·  expected 2.3e46 … 2.9e46 J`,
      binding >= 2.3e46 && binding <= 2.9e46,
    ),
  );

  /* 6 — a Type Ia at peak. */
  const peak = typeIaPeakLuminosity();
  results.push(
    toleranced(
      'Type Ia peak luminosity',
      'L = L☉ · 10^(−0.4 (M_Ia − M_bol,☉))',
      `computed ${significant(peak)} W  ·  expected 1.6e36 W`,
      relativeError(peak, 1.6e36),
      0.05,
    ),
  );

  /* 7 — at 10 pc, apparent equals absolute. */
  const at10 = apparentMagnitude(M_IA_PEAK, 10 * PARSEC);
  results.push(
    asserted(
      'Type Ia at 10 pc',
      'm = M + 5 log₁₀(d / 10 pc)',
      `computed ${at10.toFixed(4)}  ·  expected −19.3 ± 0.001`,
      Math.abs(at10 - M_IA_PEAK) <= 0.001,
    ),
  );

  /* 8 — at Betelgeuse's distance. */
  const at168 = apparentMagnitude(M_IA_PEAK, 168 * PARSEC);
  results.push(
    asserted(
      'Type Ia at 168 pc',
      'm = M + 5 log₁₀(d / 10 pc)',
      `computed ${at168.toFixed(3)}  ·  expected −13.2 ± 0.1`,
      Math.abs(at168 - -13.2) <= 0.1,
    ),
  );

  /* 9 — where a Type Ia fades to the naked-eye limit. */
  const nakedEye = distanceForMagnitude(M_IA_PEAK, MAG_NAKED_EYE) / PARSEC / 1e6;
  results.push(
    toleranced(
      'Naked-eye distance for a Type Ia',
      'd = 10 pc · 10^((m − M) / 5)',
      `computed ${significant(nakedEye)} Mpc  ·  expected 1.15 Mpc`,
      relativeError(nakedEye, 1.15),
      0.03,
    ),
  );

  return emit('supernova checks', results);
}

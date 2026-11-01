/**
 * `verifyHabitableModel`, the checks on `../habitable.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  AU,
  M_SUN,
  L_SUN,
  A_EARTH,
  A_MARS,
  A_VENUS,
  SEFF_MAXGH,
  SEFF_MOIST,
} from '../constants';
import {
  equilibriumTemperature,
  massFromLuminosity,
  stellarFlux,
  surfaceTemperatureEarthLike,
  zoneEdge,
  zoneVerdict,
} from '../habitable';
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
 * The habitable-zone model against the figures the module quotes.
 *
 * Earth's flux and temperatures, Venus's and Mars's equilibrium temperatures,
 * the Sun's conservative zone edges, the verdicts for the three planets, and
 * the edge's square-root scaling with luminosity.
 */
export function verifyHabitableModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — the solar constant from L☉. */
  const flux = stellarFlux(L_SUN, AU);
  results.push(
    toleranced(
      'Stellar flux at 1 AU',
      'S = L / (4π d²)',
      `computed ${significant(flux)} W/m²  ·  expected 1361 W/m²`,
      relativeError(flux, 1361),
      0.005,
    ),
  );

  /* 2 — Earth with no atmosphere. */
  const earth = equilibriumTemperature(L_SUN, AU, A_EARTH);
  results.push(
    asserted(
      'Equilibrium temperature of Earth',
      'T_eq = ((1 − A) L / (16 π σ d²))^(1/4)',
      `computed ${significant(earth)} K  ·  expected 255 ± 1 K`,
      Math.abs(earth - 255) <= 1,
    ),
  );

  /* 3 — Earth with its greenhouse. */
  const surface = surfaceTemperatureEarthLike(earth);
  results.push(
    asserted(
      'Surface temperature of Earth',
      'T = T_eq + 33 K',
      `computed ${significant(surface)} K  ·  expected 288 ± 1 K`,
      Math.abs(surface - 288) <= 1,
    ),
  );

  /* 4 — Venus, colder than Earth for all its closeness. */
  const venus = equilibriumTemperature(L_SUN, 0.723 * AU, A_VENUS);
  results.push(
    asserted(
      'Equilibrium temperature of Venus',
      'T_eq at 0.723 AU, A = 0.77',
      `computed ${significant(venus)} K  ·  expected 227 ± 2 K`,
      Math.abs(venus - 227) <= 2,
    ),
  );

  /* 5 — Mars. */
  const mars = equilibriumTemperature(L_SUN, 1.524 * AU, A_MARS);
  results.push(
    asserted(
      'Equilibrium temperature of Mars',
      'T_eq at 1.524 AU, A = 0.25',
      `computed ${significant(mars)} K  ·  expected 210 ± 2 K`,
      Math.abs(mars - 210) <= 2,
    ),
  );

  /* 6 — the Sun's conservative inner edge. */
  const inner = zoneEdge(L_SUN, SEFF_MOIST) / AU;
  results.push(
    toleranced(
      'Inner edge of the Sun’s zone',
      'd = 1 AU · √((L / L☉) / S_eff), S_eff = 1.014',
      `computed ${significant(inner)} AU  ·  expected 0.993 AU`,
      relativeError(inner, 0.993),
      0.005,
    ),
  );

  /* 7 — and its outer edge. */
  const outer = zoneEdge(L_SUN, SEFF_MAXGH) / AU;
  results.push(
    toleranced(
      'Outer edge of the Sun’s zone',
      'd = 1 AU · √((L / L☉) / S_eff), S_eff = 0.343',
      `computed ${significant(outer)} AU  ·  expected 1.707 AU`,
      relativeError(outer, 1.707),
      0.005,
    ),
  );

  /* 8 — the verdicts for Earth, Venus and Mars. */
  const verdicts = [zoneVerdict(L_SUN, AU), zoneVerdict(L_SUN, 0.723 * AU), zoneVerdict(L_SUN, 1.524 * AU)];
  results.push(
    asserted(
      'Verdicts at 1, 0.723 and 1.524 AU',
      'conservative band, then optimistic, then side',
      `computed ${verdicts.join(', ')}  ·  expected inside, too-hot, inside`,
      verdicts.join() === 'inside,too-hot,inside',
    ),
  );

  /* 9 — a star a hundred times fainter: the zone ten times closer. */
  const dim = zoneEdge(0.01 * L_SUN, SEFF_MOIST) / AU;
  results.push(
    toleranced(
      'Inner edge for a 0.01 L☉ star',
      'd ∝ √L',
      `computed ${significant(dim)} AU  ·  expected 0.0993 AU`,
      relativeError(dim, 0.0993),
      0.005,
    ),
  );

  /* 10 — the mass–luminosity rule gives the Sun back exactly. */
  const sunMass = massFromLuminosity(L_SUN) / M_SUN;
  results.push(
    toleranced(
      'Mass of a 1 L☉ star',
      'M = M☉ · (L / L☉)^(1/3.5)',
      `computed ${significant(sunMass)} M☉  ·  expected 1 M☉`,
      relativeError(sunMass, 1),
      1e-9,
    ),
  );

  /* 11 — a red dwarf a hundred times fainter. */
  const dwarfMass = massFromLuminosity(0.01 * L_SUN) / M_SUN;
  results.push(
    asserted(
      'Mass of a 0.01 L☉ star',
      'M = M☉ · (L / L☉)^(1/3.5)',
      `computed ${significant(dwarfMass)} M☉  ·  expected 0.25 … 0.29 M☉`,
      dwarfMass >= 0.25 && dwarfMass <= 0.29,
    ),
  );

  return emit('habitable-zone checks', results);
}

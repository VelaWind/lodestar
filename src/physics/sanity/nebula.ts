/**
 * `verifyNebulaModel`, the checks on `../nebula.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import { JULIAN_YEAR, M_SUN, PARSEC } from '../constants';
import {
  expansionRadius,
  frontThickness,
  ionizedMass,
  recombinationTime,
  stromgrenRadius,
} from '../nebula';
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
 * The H II region model against the figures the module quotes.
 *
 * The worked example's Strömgren radius, Orion's core, the ionized mass,
 * the recombination time, the front's thickness, and Spitzer's expansion at
 * the start and after a million years.
 */
export function verifyNebulaModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — an O7 star in diffuse gas. */
  const diffuse = stromgrenRadius(1e49, 1e8) / PARSEC;
  results.push(
    toleranced(
      'Strömgren radius, 1e49 s⁻¹ in 1e8 m⁻³',
      'R_S = (3 Q / (4π n² α_B))^(1/3)',
      `computed ${significant(diffuse)} pc  ·  expected 3.15 pc`,
      relativeError(diffuse, 3.15),
      0.02,
    ),
  );

  /* 2 — the same star in Orion's core. */
  const core = stromgrenRadius(1e49, 1e10) / PARSEC;
  results.push(
    toleranced(
      'Strömgren radius, 1e49 s⁻¹ in 1e10 m⁻³',
      'R_S ∝ n^(−2/3)',
      `computed ${significant(core)} pc  ·  expected 0.146 pc`,
      relativeError(core, 0.146),
      0.02,
    ),
  );

  /* 3 — the gas it lights. */
  const mass = ionizedMass(stromgrenRadius(1e49, 1e8), 1e8) / M_SUN;
  results.push(
    asserted(
      'Ionized mass, 1e49 s⁻¹ in 1e8 m⁻³',
      'M = (4/3) π R³ n m_p',
      `computed ${significant(mass)} M☉  ·  expected 300 … 350 M☉`,
      mass >= 300 && mass <= 350,
    ),
  );

  /* 4 — how fast it would fade. */
  const fade = recombinationTime(1e8) / JULIAN_YEAR;
  results.push(
    toleranced(
      'Recombination time at 1e8 m⁻³',
      't_rec = 1 / (n α_B)',
      `computed ${significant(fade)} yr  ·  expected 1220 yr`,
      relativeError(fade, 1220),
      0.03,
    ),
  );

  /* 5 — how sharp the edge is. */
  const front = frontThickness(1e8);
  results.push(
    asserted(
      'Ionization-front thickness at 1e8 m⁻³',
      'ℓ = 1 / (n σ)',
      `computed ${significant(front)} m  ·  expected 1e13 … 2e13 m`,
      front >= 1e13 && front <= 2e13,
    ),
  );

  /* 6 — Spitzer's law starts at the Strömgren radius. */
  const R = 3.15 * PARSEC;
  const start = expansionRadius(R, 0);
  results.push(
    asserted(
      'Spitzer expansion at t = 0',
      'R(0) = R_S',
      `computed ${start === R ? 'R exactly' : significant(start / PARSEC) + ' pc'}  ·  expected R exactly`,
      start === R,
    ),
  );

  /* 7 — and triples it in a million years. */
  const later = expansionRadius(R, 1e6 * JULIAN_YEAR) / PARSEC;
  results.push(
    toleranced(
      'Spitzer expansion of 3.15 pc at 1 Myr',
      'R(t) = R_S (1 + 7 c_s t / (4 R_S))^(4/7)',
      `computed ${significant(later)} pc  ·  expected 9.3 pc`,
      relativeError(later, 9.3),
      0.03,
    ),
  );

  return emit('nebula checks', results);
}

/**
 * `verifyWormholeModel`, the checks on `../wormhole.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  M_JUPITER,
  M_SUN,
  NUCLEAR_DENSITY,
  PROTON_RADIUS,
} from '../constants';
import {
  casimirDensity,
  casimirGapForThroat,
  embeddingHeight,
  exoticMass,
  throatDensity,
} from '../wormhole';
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
 * The wormhole model against the figures the module quotes.
 *
 * The exotic mass of a one-metre throat, in kilograms and in Jupiters, and of
 * a kilometre throat in Suns; the density at a one-metre throat, and against
 * nuclear density; the Casimir density at a micron; the plate gap that
 * matches the throat, in metres and in proton radii, with the round trip back
 * through casimirDensity; and the embedding surface at the throat and at two
 * throat radii.
 */
export function verifyWormholeModel(): CheckBlock {
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

  /* 1 to 3 — the negative mass, at one metre and one kilometre. */
  check('Exotic mass of a one-metre throat', 'M = −(π/2) c² b₀ / G', exoticMass(1), -2.12e27, 'kg', LOOSE);
  check('Exotic mass of a one-metre throat, in Jupiters', 'M / M_J', exoticMass(1) / M_JUPITER, -1.11, '', LOOSE);
  check('Exotic mass of a one-kilometre throat, in Suns', 'M / M☉', exoticMass(1000) / M_SUN, -1.06, '', LOOSE);

  /* 4 and 5 — the density at a one-metre throat. */
  check('Throat density at one metre', 'ρ = −c² / (8π G b₀²)', throatDensity(1), -5.36e25, 'kg/m³', LOOSE);
  check('Throat density at one metre, against nuclear density', 'ρ / ρ_nuc', throatDensity(1) / NUCLEAR_DENSITY, -2.3e8, '', 0.03);

  /* 6 — the Casimir density at a micron. */
  check('Casimir density at 1 µm', 'ρ = −π² ħ / (720 c a⁴)', casimirDensity(1e-6), -4.82e-21, 'kg/m³', LOOSE);

  /* 7 to 9 — the plate gap that matches a one-metre throat. */
  const gap = casimirGapForThroat(1);
  check('Casimir gap matching a one-metre throat', 'a = (8π³ ħ G b₀² / (720 c³))^(1/4)', gap, 3.08e-18, 'm', 0.02);
  const protons = gap / PROTON_RADIUS;
  results.push(
    asserted(
      'Casimir gap in proton radii',
      'a / r_p within [0.003, 0.005]',
      `computed ${significant(protons)}  ·  expected between 0.003 and 0.005`,
      protons >= 0.003 && protons <= 0.005,
    ),
  );
  const roundTrip = casimirDensity(gap) / throatDensity(1);
  results.push(
    asserted(
      'Casimir density at that gap equals the throat density',
      'ρ_Casimir(a) / ρ(b₀) = 1',
      `computed ${roundTrip.toPrecision(12)}  ·  expected 1 ± 1e-9`,
      Math.abs(roundTrip - 1) <= 1e-9,
    ),
  );

  /* 10 and 11 — the embedding surface. */
  const atThroat = embeddingHeight(1, 1);
  results.push(
    asserted(
      'Embedding height at the throat',
      'z = b₀ arccosh(r / b₀), r = b₀',
      `computed ${atThroat}  ·  expected exactly 0`,
      atThroat === 0,
    ),
  );
  check('Embedding height at two throat radii', 'z = b₀ arccosh(2)', embeddingHeight(2, 1), 1.317, 'b₀', TIGHT);

  return emit('wormhole checks', results);
}

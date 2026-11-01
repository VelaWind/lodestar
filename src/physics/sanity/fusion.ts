/**
 * `verifyFusionModel`, the checks on `../fusion.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  EV,
  RHO_SUN_CORE,
  T_SUN_CORE,
  X_SUN_CORE,
} from '../constants';
import {
  PP_BARRIER,
  PP_GAMOW_ENERGY,
  boltzmannFraction,
  gamowPeak,
  gamowWindowWidth,
  ppEnergyRate,
  temperatureExponent,
  tunnellingProbability,
} from '../fusion';
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
 * The fusion module's numbers, against its layer-5 worked example.
 *
 * Two protons: a Gamow energy of 493 keV and a Coulomb barrier of 1.03 MeV at
 * 1.4 fm. The Sun's centre: a Gamow peak near 6.1 keV and 6.6 keV wide, where a
 * collision tunnels about one time in ten thousand and about one proton in a
 * hundred has the energy; a pp rate of order 10⁻³ W/kg, rising as about T⁴.
 * Ranges where the target is an order of magnitude, tolerances where the
 * worked example quotes a figure.
 */
export function verifyFusionModel(): CheckBlock {
  const results: CheckResult[] = [];
  const within = (x: number, lo: number, hi: number) => x >= lo && x <= hi;
  const keV = (joules: number) => joules / EV / 1e3;

  /* 1 — the Gamow energy for two protons. */
  results.push(
    toleranced(
      'Gamow energy, p + p',
      'E_G = 2 m_r c² (π α Z₁Z₂)²,  m_r = m_p / 2',
      `computed ${significant(keV(PP_GAMOW_ENERGY))} keV  ·  expected 493 keV`,
      relativeError(keV(PP_GAMOW_ENERGY), 493),
      0.01,
    ),
  );

  /* 2 — the Coulomb barrier at the edge of the nuclear well. */
  results.push(
    toleranced(
      'Coulomb barrier, p + p at 1.4 fm',
      'V = Z₁Z₂e² / (4π ε₀ r)',
      `computed ${significant(keV(PP_BARRIER) / 1e3)} MeV  ·  expected 1.03 MeV`,
      relativeError(keV(PP_BARRIER) / 1e3, 1.03),
      0.01,
    ),
  );

  /* 3 — the Gamow peak at the Sun's centre. */
  const peak = gamowPeak(PP_GAMOW_ENERGY, T_SUN_CORE);
  results.push(
    toleranced(
      'Gamow peak at the solar core',
      'E₀ = (E_G (kT)² / 4)^(1/3)',
      `computed ${significant(keV(peak))} keV  ·  expected 6.1 keV`,
      relativeError(keV(peak), 6.1),
      0.03,
    ),
  );

  /* 4 — tunnelling at that peak. */
  const tunnel = tunnellingProbability(PP_GAMOW_ENERGY, peak);
  results.push(
    asserted(
      'Tunnelling probability at the Gamow peak',
      'P = exp(−√(E_G / E₀))',
      `computed ${significant(tunnel)}  ·  expected 1.0e-4 … 1.5e-4`,
      within(tunnel, 1.0e-4, 1.5e-4),
    ),
  );

  /* 5 — the Boltzmann factor at that peak. */
  const boltzmann = boltzmannFraction(peak, T_SUN_CORE);
  results.push(
    asserted(
      'Boltzmann factor at the Gamow peak',
      'f = exp(−E₀ / kT)',
      `computed ${significant(boltzmann)}  ·  expected 0.009 … 0.013`,
      within(boltzmann, 0.009, 0.013),
    ),
  );

  /* 6 — the width of the window. */
  const width = gamowWindowWidth(peak, T_SUN_CORE);
  results.push(
    toleranced(
      'Gamow window width at the solar core',
      'Δ = 4 √(E₀ kT / 3)',
      `computed ${significant(keV(width))} keV  ·  expected 6.6 keV`,
      relativeError(keV(width), 6.6),
      0.05,
    ),
  );

  /* 7 — the pp rate at the centre. */
  const rate = ppEnergyRate(RHO_SUN_CORE, X_SUN_CORE, T_SUN_CORE);
  results.push(
    asserted(
      'pp energy rate at the solar core',
      'ε = 0.241 ρ X² T₆^(−2/3) exp(−33.80 T₆^(−1/3))',
      `computed ${significant(rate)} W/kg  ·  expected 3e-4 … 3e-2 W/kg`,
      within(rate, 3e-4, 3e-2),
    ),
  );

  /* 8 — its temperature sensitivity. */
  const nu = temperatureExponent(T_SUN_CORE);
  results.push(
    asserted(
      'Temperature exponent of the pp rate',
      'ν = −2/3 + (33.80 / 3) T₆^(−1/3)',
      `computed ${significant(nu)}  ·  expected 3.5 … 4.5`,
      within(nu, 3.5, 4.5),
    ),
  );

  return emit('fusion checks', results);
}

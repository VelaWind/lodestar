/**
 * `verifyDarkMatterModel`, the checks on `../darkmatter.ts`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  G,
  H0_PLANCK_2018,
  JULIAN_YEAR,
  M_SUN,
  OMEGA_M,
  HALO_CORE_RADIUS,
  HALO_V_INF_DEFAULT,
  KILOPARSEC,
  MW_BARYONIC_MASS,
  MW_DISC_SCALE_LENGTH,
  OMEGA_B_H2,
  OMEGA_C_H2,
  R0_GALACTIC,
  V_CIRC_SUN,
  ZWICKY_1933_FACTOR,
  ZWICKY_1933_H0,
} from '../constants';
import {
  besselI0,
  besselI1,
  besselK0,
  besselK1,
  cosmicDarkFraction,
  cosmicDarkToBaryon,
  densityParameter,
  discMassWithin,
  discSpeed,
  dynamicalMass,
  haloSpeed,
  markerReadout,
  orbitalPeriod,
  rotationCurve,
} from '../darkmatter';
import {
  TIGHT,
  relativeError,
  significant,
  type CheckResult,
  type CheckBlock,
  toleranced,
  asserted,
  emit,
} from './core';

/**
 * The dark-matter model against the figures the module quotes.
 *
 * The modified Bessel functions the Freeman disc needs, at four arguments,
 * against 30-digit values from mpmath (which agree with Abramowitz & Stegun,
 * Table 9.8, to every digit printed there). The disc's peak at 2.15 scale
 * lengths and its Keplerian fall-off far out (Freeman 1970); the halo's approach
 * to its asymptotic speed. At the Milky Way-like defaults (Bland-Hawthorn &
 * Gerhard 2016's 6.3 × 10¹⁰ M☉ and 2.6 kpc; the tuned halo), the speed at the
 * Sun's radius (GRAVITY 2021) against Eilers et al. 2019's 229 km/s; the Sun's
 * period and the mass a 229 km/s orbit implies. Planck 2018's dark and ordinary
 * matter shares, reconciled with `OMEGA_M` the cosmology modules use. Zwicky's
 * factor with a modern Hubble constant (van den Bergh 1999). And two orderings
 * the prose depends on.
 */
export function verifyDarkMatterModel(): CheckBlock {
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
  const BESSEL = 1e-9;

  /* 1 to 4 — the Bessel functions, one per function, both branches of K. */
  check('I₀(1)', 'Σ (x²/4)ᵏ / (k!)²', besselI0(1), 1.26606587775201, '', BESSEL);
  check('I₁(2.5)', '(x/2) Σ (x²/4)ᵏ / (k!(k+1)!)', besselI1(2.5), 2.5167162452887, '', BESSEL);
  check('K₀(1), series branch', '−(ln(x/2)+γ) I₀ + Σ Hₖ (x²/4)ᵏ/(k!)²', besselK0(1), 0.421024438240708, '', BESSEL);
  check('K₁(5), integral branch', '∫ exp(−x cosh t) cosh t dt', besselK1(5), 0.00404461344545216, '', BESSEL);

  /* 5 and 6 — the disc's shape: its peak, and Kepler far outside it. */
  const Md = MW_BARYONIC_MASS;
  const Rd = MW_DISC_SCALE_LENGTH;
  let peakAt = 0;
  let peak = 0;
  for (let x = 0.5; x <= 4; x += 0.0005) {
    const v = discSpeed(x * Rd, Md, Rd);
    if (v > peak) {
      peak = v;
      peakAt = x;
    }
  }
  check('Freeman disc peak, in scale lengths', 'max of v(R), R/R_d', peakAt, 2.15, 'R_d', 0.005);
  const far = 60 * Rd;
  check('Disc speed far out, against Kepler', 'v(60 R_d) / √(GM/R)', discSpeed(far, Md, Rd) / Math.sqrt((G * Md) / far), 1, '', 0.001);

  /* 7 — the halo flattens to its asymptotic speed. */
  check(
    'Halo speed at 1000 core radii, against v_∞',
    'v_h = v_∞ √(1 − (r_c/r) arctan(r/r_c))',
    haloSpeed(1000 * HALO_CORE_RADIUS, HALO_V_INF_DEFAULT) / HALO_V_INF_DEFAULT,
    1,
    '',
    0.001,
  );

  /* 8 — the tuned defaults at the Sun's radius. */
  const galaxy = { M: Md, Rd, vInf: HALO_V_INF_DEFAULT };
  const atSun = rotationCurve(R0_GALACTIC, galaxy);
  check(
    'Circular speed at the Sun, defaults, against Eilers et al. 2019',
    'v = √(v_disc² + v_halo²) at R₀ = 8.275 kpc',
    atSun.total / 1e3,
    V_CIRC_SUN / 1e3,
    'km/s',
    0.05,
  );

  /* 9 and 10 — the Sun's orbit at the measured speed. */
  check(
    'The Sun’s orbital period at 229 km/s and 8.275 kpc',
    'T = 2πR₀ / v',
    orbitalPeriod(R0_GALACTIC, V_CIRC_SUN) / (1e6 * JULIAN_YEAR),
    222.0,
    'Myr',
    0.005,
  );
  check(
    'Mass inside the Sun’s orbit, spherical estimate',
    'M = v² R₀ / G',
    dynamicalMass(R0_GALACTIC, V_CIRC_SUN) / M_SUN,
    1.009e11,
    'M☉',
    0.005,
  );

  /* 11 to 14 — Planck 2018's matter budget. */
  check('Dark matter over ordinary matter, Planck 2018', 'Ω_c h² / Ω_b h²', cosmicDarkToBaryon(), 5.364, '', TIGHT);
  check('Dark matter’s share of all matter', 'Ω_c h² / (Ω_c h² + Ω_b h²)', cosmicDarkFraction(), 0.8429, '', TIGHT);
  check('Ω_c, with H₀ = 67.4 km/s/Mpc', 'Ω_c = Ω_c h² / h²', densityParameter(OMEGA_C_H2, H0_PLANCK_2018), 0.2642, '', TIGHT);
  const omegaCB = densityParameter(OMEGA_C_H2 + OMEGA_B_H2, H0_PLANCK_2018);
  check('Ω_c + Ω_b against the cosmology modules’ Ω_m (the rest is neutrinos)', 'Ω_c + Ω_b ≈ Ω_m', omegaCB, OMEGA_M, '', 0.01);

  /* 15 — Zwicky's factor with today's Hubble constant. */
  check(
    'Zwicky’s 1933 factor rescaled to a modern H₀',
    '400 × H₀ / 558 km/s/Mpc',
    (ZWICKY_1933_FACTOR * H0_PLANCK_2018) / ZWICKY_1933_H0,
    48.3,
    '',
    0.005,
  );

  /* 16 and 17 — orderings the prose depends on. */
  const discAlone = discSpeed(R0_GALACTIC, Md, Rd);
  const sphereSame = Math.sqrt((G * discMassWithin(R0_GALACTIC, Md, Rd)) / R0_GALACTIC);
  results.push(
    asserted(
      'At the Sun, the disc orbits faster than a sphere of the same enclosed mass would make it',
      'v_disc(R₀) > √(G M_disc(<R₀) / R₀)',
      `computed ${significant(discAlone / 1e3)} km/s against ${significant(sphereSame / 1e3)} km/s`,
      discAlone > sphereSame,
    ),
  );
  const outer = markerReadout(25 * KILOPARSEC, galaxy);
  results.push(
    asserted(
      'At 25 kpc the visible matter alone gives under two-thirds of the speed with the halo',
      'v_disc(25 kpc) < ⅔ v_total(25 kpc)',
      `computed ${significant(outer.visibleOnly / 1e3)} km/s against ${significant(outer.withHalo / 1e3)} km/s`,
      outer.visibleOnly < (2 / 3) * outer.withHalo,
    ),
  );

  return emit('dark-matter checks', results);
}

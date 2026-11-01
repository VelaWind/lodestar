/**
 * `verifyCmbModel`.
 * Moved unchanged from the single `sanity.ts`; see `./index.ts`.
 */
import {
  C,
  T_CMB,
  V_SUN_CMB,
  Z_RECOMBINATION,
} from '../constants';
import {
  cmbTemperatureAtRedshift,
  dipoleAmplitude,
  photonNumberDensity,
  planckSpectralRadiance,
  planckSpectralRadianceWavelength,
  redshiftAtTemperature,
  wienPeakWavelength,
} from '../cosmology';
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
 * The microwave background module's numbers, against its layer-5 worked
 * example and the published measurements behind it.
 *
 * Today's sky: Wien's peak at 1.063 mm, a 3.362 mK dipole at the Solar
 * System's 369.82 km/s, 411 photons per cubic centimetre, and a B_ν peak of
 * about 384 MJy/sr near 160 GHz. Last scattering: 2973 K at z_*. Both forms of
 * Planck's law are checked against each other, because the sim plots one and
 * the readout quotes the other.
 */
export function verifyCmbModel(): CheckBlock {
  const results: CheckResult[] = [];

  /* 1 — Wien's peak today. */
  const peak = wienPeakWavelength(T_CMB);
  results.push(
    toleranced(
      'Wien peak wavelength at T₀',
      'λ_peak = b / T',
      `computed ${significant(peak * 1e3)} mm  ·  expected 1.063 mm`,
      relativeError(peak, 1.063e-3),
      TIGHT,
    ),
  );

  /* 2 — B_ν near its peak today. */
  const bnu = planckSpectralRadiance(1.602e11, T_CMB);
  results.push(
    toleranced(
      'B_ν at 160.2 GHz, T₀',
      'B_ν = (2hν³/c²) / expm1(hν/kT)',
      `computed ${significant(bnu)} W m⁻² Hz⁻¹ sr⁻¹  ·  expected 3.84e-18`,
      relativeError(bnu, 3.84e-18),
      LOOSE,
    ),
  );

  /* 3 — B_λ at Wien's peak today. */
  const blam = planckSpectralRadianceWavelength(1.063e-3, T_CMB);
  results.push(
    toleranced(
      'B_λ at 1.063 mm, T₀',
      'B_λ = (2hc²/λ⁵) / expm1(hc/λkT)',
      `computed ${significant(blam)} W m⁻³ sr⁻¹  ·  expected 6.17e-4`,
      relativeError(blam, 6.17e-4),
      LOOSE,
    ),
  );

  /* 4 — the two forms agree: B_ν(c/λ) = B_λ(λ) · λ² / c. */
  const cases: [number, number][] = [
    [1e-3, T_CMB],
    [1e-6, 3000],
  ];
  const worst = Math.max(
    ...cases.map(([lambda, T]) => {
      const perFrequency = planckSpectralRadiance(C / lambda, T);
      const perWavelength = (planckSpectralRadianceWavelength(lambda, T) * lambda ** 2) / C;
      return Math.abs(relativeError(perFrequency, perWavelength));
    }),
  );
  results.push(
    asserted(
      'B_ν and B_λ agree',
      'B_ν(c/λ) = B_λ(λ) · λ² / c',
      `worst relative difference ${worst.toExponential(2)} at (1 mm, T₀) and (1 µm, 3000 K)  ·  limit 1e-9`,
      worst <= 1e-9,
    ),
  );

  /* 5 — the kinematic dipole. */
  const dipole = dipoleAmplitude(T_CMB, V_SUN_CMB);
  results.push(
    toleranced(
      'Dipole amplitude at 369.82 km/s',
      'ΔT = T v / c',
      `computed ${significant(dipole * 1e3)} mK  ·  expected 3.362 mK`,
      relativeError(dipole, 3.362e-3),
      TIGHT,
    ),
  );

  /* 6 — photons per cubic metre. */
  const n = photonNumberDensity(T_CMB);
  results.push(
    toleranced(
      'Photon number density at T₀',
      'n_γ = 16π ζ(3) (kT / hc)³',
      `computed ${significant(n)} m⁻³  ·  expected 4.11e8 m⁻³`,
      relativeError(n, 4.11e8),
      0.005,
    ),
  );

  /* 7 — the temperature at last scattering. */
  const tStar = cmbTemperatureAtRedshift(Z_RECOMBINATION);
  results.push(
    toleranced(
      'Temperature at z_*',
      'T = T₀ (1 + z)',
      `computed ${significant(tStar)} K  ·  expected 2973 K`,
      relativeError(tStar, 2973),
      TIGHT,
    ),
  );

  /* 8 — a temperature colder than today has no redshift. */
  const throwsAt = (T: number) => {
    try {
      redshiftAtTemperature(T);
      return false;
    } catch {
      return true;
    }
  };
  const refuses = throwsAt(T_CMB * 0.999) && throwsAt(0) && !throwsAt(T_CMB);
  results.push(
    asserted(
      'redshiftAtTemperature throws below T₀',
      'T < T₀  ⇒  RangeError',
      `0.999 T₀ and 0 K ${refuses ? 'rejected' : 'NOT both rejected'}; T₀ accepted`,
      refuses,
    ),
  );

  /* 9 — both forms survive the far radio end, where hν ≪ kT. */
  const radioNu = planckSpectralRadiance(C / 1, T_CMB);
  const radioLambda = planckSpectralRadianceWavelength(1, T_CMB);
  const healthy = (x: number) => Number.isFinite(x) && x > 0;
  results.push(
    asserted(
      'Planck functions finite and positive at λ = 1 m, T₀',
      'expm1 keeps the Rayleigh–Jeans tail',
      `B_ν = ${significant(radioNu)}  ·  B_λ = ${significant(radioLambda)}`,
      healthy(radioNu) && healthy(radioLambda),
    ),
  );

  return emit('microwave background checks', results);
}

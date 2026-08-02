/**
 * Thermal escape of a planetary atmosphere. SI base units throughout: kilograms,
 * metres and kelvin in; metres per second, a dimensionless ratio, and a verdict
 * out.
 *
 * The escape velocity is not recomputed here. It comes from `escape.ts`, which
 * the escape-velocity module already runs on and the sanity suite already checks
 * against Earth's 11.19 km/s — so a retention verdict is wrong only if that
 * threshold is wrong everywhere.
 *
 * What this file models, stated plainly, is a rule of thumb. It compares two
 * speeds and reports which is larger by how much. Real Jeans escape is a flux,
 * computed at the exobase, and it depends *exponentially* on the escape
 * parameter — so a planet does not switch from keeping a gas to losing it at a
 * threshold, it loses it a thousand times faster per unit of λ. The criterion
 * below is the standard pedagogical stand-in for that exponential, and the
 * module says so beside the simulation.
 *
 * Each formula appears in standard physics form directly above its
 * implementation so the two are visibly the same thing.
 */
import { AMU, K_B } from './constants';
import { vEsc } from './escape';

/**
 *     v_th = √(2 k_B T / m)
 *
 * Most probable speed in a Maxwell–Boltzmann distribution at temperature `T`,
 * m/s — the peak of the curve, not its mean (which is larger by √(4/π)) and not
 * its root-mean-square (larger by √(3/2)). Which of the three is used matters:
 * the retention criterion below is quoted against this one.
 *
 * @param t temperature, K
 * @param m mass of one molecule, kg
 */
export function mostProbableSpeed(t: number, m: number): number {
  if (!(t > 0) || !(m > 0)) return NaN;
  return Math.sqrt((2 * K_B * t) / m);
}

/**
 *     f(v) = 4π (m / 2π k_B T)^(3/2) · v² · exp(−m v² / 2 k_B T)
 *
 * Maxwell–Boltzmann speed distribution, normalised so that ∫f(v)dv over all
 * speeds is 1. The v² in front is why the curve leaves the origin at zero rather
 * than starting at its maximum: there are few ways to be nearly motionless and
 * many ways to move at a given speed in some direction.
 *
 * @param v speed, m/s
 * @param t temperature, K
 * @param m mass of one molecule, kg
 */
export function maxwellBoltzmannPdf(v: number, t: number, m: number): number {
  if (!(v >= 0) || !(t > 0) || !(m > 0)) return NaN;
  const a = m / (2 * Math.PI * K_B * t);
  return 4 * Math.PI * a ** 1.5 * v ** 2 * Math.exp((-m * v ** 2) / (2 * K_B * t));
}

/**
 *     λ_esc = (v_esc / v_th)² = G M m / (R k_B T)
 *
 * The escape parameter: the ratio of a molecule's gravitational binding energy
 * to its thermal energy, dimensionless. The two forms are identical because
 * v_esc² = 2GM/R and v_th² = 2k_BT/m, and the factors of two cancel.
 *
 * This is the number the real theory is written in — Jeans flux carries a factor
 * e^(−λ), so λ = 15 and λ = 30 are not two points on a line but two different
 * worlds.
 *
 * @param bodyMass planet mass, kg
 * @param radius planet radius, m
 * @param t temperature, K
 * @param m mass of one molecule, kg
 */
export function jeansParameter(bodyMass: number, radius: number, t: number, m: number): number {
  const escape = vEsc(bodyMass, radius);
  const thermal = mostProbableSpeed(t, m);
  if (!(escape > 0) || !(thermal > 0)) return NaN;
  return (escape / thermal) ** 2;
}

export type Retention = 'retains' | 'marginal' | 'loses';

/**
 * The classic rule of thumb: a body holds a gas over geologic time when its
 * escape velocity is roughly six times the gas's most probable speed.
 *
 *     v_esc / v_th ≳ 6   →  retained over billions of years
 *     v_esc / v_th ≲ 4.5 →  gone
 *
 * The factor six is not derived; it is the round number that comes out of asking
 * how far into the exponential tail you have to go before the trickle of
 * molecules above escape speed adds up to an atmosphere over the age of the
 * Solar System. Catling & Kasting, *Atmospheric Evolution on Inhabited and
 * Lifeless Worlds*, ch. 5, gives the criterion and the reasoning; texts quoting
 * a factor of five are using the root-mean-square speed instead of this one.
 *
 * The band between 4.5 and 6 is where the rule stops being useful and the real
 * answer depends on the exobase temperature, the solar cycle, and four billion
 * years of history — so it is reported as its own verdict rather than rounded to
 * one side. Helium on Earth sits there, and Earth is indeed losing it.
 */
export interface RetentionResult {
  /** v_esc / v_th, dimensionless. */
  ratio: number;
  verdict: Retention;
  escapeSpeed: number;
  thermalSpeed: number;
}

export const RETAINS_ABOVE = 6;
export const LOSES_BELOW = 4.5;

export function retentionVerdict(
  bodyMass: number,
  radius: number,
  t: number,
  m: number,
): RetentionResult {
  const escapeSpeed = vEsc(bodyMass, radius);
  const thermalSpeed = mostProbableSpeed(t, m);
  const ratio = escapeSpeed / thermalSpeed;

  const verdict: Retention = !Number.isFinite(ratio)
    ? 'loses'
    : ratio >= RETAINS_ABOVE
      ? 'retains'
      : ratio >= LOSES_BELOW
        ? 'marginal'
        : 'loses';

  return { ratio, verdict, escapeSpeed, thermalSpeed };
}

/* ------------------------------------------------------------------ */
/* Gases                                                               */
/* ------------------------------------------------------------------ */

export interface Gas {
  id: string;
  /** How it reads on a chip. */
  label: string;
  /** Molecular mass, kg. */
  mass: number;
  /** Relative molecular mass, for the label — the number that does the work. */
  amu: number;
}

/**
 * The six that decide what an atmosphere is made of, lightest first.
 *
 * Masses are written as a multiple of `AMU` with the relative molecular mass
 * visible, because that number is the whole argument: hydrogen escapes and
 * carbon dioxide does not for no reason other than 2.016 against 44.009.
 *
 * Relative molecular masses from the standard atomic weights (IUPAC 2021),
 * summed for each molecule.
 */
export const GASES: Gas[] = [
  { id: 'H2', label: 'H₂', amu: 2.016, mass: 2.016 * AMU },
  { id: 'He', label: 'He', amu: 4.0026, mass: 4.0026 * AMU },
  { id: 'H2O', label: 'H₂O', amu: 18.015, mass: 18.015 * AMU },
  { id: 'N2', label: 'N₂', amu: 28.014, mass: 28.014 * AMU },
  { id: 'O2', label: 'O₂', amu: 31.998, mass: 31.998 * AMU },
  { id: 'CO2', label: 'CO₂', amu: 44.009, mass: 44.009 * AMU },
];

export function gasById(id: string): Gas {
  return GASES.find((gas) => gas.id === id) ?? (GASES[0] as Gas);
}

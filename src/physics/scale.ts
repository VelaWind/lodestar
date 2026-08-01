/**
 * Scale-ladder physics. SI base units throughout: metres in, seconds out.
 *
 * Two functions, both one line, both deliberately trivial. They are here rather
 * than inline in the sim for the same reason `escape.ts` and `kepler.ts` are:
 * every readout, every label and every sanity check reads the same function, so
 * the number on the screen and the number in the check cannot drift apart.
 *
 * One departure from the rest of `physics/`: this file also carries the display
 * helper for a light travel time. The formatting *is* the hard part of this
 * particular readout — the answer spans yoctoseconds to billions of years, and a
 * ladder that picks the wrong unit is exactly the failure the physics-accuracy
 * skill warns about — and the spec for this module calls for one shared source
 * for the readout rather than a copy in each consumer. The two concerns are kept
 * in separate sections below; nothing in the display section may be used to
 * compute, and nothing in the computation section formats.
 */
import { C } from './constants';

/* ------------------------------- computation ------------------------------- */

/**
 *     t = d / c
 *
 * Time for light to cross a distance `d`, in seconds. The distance is a
 * *proper* distance here: for the cosmological rungs of the ladder this is the
 * light travel time across a comoving separation as measured today, not the
 * lookback time of a photon that actually made the trip through an expanding
 * universe. Those differ, and the module says so beside the sim.
 *
 * @param d distance, m
 */
export function lightTravelTime(d: number): number {
  if (!Number.isFinite(d) || d < 0) return NaN;
  return d / C;
}

/**
 *     n = log₁₀(b / a)
 *
 * Orders of magnitude from `a` to `b`. Positive when `b` is the larger. Both
 * arguments must be strictly positive — a log ladder has no zero rung.
 */
export function decadesBetween(a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return NaN;
  return Math.log10(b / a);
}

/* --------------------------------- display --------------------------------- */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

const MINUTE = 60;
const HOUR = 3_600;
const DAY = 86_400;
/** Julian year, s — the same definition `constants.ts` uses for LIGHT_YEAR. */
const YEAR = 3.155_76e7;

/**
 * Sub-second SI prefixes, smallest first. `limit` is the upper bound of each
 * band: a duration lands in the first band it fits under, so 3.5 × 10⁻¹⁹ s is
 * read out in zeptoseconds rather than as an unreadable string of zeros.
 */
const SUBSECOND: { limit: number; factor: number; unit: string }[] = [
  { limit: 1e-21, factor: 1e24, unit: 'ys' },
  { limit: 1e-18, factor: 1e21, unit: 'zs' },
  { limit: 1e-15, factor: 1e18, unit: 'as' },
  { limit: 1e-12, factor: 1e15, unit: 'fs' },
  { limit: 1e-9, factor: 1e12, unit: 'ps' },
  { limit: 1e-6, factor: 1e9, unit: 'ns' },
  { limit: 1e-3, factor: 1e6, unit: 'µs' },
  { limit: 1, factor: 1e3, unit: 'ms' },
];

/**
 * A light travel time in the largest unit that keeps the number human, rounded
 * before it reaches the screen. Seconds in, string out.
 *
 * The ladder spans forty-two decades, so no single unit works: a proton is
 * 5.6 ys across and the observable universe is 93 billion years across. Named
 * units are used wherever one exists, per the skill; the only scientific
 * notation left is below a yoctosecond, where the SI prefixes run out.
 */
export function formatLightTravelTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds === 0) return '0 s';

  if (seconds < 1e-24) {
    const exp = Math.floor(Math.log10(seconds));
    return `${(seconds / 10 ** exp).toFixed(2)} × 10^${exp} s`;
  }

  for (const band of SUBSECOND) {
    if (seconds < band.limit) return `${SIG3.format(seconds * band.factor)} ${band.unit}`;
  }

  if (seconds < 2 * MINUTE) return `${SIG3.format(seconds)} s`;
  if (seconds < 2 * HOUR) return `${SIG3.format(seconds / MINUTE)} min`;
  if (seconds < 2 * DAY) return `${SIG3.format(seconds / HOUR)} hours`;
  if (seconds < 2 * YEAR) return `${SIG3.format(seconds / DAY)} days`;

  const years = seconds / YEAR;
  if (years >= 1e9) return `${SIG3.format(years / 1e9)} billion years`;
  if (years >= 1e6) return `${SIG3.format(years / 1e6)} million years`;
  return `${SIG3.format(years)} years`;
}

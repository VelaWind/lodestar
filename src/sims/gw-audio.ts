/**
 * The chirp sonification's schedule, as data.
 *
 * A sonification, not a recording: a sine oscillator tracking the wave's own
 * frequency and amplitude. Gravitational waves are not sound, and there is
 * nothing to hear where they come from — what makes this honest rather than
 * decorative is that the frequencies are the true ones, unshifted, and a
 * stellar-mass inspiral happens to sweep through the range a human ear covers.
 *
 * This file exists so that claim is testable. The sim hands these two curves
 * straight to `setValueCurveAtTime` and the audio tests render them into a
 * waveform and measure it, so what is asserted is what plays. Building the
 * curves inside the component would have left the audio the one part of the
 * site verified only by watching a node get created.
 */
import { fOfTimeToMerger, strainAmplitude, timeToMerger } from '@/physics/gw';

/** The bottom of human hearing, Hz. */
export const AUDIBLE_FLOOR_HZ = 20;

/** The top, and the Nyquist limit of any sane sample rate, Hz. */
export const AUDIBLE_CEILING_HZ = 20_000;

/** Longest stretch of inspiral to sonify, s. */
export const AUDIO_MAX_S = 6;

/** Frequency a ground-based detector's band effectively opens at, Hz. */
export const BAND_ENTRY_HZ = 30;

/** Peak gain. Well below 1: this plays on a single click, without warning. */
export const AUDIO_GAIN = 0.22;

/** Points in the scheduled automation curves. */
export const CURVE_POINTS = 512;

/**
 * Fraction of the sweep spent ramping in, and again ramping out — the first of
 * the two rules in `fadeSeconds`, and the one that governs short sweeps.
 *
 * Without a fade the oscillator starts and stops at full amplitude and the edges
 * click — a discontinuity of a tenth of full scale in one sample, which is
 * audible as a tick and measurable as a sample-to-sample delta far above
 * anything a sine at these frequencies can produce.
 */
export const FADE_FRACTION = 0.03;

/**
 * Ceiling on that ramp, s.
 *
 * A fraction alone scales the wrong way. A fade only has to be long enough that
 * the edge is not a step, which is a fixed number of milliseconds, but a
 * fraction makes it proportional to the sweep — so the six-second neutron-star
 * chirp was fading out over 180 ms, and strain climbs as τ^(-1/4), so those
 * 180 ms are where almost all of the amplitude climb happens. The fade was
 * removing the climax it was there to protect.
 */
export const FADE_MAX_S = 0.01;

/**
 * Seconds of ramp at each edge of a sweep of this length.
 *
 * The fraction still governs anything short enough that 10 ms would be a
 * noticeable slice of it — the default binary's quarter-second chirp fades over
 * 7.6 ms, unchanged — and the ceiling governs everything longer.
 */
export function fadeSeconds(duration: number): number {
  return Math.min(FADE_MAX_S, FADE_FRACTION * duration);
}

/** Just enough of the drawn window for the sonification to be planned from it. */
export interface ChirpWindow {
  /** Time to merger at the cutoff, s. */
  tauEnd: number;
  /** Length of the drawn window, s. */
  duration: number;
  /** Frequency at the cutoff, Hz. */
  fEnd: number;
}

export interface AudioPlan {
  /** Time to merger where the sonification starts, s. */
  tauStart: number;
  tauEnd: number;
  duration: number;
  fStart: number;
  fEnd: number;
  /** True when part of the true band lies below the audible floor. */
  clamped: boolean;
}

/**
 * What to play: the last `AUDIO_MAX_S` of inspiral before the cutoff, or the
 * stretch from the detector band's entry frequency if that is shorter — for the
 * default binary that is 0.25 s, which is the real length of the GW150914 chirp.
 * Very heavy pairs reach their cutoff below the band entry, so the drawn window
 * is the floor.
 */
export function audioPlanFor(mc: number, win: ChirpWindow): AudioPlan {
  const fromBandEntry = timeToMerger(mc, BAND_ENTRY_HZ) - win.tauEnd;
  const duration = Math.max(win.duration, Math.min(AUDIO_MAX_S, fromBandEntry));
  const tauStart = win.tauEnd + duration;
  const fStart = fOfTimeToMerger(mc, tauStart);
  return {
    tauStart,
    tauEnd: win.tauEnd,
    duration,
    fStart,
    fEnd: win.fEnd,
    clamped: fStart < AUDIBLE_FLOOR_HZ,
  };
}

export interface ChirpCurves {
  /** Seconds from the start of the sweep at each point. Strictly increasing. */
  times: Float64Array;
  /** Oscillator frequency at each point, Hz. */
  frequencies: Float64Array;
  /** Gain at each point, 0 to `AUDIO_GAIN`. */
  gains: Float64Array;
}

/**
 * When the schedule is sampled — the answer to "where do the points go".
 *
 * Not evenly. A binary's frequency runs as τ^(-3/8), so a sweep spends most of
 * its length crossing its first octave and covers the last one in milliseconds.
 * Spacing 512 points evenly in time therefore puts almost all of them where
 * nothing is happening and leaves one segment to cover the end: on the
 * neutron-star sweep the final even segment was 11.7 ms long and the true
 * frequency crossed it from 678 Hz to 1570 Hz, which a straight line between two
 * points cannot follow. The last cycles played 8.3% sharp.
 *
 * So the points are geometric in time-to-merger instead: τ falls by the same
 * *ratio* at every step. Because f ∝ τ^(-3/8), that is the same thing as
 * geometric in frequency — every segment spans the same musical interval, which
 * is the spacing a pitch sweep wants, and the resolution follows the sweep's
 * steepness automatically. On the neutron stars it is 0.62% per step end to
 * end (about 11 cents); on the default binary, 0.16%.
 *
 * The one exception is the first point. Geometric spacing is sparse where τ is
 * large, and on a six-second sweep the opening step would be 98 ms — longer than
 * the fade-in it has to describe, which would silently stretch a 10 ms fade into
 * a 98 ms one. So point 0 opens the sweep, point 1 closes the fade-in, and the
 * remaining 510 are geometric from there. A linear fade needs exactly two points
 * and gets exactly two; the frequency it costs is a 0.06% linear span across an
 * interval where the sweep is at its flattest.
 */
function gridTimes(plan: AudioPlan, fade: number): Float64Array {
  const times = new Float64Array(CURVE_POINTS);
  const last = CURVE_POINTS - 1;
  const tauFade = plan.tauStart - fade;
  const ratio = plan.tauEnd / tauFade;

  times[0] = 0;
  for (let i = 1; i < last; i += 1) {
    times[i] = plan.tauStart - tauFade * ratio ** ((i - 1) / (last - 1));
  }
  // Written rather than computed: the sweep has to end exactly where the
  // oscillator is stopped, and `tauStart - tauEnd` is only `duration` to within
  // a float.
  times[last] = plan.duration;

  return times;
}

/**
 * The schedule: a time, a frequency and a gain at each of `CURVE_POINTS` points.
 *
 * Read as a piecewise-linear function of time — the sim plays it as a chain of
 * `linearRampToValueAtTime`, and `sampleAt` below is the same reading of it.
 *
 * Ramps rather than `setValueCurveAtTime`, which was what this used to be: a
 * curve's points are pinned to *evenly spaced* times by the spec, so a curve
 * cannot express the spacing `gridTimes` chooses. The interpolation either way
 * is linear between neighbouring points, so nothing about how a segment is read
 * has changed — only where the segments start and end.
 *
 * @param plan what to play, from `audioPlanFor`
 * @param mc   chirp mass, kg
 * @param d    luminosity distance, m
 */
export function chirpCurves(plan: AudioPlan, mc: number, d: number): ChirpCurves {
  const frequencies = new Float64Array(CURVE_POINTS);
  const gains = new Float64Array(CURVE_POINTS);
  const fade = fadeSeconds(plan.duration);
  const times = gridTimes(plan, fade);

  /* Pass one: the envelope in its own units — strain, with the fades applied.
     Nothing is scaled yet, so the shape here is the physics and only that. */
  let loudest = 0;
  for (let i = 0; i < CURVE_POINTS; i += 1) {
    const t = times[i] ?? 0;
    const tau = Math.max(plan.tauEnd, plan.tauStart - t);
    const f = fOfTimeToMerger(mc, tau);
    // Clamped, not transposed: below the audible floor the pitch stops falling
    // rather than being shifted, so every frequency you can hear is the real
    // one. The note beside the button says when that has happened.
    frequencies[i] = Math.min(AUDIBLE_CEILING_HZ, Math.max(AUDIBLE_FLOOR_HZ, f));
    const ramp = Math.min(1, t / fade, (plan.duration - t) / fade);
    const envelope = strainAmplitude(mc, f, d) * Math.max(0, ramp);
    gains[i] = envelope;
    if (envelope > loudest) loudest = envelope;
  }

  /* Pass two: one number, applied to every point, putting the sweep's loudest
     moment on the gain ceiling.

     The divisor is the envelope's own maximum, not the strain at the cutoff.
     Those are the same thing only when the fade-out is short against the time
     still to run at the cutoff, and for a neutron-star pair it is not: the
     cutoff is 1.4 ms from merger, a 10 ms fade-out reaches back to eight times
     that, and dividing by the cutoff strain therefore left the loudest thing
     that ever plays at 59% of the ceiling. That was an artifact of the choice of
     divisor rather than anything about the source.

     Nothing about the sweep's own dynamics moves: this is a single factor across
     all 512 points, so the strain-law swell and both fades keep their shape
     exactly. Nor does it discard information — the level was never a physical
     quantity. Every render was already normalised by a number that depends on
     the binary and the distance, so loudness has never encoded strain, and the
     readouts are where the amplitude is actually reported.

     The maximum is taken over the schedule's own points rather than solved for
     analytically, and that is the stronger of the two. What plays is the linear
     interpolation between these points, and a piecewise-linear function takes
     its maximum at one of its nodes — so this is not an estimate of the played
     peak that could fall between samples and under-resolve it, it is the played
     peak. The continuous envelope does rise slightly higher, at the corner where
     the fade-out begins, but that corner is not on the schedule and never
     reaches the ear; normalising by it would leave the sweep a shade under the
     ceiling for no reason a listener could hear. */
  const scale = loudest > 0 ? AUDIO_GAIN / loudest : 0;
  for (let i = 0; i < CURVE_POINTS; i += 1) gains[i] = (gains[i] ?? 0) * scale;

  return { times, frequencies, gains };
}

/**
 * The schedule read at a time, the way Web Audio reads it.
 *
 * `linearRampToValueAtTime` interpolates linearly from the previous scheduled
 * point to this one, so anything rendering this offline has to do the same or it
 * is measuring a different signal from the one that plays. The points are no
 * longer evenly spaced, so finding the segment is a search rather than a
 * multiplication.
 *
 * @param times   the schedule's own time grid, seconds, strictly increasing
 * @param values  frequencies or gains, one per time
 * @param seconds where to read, seconds from the start of the sweep
 */
export function sampleAt(times: Float64Array, values: Float64Array, seconds: number): number {
  const last = times.length - 1;
  if (last < 0) return 0;
  if (!(seconds > (times[0] ?? 0))) return values[0] ?? 0;
  if (seconds >= (times[last] ?? 0)) return values[last] ?? 0;

  let lower = 0;
  let upper = last;
  while (upper - lower > 1) {
    const middle = (lower + upper) >> 1;
    if ((times[middle] ?? 0) <= seconds) lower = middle;
    else upper = middle;
  }

  const from = times[lower] ?? 0;
  const span = (times[upper] ?? 0) - from;
  const a = values[lower] ?? 0;
  const b = values[upper] ?? a;
  return span > 0 ? a + (b - a) * ((seconds - from) / span) : a;
}

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
 * Fraction of the sweep spent ramping in, and again ramping out.
 *
 * Without it the oscillator starts and stops at full amplitude and the edges
 * click — a discontinuity of a tenth of full scale in one sample, which is
 * audible as a tick and measurable as a sample-to-sample delta far above
 * anything a sine at these frequencies can produce.
 */
export const FADE_FRACTION = 0.03;

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
  /** Oscillator frequency at each curve point, Hz. */
  frequencies: Float32Array;
  /** Gain at each curve point, 0 to `AUDIO_GAIN`. */
  gains: Float32Array;
}

/**
 * The two automation curves, sampled evenly across the plan's duration.
 *
 * Both are read by `setValueCurveAtTime`, which interpolates linearly between
 * adjacent points over the duration — so a curve is a piecewise-linear function
 * of time, and `sampleCurve` below is the same reading of it.
 *
 * @param plan what to play, from `audioPlanFor`
 * @param mc   chirp mass, kg
 * @param d    luminosity distance, m
 */
export function chirpCurves(plan: AudioPlan, mc: number, d: number): ChirpCurves {
  const frequencies = new Float32Array(CURVE_POINTS);
  const gains = new Float32Array(CURVE_POINTS);
  const peak = strainAmplitude(mc, plan.fEnd, d);

  for (let i = 0; i < CURVE_POINTS; i += 1) {
    const fraction = i / (CURVE_POINTS - 1);
    const tau = Math.max(plan.tauEnd, plan.tauStart - fraction * plan.duration);
    const f = fOfTimeToMerger(mc, tau);
    // Clamped, not transposed: below the audible floor the pitch stops falling
    // rather than being shifted, so every frequency you can hear is the real
    // one. The note beside the button says when that has happened.
    frequencies[i] = Math.min(AUDIBLE_CEILING_HZ, Math.max(AUDIBLE_FLOOR_HZ, f));
    const fade = Math.min(1, fraction / FADE_FRACTION, (1 - fraction) / FADE_FRACTION);
    gains[i] = AUDIO_GAIN * (strainAmplitude(mc, f, d) / peak) * Math.max(0, fade);
  }

  return { frequencies, gains };
}

/**
 * A curve read at a fraction of its duration, the way Web Audio reads it.
 *
 * The spec has `setValueCurveAtTime` interpolate linearly between the two
 * nearest points, so anything rendering these curves offline has to do the same
 * or it is measuring a different signal from the one that plays.
 */
export function sampleCurve(curve: Float32Array, fraction: number): number {
  const last = curve.length - 1;
  const position = Math.min(last, Math.max(0, fraction * last));
  const lower = Math.floor(position);
  const upper = Math.min(last, lower + 1);
  const between = position - lower;
  const a = curve[lower] ?? 0;
  const b = curve[upper] ?? a;
  return a + (b - a) * between;
}

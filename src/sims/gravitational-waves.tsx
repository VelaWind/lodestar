/**
 * Gravitational waves — the last cycles of an inspiral, drawn and heard.
 *
 * The chirp is the content: frequency and amplitude climbing together, faster
 * and faster, until the model runs out at the innermost stable circular orbit.
 * So the trace sweeps rather than appearing, and there is a button to hear it.
 *
 * No physics lives in this file. Every number comes from `@/physics/gw`, which
 * the math layer and the sanity checks also read — per the physics-accuracy
 * skill, the sim's calculation and the displayed equation must be one shared
 * function or they will drift. This file owns pixels, playback timing, audio
 * scheduling and formatting only.
 *
 * Rendering notes, matching the other sims:
 *   - The rAF loop never touches React state. It mutates `sceneRef` and draws;
 *     React re-renders only when playback starts or stops.
 *   - The waveform is sampled once per parameter change or resize, not per
 *     frame; a frame is then pure canvas work.
 *   - Under `prefers-reduced-motion` there is no loop at all: the complete trace
 *     is drawn in one pass, which is the same information without the sweep.
 *   - Audio is never created without a user gesture, and is torn down on unmount
 *     and on any parameter change.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { M_SUN } from '@/physics/constants';
import {
  chirpMass,
  fCutoff,
  fOfTimeToMerger,
  strainAmplitude,
  strainAt,
  timeToMerger,
} from '@/physics/gw';
import {
  AUDIBLE_FLOOR_HZ,
  BAND_ENTRY_HZ,
  audioPlanFor,
  chirpCurves,
} from '@/sims/gw-audio';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** "1.63 × 10⁻²¹" — strain has no named unit and no human-scale reading. */
function scientific(value: number, digits = 3): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  const places = Math.max(0, digits - 1);
  // Rounding the mantissa can carry it to 10; renormalise, as `lib/format.ts` does.
  if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
  const glyphs = String(exp)
    .split('')
    .map((ch) => SUPERSCRIPT[ch] ?? ch)
    .join('');
  return `${(value / 10 ** exp).toFixed(places)} × 10${glyphs}`;
}

/** Seconds → ms below a second, s above. Rounded before it reaches the screen. */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 1) return `${SIG3.format(seconds * 1e3)} ms`;
  if (seconds < 120) return `${SIG3.format(seconds)} s`;
  return `${SIG3.format(seconds / 60)} min`;
}

function formatFrequency(hz: number): string {
  return Number.isFinite(hz) ? `${SIG3.format(hz)} Hz` : '—';
}

/**
 * Centred text, nudged inward when it would cross the edge of the frame — the
 * same guard the black-holes sim uses, for the same reason: an axis label at the
 * end of a phone-width canvas otherwise draws off it.
 */
function fillTextClamped(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  left: number,
  right: number,
): void {
  const half = ctx.measureText(text).width / 2;
  const lo = left + half;
  const hi = right - half;
  ctx.fillText(text, hi >= lo ? Math.min(hi, Math.max(lo, cx)) : (left + right) / 2, y);
}

/* ------------------------------------------------------------------ */
/* The drawn window                                                    */
/* ------------------------------------------------------------------ */

/**
 * The trace covers the final octave of gravitational-wave frequency: from half
 * the cutoff frequency up to the cutoff itself.
 *
 * That choice is scale-free, and not by accident. The number of wave cycles in
 * an octave depends only on the product M_c·f, and f_cut ∝ 1/M while M_c ∝ M, so
 * the product — and the cycle count — is the same for every binary the sliders
 * can build: 7.7 cycles, from a pair of neutron stars to a pair of 100 M_☉
 * holes. The window's *duration* varies by two orders of magnitude across that
 * range; the picture does not. A fixed-duration window would show eight legible
 * cycles at one setting and a solid block of ink at another.
 */
const OCTAVE = 2;

interface TraceWindow {
  /** Time to merger at the left edge of the trace, s. */
  tauStart: number;
  /** Time to merger at the right edge — the cutoff, s. */
  tauEnd: number;
  /** tauStart − tauEnd, s. */
  duration: number;
  /** Strain amplitude at the cutoff — the peak of the drawn trace. */
  peak: number;
  fStart: number;
  fEnd: number;
}

function windowFor(mc: number, d: number, cutoff: number): TraceWindow | null {
  if (!(mc > 0) || !(d > 0) || !(cutoff > 0)) return null;
  const tauEnd = timeToMerger(mc, cutoff);
  const tauStart = timeToMerger(mc, cutoff / OCTAVE);
  const duration = tauStart - tauEnd;
  if (!(duration > 0)) return null;
  return {
    tauStart,
    tauEnd,
    duration,
    peak: strainAmplitude(mc, cutoff, d),
    fStart: cutoff / OCTAVE,
    fEnd: cutoff,
  };
}

/**
 * Slow-motion factors offered, smallest first. The default chirp's last octave
 * really does take 175 ms, which is a flicker; the ladder picks the smallest
 * factor that stretches the window past `TARGET_PLAYBACK_S`, so playback is
 * watchable at every slider setting and the factor chosen is shown on screen.
 */
const SLOWMO_LADDER = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const TARGET_PLAYBACK_S = 3.5;

function slowFactorFor(duration: number): number {
  return (
    SLOWMO_LADDER.find((factor) => duration * factor >= TARGET_PLAYBACK_S) ??
    SLOWMO_LADDER[SLOWMO_LADDER.length - 1]!
  );
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#767f93',
  edge: '#232b3b',
  star: '#9db4ff',
  ember: '#e8bd7d',
};

const TAU_2PI = 2 * Math.PI;
/** `left` is a floor; the real gutter is measured from the strain labels. */
const PAD = { left: 46, right: 12, top: 18, bottom: 34, gutterGap: 10 };
/** Samples per horizontal pixel. Six is enough that a cycle never aliases. */
const OVERSAMPLE = 6;
const MAX_SAMPLES = 5000;

/** The waveform sampled across the window, in strain — resolution, not pixels. */
interface Samples {
  count: number;
  strain: Float64Array;
  envelope: Float64Array;
}

function sampleWindow(mc: number, d: number, win: TraceWindow, count: number): Samples {
  const strain = new Float64Array(count);
  const envelope = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const tau = win.tauStart - (i / (count - 1)) * win.duration;
    strain[i] = strainAt(mc, d, tau);
    envelope[i] = strainAmplitude(mc, fOfTimeToMerger(mc, tau), d);
  }
  return { count, strain, envelope };
}

interface Scene {
  mc: number;
  d: number;
  window: TraceWindow;
  /** 0 → 1 across the trace. 1 when settled or under reduced motion. */
  progress: number;
  /** Rebuilt only when the sample count changes, i.e. on resize. */
  samples: Samples | null;
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene): void {
  ctx.clearRect(0, 0, w, h);
  const win = scene.window;

  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';

  // Measured gutter: the strain labels are "+1.6 × 10⁻²¹"-shaped, and a fixed
  // one would clip them exactly as the escape-velocity axis used to.
  const peakLabel = `+${scientific(win.peak, 2)}`;
  const gutter = Math.ceil(ctx.measureText(peakLabel).width) + PAD.gutterGap;
  const left = Math.max(PAD.left, gutter);
  const right = w - PAD.right;
  const top = PAD.top;
  const bottom = h - PAD.bottom;
  const plotW = right - left;
  const plotH = bottom - top;
  if (plotW <= 0 || plotH <= 0 || !(win.peak > 0)) return;

  const midY = (top + bottom) / 2;
  const yFor = (strain: number) => midY - (strain / win.peak) * (plotH / 2) * 0.92;
  const tauAt = (fraction: number) => win.tauStart - fraction * win.duration;

  const wanted = Math.min(MAX_SAMPLES, Math.max(120, Math.round(plotW * OVERSAMPLE)));
  if (!scene.samples || scene.samples.count !== wanted) {
    scene.samples = sampleWindow(scene.mc, scene.d, win, wanted);
  }
  const { count, strain, envelope } = scene.samples;
  const xAt = (i: number) => left + (i / (count - 1)) * plotW;

  /* --- strain axis --- */
  ctx.textAlign = 'right';
  ctx.lineWidth = 1;
  for (const level of [1, 0, -1]) {
    const y = yFor(level * win.peak);
    ctx.strokeStyle = level === 0 ? 'rgba(107,116,136,0.28)' : 'rgba(107,116,136,0.14)';
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.inkFaint;
    ctx.fillText(
      level === 0 ? '0' : `${level > 0 ? '+' : '−'}${scientific(win.peak, 2)}`,
      left - 6,
      y,
    );
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.inkFaint;
  ctx.fillText('strain h', left, top - 8);

  /* --- envelope: ±A(t), the amplitude the cycles ride inside --- */
  ctx.fillStyle = 'rgba(157,180,255,0.10)';
  ctx.beginPath();
  for (let i = 0; i < count; i += 1) {
    const x = xAt(i);
    const y = yFor(envelope[i]!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = count - 1; i >= 0; i -= 1) ctx.lineTo(xAt(i), yFor(-envelope[i]!));
  ctx.closePath();
  ctx.fill();

  /* --- the waveform --- */
  const drawn = Math.max(1, Math.round(scene.progress * (count - 1)));
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= drawn; i += 1) {
    const x = xAt(i);
    const y = yFor(strain[i]!);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  /* --- the leading edge, while the sweep is running --- */
  if (scene.progress < 1) {
    const x = xAt(drawn);
    const tau = tauAt(drawn / (count - 1));

    ctx.strokeStyle = 'rgba(232,189,125,0.35)';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    ctx.fillStyle = COLORS.ember;
    ctx.beginPath();
    ctx.arc(x, yFor(strain[drawn]!), 3, 0, TAU_2PI);
    ctx.fill();

    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    fillTextClamped(ctx, formatFrequency(fOfTimeToMerger(scene.mc, tau)), x, top - 8, left, right);
    ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  }

  /* --- time axis: labelled by how long is left, so zero is the cutoff --- */
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.inkFaint;
  for (let i = 0; i <= 4; i += 1) {
    const fraction = i / 4;
    const remaining = tauAt(fraction) - win.tauEnd;
    fillTextClamped(
      ctx,
      i === 4 ? 'cutoff' : `−${formatDuration(remaining)}`,
      left + fraction * plotW,
      bottom + 12,
      left,
      right,
    );
  }
  ctx.fillStyle = COLORS.inkFaint;
  fillTextClamped(ctx, 'time to merger', (left + right) / 2, bottom + 26, left, right);
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

/**
 * The schedule itself lives in `@/sims/gw-audio`, so the audio tests can render
 * the same two curves this component hands to the oscillator and measure the
 * waveform they produce. What is asserted there is what plays here.
 */
const AUDIO_SUPPORTED = typeof globalThis.AudioContext !== 'undefined';

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function GravitationalWavesSim({ params, values }: SimProps) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; osc: OscillatorNode } | null>(null);
  const autoPlayedRef = useRef(false);

  const m1 = readParam(params, values, 'm1');
  const m2 = readParam(params, values, 'm2');
  const d = readParam(params, values, 'd');

  const [sweeping, setSweeping] = useState(false);
  const [hearing, setHearing] = useState(false);

  // Derived once per render, never per frame. The canvas, the readouts and the
  // audio all read these same values.
  const mc = useMemo(() => chirpMass(m1, m2), [m1, m2]);
  const cutoff = useMemo(() => fCutoff(m1, m2), [m1, m2]);
  const win = useMemo(() => windowFor(mc, d, cutoff), [mc, d, cutoff]);
  const plan = useMemo(() => (win ? audioPlanFor(mc, win) : null), [mc, win]);
  const tauFrom30 = useMemo(() => timeToMerger(mc, BAND_ENTRY_HZ), [mc]);
  const slowFactor = win ? slowFactorFor(win.duration) : 1;

  /** Paints the current scene at the canvas's current size. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // DPR-aware: back the canvas with device pixels, draw in CSS pixels.
    const dpr = window.devicePixelRatio || 1;
    const wantW = Math.round(rect.width * dpr);
    const wantH = Math.round(rect.height * dpr);
    if (canvas.width !== wantW || canvas.height !== wantH) {
      canvas.width = wantW;
      canvas.height = wantH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, rect.width, rect.height, scene);
  }, []);

  const sweep = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const playbackMs = scene.window.duration * slowFactorFor(scene.window.duration) * 1000;
    const started = performance.now();
    scene.progress = 0;
    setSweeping(true);
    paint();

    const tick = (now: number) => {
      const live = sceneRef.current;
      if (!live) return;
      live.progress = Math.min(1, (now - started) / playbackMs);
      paint();
      if (live.progress >= 1) {
        rafRef.current = null;
        setSweeping(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [paint]);

  /* Rebuild on any parameter change. A trace drawn for one mass while the
     slider says another is exactly the kind of quiet lie this project avoids.
     At rest the whole trace is shown; the sweep is a replay of it, not the only
     way to see it, so a reader who never presses the button misses nothing. */
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sceneRef.current = win ? { mc, d, window: win, progress: 1, samples: null } : null;
    setSweeping(false);
    paint();

    // One sweep on first load, so the chirp is seen happening rather than found.
    // Not on every parameter change: that would restart the animation under a
    // reader's finger as they drag a slider.
    if (!reduced && !autoPlayedRef.current && win) {
      autoPlayedRef.current = true;
      sweep();
    }
  }, [mc, d, win, reduced, paint, sweep]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  /* Never leave a loop running past unmount. */
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /* ---------------------------------- audio --------------------------------- */

  const stopAudio = useCallback(() => {
    const live = audioRef.current;
    if (!live) return;
    audioRef.current = null;
    live.osc.onended = null;
    try {
      live.osc.stop();
    } catch {
      // Already finished on its own schedule; closing the context is the part
      // that matters, and an AudioContext left open holds an audio device.
    }
    void live.ctx.close();
    setHearing(false);
  }, []);

  /* Torn down on unmount, and whenever the binary changes underneath it. */
  useEffect(() => stopAudio, [stopAudio]);
  useEffect(() => {
    stopAudio();
  }, [m1, m2, d, stopAudio]);

  /**
   * Created inside the click handler, never before: browsers only allow an
   * AudioContext to start from a user gesture, and building one on mount would
   * leave a suspended context behind on every page view.
   */
  const hear = useCallback(() => {
    if (!AUDIO_SUPPORTED || !plan || !(plan.duration > 0)) return;
    if (audioRef.current) {
      stopAudio();
      return;
    }

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    const { frequencies, gains } = chirpCurves(plan, mc, d);

    const t0 = ctx.currentTime + 0.05;
    osc.frequency.setValueCurveAtTime(frequencies, t0, plan.duration);
    gain.gain.setValueCurveAtTime(gains, t0, plan.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + plan.duration);
    osc.onended = () => stopAudio();

    audioRef.current = { ctx, osc };
    setHearing(true);
  }, [d, mc, plan, stopAudio]);

  return (
    <div className="flex min-h-[20rem] flex-col gap-4">
      <div className="relative h-[18rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="The strain waveform of an inspiral’s last cycles before merger, frequency and amplitude climbing together into the cutoff."
          aria-describedby="gravitational-waves-readouts"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-ui text-[0.7rem] text-ink-faint">
        {!reduced && (
          <button
            type="button"
            onClick={sweep}
            disabled={!win}
            className="rounded-md border border-edge bg-void-500 px-4 py-2 text-xs text-ink transition-colors hover:border-star/50 hover:text-star disabled:opacity-40"
          >
            {sweeping ? 'Sweeping…' : 'Replay the chirp'}
          </button>
        )}
        {AUDIO_SUPPORTED && (
          <button
            type="button"
            onClick={hear}
            disabled={!plan}
            className="rounded-md border border-edge bg-void-500 px-4 py-2 text-xs text-ink transition-colors hover:border-star/50 hover:text-star disabled:opacity-40"
          >
            {hearing ? 'Stop' : 'Hear it'}
          </button>
        )}
        {win && (
          <span className="min-w-0">
            last {formatDuration(win.duration)} of the inspiral —{' '}
            {reduced ? 'drawn complete' : `swept at 1/${slowFactor} speed`}
          </span>
        )}
      </div>

      <dl id="gravitational-waves-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label="chirp mass" value={`${SIG3.format(mc / M_SUN)} M☉`} />
        <Readout label="frequency at cutoff" value={formatFrequency(cutoff)} />
        <Readout label="peak strain here" value={scientific(win ? win.peak : NaN)} />
        <Readout label="from 30 Hz to merger" value={formatDuration(tauFrom30)} />
      </dl>

      {AUDIO_SUPPORTED && plan && (
        <p className="font-ui text-[0.75rem] leading-relaxed text-ink-faint">
          The sound is this binary’s own frequency, unshifted —{' '}
          {formatFrequency(Math.max(plan.fStart, AUDIBLE_FLOOR_HZ))} to{' '}
          {formatFrequency(plan.fEnd)} over {formatDuration(plan.duration)}.{' '}
          {plan.clamped && (
            <>
              Part of that sweep runs below about 20 Hz, under human hearing; those frequencies are
              held at 20 Hz rather than transposed up.{' '}
            </>
          )}
          It is a sonification, not a recording: a gravitational wave is a stretching of space, not
          a sound, and there is nothing to hear where it comes from.
        </p>
      )}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums text-ember">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Test surface                                                        */
/* ------------------------------------------------------------------ */

/**
 * Internals exposed for `tests/canvas.test.ts`, and for nothing else.
 *
 * The canvas tests replay this file's drawing against a recording context at
 * every width the shell can produce and at each parameter's extremes, checking
 * that no label lands outside the frame and that no coordinate goes non-finite.
 * That needs the drawing function and the trace window a scene is built around.
 *
 * They are exported behind one deliberately ugly name rather than individually,
 * so the module's real surface stays what it has always been - a default export
 * taking SimProps - and so nobody imports them by accident.
 */
export const __internals = { drawScene, windowFor };

/**
 * Escape velocity — radial ballistic launch.
 *
 * Drag the launch speed past √(2GM/R) and the projectile stops coming back.
 * That threshold is the entire point of the module, so the sim is built around
 * making it visible: below it you get an apex and a fall, at or above it the
 * projectile leaves the top of the frame.
 *
 * No physics lives in this file. Every number comes from `@/physics/escape`,
 * which the math layer also reads — per the physics-accuracy skill, the sim's
 * calculation and the displayed equation must be one shared function or they
 * will drift. This file owns pixels, playback timing, and formatting only.
 *
 * Rendering notes:
 *   - The rAF loop never touches React state. It mutates `sceneRef` and draws;
 *     React re-renders only when the flight phase changes (four times a flight
 *     at most). Param values arrive as props from the shell, so there is no
 *     per-frame store subscription.
 *   - Under `prefers-reduced-motion` there is no loop at all: launching draws
 *     the complete trajectory in one pass with the apex marked.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { apexAltitude, integrateFlight, timestepFor, vEsc } from '@/physics/escape';
import type { Flight } from '@/physics/escape';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const KM = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const KMS = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

/** Altitude in metres → a rounded, unit-named string. */
function formatAltitude(metres: number): string {
  if (!Number.isFinite(metres)) return '∞';
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${KM.format(metres / 1000)} km`;
}

/** Speed in m/s → km/s, the natural unit at this scale. */
function formatSpeed(mps: number): string {
  if (!Number.isFinite(mps)) return '—';
  return `${KMS.format(mps / 1000)} km/s`;
}

/* ------------------------------------------------------------------ */
/* Altitude axis                                                       */
/* ------------------------------------------------------------------ */

/**
 * A hybrid altitude axis: linear near the surface, log above.
 *
 * A pure log axis crushes the surface region — a 100 km hop off Earth would sit
 * in the bottom two pixels. A pure linear axis crushes everything else: at a
 * scale that shows a 10⁶ km escape, that same hop is invisible. The linear
 * region gets the bottom `linearFraction` of the frame and covers altitudes up
 * to R/50 (127 km for Earth, so low-orbit altitudes read); the log region takes
 * the rest.
 *
 * This is a real distortion of the picture, disclosed in the approximations
 * panel and annotated on the axis itself.
 */
interface Axis {
  /** Top of the linear region, m. */
  hLinear: number;
  /** Altitude at the top of the frame, m. */
  hTop: number;
  /** Share of the drawable height given to the linear region. */
  linearFraction: number;
  hasLog: boolean;
}

const LINEAR_FRACTION = 0.28;

/**
 * Ceiling on the frame, in body radii. ~637 000 km for Earth: far enough that
 * leaving the top is unambiguous.
 *
 * Suborbital flights are capped too, not just escaping ones. Just below the
 * threshold the apex diverges — at 99.99% of v_esc it is millions of body radii
 * up — and framing that honestly would mean integrating a flight that takes
 * years. The cap keeps the picture and the integration bounded; the true apex
 * is still reported in the readout, and the status line says the apex is above
 * the frame rather than pretending the projectile escaped.
 */
const CEILING_RADII = 100;

function makeAxis(R: number, apex: number, escaping: boolean): Axis {
  const hLinear = R / 50;
  const ceiling = R * CEILING_RADII;

  if (escaping) {
    return { hLinear, hTop: ceiling, linearFraction: LINEAR_FRACTION, hasLog: true };
  }

  // Leave headroom above the apex; never collapse to a zero-height axis, never
  // exceed the ceiling. `Math.min` also absorbs a non-finite apex.
  const target = Math.min(Math.max(apex * 1.15, R / 1000), ceiling);
  if (target <= hLinear) {
    // The whole flight fits in the near-surface regime; no log region needed.
    return { hLinear: target, hTop: target, linearFraction: 1, hasLog: false };
  }
  return { hLinear, hTop: target, linearFraction: LINEAR_FRACTION, hasLog: true };
}

/** Altitude (m) → fraction of the drawable height, 0 at the surface. */
function axisFrac(axis: Axis, h: number): number {
  if (!(h > 0)) return 0;
  if (!axis.hasLog) return Math.min(1, h / axis.hTop);
  if (h <= axis.hLinear) return axis.linearFraction * (h / axis.hLinear);

  // Guarded: hLinear > 0 and hTop > hLinear on this branch, so both logs are
  // taken of strictly positive arguments.
  const span = Math.log10(axis.hTop / axis.hLinear);
  if (!(span > 0)) return axis.linearFraction;
  const into = Math.log10(h / axis.hLinear) / span;
  return Math.min(1, axis.linearFraction + (1 - axis.linearFraction) * into);
}

interface Tick {
  h: number;
  boundary: boolean;
}

function axisTicks(axis: Axis): Tick[] {
  const ticks: Tick[] = [{ h: 0, boundary: false }];

  if (!axis.hasLog) {
    for (let i = 1; i <= 4; i += 1) ticks.push({ h: (axis.hTop * i) / 4, boundary: false });
    return ticks;
  }

  ticks.push({ h: axis.hLinear, boundary: true });
  const firstDecade = Math.ceil(Math.log10(axis.hLinear));
  for (let e = firstDecade; e <= 30; e += 1) {
    const h = 10 ** e;
    if (h > axis.hTop) break;
    // Skip a decade that would collide with the boundary tick.
    if (h > axis.hLinear * 1.4) ticks.push({ h, boundary: false });
  }
  return ticks;
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

/**
 * `escaped` and `offframe` are different physical claims and must never be
 * conflated: `escaped` means v₀ ≥ v_esc and the projectile never returns;
 * `offframe` means it climbed past the top of the frame and will still fall
 * back, which is what happens just below the threshold.
 */
type Phase = 'ready' | 'flying' | 'landed' | 'escaped' | 'offframe';

interface Scene {
  apex: number;
  escaping: boolean;
  axis: Axis;
  flight: Flight | null;
  /** How far along `flight.samples` playback has reached. */
  cursor: number;
  /** Current altitude, m — interpolated between samples. */
  altitude: number;
  phase: Phase;
  /** Draw the whole path at once rather than a growing trail. */
  staticPath: boolean;
}

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#6b7488',
  edge: '#232b3b',
  body: '#151a25',
  star: '#9db4ff',
  ember: '#e8bd7d',
};

const PAD = { left: 62, right: 14, top: 20, bottom: 30 };

/**
 * Draws the whole scene. Pure function of `scene` plus the canvas size — the
 * animation loop calls this and nothing else.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene): void {
  const { axis } = scene;
  ctx.clearRect(0, 0, w, h);

  const plotLeft = PAD.left;
  const plotRight = w - PAD.right;
  const plotW = plotRight - plotLeft;
  const ySurface = h - PAD.bottom;
  const yTop = PAD.top;
  const plotH = ySurface - yTop;
  if (plotW <= 0 || plotH <= 0) return;

  const cx = plotLeft + plotW / 2;
  const yFor = (altitude: number) => ySurface - axisFrac(axis, altitude) * plotH;

  ctx.font = '11px Inter, system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';

  /* --- body: an arc across the bottom, curvature suggesting a sphere --- */
  const bodyRadius = plotW * 1.35;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, ySurface + 1);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx, ySurface + bodyRadius, bodyRadius, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.body;
  ctx.fill();
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  /* --- altitude axis --- */
  ctx.strokeStyle = 'rgba(107,116,136,0.22)';
  ctx.fillStyle = COLORS.inkFaint;
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';

  for (const tick of axisTicks(axis)) {
    const y = yFor(tick.h);
    if (y < yTop - 2 || y > ySurface + 2) continue;

    ctx.beginPath();
    if (tick.boundary) {
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(157,180,255,0.32)';
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(107,116,136,0.18)';
    }
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = tick.boundary ? COLORS.star : COLORS.inkFaint;
    ctx.fillText(tick.h === 0 ? 'surface' : formatAltitude(tick.h), plotLeft - 8, y);
  }

  // Say plainly what the axis is doing. An expert reads a log axis instantly,
  // but a *hybrid* axis is unusual enough that it has to be labelled.
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.inkFaint;
  ctx.fillText('altitude', plotLeft, yTop - 8);
  if (axis.hasLog) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(157,180,255,0.7)';
    ctx.fillText('log above · linear below', plotRight, yTop - 8);
  }

  /* --- apex marker: only when it is actually inside the frame --- */
  if (
    Number.isFinite(scene.apex) &&
    scene.apex > 0 &&
    !scene.escaping &&
    scene.apex <= axis.hTop
  ) {
    const y = yFor(scene.apex);
    ctx.strokeStyle = 'rgba(232,189,125,0.45)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.ember;
    ctx.fillText(`apex ${formatAltitude(scene.apex)}`, plotRight, y - 10);
  }

  /* --- trajectory --- */
  const { flight } = scene;
  if (flight && flight.samples.length > 1) {
    const last = scene.staticPath ? flight.samples.length - 1 : scene.cursor;

    ctx.strokeStyle = 'rgba(157,180,255,0.55)';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    for (let i = 0; i <= last && i < flight.samples.length; i += 1) {
      const sample = flight.samples[i];
      if (!sample) break;
      const y = yFor(sample.altitude);
      if (i === 0) ctx.moveTo(cx, y);
      else ctx.lineTo(cx, y);
    }
    ctx.stroke();
  }

  /* --- projectile --- */
  if (scene.phase !== 'ready') {
    const escapedOffFrame = scene.altitude >= axis.hTop;
    const y = yFor(Math.min(scene.altitude, axis.hTop));

    if (!escapedOffFrame) {
      ctx.beginPath();
      ctx.arc(cx, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.ember;
      ctx.fill();
    } else {
      // Off the top: an arrow at the frame edge instead of a clamped dot, so
      // "still going" doesn't read as "stopped here".
      ctx.beginPath();
      ctx.moveTo(cx, yTop - 6);
      ctx.lineTo(cx - 6, yTop + 5);
      ctx.lineTo(cx + 6, yTop + 5);
      ctx.closePath();
      ctx.fillStyle = COLORS.star;
      ctx.fill();
    }
  } else {
    // Ready: the projectile sits on the surface.
    ctx.beginPath();
    ctx.arc(cx, ySurface, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.inkDim;
    ctx.fill();
  }

  /* --- status --- */
  const status: Partial<Record<Phase, { text: string; color: string }>> = {
    escaped: { text: 'escapes — never returns', color: COLORS.star },
    offframe: { text: 'apex is above the frame — it still falls back', color: COLORS.ember },
    landed: { text: 'falls back', color: COLORS.ember },
  };
  const shown = status[scene.phase];
  if (shown) {
    ctx.textAlign = 'center';
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = shown.color;
    ctx.fillText(shown.text, cx, yTop + 22);
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/** Wall-clock length of a playback, ms. Flight time is compressed to fit. */
const PLAYBACK_MS = { suborbital: 5200, escape: 3800 };

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function EscapeVelocitySim({ params, values }: SimProps) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  const M = readParam(params, values, 'M');
  const R = readParam(params, values, 'R');
  const v0 = readParam(params, values, 'v0');

  // Derived once per render, never per frame. Both the readouts below and the
  // canvas read these same values.
  const escapeSpeed = useMemo(() => vEsc(M, R), [M, R]);
  const apex = useMemo(() => apexAltitude(M, R, v0), [M, R, v0]);
  const escaping = v0 >= escapeSpeed;
  const ratio = escapeSpeed > 0 ? v0 / escapeSpeed : 0;

  const [phase, setPhase] = useState<Phase>('ready');

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

  /* Reset to ready whenever any parameter changes — including mid-flight. A
     trajectory drawn for one mass while the slider says another is exactly the
     kind of quiet lie this project exists to avoid. */
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sceneRef.current = {
      apex,
      escaping,
      axis: makeAxis(R, apex, escaping),
      flight: null,
      cursor: 0,
      altitude: 0,
      phase: 'ready',
      staticPath: false,
    };
    setPhase('ready');
    paint();
  }, [M, R, v0, apex, escaping, escapeSpeed, paint]);

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

  const launch = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const dt = timestepFor(M, R);
    const flight = integrateFlight(M, R, v0, dt, scene.axis.hTop);

    // Escape is decided by v₀ against v_esc — the closed form — not by whether
    // the integration happened to run off the top of the frame.
    const endPhase: Phase = escaping ? 'escaped' : flight.leftFrame ? 'offframe' : 'landed';

    if (reduced) {
      // No animation: the complete path, drawn once, apex already marked.
      const end = flight.samples[flight.samples.length - 1];
      scene.flight = flight;
      scene.cursor = flight.samples.length - 1;
      scene.altitude = end?.altitude ?? 0;
      scene.phase = endPhase;
      scene.staticPath = true;
      setPhase(endPhase);
      paint();
      return;
    }

    scene.flight = flight;
    scene.cursor = 0;
    scene.altitude = 0;
    scene.phase = 'flying';
    scene.staticPath = false;
    setPhase('flying');

    const playbackMs = flight.leftFrame ? PLAYBACK_MS.escape : PLAYBACK_MS.suborbital;
    const started = performance.now();

    const tick = (now: number) => {
      const live = sceneRef.current;
      if (!live || !live.flight) return;

      const progress = Math.min(1, (now - started) / playbackMs);
      const tSim = progress * live.flight.duration;
      const samples = live.flight.samples;

      // Advance the cursor to the sample bracketing tSim, then interpolate.
      // Monotonic, so this is amortised O(1) per frame.
      let i = live.cursor;
      while (i < samples.length - 2) {
        const next = samples[i + 1];
        if (!next || next.t > tSim) break;
        i += 1;
      }
      live.cursor = i;

      const a = samples[i];
      const b = samples[Math.min(i + 1, samples.length - 1)] ?? a;
      if (a && b) {
        const span = b.t - a.t;
        const f = span > 0 ? Math.min(1, Math.max(0, (tSim - a.t) / span)) : 0;
        live.altitude = a.altitude + (b.altitude - a.altitude) * f;
      }

      // `paint` reads sceneRef, so the loop never closes over React state.
      paint();

      if (progress >= 1) {
        const final = samples[samples.length - 1];
        live.cursor = samples.length - 1;
        if (final) live.altitude = final.altitude;
        live.phase = endPhase;
        rafRef.current = null;
        setPhase(endPhase);
        // Final frame, now carrying the end-state label.
        paint();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [M, R, v0, escaping, reduced, paint]);

  const reset = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    scene.flight = null;
    scene.cursor = 0;
    scene.altitude = 0;
    scene.phase = 'ready';
    scene.staticPath = false;
    setPhase('ready');
    paint();
  }, [paint]);

  const idle = phase === 'ready';

  return (
    <div className="flex min-h-[20rem] flex-col gap-4">
      <div className="relative h-[22rem] w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      {/* Launch speed against escape speed. This comparison belongs on the v0
          slider track, but ParamControls is deliberately module-agnostic and
          has no concept of a derived marker — so the comparison lives here
          instead, next to the thing it explains. */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between font-ui text-[0.7rem] text-ink-faint">
          <span>launch speed vs escape speed</span>
          <span className="font-mono tabular-nums text-ember">
            {(ratio * 100).toFixed(0)}% of v<sub>esc</sub>
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-void-500">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${
              escaping ? 'bg-star' : 'bg-ember'
            }`}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between font-ui text-[0.7rem]">
          <span className="text-ink-faint">
            threshold at <span className="font-mono text-star">{formatSpeed(escapeSpeed)}</span>
          </span>
          <span className={escaping ? 'text-star' : 'text-ink-faint'}>
            {escaping ? 'at or above escape speed' : 'below escape speed'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-edge-soft pt-4">
        <dl className="flex flex-wrap gap-x-7 gap-y-2">
          <Readout label="escape speed" value={formatSpeed(escapeSpeed)} />
          <Readout
            label="apex altitude"
            value={escaping ? '∞ — escapes' : formatAltitude(apex)}
            accent={escaping}
          />
        </dl>

        <button
          type="button"
          onClick={idle ? launch : reset}
          className="shrink-0 rounded-md border border-edge bg-void-500 px-4 py-1.5 font-ui text-xs text-ink transition-colors hover:border-star/50 hover:text-star"
        >
          {idle ? (reduced ? 'Show trajectory' : 'Launch') : 'Reset'}
        </button>
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">{label}</dt>
      <dd
        className={`mt-0.5 font-mono text-lg tabular-nums ${accent ? 'text-star' : 'text-ember'}`}
      >
        {value}
      </dd>
    </div>
  );
}

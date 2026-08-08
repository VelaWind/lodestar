/**
 * Exoplanets — one transit, drawn twice.
 *
 * Top panel: the star's disc with the planet crossing it, the two to scale with
 * each other. Bottom panel: the light curve that crossing produces. Both are
 * driven by the same clock and share one horizontal axis, so the dip sits
 * exactly under the crossing that causes it — which is the whole idea of the
 * method, and is worth showing rather than asserting.
 *
 * The axis covers the transit and half again either side, not a whole orbit.
 * That is a real choice and it is disclosed beside the sim: at the default
 * settings the transit is 3% of the period, and for an Earth analogue 0.15%, so
 * an axis spanning one orbit would render the dip one pixel wide. What the frame
 * shows is faithful — the planet's size against the star's, and its speed across
 * the disc, are both to scale — it simply stops at the edges of the event.
 *
 * No physics lives in this file. Every number comes from `@/physics/transit`,
 * which the math layer and the sanity checks also read — per the
 * physics-accuracy skill, the sim's calculation and the displayed equation must
 * be one shared function or they will drift.
 *
 * Rendering notes, matching the other sims:
 *   - The rAF loop never touches React state; it advances a ref and repaints.
 *   - Under `prefers-reduced-motion` there is no loop: the complete light curve
 *     is drawn with the planet parked at mid transit.
 *   - The sliders can put the planet inside its own star, where there is no
 *     transit to model. That is a legible message on the canvas, not a crash.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { createGlowCache, drawGlow, glowRadius } from '@/visual/glow';
import { createTrail, drawTrail, pushTrail, resetTrail, type Trail } from '@/visual/trail';
import { JULIAN_YEAR } from '@/physics/constants';
import {
  lightCurve,
  transitProbability,
  transitShape,
  type TransitShape,
} from '@/physics/transit';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

/**
 * A transit depth reads as a percentage until it stops being legible as one.
 * Below a tenth of a percent the field quotes parts per million and so does
 * this: 84 ppm says something 0.0084% does not.
 */
function formatDepth(depth: number): string {
  if (!Number.isFinite(depth)) return '—';
  if (depth >= 1e-3) return `${SIG3.format(depth * 100)}%`;
  return `${SIG3.format(depth * 1e6)} ppm`;
}

function formatHours(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 3600) return `${SIG3.format(seconds / 60)} min`;
  return `${SIG3.format(seconds / 3600)} h`;
}

function formatPeriod(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 86_400) return `${SIG3.format(seconds / 3600)} h`;
  if (seconds < 2 * JULIAN_YEAR) return `${SIG3.format(seconds / 86_400)} days`;
  return `${SIG3.format(seconds / JULIAN_YEAR)} years`;
}

function formatProbability(p: number): string {
  if (!Number.isFinite(p)) return '—';
  return `${SIG3.format(p * 100)}%`;
}

/**
 * Greedy word wrap. Canvas has no line breaking of its own, and the no-transit
 * message is a whole sentence — at a 246 px frame it ran off both edges until
 * the canvas replay caught it.
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  if (maxWidth <= 0 || ctx.measureText(text).width <= maxWidth) return [text];

  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Centred text nudged inward when it would cross the frame — as the other sims do. */
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
/* Scene                                                               */
/* ------------------------------------------------------------------ */

/**
 * How much of the transit's own duration to show either side of it. At 3 the
 * event fills the middle third of the frame at every setting the sliders reach,
 * which keeps the framing constant while the underlying timescale ranges from
 * minutes to days.
 */
const WINDOW_SPAN = 3;
/** Wall-clock seconds for one sweep of that window. */
const LOOP_SECONDS = 8;

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#858ea2',
  edge: '#232b3b',
  star: '#9db4ff',
  ember: '#e8bd7d',
  photosphere: '#f4d9a4',
  planet: '#0a0d14',
};

const TAU = 2 * Math.PI;
const PAD = { left: 58, right: 14, top: 16, bottom: 30 };
/** Glow radius as a multiple of the star's drawn radius. */
const GLOW_SCALE = 1.25;
/** Retained planet positions. A count, not a duration — see `visual/trail`. */
const TRAIL_LENGTH = 60;
const starGlow = createGlowCache();
/** Share of the drawable height given to the star panel. */
const STAR_SHARE = 0.52;

export interface Scene {
  /** Stellar radius, m. */
  rs: number;
  /** Planet radius, m. */
  rp: number;
  /** Orbital distance, m. */
  a: number;
  shape: TransitShape;
  /** 0 → 1 across the drawn window. */
  progress: number;
  /** Decoration only. `null`/absent under reduced motion and in still frames. */
  trail?: Trail | null;
}

/** The window drawn, in seconds either side of mid transit. */
function halfWindow(shape: TransitShape): number {
  return (shape.total * WINDOW_SPAN) / 2;
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene): void {
  ctx.clearRect(0, 0, w, h);

  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';

  const left = PAD.left;
  const right = w - PAD.right;
  const top = PAD.top;
  const bottom = h - PAD.bottom;
  const plotW = right - left;
  const plotH = bottom - top;
  if (plotW <= 0 || plotH <= 0) return;

  /* --- the corner the sliders can reach: no transit to draw --- */
  if (!scene.shape.transits) {
    const cx = (left + right) / 2;
    ctx.textAlign = 'center';

    ctx.fillStyle = COLORS.ember;
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    const heading = wrapLines(ctx, 'No transit at this distance', plotW, 2);
    heading.forEach((line, i) => {
      fillTextClamped(ctx, line, cx, top + plotH / 2 - 10 + i * 16, left, right);
    });

    ctx.fillStyle = COLORS.inkFaint;
    ctx.font = '11px Inter, system-ui, -apple-system, sans-serif';
    const body = wrapLines(
      ctx,
      'The orbit lies inside the star. Move the planet further out.',
      plotW,
      3,
    );
    body.forEach((line, i) => {
      fillTextClamped(ctx, line, cx, top + plotH / 2 + 12 + heading.length * 16 - 16 + i * 14, left, right);
    });
    return;
  }

  const half = halfWindow(scene.shape);
  const secondsPerPx = (2 * half) / plotW;
  const xAt = (t: number) => left + (t + half) / secondsPerPx;

  /* The planet's sky-projected speed near conjunction, which is what ties the
     picture to the clock: pixels per metre follows from pixels per second, so
     the disc the planet crosses is exactly as wide as the transit is long. */
  const vProjected = (TAU * scene.a) / scene.shape.period;
  const pxPerMetre = 1 / (secondsPerPx * vProjected);
  const rsPx = scene.rs * pxPerMetre;
  // A planet under a pixel across is still there — Earth is 1/109 of the Sun —
  // so it is floored rather than allowed to vanish between samples.
  const rpPx = Math.max(0.75, scene.rp * pxPerMetre);

  const starPanelH = plotH * STAR_SHARE;
  const starCy = top + starPanelH / 2;
  const curveTop = top + starPanelH + 14;
  const curveBottom = bottom;
  const curveH = curveBottom - curveTop;
  const cx = (left + right) / 2;

  /* --- the star, clipped to its panel --- */
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, plotW, starPanelH);
  ctx.clip();

  /* The glow was already a multiple of the star's drawn radius. What is new is
     the cap: the clip above keeps it inside the star panel, and this keeps it
     off the axis labels down the left edge, which the clip does not cover. */
  const glowR = glowRadius(rsPx * GLOW_SCALE, cx, starCy, w, h, null, 0);
  drawGlow(
    ctx,
    starGlow,
    cx,
    starCy,
    glowR,
    'rgba(244,217,164,0.22)',
    'rgba(244,217,164,0)',
  );

  ctx.fillStyle = COLORS.photosphere;
  ctx.beginPath();
  ctx.arc(cx, starCy, rsPx, 0, TAU);
  ctx.fill();

  /* --- the planet's trail, then the planet ---
     Screen coordinates: the planet crosses a straight line at fixed height, so
     there is no world frame worth transforming from. Recorded here rather than
     in the loop because this is the only place the drawn position exists, which
     makes the head of the trail the planet's own pixel by construction.
     Still clipped to the star panel, so it cannot run out over the light curve. */
  const t = -half + scene.progress * 2 * half;
  const planetX = xAt(t);

  if (scene.trail) {
    pushTrail(scene.trail, planetX, starCy);
    // The planet is a dark disc on a bright star, so its trail is drawn in the
    // star's own colour and reads as the light it has not yet blocked.
    drawTrail(ctx, scene.trail, COLORS.photosphere, rpPx, 0, 1, 0, 1);
  }

  ctx.fillStyle = COLORS.planet;
  ctx.beginPath();
  ctx.arc(planetX, starCy, rpPx, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(213,220,234,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  /* --- the light curve --- */
  const depth = scene.shape.depth;
  // A little headroom under the floor so the trace never sits on the axis.
  const floor = 1 - depth * 1.15;
  const yFor = (flux: number) => curveBottom - ((flux - floor) / (1 - floor)) * curveH;

  ctx.strokeStyle = 'rgba(107,116,136,0.20)';
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  for (const flux of [1, 1 - depth]) {
    const y = yFor(flux);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.inkFaint;
    ctx.fillText(flux === 1 ? '1.000' : formatDepth(depth), left - 6, y);
  }

  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const samples = Math.max(120, Math.round(plotW * 3));
  for (let i = 0; i <= samples; i += 1) {
    const sampleT = -half + (i / samples) * 2 * half;
    const x = xAt(sampleT);
    const y = yFor(lightCurve(scene.shape, sampleT));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  /* --- the shared cursor: one clock, two panels --- */
  ctx.strokeStyle = 'rgba(232,189,125,0.40)';
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(planetX, top);
  ctx.lineTo(planetX, curveBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(planetX, yFor(lightCurve(scene.shape, t)), 3, 0, TAU);
  ctx.fill();

  /* --- axes --- */
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.inkFaint;
  ctx.fillText('relative flux', left, curveTop - 6);

  ctx.textAlign = 'center';
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const sampleT = -half + fraction * 2 * half;
    const label = Math.abs(sampleT) < 1 ? 'mid transit' : formatHours(Math.abs(sampleT));
    const prefix = sampleT < 0 ? '−' : sampleT > 0 ? '+' : '';
    fillTextClamped(
      ctx,
      Math.abs(sampleT) < 1 ? label : `${prefix}${label}`,
      xAt(sampleT),
      bottom + 12,
      left,
      right,
    );
  }
  ctx.fillStyle = COLORS.inkFaint;
  fillTextClamped(ctx, 'time from mid transit', cx, bottom + 26, left, right);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function ExoplanetsSim({ params, values }: SimProps) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  /* One buffer for the component's life, reused across parameter changes. */
  const trailRef = useRef<Trail | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  const ms = readParam(params, values, 'Mstar');
  const rs = readParam(params, values, 'Rstar');
  const rp = readParam(params, values, 'Rp');
  const a = readParam(params, values, 'a');

  // Derived once per render, never per frame. The canvas and the readouts read
  // these same values, and both read them from `@/physics/transit`.
  const shape = useMemo(() => transitShape(ms, rs, rp, a), [ms, rs, rp, a]);
  const probability = useMemo(() => transitProbability(rs, rp, a), [rs, rp, a]);
  const compression = shape.transits ? (WINDOW_SPAN * shape.total) / LOOP_SECONDS : NaN;

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

  /* Rebuild and restart on any parameter change. A curve drawn for one planet
     while the slider says another is exactly the quiet lie this project avoids. */
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Reduced motion parks the planet at mid transit, which is the frame that
    // carries the most information: full depth, planet centred on the disc.
    if (!reduced) trailRef.current ??= createTrail(TRAIL_LENGTH);
    if (trailRef.current) resetTrail(trailRef.current);
    sceneRef.current = {
      rs,
      rp,
      a,
      shape,
      progress: reduced ? 0.5 : 0,
      trail: reduced ? null : trailRef.current,
    };
    paint();

    if (reduced || !shape.transits) return;

    const started = performance.now();
    const tick = (now: number) => {
      const live = sceneRef.current;
      if (!live) return;
      live.progress = ((now - started) / (LOOP_SECONDS * 1000)) % 1;
      paint();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [rs, rp, a, shape, reduced, paint]);

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

  return (
    <div className="flex min-h-[20rem] flex-col gap-4">
      <div className="relative h-[22rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="A planet crossing the disc of its star, drawn above the dip in brightness that crossing produces, both on one time axis."
          aria-describedby="exoplanets-readouts"
        />
      </div>

      <p className="font-ui text-[0.7rem] leading-relaxed text-ink-faint">
        {shape.transits ? (
          <>
            The axis covers the transit and half again either side —{' '}
            <span className="font-mono text-ember">{formatHours(WINDOW_SPAN * shape.total)}</span> of
            a {formatPeriod(shape.period)} orbit
            {reduced
              ? ', drawn complete with the planet at mid transit.'
              : `, replayed in ${LOOP_SECONDS} seconds, so time runs ${SIG3.format(compression)}× faster than it does out there.`}
          </>
        ) : (
          <>
            At this distance the orbit lies inside the star, so there is nothing to transit. Move
            the planet further out, or shrink the star, and the curve returns.
          </>
        )}
      </p>

      {/* With the orbit inside the star there is no transit, so the quantities
          that describe one are blanked rather than reported: the depth is a bare
          ratio of radii there, and the alignment probability clamps to 100% for
          a geometry that cannot produce a transit at all. The period is the one
          figure that survives, being a property of the orbit and not the view. */}
      <dl id="exoplanets-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label="transit depth" value={shape.transits ? formatDepth(shape.depth) : '—'} />
        <Readout label="duration" value={formatHours(shape.total)} />
        <Readout label="orbital period" value={formatPeriod(shape.period)} />
        <Readout
          label="chance of alignment"
          value={shape.transits ? formatProbability(probability) : '—'}
        />
      </dl>
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
 * every width the shell can produce and at each parameter's extremes — including
 * the corner where the orbit lies inside the star and there is no transit to
 * draw, which must produce a legible message rather than a NaN coordinate.
 */
export const __internals = { drawScene, halfWindow };

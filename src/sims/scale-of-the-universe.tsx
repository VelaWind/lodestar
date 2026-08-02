/**
 * Scale of the universe — a ladder of ten anchored scenes across forty-two
 * decades.
 *
 * The thing a static diagram cannot do is make a ratio *felt*. Reading "63,000
 * protons across a hydrogen atom" costs nothing; watching the proton shrink to a
 * dot and the atom grow from one, twice, at every rung, is the point of the
 * module. So the transition is the content and the pictures are labels.
 *
 * No physics lives in this file. Light travel time and the decade arithmetic
 * come from `@/physics/scale`; the anchor data comes from the module's own
 * content file, which is where sizes, notes and sources belong. This file owns
 * pixels, playback timing, and length formatting only.
 *
 * Rendering notes, matching the other two sims:
 *   - The rAF loop never touches React state, and it only runs *during* a
 *     transition — there is no idle animation to burn a frame budget on.
 *   - Readouts change when the slider changes, not per frame, so they are
 *     ordinary React rather than imperative DOM writes.
 *   - Under `prefers-reduced-motion` there is no loop at all: crossing an anchor
 *     cuts straight to the new scene.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { scaleAnchors, type ScaleAnchor } from '@/content/modules/scale-of-the-universe';
import { AU, LIGHT_YEAR } from '@/physics/constants';
import { decadesBetween, formatLightTravelTime, lightTravelTime } from '@/physics/scale';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

/** Metres → the largest named unit that keeps the number readable. */
function formatLength(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  if (metres < 1e-12) return `${SIG3.format(metres * 1e15)} fm`;
  if (metres < 1e-9) return `${SIG3.format(metres * 1e12)} pm`;
  if (metres < 1e-6) return `${SIG3.format(metres * 1e9)} nm`;
  if (metres < 1e-3) return `${SIG3.format(metres * 1e6)} µm`;
  if (metres < 1e-1) return `${SIG3.format(metres * 1e3)} mm`;
  if (metres < 1e3) return `${SIG3.format(metres)} m`;
  if (metres < 1e9) return `${SIG3.format(metres / 1e3)} km`;
  if (metres < 1e11) return `${SIG3.format(metres / 1e9)} million km`;
  if (metres < 0.05 * LIGHT_YEAR) return `${SIG3.format(metres / AU)} AU`;
  const ly = metres / LIGHT_YEAR;
  if (ly >= 1e9) return `${SIG3.format(ly / 1e9)} billion light-years`;
  if (ly >= 1e6) return `${SIG3.format(ly / 1e6)} million light-years`;
  return `${SIG3.format(ly)} light-years`;
}

/* ------------------------------------------------------------------ */
/* Anchors and snapping                                                */
/* ------------------------------------------------------------------ */

/**
 * How close, in decades, the slider has to be for an anchor to claim it.
 * ±0.15 decades is ±41% in size — wide enough to feel like a detent, narrow
 * enough that 93% of the ladder stays freely selectable.
 */
const SNAP_DECADES = 0.15;

/**
 * How long the value must sit still before the magnet acts, ms.
 *
 * The snap deliberately does *not* fire on every slider move. The shell owns
 * ParamControls and a sim cannot change how the slider itself behaves, so the
 * only lever here is writing a corrected value back through `setValue` — and
 * doing that on every move would fight the reader's drag, or, if it eased rather
 * than jumped, would creep toward the anchor on its own as the correction fed
 * itself. Settling after a pause gives free movement while dragging and a clean
 * landing when the reader stops, which is what a magnetic detent should feel
 * like. See the report accompanying this module.
 */
const SNAP_SETTLE_MS = 160;

/** Index of the anchor nearest `s` in log space. Never -1: the ladder is fixed. */
function nearestAnchorIndex(s: number): number {
  if (!(s > 0)) return 0;
  let best = 0;
  let bestDistance = Infinity;
  scaleAnchors.forEach((anchor, i) => {
    const distance = Math.abs(Math.log10(s / anchor.size));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

/** The anchor size to settle onto, or null if `s` is outside every window. */
function snapTarget(s: number): number | null {
  if (!(s > 0)) return null;
  const anchor = scaleAnchors[nearestAnchorIndex(s)];
  if (!anchor || anchor.size === s) return null;
  return Math.abs(Math.log10(s / anchor.size)) <= SNAP_DECADES ? anchor.size : null;
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#6b7488',
  edge: '#232b3b',
  star: '#9db4ff',
  ember: '#e8bd7d',
};

const TAU = 2 * Math.PI;

/** Deterministic golden-angle scatter on the unit disc — no per-frame randomness. */
const UNIVERSE_DOTS = Array.from({ length: 44 }, (_, i) => {
  const radius = Math.sqrt((i + 0.5) / 44);
  const angle = i * 2.399_963;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
});

function softDisc(
  ctx: CanvasRenderingContext2D,
  r: number,
  inner: string,
  outer: string,
  hardness = 0.55,
): void {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(hardness, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

/**
 * Draws one anchor's icon centred on the origin, sized to characteristic radius
 * `r`. Icons, not scale drawings — disclosed beside the sim. The two quantum
 * rungs are drawn with deliberately soft edges because they do not have hard
 * ones; everything else gets a clean outline.
 */
function drawShape(ctx: CanvasRenderingContext2D, id: string, r: number): void {
  switch (id) {
    case 'proton':
      softDisc(ctx, r, 'rgba(232,189,125,0.95)', 'rgba(232,189,125,0)', 0.5);
      break;

    case 'hydrogen-atom':
      softDisc(ctx, r, 'rgba(157,180,255,0.35)', 'rgba(157,180,255,0)', 0.15);
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1.5, r * 0.06), 0, TAU);
      ctx.fill();
      break;

    case 'red-blood-cell':
      ctx.fillStyle = 'rgba(232,125,125,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      softDisc(ctx, r * 0.62, 'rgba(120,40,50,0.55)', 'rgba(120,40,50,0)', 0.2);
      break;

    case 'human': {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(0, -r * 0.62, r * 0.2, 0, TAU);
      ctx.fill();
      ctx.lineCap = 'round';
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = Math.max(2, r * 0.17);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.34);
      ctx.lineTo(0, r * 0.22);
      ctx.moveTo(0, r * 0.22);
      ctx.lineTo(-r * 0.22, r * 0.9);
      ctx.moveTo(0, r * 0.22);
      ctx.lineTo(r * 0.22, r * 0.9);
      ctx.moveTo(-r * 0.3, -r * 0.12);
      ctx.lineTo(r * 0.3, -r * 0.12);
      ctx.stroke();
      break;
    }

    case 'earth':
      ctx.fillStyle = 'rgba(93,132,208,0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(213,220,234,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.34, 0, 0, TAU);
      ctx.stroke();
      break;

    case 'sun':
      softDisc(ctx, r * 1.5, 'rgba(232,189,125,0.30)', 'rgba(232,189,125,0)', 0.45);
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      break;

    case 'neptune-orbit':
      ctx.strokeStyle = 'rgba(157,180,255,0.5)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, r * 0.05), 0, TAU);
      ctx.fill();
      ctx.fillStyle = COLORS.star;
      ctx.beginPath();
      ctx.arc(r * Math.cos(-0.6), r * Math.sin(-0.6), Math.max(2, r * 0.035), 0, TAU);
      ctx.fill();
      break;

    case 'proxima-centauri': {
      // A distance, so the icon is two stars and the gap between them.
      ctx.strokeStyle = 'rgba(107,116,136,0.5)';
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(-r, 0, Math.max(2.5, r * 0.07), 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(232,125,125,0.9)';
      ctx.beginPath();
      ctx.arc(r, 0, Math.max(2, r * 0.05), 0, TAU);
      ctx.fill();
      break;
    }

    case 'milky-way':
      ctx.save();
      ctx.rotate(-0.35);
      softDisc(ctx, r, 'rgba(157,180,255,0.22)', 'rgba(157,180,255,0)', 0.1);
      ctx.scale(1, 0.42);
      softDisc(ctx, r * 0.95, 'rgba(213,220,234,0.35)', 'rgba(157,180,255,0)', 0.08);
      softDisc(ctx, r * 0.3, 'rgba(255,240,214,0.9)', 'rgba(232,189,125,0)', 0.25);
      ctx.restore();
      break;

    case 'observable-universe':
      ctx.strokeStyle = 'rgba(157,180,255,0.45)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(213,220,234,0.5)';
      for (const dot of UNIVERSE_DOTS) {
        ctx.beginPath();
        ctx.arc(dot.x * r * 0.92, dot.y * r * 0.92, 1.4, 0, TAU);
        ctx.fill();
      }
      break;

    default:
      ctx.strokeStyle = COLORS.inkDim;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
  }
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

/** Wall-clock length of a rung-to-rung zoom, ms. Spec ceiling is 600. */
const TRANSITION_MS = 520;
/** Characteristic radius of the resting icon, as a share of the stage. */
const ICON_FRACTION = 0.3;

interface Scene {
  /** Anchor being shown. */
  index: number;
  /** Anchor being left, or null when nothing is in flight. */
  from: number | null;
  /** performance.now() at the start of the transition. */
  started: number;
  /** Live slider value, for the ladder strip. */
  s: number;
}

const PAD = { left: 20, right: 20, top: 24, bottom: 46 };

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;

function drawIcon(
  ctx: CanvasRenderingContext2D,
  anchor: ScaleAnchor,
  cx: number,
  cy: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.001 || radius <= 0.2) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(cx, cy);
  drawShape(ctx, anchor.id, radius);
  ctx.restore();
}

/**
 * Greedy word wrap to at most `maxLines` lines. Canvas has no line breaking of
 * its own, so a comparison sentence — "About 930,000 Milky Ways across the
 * observable universe." — ran off both edges of a phone-width frame. Anything
 * still too long after `maxLines` keeps its last line long rather than dropping
 * words: a clipped sentence is a bug, a truncated one is a lie.
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

/** Vertical step between wrapped comparison lines, px. */
const COMPARISON_LINE_HEIGHT = 14;

function drawLabels(
  ctx: CanvasRenderingContext2D,
  anchor: ScaleAnchor,
  cx: number,
  yName: number,
  yFoot: number,
  alpha: number,
  maxWidth: number,
): void {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.textAlign = 'center';

  ctx.font = '600 15px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(anchor.name, cx, yName);

  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillStyle = COLORS.ember;
  ctx.fillText(formatLength(anchor.size), cx, yName + 20);

  if (anchor.comparison) {
    ctx.font = '12px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillStyle = COLORS.inkDim;
    // The block grows upward from `yFoot`, into the empty band above it, so the
    // bottom of the caption stays put and never reaches the ladder strip.
    const lines = wrapLines(ctx, anchor.comparison, maxWidth, 2);
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, yFoot - (lines.length - 1 - i) * COMPARISON_LINE_HEIGHT);
    });
  }
  ctx.restore();
}

/** The ten rungs as ticks, with a marker at the live slider position. */
function drawLadder(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  left: number,
  right: number,
  y: number,
  param: Param,
): void {
  const lo = Math.log10(param.min);
  const hi = Math.log10(param.max);
  const span = hi - lo;
  if (!(span > 0)) return;
  const xFor = (value: number) =>
    left + ((Math.log10(value) - lo) / span) * (right - left);

  ctx.strokeStyle = 'rgba(107,116,136,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();

  scaleAnchors.forEach((anchor, i) => {
    const x = xFor(anchor.size);
    const active = i === scene.index;
    ctx.strokeStyle = active ? COLORS.star : 'rgba(107,116,136,0.55)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y - (active ? 7 : 4));
    ctx.lineTo(x, y + (active ? 7 : 4));
    ctx.stroke();
  });

  if (scene.s > 0) {
    const x = xFor(Math.min(param.max, Math.max(param.min, scene.s)));
    ctx.fillStyle = COLORS.ember;
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 4, y - 16);
    ctx.lineTo(x + 4, y - 16);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draws the whole scene. Pure function of `scene` plus the canvas size — the
 * animation loop calls this and nothing else.
 *
 * The transition is a cross-zoom whose direction carries the sign of the move:
 * going up the ladder the old rung shrinks toward a dot while the new one grows
 * from one, and going down, both run the other way. That is the ratio made
 * kinetic — the only place in the module where 63,000-to-one is shown rather
 * than stated.
 */
function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scene: Scene,
  param: Param,
  now: number,
): boolean {
  ctx.clearRect(0, 0, w, h);

  const left = PAD.left;
  const right = w - PAD.right;
  const stageH = h - PAD.top - PAD.bottom;
  if (right - left <= 0 || stageH <= 0) return false;

  const cx = (left + right) / 2;
  const cy = PAD.top + stageH * 0.44;
  const radius = Math.min(right - left, stageH) * ICON_FRACTION;
  const yName = PAD.top + stageH * 0.86;
  const yFoot = PAD.top + stageH + 4;

  const to = scaleAnchors[scene.index];
  const fromIndex = scene.from;
  const from = fromIndex === null ? null : scaleAnchors[fromIndex];

  let running = false;
  if (from && to && fromIndex !== null) {
    const raw = Math.min(1, (now - scene.started) / TRANSITION_MS);
    const p = easeOutCubic(raw);
    running = raw < 1;

    // Up the ladder: the outgoing rung collapses to a point and the incoming
    // one opens out of it. Down the ladder: the reverse, so the reader is
    // always moving *through* the object rather than watching a crossfade.
    const up = scene.index > fromIndex;
    const outgoing = up ? 1 - p : 1 + p * 5;
    const incoming = up ? p : 1 + (1 - p) * 5;

    drawIcon(ctx, from, cx, cy, radius * outgoing, 1 - p);
    drawIcon(ctx, to, cx, cy, radius * incoming, p);
    drawLabels(ctx, from, cx, yName, yFoot, Math.max(0, 1 - raw * 2), right - left);
    drawLabels(ctx, to, cx, yName, yFoot, Math.max(0, raw * 2 - 1), right - left);
  } else if (to) {
    drawIcon(ctx, to, cx, cy, radius, 1);
    drawLabels(ctx, to, cx, yName, yFoot, 1, right - left);
  }

  drawLadder(ctx, scene, left, right, h - 18, param);
  return running;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function ScaleOfTheUniverseSim({ params, values, setValue }: SimProps) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  const param = useMemo(
    () => params.find((p) => p.id === 's') ?? params[0],
    [params],
  );
  const s = readParam(params, values, 's');
  const index = nearestAnchorIndex(s);
  const anchor = scaleAnchors[index];
  const previous = index > 0 ? scaleAnchors[index - 1] : undefined;

  /** Paints the current scene; returns true while a transition is still live. */
  const paint = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      const scene = sceneRef.current;
      if (!canvas || !scene || !param) return false;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;

      // DPR-aware: back the canvas with device pixels, draw in CSS pixels.
      const dpr = window.devicePixelRatio || 1;
      const wantW = Math.round(rect.width * dpr);
      const wantH = Math.round(rect.height * dpr);
      if (canvas.width !== wantW || canvas.height !== wantH) {
        canvas.width = wantW;
        canvas.height = wantH;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return drawScene(ctx, rect.width, rect.height, scene, param, now);
    },
    [param],
  );

  /* Seed the scene once, before the first paint. */
  if (sceneRef.current === null) {
    sceneRef.current = { index, from: null, started: 0, s };
  }

  /* Anchor changes drive the zoom. Everything else about the slider — the live
     value under the marker — is a repaint, not a transition. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.s = s;

    if (scene.index === index) {
      // Same rung: repaint for the ladder marker only, and do not disturb a
      // transition that may still be running.
      if (rafRef.current === null) paint(performance.now());
      return;
    }

    if (reduced) {
      scene.from = null;
      scene.index = index;
      paint(performance.now());
      return;
    }

    scene.from = scene.index;
    scene.index = index;
    scene.started = performance.now();

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const running = paint(now);
      if (running) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const live = sceneRef.current;
      if (live) live.from = null;
      rafRef.current = null;
      paint(now); // settled frame, no ghost of the outgoing rung
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [s, index, reduced, paint]);

  /**
   * The magnet. Writes the anchor back through the shell's own setter after the
   * value has been still for a moment — see SNAP_SETTLE_MS for why it waits.
   * Idempotent: the anchor is its own snap target, so this settles once and
   * cannot oscillate.
   */
  useEffect(() => {
    const target = snapTarget(s);
    if (target === null) return;
    const timer = window.setTimeout(() => setValue('s', target), SNAP_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [s, setValue]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint(performance.now()));
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

  const crossing = lightTravelTime(s);
  const decades = previous ? decadesBetween(previous.size, s) : NaN;

  return (
    <div className="flex min-h-[20rem] flex-col gap-4">
      <div className="relative h-[24rem] w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      {anchor && (
        <div className="space-y-1.5 border-t border-edge-soft pt-4">
          <p className="font-ui text-[0.8rem] leading-relaxed text-ink-dim">
            {anchor.sizeNote}
          </p>
          <p className="font-ui text-[0.7rem] text-ink-faint">source: {anchor.source}</p>
        </div>
      )}

      <dl className="flex flex-wrap gap-x-7 gap-y-2">
        <Readout label="light crosses it in" value={formatLightTravelTime(crossing)} />
        <Readout
          label={previous ? `decades above ${previous.name.toLowerCase()}` : 'decades below'}
          value={
            previous && Number.isFinite(decades)
              ? `${decades >= 0 ? '+' : ''}${decades.toFixed(2)}`
              : '— first rung'
          }
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
 * every width the shell can produce and at each parameter's extremes, checking
 * that no label lands outside the frame and that no coordinate goes non-finite.
 * That needs the drawing function; a scene here is four plain fields.
 *
 * They are exported behind one deliberately ugly name rather than individually,
 * so the module's real surface stays what it has always been - a default export
 * taking SimProps - and so nobody imports them by accident.
 */
export const __internals = { drawScene };

/**
 * Time dilation — two clocks on one trip, above; clocks near a black hole, below.
 *
 * Top panel: two clock faces, "at home" and "on the ship", run through a
 * looping round trip to Proxima Centauri at the slider's speed. The home clock
 * makes one full turn per loop; the ship's clock turns 1/γ as far, each face
 * filling behind its hand, and under each is the time that passes on it for
 * the whole trip. A bar beneath shows how much of each home hour the ship's
 * clock ticks through. Under reduced motion both faces are drawn at the end of
 * the trip.
 *
 * Bottom panel: the rate of a clock hovering outside a ten-solar-mass black
 * hole against its distance, on a log axis from just outside the horizon to
 * 10¹¹ m, with the event horizon, photon sphere and innermost stable orbit
 * marked and a dot at the slider's distance.
 *
 * No physics lives in this file. Every factor, rate and duration comes from
 * `@/physics/relativity`, which the sanity block also reads. This file owns
 * pixels and formatting only.
 *
 * Motion: the trip loops continuously on `useRafLoop`; when a slider changes,
 * the clocks (in log v) and the dot (in log r) slide to their new values over
 * `DURATION.slow` on the `EASE.out` curve. Under reduced motion nothing loops
 * or slides.
 */
import { useCallback, useEffect, useRef } from 'react';
import { canvasSize, observeCanvasSize } from './canvasSize';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { DAY_S, D_PROXIMA, JULIAN_YEAR, M_DEMO_BH } from '@/physics/constants';
import { schwarzschildRadius } from '@/physics/blackhole';
import { clockDeficit, gravitationalRate, lorentzFactor, twinTrip } from '@/physics/relativity';
import { eased } from '@/motion/ease';
import { DURATION, EASE } from '@/motion/tokens';
import { useRafLoop } from '@/motion/useRafLoop';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, overlaps, textWidth, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const SIG4 = new Intl.NumberFormat('en', { minimumSignificantDigits: 4, maximumSignificantDigits: 4 });

const MINUTE = 60;
const HOUR = 3600;

/** A short duration in s, in the unit that keeps it readable: ps, ns, µs, ms, s, min or h, three significant figures. */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds === 0) return '0 s';
  if (seconds < 1e-9) return `${SIG3.format(seconds * 1e12)} ps`;
  if (seconds < 1e-6) return `${SIG3.format(seconds * 1e9)} ns`;
  if (seconds < 1e-3) return `${SIG3.format(seconds * 1e6)} µs`;
  if (seconds < 1) return `${SIG3.format(seconds * 1e3)} ms`;
  if (seconds < MINUTE) return `${SIG3.format(seconds)} s`;
  if (seconds < HOUR) return `${SIG3.format(seconds / MINUTE)} min`;
  return `${SIG3.format(seconds / HOUR)} h`;
}

/** A trip's length in s as years, three significant figures, in number words past a million, or days and hours under a year. */
function formatTripTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const years = seconds / JULIAN_YEAR;
  if (years < 1) {
    return seconds >= DAY_S ? `${SIG3.format(seconds / DAY_S)} days` : formatDuration(seconds);
  }
  const unit = (n: string) => `${n} ${n === '1' ? 'year' : 'years'}`;
  if (years < 1e6) return unit(SIG3.format(years));
  if (years < 1e9) return `${SIG3.format(years / 1e6)} million years`;
  return `${SIG3.format(years / 1e9)} billion years`;
}

/** A trip's length, or the plain statement that a traveller at rest never arrives. */
function formatTrip(seconds: number, moving: boolean): string {
  return moving ? formatTripTime(seconds) : 'never: not moving';
}

/** The traveller's daily loss, or the plain statement that at rest there is none. */
function formatDailyLoss(seconds: number, moving: boolean): string {
  return moving ? formatDuration(seconds) : 'none: not moving';
}

/** The Lorentz factor to four significant figures: "1.667". */
function formatGamma(gamma: number): string {
  return Number.isFinite(gamma) ? SIG4.format(gamma) : '—';
}

/** A clock rate to four decimals, or the plain statement when it has stopped. */
function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  return rate <= 0 ? 'stopped, seen from far away' : rate.toFixed(4);
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#858ea2',
  edge: '#232b3b',
  void: '#05070c',
  star: '#9db4ff',
  ember: '#e8bd7d',
  warm: '#f0a868',
  home: 'rgba(157,180,255,0.28)',
  ship: 'rgba(240,168,104,0.32)',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const PLOT_LEFT = 44;
const TOP_SHARE = 0.55;

/** How long one loop of the trip takes on screen, ms: display pacing only. */
const LOOP_MS = 6000;

/** The black hole and its marked radii, m. */
const R_S = schwarzschildRadius(M_DEMO_BH);
const R_AXIS_MIN = 1.01 * R_S;
const R_AXIS_MAX = 1e11;
const GUIDES: [number, string][] = [
  [R_S, 'event horizon'],
  [1.5 * R_S, 'photon sphere'],
  [3 * R_S, 'innermost stable orbit'],
];

/** Distance ticks: in km (friendly) or in multiples of r_s (technical). */
const KM_TICKS: [number, string][] = [
  [1e5, '100 km'],
  [1e7, '10⁴ km'],
  [1e9, '10⁶ km'],
  [1e11, '10⁸ km'],
];
const RS_TICKS: [number, string][] = [
  [10, '10 rₛ'],
  [1e3, '10³ rₛ'],
  [1e5, '10⁵ rₛ'],
  [1e7, '10⁷ rₛ'],
];

type Units = 'friendly' | 'technical';

interface View {
  /** Speed as currently drawn, m/s — mid-tween while it slides. */
  v: number;
  /** Distance from the black hole as currently drawn, m. */
  r: number;
  /** How far through the looping trip the home clock is, 0 to 1. */
  phase: number;
  units: Units;
}

/** Text at (x, y), recorded as an obstacle for any label placed after it. */
function placeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  obstacles: LabelBox[],
): void {
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  obstacles.push(labelBox(ctx, text, x, y, align));
}

/** Centred text slid inward so it never crosses [left, right]. */
function centredWithin(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  left: number,
  right: number,
  obstacles: LabelBox[],
): void {
  const half = textWidth(ctx, text) / 2;
  const x = right - left >= 2 * half ? Math.min(right - half, Math.max(left + half, cx)) : (left + right) / 2;
  placeText(ctx, text, x, y, 'center', obstacles);
}

/** Text on a dark plate, so it reads over the lines it sits on. */
function platedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  spot: { x: number; y: number; align: CanvasTextAlign },
  obstacles: LabelBox[],
): void {
  const box = labelBox(ctx, text, spot.x, spot.y, spot.align);
  const ink = ctx.fillStyle;
  ctx.fillStyle = 'rgba(5,7,12,0.82)';
  ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
  ctx.fillStyle = ink;
  placeText(ctx, text, spot.x, spot.y, spot.align, obstacles);
}

function inside(
  ctx: CanvasRenderingContext2D,
  text: string,
  c: { x: number; y: number; align: CanvasTextAlign },
  bounds: LabelBox,
): boolean {
  const box = labelBox(ctx, text, c.x, c.y, c.align);
  return box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
}

/**
 * A plated label near a point, in the first spot inside `bounds` and clear of
 * everything already drawn — the candidate grid the template sims use, plus a
 * centred candidate slid inward at each height.
 */
function labelNear(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bounds: LabelBox,
  obstacles: LabelBox[],
  extra: LabelBox[] = [],
): void {
  const half = textWidth(ctx, text) / 2;
  const slid = Math.min(bounds.x1 - half - 1, Math.max(bounds.x0 + half + 1, x));
  const candidates: { x: number; y: number; align: CanvasTextAlign }[] = [];
  for (const dy of [-9, 15, -21, 27, -33, 39, -45, 51, -57, 63, -69, 75, -81, 87]) {
    candidates.push({ x, y: y + dy, align: 'center' });
    candidates.push({ x: x + 9, y: y + dy + (dy < 0 ? 6 : -6), align: 'left' });
    candidates.push({ x: x - 9, y: y + dy + (dy < 0 ? 6 : -6), align: 'right' });
    if (slid !== x) candidates.push({ x: slid, y: y + dy, align: 'center' });
  }
  const fits = candidates.filter((c) => inside(ctx, text, c, bounds));
  const spot =
    fits.length > 0
      ? firstClearPlacement(ctx, text, fits, [...obstacles, ...extra])
      : { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2, align: 'center' as const };
  platedText(ctx, text, spot, obstacles);
}

/**
 * One clock face: twelve ticks, the elapsed share filled behind the hand, and
 * a hand at `turns` of a full turn (which may be more than one; the fill is
 * capped at a full face).
 */
function drawClock(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  turns: number,
  fill: string,
  hand: string,
): void {
  ctx.strokeStyle = COLORS.inkFaint;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.stroke();

  const share = Math.min(1, Math.max(0, turns));
  if (share > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius - 1, -Math.PI / 2, -Math.PI / 2 + share * TAU);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = COLORS.inkDim;
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU - Math.PI / 2;
    const inner = radius * (i % 3 === 0 ? 0.8 : 0.88);
    ctx.beginPath();
    ctx.moveTo(cx + inner * Math.cos(a), cy + inner * Math.sin(a));
    ctx.lineTo(cx + radius * 0.96 * Math.cos(a), cy + radius * 0.96 * Math.sin(a));
    ctx.stroke();
  }

  const angle = (turns % 1) * TAU - Math.PI / 2;
  ctx.strokeStyle = hand;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + radius * 0.78 * Math.cos(angle), cy + radius * 0.78 * Math.sin(angle));
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = hand;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, TAU);
  ctx.fill();
}

function drawClocks(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const left = PAD.left;
  const right = w - PAD.right;
  const gamma = lorentzFactor(view.v);
  const trip = twinTrip(D_PROXIMA, view.v);
  // At rest the trip never happens: both clocks show the same and stand still.
  const moving = view.v > 0;

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'Two clocks, one trip', PAD.left, 14, 'left', obstacles);

  /* The two faces, side by side. */
  const barLabelLines =
    textWidth(ctx, 'for every hour at home, the ship’s clock ticks') <= right - left
      ? ['for every hour at home, the ship’s clock ticks']
      : ['for every hour at home,', 'the ship’s clock ticks'];
  const barBlock = 12 * barLabelLines.length + 22;
  const radius = Math.max(16, Math.min((right - left) / 4 - 16, (splitY - 36 - 30 - barBlock - 14) / 2, 70));
  const cy = 36 + radius;
  const faces: [number, string, number, string, string, string][] = [
    [left + (right - left) * 0.27, 'at home', moving ? view.phase : 0, COLORS.home, COLORS.star, formatTrip(trip.home_s, moving)],
    [left + (right - left) * 0.73, 'on the ship', moving ? view.phase / gamma : 0, COLORS.ship, COLORS.warm, formatTrip(trip.traveller_s, moving)],
  ];
  for (const [cx, name, turns, fill, hand, elapsed] of faces) {
    ctx.fillStyle = COLORS.ink;
    centredWithin(ctx, name, cx, 30, left, right, obstacles);
    drawClock(ctx, cx, cy, radius, turns, fill, hand);
    ctx.fillStyle = hand;
    centredWithin(ctx, elapsed, cx, cy + radius + 14, left, right, obstacles);
  }

  /* The bar: how much of each home hour the ship's clock ticks through. */
  let y = cy + radius + 32;
  ctx.fillStyle = COLORS.inkFaint;
  for (const line of barLabelLines) {
    placeText(ctx, line, left, y, 'left', obstacles);
    y += 12;
  }
  const barTop = y - 6;
  const barH = 12;
  const share = 1 / gamma;
  ctx.fillStyle = 'rgba(35,43,59,0.9)';
  ctx.fillRect(left, barTop, right - left, barH);
  ctx.fillStyle = COLORS.ship;
  ctx.fillRect(left, barTop, (right - left) * share, barH);
  ctx.strokeStyle = COLORS.warm;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + (right - left) * share, barTop - 2);
  ctx.lineTo(left + (right - left) * share, barTop + barH + 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.ember;
  platedText(ctx, formatDuration(HOUR * share), { x: right - 3, y: barTop + barH - 2.5, align: 'right' }, obstacles);
}

function drawGravity(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const plotLeft = PLOT_LEFT;
  const plotRight = w - PAD.right;
  const plotTop = splitY + 38;
  const plotBottom = h - 36;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return;

  const l0 = Math.log10(R_AXIS_MIN);
  const l1 = Math.log10(R_AXIS_MAX);
  const xOf = (r: number) => plotLeft + ((Math.log10(r) - l0) / (l1 - l0)) * plotW;
  const yOf = (rate: number) => plotBottom - rate * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'Clocks near a black hole', PAD.left, splitY + 16, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'dτ/dt' : 'clock speed compared with far away', PAD.left, splitY + 29, 'left', obstacles);

  /* Axes and ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  for (const rate of [0, 0.5, 1]) placeText(ctx, String(rate), plotLeft - 4, yOf(rate) + 3, 'right', obstacles);
  for (const [value, label] of deep ? RS_TICKS : KM_TICKS) {
    const r = deep ? value * R_S : value;
    const x = xOf(r);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    centredWithin(ctx, label, x, plotBottom + 13, 0, w, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'r' : 'distance from the black hole',
    (plotLeft + plotRight) / 2,
    plotBottom + 27,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The marked radii. The horizon sits a hundredth of r_s left of the axis; its guide is drawn on the axis edge. */
  ctx.strokeStyle = 'rgba(152,162,184,0.35)';
  ctx.setLineDash([2, 3]);
  const guideXs = GUIDES.map(([r]) => Math.max(plotLeft, xOf(r)));
  for (const x of guideXs) {
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotBottom);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* The curve. */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const steps = 200;
  for (let i = 0; i <= steps; i += 1) {
    const r = R_AXIS_MIN * (R_AXIS_MAX / R_AXIS_MIN) ** (i / steps);
    const y = yOf(gravitationalRate(M_DEMO_BH, r));
    if (i === 0) ctx.moveTo(xOf(r), y);
    else ctx.lineTo(xOf(r), y);
  }
  ctx.stroke();

  /* The dot at the slider's distance. */
  const rate = gravitationalRate(M_DEMO_BH, view.r);
  const xD = xOf(view.r);
  const yD = yOf(rate);
  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(xD, yD, 4, 0, TAU);
  ctx.fill();
  const marks: LabelBox[] = [{ x0: xD - 5, x1: xD + 5, y0: yD - 5, y1: yD + 5 }];

  /* Guide labels in rows at the top of the plot, left-aligned beside each guide; dropped where there is no room. */
  ctx.fillStyle = COLORS.inkFaint;
  const rows = [plotTop + 12, plotTop + 27, plotTop + 42];
  for (const [i, [, name]] of GUIDES.entries()) {
    const x = (guideXs[i] ?? plotLeft) + 3;
    const spot = rows
      .map((y) => ({ x, y, align: 'left' as const }))
      .find(
        (c) =>
          inside(ctx, name, c, plotBox) &&
          ![...obstacles, ...marks].some((o) => overlaps(labelBox(ctx, name, c.x, c.y, c.align), o, 2)),
      );
    if (spot) platedText(ctx, name, spot, obstacles);
  }

  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, rate.toFixed(4), xD, yD, plotBox, obstacles, marks);
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size.
 *
 * One obstacle list runs through both panels in drawing order, so every label
 * placed by measurement is placed against every label already on the canvas.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): void {
  ctx.clearRect(0, 0, w, h);
  if (w <= PLOT_LEFT + PAD.right + 44 || h <= 0) return;

  const splitY = Math.round(h * TOP_SHARE);
  const obstacles: LabelBox[] = [];

  ctx.save();
  drawClocks(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawGravity(ctx, w, h, splitY, view, obstacles);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

type Shown = { v: number; r: number };

/**
 * Slides `shown[key]` to `to`, in log space for a log slider and linearly
 * otherwise (v starts at rest, where a log has nowhere to begin), painting
 * each frame; a changed target cancels the frame in flight.
 */
function slide(
  shown: { current: Shown },
  key: keyof Shown,
  to: number,
  log: boolean,
  jump: boolean,
  paint: () => void,
): (() => void) | undefined {
  const from = shown.current[key];
  if (jump || from === to || typeof requestAnimationFrame === 'undefined') {
    shown.current = { ...shown.current, [key]: to };
    paint();
    return undefined;
  }
  const a = log ? Math.log(from) : from;
  const b = log ? Math.log(to) : to;
  let frame = 0;
  let start: number | null = null;
  const tick = (time: number) => {
    if (start === null) start = time;
    const progress = Math.min(1, (time - start) / DURATION.slow);
    const t = a + (b - a) * eased(EASE.out, progress);
    const value = progress >= 1 ? to : log ? Math.exp(t) : t;
    shown.current = { ...shown.current, [key]: value };
    paint();
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export default function TimeDilationSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const v = readParam(params, values, 'v');
  const r = readParam(params, values, 'r');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/relativity`, once per render.
  const gamma = lorentzFactor(v);
  const dailyLoss = clockDeficit(v) * DAY_S;
  const trip = twinTrip(D_PROXIMA, v);
  const moving = v > 0;
  const rate = gravitationalRate(M_DEMO_BH, r);
  const hourFarAway = rate > 0 ? HOUR / rate : Infinity;
  const combined = rate / gamma;

  /** The values the panels are drawn at, which trail the sliders while they slide. */
  const shownRef = useRef<Shown>({ v, r });
  /** How far through the looping trip the clocks are; held at the end under reduced motion. */
  const phaseRef = useRef(reduced ? 1 : 0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvasSize(canvas);
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
    drawScene(ctx, rect.width, rect.height, { ...shownRef.current, phase: phaseRef.current, units });
  }, [units]);

  /* The trip loops; under reduced motion both clocks rest at its end. */
  useEffect(() => {
    if (reduced) {
      phaseRef.current = 1;
      paint();
    }
  }, [reduced, paint]);
  useRafLoop((deltaMs) => {
    phaseRef.current = (phaseRef.current + deltaMs / LOOP_MS) % 1;
    paint();
  }, !reduced);

  /* The clocks follow v and the dot follows r. */
  useEffect(() => slide(shownRef, 'v', v, false, reduced, paint), [v, reduced, paint]);
  useEffect(() => slide(shownRef, 'r', r, true, reduced, paint), [r, reduced, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return observeCanvasSize(canvas, () => paint());
  }, [paint]);

  return (
    <div className="flex min-h-[34rem] flex-col gap-4">
      <div className="relative h-[34rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Above, two clock faces, one at home and one on a ship flying to Proxima Centauri and back, the ship's clock turning more slowly by the Lorentz factor, with the years each records for the trip and a bar showing how much of each home hour the ship's clock ticks. Below, the rate of a clock hovering near a ten-solar-mass black hole against its distance, falling toward zero at the event horizon, with the photon sphere and innermost stable orbit marked."
          aria-describedby="time-dilation-readouts"
        />
      </div>

      <dl id="time-dilation-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Lorentz factor γ' : 'How much slower the moving clock runs'} value={formatGamma(gamma)} />
        <Readout
          label={deep ? '(1 − 1/γ) × 1 day' : 'A day at home, the traveller’s clock loses'}
          value={formatDailyLoss(dailyLoss, moving)}
        />
        <Readout label={deep ? '2d/v' : 'Round trip to Proxima Centauri, at home'} value={formatTrip(trip.home_s, moving)} />
        <Readout label={deep ? '2d/(γv)' : '…and for the traveller'} value={formatTrip(trip.traveller_s, moving)} />
        <Readout
          label={deep ? '√(1 − rₛ/r)' : 'Clock speed this close to the black hole'}
          value={formatRate(rate)}
        />
        <Readout
          label={deep ? '1 h / √(1 − rₛ/r)' : 'One hour here is, far away'}
          value={Number.isFinite(hourFarAway) ? formatDuration(hourFarAway) : 'forever'}
        />
        <Readout label={deep ? 'Combined rate' : 'Hovering there and moving at this speed'} value={combined.toFixed(4)} />
      </dl>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-ui text-xs text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums text-ember">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Test surface                                                        */
/* ------------------------------------------------------------------ */

/**
 * Internals exposed for `tests/canvas.test.ts`, and for nothing else — the same
 * deliberately ugly name the other sims use.
 */
export const __internals = {
  drawScene,
  formatDuration,
  formatTripTime,
  formatTrip,
  formatDailyLoss,
  formatGamma,
  formatRate,
};

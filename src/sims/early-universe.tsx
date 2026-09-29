/**
 * The early universe — how it cooled, above; what existed, below.
 *
 * Top panel: temperature against time on log-log axes, from one microsecond to
 * today, with the epochs shaded behind the curve. A dot rides the curve at the
 * time slider; a dashed line marks the temperature at which the chosen particle
 * stops being made (kT = mc²), and a ring marks where the universe crossed it.
 *
 * Bottom panel: the same epochs as a ribbon on the same time axis, hot to cold,
 * with the current one highlighted and described beneath.
 *
 * No physics lives in this file. Every temperature, time and scale factor comes
 * from `@/physics/earlyuniverse`, which the sanity block also reads. This file
 * owns pixels and formatting only.
 *
 * The curve is computed once and cached. Below the radiation–ΛCDM stitch it is
 * sampled log-spaced in time; above it, log-spaced in scale factor as the points
 * (t(a), T₀/a) — the same curve, since T = T₀/a there, for a fiftieth of the
 * cost of inverting t(a) at every sample.
 *
 * Motion: when the time slider moves, the dot and the cursor slide to the new
 * time over `DURATION.slow` on the `EASE.out` curve, in log t. Under reduced
 * motion they jump, and the canvas is still between drags.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { EV, JULIAN_YEAR, K_B, T_CMB } from '@/physics/constants';
import {
  EPOCHS,
  type EpochRow,
  epochAt,
  freezeOutTime,
  lcdmScaleFactorAtTime,
  lcdmTimeAtScaleFactor,
  radiationTemperatureAtTime,
  scaleFactorAtTime,
  stitchTime,
  temperatureAtTime,
  timeAtTemperature,
} from '@/physics/earlyuniverse';
import { DURATION, EASE, type Bezier } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, overlaps, type LabelBox } from './labels';

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

function exponentGlyph(exp: number): string {
  return String(exp)
    .split('')
    .map((ch) => SUPERSCRIPT[ch] ?? ch)
    .join('');
}

/** "1.23 × 10⁻⁷" — rounded before it reaches the screen, mantissa renormalised. */
function scientific(value: number, digits = 3): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  const places = Math.max(0, digits - 1);
  if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
  return `${(value / 10 ** exp).toFixed(places)} × 10${exponentGlyph(exp)}`;
}

/** The skill's plain-decimal band: plain inside [0.01, 10 000), exponent outside. */
function plainOrScientific(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 0.01 && abs < 1e4) return SIG3.format(value);
  return scientific(value);
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;

/**
 * A time since the Big Bang in the largest unit that keeps the number human,
 * three significant figures. Below a microsecond — only freeze-out times for
 * heavy particles reach there — seconds in scientific notation.
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 1e-6) return `${scientific(seconds)} s`;
  if (seconds < 1e-3) return `${SIG3.format(seconds * 1e6)} µs`;
  if (seconds < 1) return `${SIG3.format(seconds * 1e3)} ms`;
  if (seconds < MINUTE) return `${SIG3.format(seconds)} s`;
  if (seconds < HOUR) return `${SIG3.format(seconds / MINUTE)} min`;
  if (seconds < DAY) return `${SIG3.format(seconds / HOUR)} h`;
  if (seconds < JULIAN_YEAR) return `${SIG3.format(seconds / DAY)} days`;
  const years = seconds / JULIAN_YEAR;
  if (years < 1e3) return `${SIG3.format(years)} yr`;
  if (years < 1e6) return `${SIG3.format(years / 1e3)} kyr`;
  if (years < 1e9) return `${SIG3.format(years / 1e6)} Myr`;
  return `${SIG3.format(years / 1e9)} Gyr`;
}

/**
 * An energy in J as eV, keV, MeV or GeV, three significant figures.
 *
 * The switch to the next unit comes at a tenth of it rather than at one, so
 * the value one second in reads 0.859 MeV, as the prose and the worked example
 * quote it, rather than 859 keV.
 */
function formatEnergy(joules: number): string {
  if (!Number.isFinite(joules) || joules <= 0) return '—';
  const ev = joules / EV;
  if (ev >= 1e9) return `${plainOrScientific(ev / 1e9)} GeV`;
  if (ev >= 1e5) return `${plainOrScientific(ev / 1e6)} MeV`;
  if (ev >= 1e2) return `${plainOrScientific(ev / 1e3)} keV`;
  return `${plainOrScientific(ev)} eV`;
}

/** An energy in J as MeV, for the particle's line — the slider's own unit. */
function formatMeV(joules: number): string {
  return `${plainOrScientific(joules / (1e6 * EV))} MeV`;
}

/** "1 / 5.16 × 10⁹", "0.62", "1 (today)". */
function formatScaleFactor(a: number): string {
  if (!Number.isFinite(a) || a <= 0) return '—';
  if (a >= 0.9995) return '1 (today)';
  if (a < 0.5) return `1 / ${plainOrScientific(1 / a)}`;
  return SIG3.format(a);
}

/**
 * A motion token's cubic Bézier, evaluated: progress in, eased progress out.
 * Bisection on x(t) = p, then y(t).
 */
function eased(curve: Bezier, p: number): number {
  const [x1, y1, x2, y2] = curve;
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < p) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}

/* ------------------------------------------------------------------ */
/* The cooling curve, computed once                                    */
/* ------------------------------------------------------------------ */

/** Samples along the curve. */
const CURVE_SAMPLES = 400;

export interface CurvePoint {
  /** Time since the Big Bang, s. */
  t: number;
  /** Photon temperature, K. */
  T: number;
}

const curveCache = new Map<string, CurvePoint[]>();

/**
 * The temperature history from `tMin` to `tMax`, 400 points, cached by range.
 *
 * Split at the stitch in proportion to the decades on each side. Before it,
 * log-spaced times through `radiationTemperatureAtTime`; after it, log-spaced
 * scale factors through `lcdmTimeAtScaleFactor`, with T = T₀/a — exactly the
 * relation `temperatureAtTime` inverts, sampled from the cheap side.
 */
function curveFor(tMin: number, tMax: number): CurvePoint[] {
  const key = `${tMin}:${tMax}`;
  const cached = curveCache.get(key);
  if (cached) return cached;

  const stitch = stitchTime();
  const logMin = Math.log10(tMin);
  const logMax = Math.log10(tMax);
  const logStitch = Math.min(logMax, Math.max(logMin, Math.log10(stitch)));
  const early = Math.max(2, Math.round((CURVE_SAMPLES * (logStitch - logMin)) / (logMax - logMin)));
  const late = Math.max(2, CURVE_SAMPLES - early);

  const points: CurvePoint[] = [];
  for (let i = 0; i < early; i += 1) {
    const t = 10 ** (logMin + ((logStitch - logMin) * i) / early);
    points.push({ t, T: radiationTemperatureAtTime(t) });
  }
  const aStart = Math.log10(lcdmScaleFactorAtTime(10 ** logStitch));
  const aEnd = Math.log10(lcdmScaleFactorAtTime(tMax));
  for (let i = 0; i < late; i += 1) {
    const a = 10 ** (aStart + ((aEnd - aStart) * i) / (late - 1));
    points.push({ t: lcdmTimeAtScaleFactor(a), T: T_CMB / a });
  }

  curveCache.set(key, points);
  return points;
}

/** Temperature on the drawn curve at time t, K: log-log interpolation between samples. */
function curveTemperatureAt(curve: CurvePoint[], t: number): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) return NaN;
  if (t <= first.t) return first.T;
  if (t >= last.t) return last.T;
  let lo = 0;
  let hi = curve.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((curve[mid] as CurvePoint).t < t) lo = mid;
    else hi = mid;
  }
  const a = curve[lo] as CurvePoint;
  const b = curve[hi] as CurvePoint;
  const f = (Math.log(t) - Math.log(a.t)) / (Math.log(b.t) - Math.log(a.t));
  return Math.exp(Math.log(a.T) + f * (Math.log(b.T) - Math.log(a.T)));
}

/** Epoch boundaries in time: when kT fell to each row's upper bound. */
let boundaryCache: number[] | null = null;
function epochBoundaries(): number[] {
  // Row i spans from boundary[i] (its hot edge) to boundary[i + 1].
  boundaryCache ??= EPOCHS.map((row) =>
    Number.isFinite(row.kTmax_J) ? timeAtTemperature(row.kTmax_J / K_B) : 0,
  );
  return boundaryCache;
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
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const AXIS_GUTTER = 44;
/** Room for the Deep tier's right-hand eV axis. */
const RIGHT_AXIS = 36;
const TOP_SHARE = 0.66;

/** The temperature axis, K. */
const T_AXIS_MIN = 1;
const T_AXIS_MAX = 1e13;

type Units = 'friendly' | 'technical';

interface View {
  /** Time the dot and cursor are drawn at, s — mid-tween while they slide. */
  t: number;
  /** Particle rest energy, J. */
  E: number;
  /** The time axis, s. */
  tMin: number;
  tMax: number;
  curve: CurvePoint[];
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

/** Text on a plate of the background, so lines running under it stay out of the way. */
function placePlated(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  obstacles: LabelBox[],
): void {
  const box = labelBox(ctx, text, x, y, align);
  const ink = ctx.fillStyle;
  ctx.fillStyle = 'rgba(5,7,12,0.82)';
  ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
  ctx.fillStyle = ink;
  placeText(ctx, text, x, y, align, obstacles);
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
  const half = ctx.measureText(text).width / 2;
  const x = right - left >= 2 * half ? Math.min(right - half, Math.max(left + half, cx)) : (left + right) / 2;
  placeText(ctx, text, x, y, 'center', obstacles);
}

/**
 * A plated label near a point, in the first spot inside `bounds` and clear of
 * everything already drawn — the same candidate grid the CMB sim uses.
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
  const candidates: { x: number; y: number; align: CanvasTextAlign }[] = [];
  for (const dy of [-9, 15, -21, 27, -33, 39, -45, 51, -57, 63, -69, 75]) {
    candidates.push({ x, y: y + dy, align: 'center' });
    candidates.push({ x: x + 9, y: y + dy + (dy < 0 ? 6 : -6), align: 'left' });
    candidates.push({ x: x - 9, y: y + dy + (dy < 0 ? 6 : -6), align: 'right' });
  }
  const inside = candidates.filter((c) => {
    const box = labelBox(ctx, text, c.x, c.y, c.align);
    return box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
  });
  const spot =
    inside.length > 0
      ? firstClearPlacement(ctx, text, inside, [...obstacles, ...extra])
      : { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2, align: 'center' as const };
  placePlated(ctx, text, spot.x, spot.y, spot.align, obstacles);
}

/** Tick marks for the time axis, in human units. */
const TIME_TICKS: { t: number; label: string }[] = [
  { t: 1e-6, label: '1 µs' },
  { t: 1e-3, label: '1 ms' },
  { t: 1, label: '1 s' },
  { t: MINUTE, label: '1 min' },
  { t: JULIAN_YEAR, label: '1 yr' },
  { t: 1e3 * JULIAN_YEAR, label: '1 kyr' },
  { t: 1e6 * JULIAN_YEAR, label: '1 Myr' },
  { t: 1e9 * JULIAN_YEAR, label: '1 Gyr' },
];

/** Epoch tints, hot to cold: white-orange to deep blue. */
const HOT = [255, 226, 180];
const WARM = [236, 142, 58];
const COLD = [28, 44, 110];

function epochTint(index: number): number[] {
  const f = EPOCHS.length > 1 ? index / (EPOCHS.length - 1) : 0;
  const [from, to, g] = f < 0.35 ? [HOT, WARM, f / 0.35] : [WARM, COLD, (f - 0.35) / 0.65];
  return (from as number[]).map((c, i) => c + (((to as number[])[i] ?? c) - c) * (g as number));
}

function rgb(c: number[], alpha = 1): string {
  const [r, g, b] = c.map((x) => Math.round(Math.min(255, Math.max(0, x))));
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Axis {
  xOf: (t: number) => number;
  left: number;
  right: number;
}

function drawCooling(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): Axis | null {
  const deep = view.units === 'technical';
  const plotLeft = AXIS_GUTTER;
  const plotRight = w - PAD.right - (deep ? RIGHT_AXIS : 0);
  const plotTop = 28;
  const plotBottom = splitY - 38;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return null;

  const logT0 = Math.log10(view.tMin);
  const logT1 = Math.log10(view.tMax);
  const logK0 = Math.log10(T_AXIS_MIN);
  const logK1 = Math.log10(T_AXIS_MAX);
  const xOf = (t: number) => plotLeft + ((Math.log10(t) - logT0) / (logT1 - logT0)) * plotW;
  const yOf = (T: number) => plotBottom - ((Math.log10(T) - logK0) / (logK1 - logK0)) * plotH;
  const inX = (t: number) => t >= view.tMin && t <= view.tMax;
  const inY = (T: number) => T >= T_AXIS_MIN && T <= T_AXIS_MAX;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';

  /* Title row. */
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'How the universe cooled', PAD.left, 14, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'T (K)' : 'temperature', plotRight, 14, 'right', obstacles);

  /* Epoch bands, alternately shaded. */
  const bounds = epochBoundaries();
  const spans = EPOCHS.map((row, i) => {
    const hot = Math.max(view.tMin, bounds[i] ?? view.tMin);
    const next = bounds[i + 1];
    const cold = Math.min(view.tMax, next === undefined ? view.tMax : next);
    return { row, x0: xOf(hot), x1: xOf(Math.max(hot, cold)) };
  });
  spans.forEach((span, i) => {
    if (i % 2 === 1 && span.x1 > span.x0) {
      ctx.fillStyle = 'rgba(157,180,255,0.05)';
      ctx.fillRect(span.x0, plotTop, span.x1 - span.x0, plotH);
    }
  });

  /* Axes. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  if (deep) ctx.lineTo(plotRight, plotTop);
  ctx.stroke();

  /* Temperature decades, every third, in K. */
  ctx.fillStyle = COLORS.inkFaint;
  for (let exp = 0; exp <= 12; exp += 3) {
    placeText(ctx, `10${exponentGlyph(exp)} K`, plotLeft - 4, yOf(10 ** exp) + 3, 'right', obstacles);
  }

  /* The Deep tier's second axis: the same temperatures as kT. */
  if (deep) {
    for (const [ev, label] of [
      [1e-3, '1 meV'],
      [1, '1 eV'],
      [1e3, '1 keV'],
      [1e6, '1 MeV'],
    ] as const) {
      const T = (ev * EV) / K_B;
      if (inY(T)) placeText(ctx, label, plotRight + 4, yOf(T) + 3, 'left', obstacles);
    }
  }

  /* Time ticks in human units, thinned so no two labels touch. */
  ctx.strokeStyle = COLORS.edge;
  const tickLabels: LabelBox[] = [];
  for (const tick of TIME_TICKS) {
    if (!inX(tick.t)) continue;
    const x = xOf(tick.t);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    const half = ctx.measureText(tick.label).width / 2;
    const cx = Math.min(w - half, Math.max(half, x));
    const box = labelBox(ctx, tick.label, cx, plotBottom + 14, 'center');
    if (tickLabels.some((b) => overlaps(box, b, 3))) continue;
    tickLabels.push(box);
    placeText(ctx, tick.label, cx, plotBottom + 14, 'center', obstacles);
  }
  centredWithin(
    ctx,
    deep ? 't (s)' : 'time after the beginning',
    (plotLeft + plotRight) / 2,
    plotBottom + 28,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The curve. */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  let drawing = false;
  for (const point of view.curve) {
    if (!inX(point.t) || !inY(point.T)) {
      drawing = false;
      continue;
    }
    if (!drawing) ctx.moveTo(xOf(point.t), yOf(point.T));
    else ctx.lineTo(xOf(point.t), yOf(point.T));
    drawing = true;
  }
  ctx.stroke();

  /* The particle: a dashed line at kT = mc², and a ring where the curve crosses it. */
  const TE = view.E / K_B;
  const dots: LabelBox[] = [];
  let ring: { x: number; y: number } | null = null;
  if (inY(TE)) {
    const yE = yOf(TE);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.ember;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotLeft, yE);
    ctx.lineTo(plotRight, yE);
    ctx.stroke();
    ctx.setLineDash([]);
    const tCross = timeAtTemperature(TE);
    if (inX(tCross)) {
      ring = { x: xOf(tCross), y: yE };
      ctx.strokeStyle = COLORS.ember;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 5, 0, TAU);
      ctx.stroke();
      dots.push({ x0: ring.x - 6, x1: ring.x + 6, y0: ring.y - 6, y1: ring.y + 6 });
    }
  }

  /* The dot at the time slider, on the drawn curve. */
  const tDot = Math.min(view.tMax, Math.max(view.tMin, view.t));
  const TDot = curveTemperatureAt(view.curve, tDot);
  if (Number.isFinite(TDot) && inY(TDot)) {
    const x = xOf(tDot);
    const y = yOf(TDot);
    ctx.fillStyle = 'rgba(157,180,255,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, TAU);
    ctx.fill();
    dots.push({ x0: x - 7, x1: x + 7, y0: y - 7, y1: y + 7 });
  }

  /*
   * Labels last, against everything drawn. Epoch titles first, along the top in
   * up to two rows, each centred on its band and kept only if it clears the
   * others; a title with no room is dropped rather than squeezed. Then the
   * particle's energy and the ring, which move and so find room around them.
   */
  ctx.fillStyle = COLORS.inkFaint;
  const rows = [plotTop + 11, plotTop + 24];
  for (const span of spans) {
    const width = span.x1 - span.x0;
    if (width <= 0) continue;
    const text = span.row.title;
    const half = ctx.measureText(text).width / 2;
    // A title may spill past its band a little, not onto a neighbour's middle.
    if (2 * half > width + 40) continue;
    const cx = Math.min(plotBox.x1 - half, Math.max(plotBox.x0 + half, (span.x0 + span.x1) / 2));
    for (const y of rows) {
      const box = labelBox(ctx, text, cx, y, 'center');
      if ([...obstacles, ...dots].some((o) => overlaps(box, o, 2))) continue;
      placePlated(ctx, text, cx, y, 'center', obstacles);
      break;
    }
  }

  if (inY(TE)) {
    ctx.fillStyle = COLORS.ember;
    labelNear(ctx, formatMeV(view.E), plotRight - 40, yOf(TE), plotBox, obstacles, dots);
    if (ring) labelNear(ctx, 'stops being made', ring.x, ring.y, plotBox, obstacles, dots);
  } else {
    // Heavier than the chart: the line would sit above 10¹³ K. On a narrow plot
    // the sentence does not fit, and an arrow says the same thing.
    ctx.fillStyle = COLORS.ember;
    const full = `${formatMeV(view.E)} is above this chart`;
    const text =
      ctx.measureText(full).width + 8 <= plotBox.x1 - plotBox.x0 ? full : `${formatMeV(view.E)} ↑`;
    labelNear(ctx, text, plotRight - 60, plotTop + 4, plotBox, obstacles, dots);
  }

  return { xOf, left: plotLeft, right: plotRight };
}

/** Words, broken into at most two lines that each fit `width`. */
function wrapTwo(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  if (ctx.measureText(text).width <= width) return [text];
  const words = text.split(' ');
  let first = '';
  for (const word of words) {
    const next = first ? `${first} ${word}` : word;
    if (ctx.measureText(next).width > width) break;
    first = next;
  }
  const rest = text.slice(first.length).trim();
  return first ? [first, rest] : [text];
}

function drawContents(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  axis: Axis,
  obstacles: LabelBox[],
): void {
  const left = PAD.left;
  const right = w - PAD.right;
  const titleY = splitY + 18;
  const ribbonTop = splitY + 26;
  const ribbonBottom = ribbonTop + 34;

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'What exists', left, titleY, 'left', obstacles);

  const bounds = epochBoundaries();
  const tNow = Math.min(view.tMax, Math.max(view.tMin, view.t));
  const current: EpochRow = epochAt(curveTemperatureAt(view.curve, tNow));

  EPOCHS.forEach((row, i) => {
    const hot = Math.max(view.tMin, bounds[i] ?? view.tMin);
    const next = bounds[i + 1];
    const cold = Math.min(view.tMax, next === undefined ? view.tMax : next);
    if (cold <= hot) return;
    const x0 = axis.xOf(hot);
    const x1 = axis.xOf(cold);
    const isCurrent = row.id === current.id;
    ctx.fillStyle = rgb(epochTint(i), isCurrent ? 0.95 : 0.4);
    ctx.fillRect(x0, ribbonTop, x1 - x0, ribbonBottom - ribbonTop);
    if (isCurrent) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, ribbonTop - 1);
      ctx.lineTo(x1, ribbonTop - 1);
      ctx.moveTo(x0, ribbonBottom + 1);
      ctx.lineTo(x1, ribbonBottom + 1);
      ctx.stroke();
    }
  });

  /* The cursor at the slider time. */
  const xNow = axis.xOf(tNow);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xNow, ribbonTop - 5);
  ctx.lineTo(xNow, ribbonBottom + 5);
  ctx.stroke();

  /* The current epoch, described. */
  ctx.fillStyle = COLORS.ink;
  const lines = wrapTwo(ctx, current.description, right - left);
  lines.forEach((line, i) => {
    centredWithin(ctx, line, (left + right) / 2, ribbonBottom + 20 + i * 13, left, right, obstacles);
  });
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size.
 *
 * One obstacle list runs through both panels in drawing order, so every label
 * placed by measurement is placed against every label already on the canvas.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): void {
  ctx.clearRect(0, 0, w, h);
  if (w <= PAD.left + PAD.right + AXIS_GUTTER + RIGHT_AXIS || h <= 0) return;

  const splitY = Math.round(h * TOP_SHARE);
  const obstacles: LabelBox[] = [];

  ctx.save();
  const axis = drawCooling(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  if (axis) drawContents(ctx, w, splitY, view, axis, obstacles);
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

function paramBound(params: Param[], id: string, which: 'min' | 'max'): number {
  return params.find((p) => p.id === id)?.[which] ?? NaN;
}

export default function EarlyUniverseSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const t = readParam(params, values, 't');
  const E = readParam(params, values, 'E');
  const tMin = paramBound(params, 't', 'min');
  const tMax = paramBound(params, 't', 'max');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/earlyuniverse`, once per render.
  const T = temperatureAtTime(t);
  const a = scaleFactorAtTime(t);
  const epoch = epochAt(T);
  const made = K_B * T > E;
  const tFreeze = freezeOutTime(E);

  /** The time the dot and cursor are drawn at, which trails `t` while they slide. */
  const shownRef = useRef(t);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    drawScene(ctx, rect.width, rect.height, {
      t: shownRef.current,
      E,
      tMin,
      tMax,
      curve: curveFor(tMin, tMax),
      units,
    });
  }, [E, tMin, tMax, units]);

  /*
   * The slide, in log t, from wherever the dot is drawn now; a changed target
   * cancels the frame in flight. Reduced motion, or no rAF, jumps.
   */
  useEffect(() => {
    const from = shownRef.current;
    const to = t;
    if (reduced || from === to || typeof requestAnimationFrame === 'undefined') {
      shownRef.current = to;
      paint();
      return;
    }

    const logFrom = Math.log(from);
    const logTo = Math.log(to);
    let frame = 0;
    let start: number | null = null;
    const tick = (time: number) => {
      if (start === null) start = time;
      const progress = Math.min(1, (time - start) / DURATION.slow);
      shownRef.current = progress >= 1 ? to : Math.exp(logFrom + (logTo - logFrom) * eased(EASE.out, progress));
      paint();
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [t, reduced, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const temperature = `${plainOrScientific(T)} K`;

  return (
    <div className="flex min-h-[26rem] flex-col gap-4">
      <div className="relative h-[26rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Temperature of the universe against time since the beginning, on logarithmic axes from one microsecond to today, with the epochs shaded, above a ribbon of the same epochs with the current one highlighted and described."
          aria-describedby="early-universe-readouts"
        />
      </div>

      <dl id="early-universe-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Time t' : 'How long after the beginning'} value={formatTime(t)} />
        <Readout
          label={deep ? 'Temperature T' : 'How hot'}
          value={deep ? `${temperature} (kT = ${formatEnergy(K_B * T)})` : temperature}
        />
        <Readout label={deep ? 'Scale factor a' : 'How much smaller than today'} value={formatScaleFactor(a)} />
        <Readout label={deep ? 'Epoch' : 'What exists'} value={epoch.title} />
        <Readout
          label={deep ? 'kT > mc²' : 'Is this particle still being made?'}
          value={made ? 'Yes: light is hot enough to make it in pairs' : 'No: too cold; only leftovers remain'}
        />
        <Readout
          label={deep ? 'Freeze-out time t(kT = mc²)' : 'When it stopped being made'}
          value={formatTime(tFreeze)}
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
 * Internals exposed for `tests/canvas.test.ts`, and for nothing else — the same
 * deliberately ugly name the other sims use.
 */
export const __internals = { drawScene, curveFor, formatTime, formatScaleFactor, formatEnergy };

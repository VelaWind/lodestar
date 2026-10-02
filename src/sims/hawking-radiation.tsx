/**
 * Hawking radiation — how hot a black hole glows, above; how long it lasts, below.
 *
 * Top panel: the Hawking temperature against mass on log–log axes, from a
 * hundred tonnes to five Suns. A horizontal line marks today's microwave
 * background; holes left of the crossing are hotter than it and shrinking,
 * holes right of it colder and growing, and the two sides are shaded and named
 * where there is room. A mountain, the Moon and the Sun are ticked on the mass
 * axis. A dot sits at the slider's mass.
 *
 * Bottom panel: the photons-only evaporation time against the same mass axis,
 * from a millisecond to 10⁷⁰ years, with the age of the universe marked and a
 * dot at the slider's mass.
 *
 * No physics lives in this file. Every temperature, power, lifetime and verdict
 * comes from `@/physics/blackhole` and `@/physics/hawking`, which the sanity
 * block also reads. This file owns pixels and formatting only.
 *
 * Motion: when the slider changes, both dots slide to the new mass in log M
 * over `DURATION.slow` on the `EASE.out` curve. Under reduced motion they jump.
 */
import { useCallback, useEffect, useRef } from 'react';
import { canvasSize, observeCanvasSize } from './canvasSize';
import type { Param, ParamValues, SimProps } from '@/content/types';
import {
  AGE_UNIVERSE,
  DAY_S,
  EV,
  JULIAN_YEAR,
  K_B,
  M_EARTH,
  M_MOON,
  M_SUN,
  T_CMB,
} from '@/physics/constants';
import { evaporationTime, hawkingTemperature, schwarzschildRadius } from '@/physics/blackhole';
import { emissionBand, hawkingPower, massForHawkingTemperature, netWithCMB } from '@/physics/hawking';
import { eased } from '@/motion/ease';
import { DURATION, EASE } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, overlaps, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

const MINUTE = 60;
const HOUR = 3600;

const SUPERSCRIPT_DIGITS: Record<string, string> = {
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

/** 10ⁿ as text: "1", "10", "10²⁰", "10⁻⁶". */
function powerOfTen(exponent: number): string {
  if (exponent === 0) return '1';
  if (exponent === 1) return '10';
  return `10${String(exponent)
    .split('')
    .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join('')}`;
}

/** "2.67 × 10¹²": three significant figures, the mantissa renormalised if rounding carries it to 10. */
function scientific(value: number): string {
  let exponent = Math.floor(Math.log10(Math.abs(value)));
  if (Math.abs(Number((value / 10 ** exponent).toFixed(2))) >= 10) exponent += 1;
  return `${(value / 10 ** exponent).toFixed(2)} × ${powerOfTen(exponent)}`;
}

/** Number words for the large band, largest first: [threshold, divisor, word]. */
const NUMBER_WORDS: [number, number, string][] = [
  [1e12, 1e12, 'trillion'],
  [1e9, 1e9, 'billion'],
  [1e6, 1e6, 'million'],
];

/**
 * A positive number to three significant figures in the site's reader bands:
 * plain from 0.01 to 10 000, with thousands separators to a million, in number
 * words to a thousand trillion, and as a power of ten outside that.
 */
function formatSig3(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const rounded = Number(value.toPrecision(3));
  const abs = Math.abs(rounded);
  if (abs >= 0.01 && abs < 1e4) return String(rounded);
  if (abs >= 1e4 && abs < 1e6) return SIG3.format(rounded);
  if (abs >= 1e6 && abs < 1e15) {
    const [, divisor, word] = NUMBER_WORDS.find(([threshold]) => abs >= threshold)!;
    return `${Number((rounded / divisor).toPrecision(3))} ${word}`;
  }
  return scientific(value);
}

/** Length units for the horizon, largest first: [metres per unit, name]. */
const LENGTH_UNITS: [number, string][] = [
  [1e3, 'km'],
  [1, 'm'],
  [1e-3, 'mm'],
  [1e-6, 'µm'],
  [1e-9, 'nm'],
  [1e-12, 'pm'],
  [1e-15, 'fm'],
];

/** A radius in m, in the unit its magnitude warrants, fm to km, three significant figures. */
function formatRadius(metres: number): string {
  if (!(metres > 0) || !Number.isFinite(metres)) return '—';
  const rounded = Number(metres.toPrecision(3));
  const [perUnit, unit] = LENGTH_UNITS.find(([f]) => rounded >= f) ?? LENGTH_UNITS[LENGTH_UNITS.length - 1]!;
  return `${formatSig3(metres / perUnit)} ${unit}`;
}

/** An energy in J as eV, keV, MeV, GeV or TeV, three significant figures. */
function formatEnergy(joules: number): string {
  if (!(joules > 0) || !Number.isFinite(joules)) return '—';
  const eV = joules / EV;
  const rounded = Number(eV.toPrecision(3));
  if (rounded >= 1e12) return `${formatSig3(eV / 1e12)} TeV`;
  if (rounded >= 1e9) return `${formatSig3(eV / 1e9)} GeV`;
  if (rounded >= 1e6) return `${formatSig3(eV / 1e6)} MeV`;
  if (rounded >= 1e3) return `${formatSig3(eV / 1e3)} keV`;
  return `${formatSig3(eV)} eV`;
}

/** A temperature in K, three significant figures. */
function formatTemperature(kelvin: number): string {
  return `${formatSig3(kelvin)} K`;
}

/** A power in W, three significant figures. */
function formatPower(watts: number): string {
  return `${formatSig3(watts)} W`;
}

/**
 * A lifetime in s, in human units up to years — ms, s, min, h, days, then
 * years in words — and as a power of ten of years beyond a trillion.
 */
function formatLifetime(seconds: number): string {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return '—';
  if (seconds < 1) return `${formatSig3(seconds * 1e3)} ms`;
  if (seconds < MINUTE) return `${formatSig3(seconds)} s`;
  if (seconds < HOUR) return `${formatSig3(seconds / MINUTE)} min`;
  if (seconds < DAY_S) return `${formatSig3(seconds / HOUR)} h`;
  const years = seconds / JULIAN_YEAR;
  if (years < 1) return `${formatSig3(seconds / DAY_S)} days`;
  if (Number(years.toPrecision(3)) >= 1e12) return `${scientific(years)} years`;
  const n = formatSig3(years);
  return `${n} ${n === '1' ? 'year' : 'years'}`;
}

/** The net readout: the comparison with the background, then the verdict. */
function formatNet(verdict: 'shrinking' | 'growing' | 'balanced'): string {
  if (verdict === 'balanced') return 'as warm as the background: in balance';
  return verdict === 'shrinking' ? 'hotter than the background: shrinking' : 'colder than the background: growing';
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#858ea2',
  edge: '#232b3b',
  grid: 'rgba(35,43,59,0.55)',
  star: '#9db4ff',
  ember: '#e8bd7d',
  warm: '#f0a868',
  cmb: '#c7a0e8',
  shrinking: 'rgba(240,168,104,0.08)',
  growing: 'rgba(157,180,255,0.07)',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const FONT_SUB = '7px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
/** Both panels share one mass axis, so the plot's left edge is common to both: room for "10⁴⁰ years". */
const PLOT_LEFT = 66;
const TOP_SHARE = 0.5;

/** The axes' ranges, display only: mass in kg, temperature in K, lifetime in s. */
const M_AXIS: [number, number] = [1e5, 1e31];
const T_AXIS: [number, number] = [1e-9, 1e19];
const LIFE_AXIS: [number, number] = [1e-3, 1e70 * JULIAN_YEAR];

/** The mass as warm as today's microwave background, kg. */
const M_CROSSOVER = massForHawkingTemperature(T_CMB);

/** Named masses ticked on the mass axis. A mountain is 10¹² kg, the round figure the module uses. */
const REFERENCES: [number, string][] = [
  [1e12, 'a mountain'],
  [M_MOON, 'the Moon'],
  [M_SUN, 'the Sun'],
];

/**
 * Landmarks for the "compared with" readout: a mountain (10¹² kg, the round
 * figure the module uses), the Moon, the Earth and the Sun. The slider's bare
 * kilograms span twenty-six decades, and a beginner needs a thing to hold.
 */
const LANDMARKS: [number, string][] = [
  [1e12, 'a mountain'],
  [M_MOON, 'the Moon'],
  [M_EARTH, 'the Earth'],
  [M_SUN, 'the Sun'],
];

/**
 * The mass as a multiple of the nearest landmark, nearest in log space:
 * "0.613 × the Moon" at the crossover. Far from every landmark (the slider's
 * hundred-tonne end is 10⁻⁷ of a mountain) the ratio is given as a power of
 * ten, since three significant figures of 10⁻⁷ say nothing a reader can use.
 */
function formatLandmark(M_kg: number): string {
  if (!(M_kg > 0)) return '—';
  let best = LANDMARKS[0]!;
  for (const landmark of LANDMARKS) {
    if (Math.abs(Math.log10(M_kg / landmark[0])) < Math.abs(Math.log10(M_kg / best[0]))) best = landmark;
  }
  const ratio = M_kg / best[0];
  if (ratio >= 0.01 && ratio < 1e4) return `${formatSig3(ratio)} × ${best[1]}`;
  return `about ${powerOfTen(Math.round(Math.log10(ratio)))} × ${best[1]}`;
}

const MASS_TICKS = [1e10, 1e15, 1e20, 1e25, 1e30];
const T_TICKS = [1e-6, 1, 1e6, 1e12, 1e18];
const LIFE_TICKS: [number, string][] = [
  [1, '1 s'],
  [JULIAN_YEAR, '1 year'],
  [1e9 * JULIAN_YEAR, `${powerOfTen(9)} years`],
  [1e20 * JULIAN_YEAR, `${powerOfTen(20)} years`],
  [1e40 * JULIAN_YEAR, `${powerOfTen(40)} years`],
  [1e60 * JULIAN_YEAR, `${powerOfTen(60)} years`],
];

type Units = 'friendly' | 'technical';

interface View {
  /** Mass as currently drawn, kg — mid-tween while it slides. */
  M: number;
  units: Units;
}

interface Frame {
  left: number;
  right: number;
  top: number;
  bottom: number;
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

/** Is a spot inside `bounds` and clear of everything in `blockers`? */
function clear(
  ctx: CanvasRenderingContext2D,
  text: string,
  c: { x: number; y: number; align: CanvasTextAlign },
  bounds: LabelBox,
  blockers: LabelBox[],
): boolean {
  return inside(ctx, text, c, bounds) && !blockers.some((o) => overlaps(labelBox(ctx, text, c.x, c.y, c.align), o, 2));
}

/**
 * The first label and spot, of several tried in order, that fits inside
 * `bounds` clear of every blocker; drawn plated. Nothing is drawn if none fits,
 * which is what "labelled where width allows" means.
 */
function placeFirstClear(
  ctx: CanvasRenderingContext2D,
  options: { text: string; spots: { x: number; y: number; align: CanvasTextAlign }[] }[],
  bounds: LabelBox,
  obstacles: LabelBox[],
  marks: LabelBox[],
): boolean {
  for (const { text, spots } of options) {
    const spot = spots.find((c) => clear(ctx, text, c, bounds, [...obstacles, ...marks]));
    if (spot) {
      platedText(ctx, text, spot, obstacles);
      return true;
    }
  }
  return false;
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
  const half = ctx.measureText(text).width / 2;
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
 * An axis title with a subscript, "T_H (K)" drawn as T with a small H, left
 * aligned at (x, y). Each piece is recorded as an obstacle.
 */
function subscripted(
  ctx: CanvasRenderingContext2D,
  parts: [string, string, string],
  x: number,
  y: number,
  obstacles: LabelBox[],
): void {
  const [base, sub, tail] = parts;
  ctx.font = FONT;
  placeText(ctx, base, x, y, 'left', obstacles);
  let cursor = x + ctx.measureText(base).width;
  ctx.font = FONT_SUB;
  placeText(ctx, sub, cursor, y + 2, 'left', obstacles);
  cursor += ctx.measureText(sub).width;
  ctx.font = FONT;
  if (tail) placeText(ctx, tail, cursor, y, 'left', obstacles);
}

/** x for a mass on the shared log axis. */
function xOfMass(f: Frame, M: number): number {
  const [lo, hi] = M_AXIS.map(Math.log10) as [number, number];
  return f.left + ((Math.log10(M) - lo) / (hi - lo)) * (f.right - f.left);
}

/** y for a value on a log axis spanning `range`. */
function yOfLog(f: Frame, value: number, range: [number, number]): number {
  const [lo, hi] = range.map(Math.log10) as [number, number];
  return f.bottom - ((Math.log10(value) - lo) / (hi - lo)) * (f.bottom - f.top);
}

/**
 * The frame, ticks and titles both panels share: axes, faint gridlines at the
 * y ticks, the mass ticks and reference marks along the bottom, and the mass
 * axis title. Tick labels that would touch one already drawn are skipped.
 */
function drawMassAxis(
  ctx: CanvasRenderingContext2D,
  w: number,
  f: Frame,
  deep: boolean,
  named: boolean,
  obstacles: LabelBox[],
): void {
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(f.left, f.top);
  ctx.lineTo(f.left, f.bottom);
  ctx.lineTo(f.right, f.bottom);
  ctx.stroke();

  ctx.font = FONT;
  ctx.fillStyle = COLORS.inkFaint;
  const row = (text: string, x: number, y: number) => {
    const half = ctx.measureText(text).width / 2;
    const cx = Math.min(w - PAD.right - half, Math.max(PAD.left + half, x));
    const box = labelBox(ctx, text, cx, y, 'center');
    if (!obstacles.some((o) => overlaps(box, o, 2))) placeText(ctx, text, cx, y, 'center', obstacles);
  };
  for (const M of MASS_TICKS) {
    const x = xOfMass(f, M);
    ctx.beginPath();
    ctx.moveTo(x, f.bottom);
    ctx.lineTo(x, f.bottom + 3);
    ctx.stroke();
    row(`${powerOfTen(Math.round(Math.log10(M)))} kg`, x, f.bottom + 13);
  }

  /* The named masses: a short warm mark on the axis, and the name beneath where it fits. */
  ctx.strokeStyle = COLORS.warm;
  for (const [M, name] of REFERENCES) {
    const x = xOfMass(f, M);
    ctx.beginPath();
    ctx.moveTo(x, f.bottom - 4);
    ctx.lineTo(x, f.bottom);
    ctx.stroke();
    if (named) {
      ctx.fillStyle = COLORS.warm;
      row(name, x, f.bottom + 28);
    }
  }

  ctx.fillStyle = COLORS.inkFaint;
  const titleY = f.bottom + (named ? 43 : 28);
  row(deep ? 'M (kg)' : 'mass', (f.left + f.right) / 2, titleY);
}

/** Faint gridlines and labels at the y ticks, right-aligned far enough left of the axis to clear a dot sitting on it. */
function drawYTicks(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  ticks: [number, string][],
  range: [number, number],
  obstacles: LabelBox[],
): void {
  ctx.font = FONT;
  for (const [value, label] of ticks) {
    const y = yOfLog(f, value, range);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(f.left, y);
    ctx.lineTo(f.right, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.inkFaint;
    const box = labelBox(ctx, label, f.left - 7, y + 3, 'right');
    if (!obstacles.some((o) => overlaps(box, o, 2))) placeText(ctx, label, f.left - 7, y + 3, 'right', obstacles);
  }
}

/** A log–log curve of `fn` across the mass axis. */
function drawCurve(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  fn: (M: number) => number,
  range: [number, number],
): void {
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const steps = 200;
  for (let i = 0; i <= steps; i += 1) {
    const M = M_AXIS[0] * (M_AXIS[1] / M_AXIS[0]) ** (i / steps);
    const x = xOfMass(f, M);
    const y = yOfLog(f, fn(M), range);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

/** A dot at the slider's mass, returned as an obstacle box for the labels placed after it. */
function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number): LabelBox {
  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, TAU);
  ctx.fill();
  return { x0: x - 5, x1: x + 5, y0: y - 5, y1: y + 5 };
}

/** A dashed horizontal reference line across the plot. */
function drawLevel(ctx: CanvasRenderingContext2D, f: Frame, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(f.left, y);
  ctx.lineTo(f.right, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTemperature(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const f: Frame = { left: PLOT_LEFT, right: w - PAD.right, top: 36, bottom: splitY - 52 };
  if (f.right - f.left <= 0 || f.bottom - f.top <= 0) return;
  const plotBox: LabelBox = { x0: f.left + 2, x1: f.right - 2, y0: f.top + 2, y1: f.bottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'How hot it glows', PAD.left, 14, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  if (deep) subscripted(ctx, ['T', 'H', ' (K)'], PAD.left, 27, obstacles);
  else placeText(ctx, 'temperature', PAD.left, 27, 'left', obstacles);

  /* The two sides of the crossover: shrinking today to the left, growing to the right. */
  const xCross = Math.min(f.right, Math.max(f.left, xOfMass(f, M_CROSSOVER)));
  ctx.fillStyle = COLORS.shrinking;
  ctx.fillRect(f.left, f.top, xCross - f.left, f.bottom - f.top);
  ctx.fillStyle = COLORS.growing;
  ctx.fillRect(xCross, f.top, f.right - xCross, f.bottom - f.top);

  drawYTicks(
    ctx,
    f,
    T_TICKS.map((T) => [T, `${powerOfTen(Math.round(Math.log10(T)))} K`]),
    T_AXIS,
    obstacles,
  );
  drawMassAxis(ctx, w, f, deep, true, obstacles);

  const yCmb = yOfLog(f, T_CMB, T_AXIS);
  drawLevel(ctx, f, yCmb, COLORS.cmb);
  drawCurve(ctx, f, hawkingTemperature, T_AXIS);

  const T = hawkingTemperature(view.M);
  const xD = xOfMass(f, view.M);
  const yD = yOfLog(f, T, T_AXIS);
  const marks = [drawDot(ctx, xD, yD)];

  /* The background line's label: at the right end above the line, then either end above or below, then a little further off. */
  ctx.font = FONT;
  ctx.fillStyle = COLORS.cmb;
  const cmbSpots = [-5, 13, -11, 19].flatMap((dy) => [
    { x: f.right - 4, y: yCmb + dy, align: 'right' as const },
    { x: f.left + 4, y: yCmb + dy, align: 'left' as const },
  ]);
  placeFirstClear(
    ctx,
    [
      { text: 'the microwave background, 2.7 K', spots: cmbSpots },
      { text: '2.7 K background', spots: cmbSpots },
    ],
    plotBox,
    obstacles,
    marks,
  );

  /* The two sides, named in the corners the curve leaves empty. */
  ctx.fillStyle = COLORS.warm;
  placeFirstClear(
    ctx,
    [{ text: 'shrinking today', spots: [{ x: f.left + 4, y: f.bottom - 6, align: 'left' }] }],
    { ...plotBox, x1: Math.max(plotBox.x0, xCross - 2) },
    obstacles,
    marks,
  );
  ctx.fillStyle = COLORS.star;
  placeFirstClear(
    ctx,
    [{ text: 'growing today', spots: [{ x: f.right - 4, y: f.top + 12, align: 'right' }] }],
    { ...plotBox, x0: Math.min(plotBox.x1, xCross + 2) },
    obstacles,
    marks,
  );

  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, formatTemperature(T), xD, yD, plotBox, obstacles, marks);
}

function drawLifetime(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const f: Frame = { left: PLOT_LEFT, right: w - PAD.right, top: splitY + 38, bottom: h - 36 };
  if (f.right - f.left <= 0 || f.bottom - f.top <= 0) return;
  const plotBox: LabelBox = { x0: f.left + 2, x1: f.right - 2, y0: f.top + 2, y1: f.bottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'How long it lasts', PAD.left, splitY + 16, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  if (deep) subscripted(ctx, ['t', 'evap', ''], PAD.left, splitY + 29, obstacles);
  else placeText(ctx, 'time to evaporate, if left alone', PAD.left, splitY + 29, 'left', obstacles);

  drawYTicks(ctx, f, LIFE_TICKS, LIFE_AXIS, obstacles);
  drawMassAxis(ctx, w, f, deep, false, obstacles);

  const yAge = yOfLog(f, AGE_UNIVERSE, LIFE_AXIS);
  drawLevel(ctx, f, yAge, COLORS.cmb);
  drawCurve(ctx, f, evaporationTime, LIFE_AXIS);

  const t = evaporationTime(view.M);
  const xD = xOfMass(f, view.M);
  const yD = yOfLog(f, t, LIFE_AXIS);
  const marks = [drawDot(ctx, xD, yD)];

  ctx.font = FONT;
  ctx.fillStyle = COLORS.cmb;
  const ageSpots = [-5, 13, -11, 19].flatMap((dy) => [
    { x: f.right - 4, y: yAge + dy, align: 'right' as const },
    { x: f.left + 4, y: yAge + dy, align: 'left' as const },
  ]);
  placeFirstClear(ctx, [{ text: 'the age of the universe', spots: ageSpots }], plotBox, obstacles, marks);

  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, formatLifetime(t), xD, yD, plotBox, obstacles, marks);
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
  drawTemperature(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawLifetime(ctx, w, h, splitY, view, obstacles);
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

/**
 * Slides `shown.current` to `to` in log space, painting each frame; a changed
 * target cancels the frame in flight.
 */
function slide(
  shown: { current: number },
  to: number,
  jump: boolean,
  paint: () => void,
): (() => void) | undefined {
  const from = shown.current;
  if (jump || from === to || typeof requestAnimationFrame === 'undefined') {
    shown.current = to;
    paint();
    return undefined;
  }
  const a = Math.log(from);
  const b = Math.log(to);
  let frame = 0;
  let start: number | null = null;
  const tick = (time: number) => {
    if (start === null) start = time;
    const progress = Math.min(1, (time - start) / DURATION.slow);
    shown.current = progress >= 1 ? to : Math.exp(a + (b - a) * eased(EASE.out, progress));
    paint();
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export default function HawkingRadiationSim({ params, values, setValue }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const M = readParam(params, values, 'M');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/blackhole` and `@/physics/hawking`, once per render.
  const radius = schwarzschildRadius(M);
  const temperature = hawkingTemperature(M);
  const net = netWithCMB(M);
  const band = emissionBand(M);
  const power = hawkingPower(M);
  const lifetime = evaporationTime(M);

  /** The mass the panels are drawn at, which trails the slider while it slides. */
  const shownRef = useRef(M);

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
    drawScene(ctx, rect.width, rect.height, { M: shownRef.current, units });
  }, [units]);

  /* Both dots follow the mass. */
  useEffect(() => slide(shownRef, M, reduced, paint), [M, reduced, paint]);

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
          aria-label="Above, a black hole's Hawking temperature against its mass on logarithmic axes, falling in a straight line from hot light holes to cold heavy ones, crossing a line at the 2.7 kelvin microwave background: lighter holes are hotter than it and shrinking, heavier ones colder and growing, with a mountain, the Moon and the Sun marked along the mass axis. Below, the time each would take to evaporate, rising steeply with mass and crossing a line at the age of the universe."
          aria-describedby="hawking-radiation-readouts"
        />
      </div>

      <dl id="hawking-radiation-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Schwarzschild radius' : 'How big it is'} value={formatRadius(radius)} />
        <Readout
          label={deep ? 'Hawking temperature' : 'How hot it glows'}
          value={
            deep
              ? `${formatTemperature(temperature)} (kT ${formatEnergy(K_B * temperature)})`
              : formatTemperature(temperature)
          }
        />
        <Readout label={deep ? 'Net with the CMB' : 'Against the cosmic background'} value={formatNet(net)} />
        <Readout label={deep ? 'Emission' : 'What it gives off'} value={band} />
        <Readout label={deep ? 'Hawking power, photons' : 'Power it radiates'} value={formatPower(power)} />
        <Readout
          label={deep ? 'Evaporation time, photons' : 'Time to evaporate, left alone'}
          value={formatLifetime(lifetime)}
        />
        <Readout label={deep ? 'Mass, nearest landmark' : 'As heavy as'} value={formatLandmark(M)} />
      </dl>

      {/* The crossover mass falls between two slider stops (0.34 of a step
          from the nearer), so no drag can land on it. This sets it exactly,
          from the physics code, not from a typed-in number. */}
      <button
        type="button"
        onClick={() => setValue('M', M_CROSSOVER)}
        className="flex items-center gap-2 self-start rounded-md border border-edge bg-void-500 px-3 py-2 font-ui text-xs text-ink-dim transition-colors hover:border-star/40 hover:text-ink"
      >
        Set to the crossover mass
      </button>
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
  formatSig3,
  formatRadius,
  formatEnergy,
  formatTemperature,
  formatPower,
  formatLifetime,
  formatNet,
  formatLandmark,
  M_CROSSOVER,
};

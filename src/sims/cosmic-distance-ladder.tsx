/**
 * The cosmic distance ladder — which methods reach a distance, above; what a
 * calibration error does to H₀, below.
 *
 * Top panel: distance on a log axis from 1 pc to 1 Gpc, with the four rungs
 * as bars stacked from the bottom, each across the range it is drawn to cover.
 * Where consecutive rungs overlap, the overlap is shaded brighter: that is
 * where calibration passes from one method to the next. A cursor sits at the
 * slider's distance and lights the bars it crosses; landmarks are ticked along
 * the axis and named where there is room.
 *
 * Bottom panel: the H₀ a ladder would report, against the error δ in its
 * candles' assumed brightness, if the true rate were Planck's. Bands mark
 * Planck's and SH0ES's values with their uncertainties; a dot rides the curve
 * at the slider's δ.
 *
 * No physics lives in this file. Every angle, magnitude, rate and range comes
 * from `@/physics/ladder`, which the sanity block also reads. This file owns
 * pixels and formatting only.
 *
 * Motion: when either slider changes, the cursor (in log d) and the dot (in δ)
 * slide to their new places over `DURATION.slow` on the `EASE.out` curve.
 * Under reduced motion they jump.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import {
  ARCSEC,
  D_LMC,
  H0_PLANCK_2018,
  H0_PLANCK_2018_SIGMA,
  H0_SH0ES_2022,
  H0_SH0ES_2022_SIGMA,
  KM_S_PER_MPC,
  LIGHT_YEAR,
  M_IA_PEAK,
  PARSEC,
} from '@/physics/constants';
import {
  CEPHEID_PERIOD_DAYS,
  RUNGS,
  apparentMagnitude,
  inferredH0,
  leavittAbsoluteMagnitude,
  parallaxAngle,
  parallaxFractionalError,
  peculiarVelocityShare,
  rungsAt,
  type Rung,
} from '@/physics/ladder';
import { eased } from '@/motion/ease';
import { DURATION, EASE } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, overlaps, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const SIG2 = new Intl.NumberFormat('en', { minimumSignificantDigits: 2, maximumSignificantDigits: 2 });

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

/** "4.5 × 10⁸" — rounded before it reaches the screen, mantissa renormalised. */
function scientific(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  const places = Math.max(0, digits - 1);
  if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
  return `${(value / 10 ** exp).toFixed(places)} × 10${exponentGlyph(exp)}`;
}

/** Plain inside the skill's 0.01 to 10 000 band, scientific outside it, at the given precision. */
function plainOrScientific(value: number, format: Intl.NumberFormat, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 0.01 && abs < 1e4) return format.format(value);
  return scientific(value, digits);
}

/** The methods that reach a distance, in ladder order, or "none". */
function formatMethods(d_m: number): string {
  const labels = rungsAt(d_m).map((rung) => rung.label);
  return labels.length > 0 ? labels.join(', ') : 'none';
}

/** A parallax angle in rad as µas, mas or arcsec by size, three significant figures. */
function formatParallax(p_rad: number): string {
  if (!Number.isFinite(p_rad) || p_rad <= 0) return '—';
  const arcsec = p_rad / ARCSEC;
  if (arcsec >= 1) return `${plainOrScientific(arcsec, SIG3, 3)} arcsec`;
  if (arcsec >= 1e-3) return `${plainOrScientific(arcsec * 1e3, SIG3, 3)} mas`;
  return `${plainOrScientific(arcsec * 1e6, SIG3, 3)} µas`;
}

/** A fraction as a percentage, two significant figures. */
function formatPercent(fraction: number): string {
  return Number.isFinite(fraction) ? `${plainOrScientific(fraction * 100, SIG2, 2)} %` : '—';
}

/** Gaia's precision as a percentage, or a plain statement past 100 %. */
function formatPrecision(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  return fraction > 1 ? 'worse than 100 %: too far' : formatPercent(fraction);
}

/** A galaxy's own motion as a share of its recession, or a plain statement past 100 %. */
function formatOwnMotion(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  return fraction > 1 ? 'more than the expansion itself' : formatPercent(fraction);
}

/** A magnitude to one decimal, signed, with a true minus: "−0.8", "+13.3". */
function formatMagnitude(m: number): string {
  if (!Number.isFinite(m)) return '—';
  const r = Math.round(m * 10) / 10;
  if (r === 0) return '0.0';
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(1)}`;
}

/** H₀ in s⁻¹ as km/s/Mpc, one decimal. */
function formatH0(H0_s: number): string {
  return Number.isFinite(H0_s) ? `${(H0_s / KM_S_PER_MPC).toFixed(1)} km/s/Mpc` : '—';
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
  planck: 'rgba(157,180,255,0.22)',
  planckInk: '#9db4ff',
  shoes: 'rgba(240,168,104,0.22)',
  shoesInk: '#f0a868',
};

/** Each rung's colour, as RGB, bottom to top. */
const RUNG_RGB: Record<Rung['id'], [number, number, number]> = {
  parallax: [111, 168, 220],
  cepheids: [232, 189, 125],
  'type-ia': [180, 142, 173],
  'hubble-flow': [143, 205, 160],
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const PLOT_LEFT = 44;
const TOP_SHARE = 0.5;

/** The ladder's distance axis, m. */
const D_AXIS_MIN = PARSEC;
const D_AXIS_MAX = 1e9 * PARSEC;

/**
 * Landmarks along the distance axis, m: display values, rounded, from the
 * standard references (Proxima's Gaia parallax; the GRAVITY distance to Sgr A*;
 * the LMC anchor; Andromeda's Cepheid distance; Virgo's and Coma's mean
 * distances).
 */
const LANDMARKS: [number, string][] = [
  [1.3 * PARSEC, 'Proxima Centauri'],
  [8.2e3 * PARSEC, 'Galactic centre'],
  [D_LMC, 'LMC'],
  [765e3 * PARSEC, 'Andromeda'],
  [16.5e6 * PARSEC, 'Virgo Cluster'],
  [100e6 * PARSEC, 'Coma Cluster'],
];

/** Distance ticks every two decades, in light-years (friendly) or parsecs (technical). */
const LY_TICKS: [number, string][] = [
  [10 * LIGHT_YEAR, '10 ly'],
  [1e3 * LIGHT_YEAR, '1 kly'],
  [1e5 * LIGHT_YEAR, '100 kly'],
  [1e7 * LIGHT_YEAR, '10 Mly'],
  [1e9 * LIGHT_YEAR, '1 Gly'],
];
const PC_TICKS: [number, string][] = [
  [1 * PARSEC, '1 pc'],
  [100 * PARSEC, '100 pc'],
  [1e4 * PARSEC, '10 kpc'],
  [1e6 * PARSEC, '1 Mpc'],
  [1e8 * PARSEC, '100 Mpc'],
];

/** The calibration panel's axes: δ in magnitudes, H₀ in s⁻¹. */
const DELTA_MIN = -0.3;
const DELTA_MAX = 0.3;
const H_AXIS_MIN = 55 * KM_S_PER_MPC;
const H_AXIS_MAX = 85 * KM_S_PER_MPC;
const DELTA_TICKS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
const H_TICKS = [60, 70, 80];

type Units = 'friendly' | 'technical';

interface View {
  /** Distance as currently drawn, m — mid-tween while it slides. */
  d: number;
  /** Calibration offset as currently drawn, mag. */
  delta: number;
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
  const half = ctx.measureText(text).width / 2;
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
 * A reference band's label at its right end, just above the band or just
 * below it; failing both, wherever `labelNear` finds room nearby.
 */
function labelAtEnd(
  ctx: CanvasRenderingContext2D,
  text: string,
  top: number,
  bottom: number,
  bounds: LabelBox,
  obstacles: LabelBox[],
  extra: LabelBox[],
): void {
  const right = bounds.x1 - 1;
  const clear = [
    { x: right, y: top - 3, align: 'right' as const },
    { x: right, y: bottom + 11, align: 'right' as const },
  ].find(
    (c) =>
      inside(ctx, text, c, bounds) &&
      ![...obstacles, ...extra].some((o) => overlaps(labelBox(ctx, text, c.x, c.y, c.align), o, 2)),
  );
  if (clear) platedText(ctx, text, clear, obstacles);
  else labelNear(ctx, text, right - ctx.measureText(text).width / 2, (top + bottom) / 2, bounds, obstacles, extra);
}

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function drawLadder(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const plotLeft = PAD.left + 8;
  const plotRight = w - PAD.right - 8;
  const plotTop = 24;
  const axisY = splitY - 36;
  const plotW = plotRight - plotLeft;
  if (plotW <= 0 || axisY - plotTop <= 0) return;

  const l0 = Math.log10(D_AXIS_MIN);
  const l1 = Math.log10(D_AXIS_MAX);
  const xOf = (d: number) => plotLeft + ((Math.log10(d) - l0) / (l1 - l0)) * plotW;
  const clampX = (x: number) => Math.min(plotRight, Math.max(plotLeft, x));

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'The ladder', PAD.left, 14, 'left', obstacles);

  /* Rung geometry: bars stacked up from just above the axis. */
  const barH = 22;
  const gap = 10;
  const barTop = (i: number) => axisY - 8 - (i + 1) * barH - i * gap;
  const stackTop = barTop(RUNGS.length - 1);

  /*
   * Landmarks: named in two rows just above the stack where there is room,
   * dropped where there is not, each with a faint rule from the axis up to its
   * name (or to the top of the stack, if unnamed). The row nearest the stack
   * is left for the calibration note.
   */
  const marks: LabelBox[] = [];
  const noteY = stackTop - 12;
  const landmarkRows = [stackTop - 30, stackTop - 44].filter((y) => y - 8 >= plotTop + 4);
  ctx.fillStyle = COLORS.inkFaint;
  const ruleTops = LANDMARKS.map(([d, name]) => {
    const x = xOf(d);
    const half = ctx.measureText(name).width / 2;
    const cx = Math.min(plotRight - half, Math.max(plotLeft + half, x));
    const row = landmarkRows
      .map((y) => ({ x: cx, y, align: 'center' as const }))
      .find((c) => !obstacles.some((o) => overlaps(labelBox(ctx, name, c.x, c.y, c.align), o, 2)));
    if (!row) return stackTop - 4;
    placeText(ctx, name, row.x, row.y, row.align, obstacles);
    return row.y + 3;
  });
  ctx.strokeStyle = 'rgba(152,162,184,0.28)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  for (const [i, [d]] of LANDMARKS.entries()) {
    const x = xOf(d);
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, ruleTops[i] ?? stackTop - 4);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* The overlaps, where calibration passes from one rung to the next. */
  const overlapsPx: { x0: number; x1: number; y: number }[] = [];
  for (let i = 0; i + 1 < RUNGS.length; i += 1) {
    const lower = RUNGS[i]!;
    const upper = RUNGS[i + 1]!;
    const from = Math.max(lower.dMin_m, upper.dMin_m);
    const to = Math.min(lower.dMax_m, upper.dMax_m);
    if (to <= from) continue;
    const x0 = clampX(xOf(from));
    const x1 = clampX(xOf(to));
    if (x1 - x0 < 1) continue;
    ctx.fillStyle = 'rgba(213,220,234,0.10)';
    ctx.fillRect(x0, barTop(i + 1), x1 - x0, barTop(i) + barH - barTop(i + 1));
    overlapsPx.push({ x0, x1, y: barTop(i) - gap / 2 });
  }

  /* The bars; those the cursor crosses are lit. */
  const lit = new Set(rungsAt(view.d).map((rung) => rung.id));
  for (const [i, rung] of RUNGS.entries()) {
    const x0 = clampX(xOf(rung.dMin_m));
    const x1 = clampX(xOf(rung.dMax_m));
    const y = barTop(i);
    const on = lit.has(rung.id);
    ctx.fillStyle = rgba(RUNG_RGB[rung.id], on ? 0.8 : 0.3);
    ctx.fillRect(x0, y, x1 - x0, barH);
    if (on) {
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.lineTo(x1, y + barH);
      ctx.lineTo(x0, y + barH);
      ctx.closePath();
      ctx.stroke();
    }
  }

  /* The axis and its ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, axisY);
  ctx.lineTo(plotRight, axisY);
  ctx.stroke();
  ctx.fillStyle = COLORS.inkFaint;
  for (const [d, label] of deep ? PC_TICKS : LY_TICKS) {
    const x = xOf(d);
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, axisY + 3);
    ctx.stroke();
    centredWithin(ctx, label, x, axisY + 13, 0, w, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'd' : 'distance',
    (plotLeft + plotRight) / 2,
    axisY + 26,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The cursor at the slider's distance. */
  const xC = xOf(view.d);
  ctx.strokeStyle = COLORS.warm;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xC, stackTop - 6);
  ctx.lineTo(xC, axisY);
  ctx.stroke();
  marks.push({ x0: xC - 2, x1: xC + 2, y0: stackTop - 6, y1: axisY });

  /* Rung names: inside the bar where it fits, otherwise beside it. */
  const panel: LabelBox = { x0: plotLeft, x1: plotRight, y0: plotTop, y1: axisY - 2 };
  for (const [i, rung] of RUNGS.entries()) {
    const x0 = clampX(xOf(rung.dMin_m));
    const x1 = clampX(xOf(rung.dMax_m));
    const y = barTop(i) + barH / 2 + 3.5;
    const width = ctx.measureText(rung.label).width;
    const on = lit.has(rung.id);
    ctx.fillStyle = on ? COLORS.void : COLORS.ink;
    // Inside, clear of the cursor: the bar's midpoint, or slid along it away from the cursor.
    const spots = [(x0 + x1) / 2, x0 + width / 2 + 6, x1 - width / 2 - 6];
    const inBar = spots.find(
      (cx) =>
        cx - width / 2 >= x0 + 3 &&
        cx + width / 2 <= x1 - 3 &&
        ![...obstacles, ...marks].some((o) => overlaps(labelBox(ctx, rung.label, cx, y, 'center'), o, 2)),
    );
    if (inBar !== undefined) {
      placeText(ctx, rung.label, inBar, y, 'center', obstacles);
    } else {
      ctx.fillStyle = COLORS.ink;
      labelNear(ctx, rung.label, (x0 + x1) / 2, y - 3.5, panel, obstacles, marks);
    }
  }

  /* One "calibration passes up" label, on the widest overlap wide enough to carry it. */
  const note = 'calibration passes up';
  const widest = [...overlapsPx].sort((a, b) => b.x1 - b.x0 - (a.x1 - a.x0))[0];
  const noteHalf = ctx.measureText(note).width / 2;
  if (widest && widest.x1 - widest.x0 >= noteHalf * 1.2) {
    // Centred on the overlap, slid inward if the overlap runs to an edge of the plot.
    const cx = Math.min(plotRight - noteHalf - 2, Math.max(plotLeft + noteHalf + 2, (widest.x0 + widest.x1) / 2));
    const spot = { x: cx, y: noteY, align: 'center' as const };
    const clear =
      inside(ctx, note, spot, { x0: plotLeft, x1: plotRight, y0: plotTop, y1: axisY }) &&
      ![...obstacles, ...marks].some((o) => overlaps(labelBox(ctx, note, spot.x, spot.y, spot.align), o, 2));
    if (clear) {
      ctx.fillStyle = COLORS.inkDim;
      platedText(ctx, note, spot, obstacles);
    }
  }

}

function drawCalibration(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  ctx.font = FONT;
  // The y-axis title on one line where it fits, otherwise broken after "reports"
  // onto a second, with the plot moved down a row to make room.
  const yTitle = deep ? 'H₀ (km/s/Mpc)' : 'expansion rate the ladder reports (km/s per Mpc)';
  const yTitleLines =
    ctx.measureText(yTitle).width <= w - PAD.left - PAD.right
      ? [yTitle]
      : ['expansion rate the ladder reports', '(km/s per Mpc)'];
  const plotLeft = PLOT_LEFT;
  const plotRight = w - PAD.right;
  const plotTop = splitY + 38 + (yTitleLines.length - 1) * 12;
  const plotBottom = h - 36;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return;

  const xOf = (delta: number) => plotLeft + ((delta - DELTA_MIN) / (DELTA_MAX - DELTA_MIN)) * plotW;
  const yOf = (H0: number) => plotBottom - ((H0 - H_AXIS_MIN) / (H_AXIS_MAX - H_AXIS_MIN)) * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'What a calibration error does to H₀', PAD.left, splitY + 16, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  for (const [i, line] of yTitleLines.entries()) {
    placeText(ctx, line, PAD.left, splitY + 29 + i * 12, 'left', obstacles);
  }

  /* The two measurements, as bands. */
  const band = (centre: number, sigma: number, fill: string) => {
    const top = yOf(centre + sigma);
    const bottom = yOf(centre - sigma);
    ctx.fillStyle = fill;
    ctx.fillRect(plotLeft, top, plotW, bottom - top);
    return [top, bottom] as const;
  };
  const [pTop, pBottom] = band(H0_PLANCK_2018, H0_PLANCK_2018_SIGMA, COLORS.planck);
  const [sTop, sBottom] = band(H0_SH0ES_2022, H0_SH0ES_2022_SIGMA, COLORS.shoes);

  /* Axes and ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  ctx.fillStyle = COLORS.inkFaint;
  for (const H of H_TICKS) placeText(ctx, String(H), plotLeft - 4, yOf(H * KM_S_PER_MPC) + 3, 'right', obstacles);
  for (const delta of DELTA_TICKS) {
    const x = xOf(delta);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    const text = delta === 0 ? '0' : `${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)}`;
    centredWithin(ctx, text, x, plotBottom + 13, 0, w, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'δ (mag)' : 'error in assumed brightness (magnitudes)',
    (plotLeft + plotRight) / 2,
    plotBottom + 27,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The curve: a ladder calibrated wrong by δ, if the truth were Planck's. */
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const steps = 60;
  for (let i = 0; i <= steps; i += 1) {
    const delta = DELTA_MIN + ((DELTA_MAX - DELTA_MIN) * i) / steps;
    const y = yOf(inferredH0(H0_PLANCK_2018, delta));
    if (i === 0) ctx.moveTo(xOf(delta), y);
    else ctx.lineTo(xOf(delta), y);
  }
  ctx.stroke();

  /* The dot at the slider's δ. */
  const H = inferredH0(H0_PLANCK_2018, view.delta);
  const xD = xOf(view.delta);
  const yD = yOf(H);
  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(xD, yD, 4, 0, TAU);
  ctx.fill();
  const marks: LabelBox[] = [{ x0: xD - 5, x1: xD + 5, y0: yD - 5, y1: yD + 5 }];

  /* Labels: the fixed ones first, then the one that moves. */
  ctx.fillStyle = COLORS.planckInk;
  labelAtEnd(ctx, 'CMB (no ladder)', pTop, pBottom, plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.shoesInk;
  labelAtEnd(ctx, 'the ladder, 2022', sTop, sBottom, plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, (H / KM_S_PER_MPC).toFixed(1), xD, yD, plotBox, obstacles, marks);
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
  drawLadder(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawCalibration(ctx, w, h, splitY, view, obstacles);
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

type Shown = { d: number; delta: number };

/**
 * Slides `shown[key]` to `to` — in log space for d, linearly for δ — painting
 * each frame; a changed target cancels the frame in flight.
 */
function slide(
  shown: { current: Shown },
  key: keyof Shown,
  to: number,
  jump: boolean,
  paint: () => void,
): (() => void) | undefined {
  const from = shown.current[key];
  if (jump || from === to || typeof requestAnimationFrame === 'undefined') {
    shown.current = { ...shown.current, [key]: to };
    paint();
    return undefined;
  }
  const log = key === 'd';
  const a = log ? Math.log(from) : from;
  const b = log ? Math.log(to) : to;
  let frame = 0;
  let start: number | null = null;
  const tick = (time: number) => {
    if (start === null) start = time;
    const progress = Math.min(1, (time - start) / DURATION.slow);
    const mid = a + (b - a) * eased(EASE.out, progress);
    const value = progress >= 1 ? to : log ? Math.exp(mid) : mid;
    shown.current = { ...shown.current, [key]: value };
    paint();
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export default function CosmicDistanceLadderSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const d = readParam(params, values, 'd');
  const delta = readParam(params, values, 'delta');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/ladder`, once per render.
  const methods = formatMethods(d);
  const p = parallaxAngle(d);
  const precision = parallaxFractionalError(d);
  const mCepheid = apparentMagnitude(leavittAbsoluteMagnitude(CEPHEID_PERIOD_DAYS), d);
  const mTypeIa = apparentMagnitude(M_IA_PEAK, d);
  const share = peculiarVelocityShare(H0_PLANCK_2018, d);
  const H0 = inferredH0(H0_PLANCK_2018, delta);

  /** The values the panels are drawn at, which trail the sliders while they slide. */
  const shownRef = useRef<Shown>({ d, delta });

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
    drawScene(ctx, rect.width, rect.height, { ...shownRef.current, units });
  }, [units]);

  /* The cursor follows d and the dot follows δ; reduced motion, or no rAF, jumps. */
  useEffect(() => slide(shownRef, 'd', d, reduced, paint), [d, reduced, paint]);
  useEffect(() => slide(shownRef, 'delta', delta, reduced, paint), [delta, reduced, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  return (
    <div className="flex min-h-[34rem] flex-col gap-4">
      <div className="relative h-[34rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Above, distance on a logarithmic axis from one parsec to a billion, with the four rungs of the ladder as stacked bars, parallax, Cepheids, Type Ia supernovae and the Hubble flow, their overlaps shaded, landmarks along the axis and a cursor at the chosen distance. Below, the expansion rate a ladder would report against an error in its candles' assumed brightness, with bands for the microwave-background prediction and the 2022 ladder measurement."
          aria-describedby="cosmic-distance-ladder-readouts"
        />
      </div>

      <dl id="cosmic-distance-ladder-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Usable methods' : 'What can reach this far'} value={methods} />
        <Readout label={deep ? 'Parallax angle' : 'How much it shifts as Earth orbits'} value={formatParallax(p)} />
        <Readout label={deep ? 'Parallax precision' : 'How well Gaia can measure that'} value={formatPrecision(precision)} />
        <Readout
          label={deep ? 'Cepheid apparent magnitude' : 'How bright a 30-day Cepheid looks'}
          value={formatMagnitude(mCepheid)}
        />
        <Readout label={deep ? 'Type Ia apparent magnitude' : 'How bright a Type Ia looks'} value={formatMagnitude(mTypeIa)} />
        <Readout
          label={deep ? '300 km/s against expansion' : 'How much a galaxy’s own motion could fool you'}
          value={formatOwnMotion(share)}
        />
        <Readout label={deep ? 'Inferred H₀' : 'Expansion rate the ladder would report'} value={formatH0(H0)} />
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
  formatMethods,
  formatParallax,
  formatPrecision,
  formatPercent,
  formatOwnMotion,
  formatMagnitude,
  formatH0,
};

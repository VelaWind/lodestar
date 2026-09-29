/**
 * Supernovae — what a star becomes, above; how bright a Type Ia looks, below.
 *
 * Top panel: birth mass on a log axis from half a solar mass to 32. A
 * ribbon along the bottom third shows the three fates, cut sharply at 8 and
 * 20 M☉, with the current one highlighted and a cursor at the slider's mass.
 * Above it, the main-sequence lifetime on a log axis, with a dot at the
 * slider's mass labelled in years.
 *
 * Bottom panel: distance on a log axis against apparent magnitude on a linear
 * one, brightest at the top. The line is a Type Ia at its average peak; the
 * dashed reference lines are the full Moon, Venus, the naked-eye limit and the
 * deepest space-telescope images, and a tick marks Andromeda, where SN 1885A
 * went off. A dot rides the line at the slider's distance.
 *
 * No physics lives in this file. Every lifetime, fate, mass, energy and
 * magnitude comes from `@/physics/supernova`, which the sanity block also
 * reads. This file owns pixels and formatting only.
 *
 * Motion: when either slider changes, its dot (and the top panel's cursor and
 * highlighted fate) slides to the new place over `DURATION.slow` on the
 * `EASE.out` curve, in log mass or log distance. Under reduced motion they jump.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import {
  JULIAN_YEAR,
  LIGHT_YEAR,
  L_SUN,
  MASS_NS_MAX,
  MASS_WD_MAX,
  MEGAPARSEC,
  M_IA_PEAK,
  M_NS_TYPICAL,
  M_SUN,
  PARSEC,
  R_NS,
} from '@/physics/constants';
import {
  FATE_LABELS,
  MAG_FULL_MOON,
  MAG_NAKED_EYE,
  MAG_SPACE_TELESCOPE,
  MAG_VENUS,
  apparentMagnitude,
  collapseEnergy,
  distanceForMagnitude,
  fate,
  mainSequenceLifetime,
  mainSequenceLuminosity,
  remnantMass,
  type Fate,
} from '@/physics/supernova';
import { eased } from '@/motion/ease';
import { DURATION, EASE } from '@/motion/tokens';
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

/** "2.6 × 10⁴⁶" — rounded before it reaches the screen, mantissa renormalised. */
function scientific(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  const places = Math.max(0, digits - 1);
  if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
  return `${(value / 10 ** exp).toFixed(places)} × 10${exponentGlyph(exp)}`;
}

/** Plain inside the skill's 0.01 to 10 000 band, scientific outside it. */
function plainOrScientific(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 0.01 && abs < 1e4) return SIG3.format(value);
  return scientific(value, 3);
}

/** A duration in s as yr, kyr, Myr or Gyr, three significant figures. */
function formatYears(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const years = seconds / JULIAN_YEAR;
  if (years < 1e3) return `${SIG3.format(years)} yr`;
  if (years < 1e6) return `${SIG3.format(years / 1e3)} kyr`;
  if (years < 1e9) return `${SIG3.format(years / 1e6)} Myr`;
  return `${SIG3.format(years / 1e9)} Gyr`;
}

/** A distance in m as light-years, in words past a million, three significant figures. */
function formatLightYears(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  const ly = metres / LIGHT_YEAR;
  if (ly >= 1e9) return `${SIG3.format(ly / 1e9)} billion light-years`;
  if (ly >= 1e6) return `${SIG3.format(ly / 1e6)} million light-years`;
  return `${plainOrScientific(ly)} light-years`;
}

/** A magnitude to one decimal, signed, with a true minus: "−13.2", "+20.6". */
function formatMagnitude(m: number): string {
  if (!Number.isFinite(m)) return '—';
  const r = Math.round(m * 10) / 10;
  if (r === 0) return '0.0';
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(1)}`;
}

/** What a magnitude means to someone looking up. */
function brightnessWords(m: number): string {
  if (m < MAG_FULL_MOON) return 'brighter than the full Moon';
  if (m < MAG_VENUS) return 'brighter than Venus';
  if (m < MAG_NAKED_EYE) return 'visible to the naked eye';
  return 'telescope only';
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
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const PLOT_LEFT = 52;
const TOP_SHARE = 0.5;

/** The top panel's axes: birth mass in kg, lifetime in s. */
const M_AXIS_MIN = 0.5 * M_SUN;
const M_AXIS_MAX = 32 * M_SUN;
const T_AXIS_MIN = 1e6 * JULIAN_YEAR;
const T_AXIS_MAX = 1e11 * JULIAN_YEAR;

/** The bottom panel's axes: distance in m, apparent magnitude brightest at the top. */
const D_AXIS_MIN = 1e17;
const D_AXIS_MAX = 3e25;
const MAG_TOP = -22;
const MAG_BOTTOM = 35;

/** Andromeda, m: where SN 1885A, the one supernova seen there, went off. */
const ANDROMEDA = 2.5e6 * LIGHT_YEAR;

/** The fates as bands on the mass axis, and how each is painted. */
const BANDS: { fate: Fate; from: number; to: number; name: string; fill: string; current: string }[] = [
  {
    fate: 'white-dwarf',
    from: M_AXIS_MIN,
    to: MASS_WD_MAX,
    name: 'white dwarf',
    fill: 'rgba(223,230,242,0.3)',
    current: 'rgba(223,230,242,0.92)',
  },
  {
    fate: 'neutron-star',
    from: MASS_WD_MAX,
    to: MASS_NS_MAX,
    name: 'neutron star',
    fill: 'rgba(88,119,208,0.35)',
    current: 'rgba(88,119,208,0.95)',
  },
  {
    fate: 'black-hole',
    from: MASS_NS_MAX,
    to: M_AXIS_MAX,
    name: 'black hole',
    fill: 'rgba(16,19,28,0.9)',
    current: 'rgba(0,0,0,1)',
  },
];

type Units = 'friendly' | 'technical';

interface View {
  /** Birth mass as currently drawn, kg — mid-tween while it slides. */
  M: number;
  /** Distance as currently drawn, m — likewise. */
  d: number;
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

function inside(ctx: CanvasRenderingContext2D, text: string, c: { x: number; y: number; align: CanvasTextAlign }, bounds: LabelBox): boolean {
  const box = labelBox(ctx, text, c.x, c.y, c.align);
  return box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
}

/**
 * A plated label near a point, in the first spot inside `bounds` and clear of
 * everything already drawn — the candidate grid the template sims use, plus a
 * centred candidate slid inward at each height, so a label wider than the gap
 * beside its point still has somewhere inside the plot to go.
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
 * `labelNear` for a label that may be wider than the plot: on one line when
 * it fits, otherwise broken after its first comma into two lines placed as one
 * block, on one plate, clear of everything already drawn.
 */
function wrappedLabelNear(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bounds: LabelBox,
  obstacles: LabelBox[],
  extra: LabelBox[] = [],
): void {
  const comma = text.indexOf(', ');
  if (ctx.measureText(text).width + 2 <= bounds.x1 - bounds.x0 || comma < 0) {
    labelNear(ctx, text, x, y, bounds, obstacles, extra);
    return;
  }
  const lines = [text.slice(0, comma + 1), text.slice(comma + 2)];
  const LINE = 12;
  const blockAt = (c: { x: number; y: number; align: CanvasTextAlign }): LabelBox => {
    const boxes = lines.map((line, i) => labelBox(ctx, line, c.x, c.y + i * LINE, c.align));
    return {
      x0: Math.min(...boxes.map((b) => b.x0)),
      x1: Math.max(...boxes.map((b) => b.x1)),
      y0: Math.min(...boxes.map((b) => b.y0)),
      y1: Math.max(...boxes.map((b) => b.y1)),
    };
  };
  const half = Math.max(...lines.map((line) => ctx.measureText(line).width)) / 2;
  const slid = Math.min(bounds.x1 - half - 1, Math.max(bounds.x0 + half + 1, x));
  const candidates: { x: number; y: number; align: CanvasTextAlign }[] = [];
  // Every height in the plot, nearest first, and at each one the block over
  // its point or pushed to either side: a two-line block is hard to fit, so it
  // is allowed to go anywhere in the panel.
  const rows: number[] = [];
  for (let row = bounds.y0 + 10; row <= bounds.y1; row += 2) rows.push(row);
  rows.sort((a, b) => Math.abs(a - (y - 21)) - Math.abs(b - (y - 21)));
  const xs = [slid, bounds.x0 + half + 1, bounds.x1 - half - 1];
  for (const row of rows) for (const cx of xs) candidates.push({ x: cx, y: row, align: 'center' });
  const blocked = [...obstacles, ...extra];
  const fits = candidates.filter((c) => {
    const box = blockAt(c);
    return box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
  });
  const spot =
    fits.find((c) => !blocked.some((o) => overlaps(blockAt(c), o, 2))) ??
    fits[fits.length - 1] ?? { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2, align: 'center' as const };
  const box = blockAt(spot);
  const ink = ctx.fillStyle;
  ctx.fillStyle = 'rgba(5,7,12,0.82)';
  ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
  ctx.fillStyle = ink;
  lines.forEach((line, i) => placeText(ctx, line, spot.x, spot.y + i * LINE, spot.align, obstacles));
}

/**
 * A reference line's label at its right end, just above the line or just
 * below it; failing both, wherever `labelNear` finds room nearby.
 */
function labelAtEnd(
  ctx: CanvasRenderingContext2D,
  text: string,
  lineY: number,
  bounds: LabelBox,
  obstacles: LabelBox[],
  extra: LabelBox[],
): void {
  const right = bounds.x1 - 1;
  const clear = [
    { x: right, y: lineY - 3, align: 'right' as const },
    { x: right, y: lineY + 11, align: 'right' as const },
  ].find(
    (c) =>
      inside(ctx, text, c, bounds) &&
      ![...obstacles, ...extra].some((o) => overlaps(labelBox(ctx, text, c.x, c.y, c.align), o, 2)),
  );
  if (clear) platedText(ctx, text, clear, obstacles);
  else labelNear(ctx, text, right - ctx.measureText(text).width / 2, lineY, bounds, obstacles, extra);
}

const LIFETIME_TICKS: [number, string, string][] = [
  [1e6, '1 Myr', '10⁶'],
  [1e7, '10 Myr', '10⁷'],
  [1e8, '100 Myr', '10⁸'],
  [1e9, '1 Gyr', '10⁹'],
  [1e10, '10 Gyr', '10¹⁰'],
  [1e11, '100 Gyr', '10¹¹'],
];

/**
 * Mass ticks, in the order their labels claim space: the two fate boundaries
 * first, then the slider's doublings. 16 and 20 sit a tenth of a decade apart,
 * so on the narrowest canvas 16 keeps its tick mark and gives up its label.
 */
const MASS_TICKS: [number, string][] = [
  [8, '8'],
  [20, '20'],
  [0.5, '0.5'],
  [1, '1'],
  [2, '2'],
  [4, '4'],
  [32, '32'],
  [16, '16'],
];

function drawFates(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const plotLeft = PLOT_LEFT;
  const plotRight = w - PAD.right;
  const plotTop = 36;
  const axisY = splitY - 36;
  const ribbonBottom = axisY;
  const ribbonTop = axisY - Math.round((axisY - plotTop) / 3);
  const lifeTop = plotTop;
  const lifeBottom = ribbonTop - 10;
  const plotW = plotRight - plotLeft;
  if (plotW <= 0 || lifeBottom - lifeTop <= 0) return;

  const lm0 = Math.log10(M_AXIS_MIN);
  const lm1 = Math.log10(M_AXIS_MAX);
  const lt0 = Math.log10(T_AXIS_MIN);
  const lt1 = Math.log10(T_AXIS_MAX);
  const xOf = (M: number) => plotLeft + ((Math.log10(M) - lm0) / (lm1 - lm0)) * plotW;
  const yOf = (t: number) => lifeBottom - ((Math.log10(t) - lt0) / (lt1 - lt0)) * (lifeBottom - lifeTop);
  const lifeBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: lifeTop + 2, y1: ribbonTop - 2 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'What a star becomes', PAD.left, 14, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'lifetime (yr)' : 'how long it shines', PAD.left, 27, 'left', obstacles);

  /* Lifetime axis, decade gridlines and ticks. */
  ctx.lineWidth = 1;
  for (const [years, friendly, technical] of LIFETIME_TICKS) {
    const y = yOf(years * JULIAN_YEAR);
    ctx.strokeStyle = 'rgba(35,43,59,0.6)';
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
    placeText(ctx, deep ? technical : friendly, plotLeft - 4, y + 3, 'right', obstacles);
  }
  ctx.strokeStyle = COLORS.edge;
  ctx.beginPath();
  ctx.moveTo(plotLeft, lifeTop);
  ctx.lineTo(plotLeft, lifeBottom);
  ctx.stroke();

  /* The fate ribbon. */
  const current = fate(view.M);
  const ribbonMid = (ribbonTop + ribbonBottom) / 2;
  for (const band of BANDS) {
    const x0 = xOf(band.from);
    const x1 = xOf(band.to);
    const isCurrent = band.fate === current;
    ctx.fillStyle = isCurrent ? band.current : band.fill;
    ctx.fillRect(x0, ribbonTop, x1 - x0, ribbonBottom - ribbonTop);
    ctx.strokeStyle = isCurrent ? COLORS.ember : COLORS.edge;
    ctx.lineWidth = isCurrent ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x0, ribbonTop);
    ctx.lineTo(x1, ribbonTop);
    ctx.lineTo(x1, ribbonBottom);
    ctx.lineTo(x0, ribbonBottom);
    ctx.closePath();
    ctx.stroke();
  }
  for (const band of BANDS) {
    const x0 = xOf(band.from);
    const x1 = xOf(band.to);
    const isCurrent = band.fate === current;
    const width = ctx.measureText(band.name).width;
    if (width + 8 <= x1 - x0) {
      // Dark ink on the two lit bands when they are highlighted; pale elsewhere.
      ctx.fillStyle = isCurrent && band.fate !== 'black-hole' ? COLORS.void : isCurrent ? COLORS.ink : COLORS.inkDim;
      placeText(ctx, band.name, (x0 + x1) / 2, ribbonMid + 3.5, 'center', obstacles);
    } else {
      ctx.fillStyle = isCurrent ? COLORS.ink : COLORS.inkDim;
      labelNear(ctx, band.name, (x0 + x1) / 2, ribbonTop, lifeBox, obstacles);
    }
  }

  /* Mass axis under the ribbon. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.inkFaint;
  const tickLabels: LabelBox[] = [];
  for (const [suns, label] of MASS_TICKS) {
    const x = xOf(suns * M_SUN);
    ctx.beginPath();
    ctx.moveTo(x, ribbonBottom);
    ctx.lineTo(x, ribbonBottom + 3);
    ctx.stroke();
    const half = ctx.measureText(label).width / 2;
    const cx = Math.min(w - half, Math.max(half, x));
    const box = labelBox(ctx, label, cx, axisY + 13, 'center');
    if (tickLabels.some((placed) => overlaps(box, placed, 2))) continue;
    tickLabels.push(box);
    placeText(ctx, label, cx, axisY + 13, 'center', obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'M (M☉)' : 'mass at birth (Suns)',
    (plotLeft + plotRight) / 2,
    axisY + 26,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The lifetime curve, clipped to its panel. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, lifeTop, plotW, lifeBottom - lifeTop);
  ctx.clip();
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const steps = 160;
  for (let i = 0; i <= steps; i += 1) {
    const M = M_AXIS_MIN * (M_AXIS_MAX / M_AXIS_MIN) ** (i / steps);
    const x = xOf(M);
    const y = yOf(mainSequenceLifetime(M));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  /* The cursor and the dot. Below the axis floor the dot sits on it, hollow. */
  const t = mainSequenceLifetime(view.M);
  const xM = xOf(view.M);
  const offChart = t < T_AXIS_MIN;
  const yDot = offChart ? lifeBottom : yOf(Math.min(T_AXIS_MAX, t));
  ctx.strokeStyle = 'rgba(240,168,104,0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xM, yDot);
  ctx.lineTo(xM, ribbonTop);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.warm;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xM, ribbonTop - 4);
  ctx.lineTo(xM, ribbonBottom + 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(xM, yDot, 4, 0, TAU);
  if (offChart) {
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = COLORS.warm;
    ctx.fill();
  }
  const marks: LabelBox[] = [{ x0: xM - 5, x1: xM + 5, y0: yDot - 5, y1: yDot + 5 }];

  ctx.fillStyle = COLORS.warm;
  labelNear(ctx, offChart ? `${formatYears(t)}, below the axis` : formatYears(t), xM, yDot, lifeBox, obstacles, marks);
}

const MAG_TICKS = [-20, -10, 0, 10, 20, 30];

function formatMagnitudeTick(v: number): string {
  return v === 0 ? '0' : `${v < 0 ? '−' : '+'}${Math.abs(v)}`;
}

const LY_TICKS: [number, string][] = [
  [100, '100 ly'],
  [1e4, '10 kly'],
  [1e6, '1 Mly'],
  [1e8, '100 Mly'],
];

const PC_TICKS: [number, string][] = [
  [10, '10 pc'],
  [1e3, '1 kpc'],
  [1e5, '100 kpc'],
  [1e7, '10 Mpc'],
];

const REFERENCES: [number, string][] = [
  [MAG_FULL_MOON, `full Moon, ${formatMagnitude(MAG_FULL_MOON)}`],
  [MAG_VENUS, `Venus, ${formatMagnitude(MAG_VENUS)}`],
  [MAG_NAKED_EYE, `naked-eye limit, +${MAG_NAKED_EYE}`],
  [MAG_SPACE_TELESCOPE, `space-telescope limit, about +${MAG_SPACE_TELESCOPE}`],
];

function drawBrightness(
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
  const plotBottom = h - (deep ? 48 : 36);
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return;

  const ld0 = Math.log10(D_AXIS_MIN);
  const ld1 = Math.log10(D_AXIS_MAX);
  const xOf = (d: number) => plotLeft + ((Math.log10(d) - ld0) / (ld1 - ld0)) * plotW;
  const yOf = (m: number) => plotTop + ((m - MAG_TOP) / (MAG_BOTTOM - MAG_TOP)) * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'How bright a Type Ia looks', PAD.left, splitY + 16, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'm' : 'how bright it looks', PAD.left, splitY + 29, 'left', obstacles);

  /* Axes and ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  for (const v of MAG_TICKS) placeText(ctx, formatMagnitudeTick(v), plotLeft - 4, yOf(v) + 3, 'right', obstacles);
  for (const [ly, label] of LY_TICKS) {
    const x = xOf(ly * LIGHT_YEAR);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    centredWithin(ctx, label, x, plotBottom + 13, 0, w, obstacles);
  }
  if (deep) {
    for (const [pc, label] of PC_TICKS) {
      const x = xOf(pc * PARSEC);
      ctx.beginPath();
      ctx.moveTo(x, plotBottom + 16);
      ctx.lineTo(x, plotBottom + 18);
      ctx.stroke();
      centredWithin(ctx, label, x, plotBottom + 27, 0, w, obstacles);
    }
  }
  centredWithin(
    ctx,
    deep ? 'd' : 'distance',
    (plotLeft + plotRight) / 2,
    plotBottom + (deep ? 40 : 27),
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* Reference lines. */
  ctx.strokeStyle = 'rgba(133,142,162,0.45)';
  ctx.setLineDash([4, 4]);
  for (const [mag] of REFERENCES) {
    const y = yOf(mag);
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* Andromeda: a tick on the axis and a faint rule up to the line. */
  const xAnd = xOf(ANDROMEDA);
  const yAnd = yOf(apparentMagnitude(M_IA_PEAK, ANDROMEDA));
  ctx.strokeStyle = 'rgba(152,162,184,0.45)';
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xAnd, plotBottom);
  ctx.lineTo(xAnd, yAnd);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.inkDim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xAnd, plotBottom);
  ctx.lineTo(xAnd, plotBottom - 6);
  ctx.stroke();

  /* The Type Ia line: straight, since m is linear in log d. Clipped to the panel. */
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotW, plotH);
  ctx.clip();
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(xOf(D_AXIS_MIN), yOf(apparentMagnitude(M_IA_PEAK, D_AXIS_MIN)));
  ctx.lineTo(xOf(D_AXIS_MAX), yOf(apparentMagnitude(M_IA_PEAK, D_AXIS_MAX)));
  ctx.stroke();
  ctx.restore();

  /* The dot. Brighter than the top of the axis, it sits on it, hollow. */
  const m = apparentMagnitude(M_IA_PEAK, view.d);
  const xD = xOf(view.d);
  const offChart = m < MAG_TOP;
  const yD = offChart ? plotTop : yOf(Math.min(MAG_BOTTOM, m));
  ctx.beginPath();
  ctx.arc(xD, yD, 4, 0, TAU);
  if (offChart) {
    ctx.strokeStyle = COLORS.warm;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = COLORS.warm;
    ctx.fill();
  }
  const marks: LabelBox[] = [
    { x0: xD - 5, x1: xD + 5, y0: yD - 5, y1: yD + 5 },
    { x0: xAnd - 2, x1: xAnd + 2, y0: plotBottom - 7, y1: plotBottom },
  ];

  /* Labels: the fixed ones first, then the one that moves. */
  ctx.fillStyle = COLORS.inkFaint;
  for (const [mag, label] of REFERENCES) labelAtEnd(ctx, label, yOf(mag), plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.inkDim;
  wrappedLabelNear(ctx, 'Andromeda: SN 1885A, a faint one, reached +6', xAnd, yAnd, plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.warm;
  labelNear(ctx, formatMagnitude(m), xD, yD, plotBox, obstacles, marks);
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
  drawFates(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawBrightness(ctx, w, h, splitY, view, obstacles);
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
 * Slides `shown[key]` to `to` in log space, painting each frame; a changed
 * target cancels the frame in flight. Returns the cleanup.
 */
function slide(
  shown: { current: { M: number; d: number } },
  key: 'M' | 'd',
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
  const logFrom = Math.log(from);
  const logTo = Math.log(to);
  let frame = 0;
  let start: number | null = null;
  const tick = (time: number) => {
    if (start === null) start = time;
    const progress = Math.min(1, (time - start) / DURATION.slow);
    const value = progress >= 1 ? to : Math.exp(logFrom + (logTo - logFrom) * eased(EASE.out, progress));
    shown.current = { ...shown.current, [key]: value };
    paint();
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

export default function SupernovaeSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const M = readParam(params, values, 'M');
  const d = readParam(params, values, 'd');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/supernova`, once per render.
  const fateNow = fate(M);
  const remnant = remnantMass(M) / M_SUN;
  const lifetime = mainSequenceLifetime(M);
  const luminosity = mainSequenceLuminosity(M) / L_SUN;
  const binding = collapseEnergy(M_NS_TYPICAL, R_NS);
  const m = apparentMagnitude(M_IA_PEAK, d);
  const nakedEye = distanceForMagnitude(M_IA_PEAK, MAG_NAKED_EYE);

  /** The mass and distance the panels are drawn at, which trail the sliders while they slide. */
  const shownRef = useRef({ M, d });

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

  /* Each slider's dot slides on its own; reduced motion, or no rAF, jumps. */
  useEffect(() => slide(shownRef, 'M', M, reduced, paint), [M, reduced, paint]);
  useEffect(() => slide(shownRef, 'd', d, reduced, paint), [d, reduced, paint]);

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
          aria-label="Above, a star's birth mass on a logarithmic axis from half the Sun's to thirty-two times it: a ribbon of three fates, white dwarf below eight solar masses, neutron star to twenty, black hole above, with the current one highlighted, under a falling curve of how long the star shines. Below, how bright a Type Ia supernova looks against its distance, with lines for the full Moon, Venus, the naked-eye limit and the space-telescope limit, and a tick at Andromeda."
          aria-describedby="supernovae-readouts"
        />
      </div>

      <dl id="supernovae-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Fate' : 'What it becomes'} value={FATE_LABELS[fateNow]} />
        <Readout
          label={deep ? 'Remnant mass' : 'Mass of what is left'}
          value={`${remnant.toFixed(2)} M☉${fateNow === 'black-hole' ? ' (rough)' : ''}`}
        />
        <Readout
          label={deep ? 'Main-sequence lifetime' : 'How long it shines steadily'}
          value={formatYears(lifetime)}
        />
        <Readout label={deep ? 'Luminosity L' : 'How bright it is meanwhile'} value={`${plainOrScientific(luminosity)} L☉`} />
        <Readout
          label={deep ? 'Binding energy 3GM²/5R' : 'Energy released by the collapse'}
          value={fateNow === 'white-dwarf' ? 'none: no collapse' : `${scientific(binding, 2)} J`}
        />
        <Readout
          label={deep ? 'Apparent magnitude m' : 'How bright a Type Ia looks from here'}
          value={`${formatMagnitude(m)}, ${brightnessWords(m)}`}
        />
        <Readout
          label={deep ? 'd at m = 6' : 'How far away you could see one unaided'}
          value={deep ? `${SIG3.format(nakedEye / MEGAPARSEC)} Mpc` : formatLightYears(nakedEye)}
        />
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
  scientific,
  formatYears,
  formatMagnitude,
  formatLightYears,
  brightnessWords,
};

/**
 * Nebulae — how big the glowing bubble is, above; why it glows the colours it
 * does, below.
 *
 * Top panel: the Strömgren radius against gas density on log-log axes, for the
 * live photon rate and, faintly, for the slider's faintest and brightest stars.
 * A dot sits at the slider's density; a marker shows Orion's core when the
 * star is O7-like. Beside the plot, a schematic: the star, the ionized disc
 * around it sized by log(R / 0.01 pc), and the ionization front at its edge.
 *
 * Bottom panel: the visible spectrum from 380 to 750 nm with the bright lines
 * of an H II region as bars, heights their typical relative intensities. The
 * strip and the bars brighten with the emission measure n² R, relative to the
 * defaults.
 *
 * No physics lives in this file. Every radius, mass, time and length comes from
 * `@/physics/nebula`, which the sanity block also reads. This file owns pixels
 * and formatting only.
 *
 * Motion: when either slider changes, the live line, the dot, the disc and the
 * spectrum's brightness slide to their new values over `DURATION.slow` on the
 * `EASE.out` curve, in log Q and log n. Under reduced motion they jump.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { AU, JULIAN_YEAR, LIGHT_YEAR, M_SUN, PARSEC, Q_O7V } from '@/physics/constants';
import {
  EMISSION_LINES,
  expansionRadius,
  frontThickness,
  ionizedMass,
  recombinationTime,
  stromgrenRadius,
} from '@/physics/nebula';
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

/** "1.6 × 10⁻⁴" — rounded before it reaches the screen, mantissa renormalised. */
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

/** A length in m as light-years (friendly) or parsecs (technical), three significant figures. */
function formatRadius(metres: number, units: Units): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  return units === 'technical'
    ? `${plainOrScientific(metres / PARSEC)} pc`
    : `${plainOrScientific(metres / LIGHT_YEAR)} light-years`;
}

/** The same radius, short, for the label beside the dot: "10.3 ly", "3.15 pc". */
function formatRadiusShort(metres: number, units: Units): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  return units === 'technical'
    ? `${plainOrScientific(metres / PARSEC)} pc`
    : `${plainOrScientific(metres / LIGHT_YEAR)} ly`;
}

/** A mass in kg as solar masses, three significant figures. */
function formatSolarMasses(kg: number): string {
  return Number.isFinite(kg) ? `${plainOrScientific(kg / M_SUN)} M☉` : '—';
}

/** A time in s as years, three significant figures. */
function formatYears(seconds: number): string {
  return Number.isFinite(seconds) ? `${plainOrScientific(seconds / JULIAN_YEAR)} years` : '—';
}

/** The front's thickness as a fraction of the radius, two significant figures, and in AU. */
function formatFront(thickness_m: number, radius_m: number): string {
  if (!Number.isFinite(thickness_m) || !Number.isFinite(radius_m) || radius_m <= 0) return '—';
  return `${scientific(thickness_m / radius_m, 2)} of the radius (${plainOrScientific(thickness_m / AU)} AU)`;
}

/** The strongest line in the table, which sets the colour a bright nebula shows the eye. */
function dominantLine(): string {
  const strongest = EMISSION_LINES.reduce((a, b) => (b.relative > a.relative ? b : a));
  return `green-teal, from oxygen at ${(strongest.wavelength_m * 1e9).toFixed(1)} nm`;
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
  glow: 'rgba(240,112,140,0.32)',
  front: 'rgba(250,150,165,0.95)',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const PLOT_LEFT = 44;
const TOP_SHARE = 0.52;

/** The top panel's axes: density in m⁻³, radius in m. */
const N_AXIS_MIN = 1e6;
const N_AXIS_MAX = 1e11;
const R_AXIS_MIN = 0.01 * PARSEC;
const R_AXIS_MAX = 100 * PARSEC;
/** The slider's faintest and brightest stars, s⁻¹. */
const Q_FAINTEST = 1e45;
const Q_BRIGHTEST = 1e50;
/** Orion's core: ten thousand atoms per cm³, where an O7 star's sphere is 0.146 pc. */
const N_ORION_CORE = 1e10;
/** How close to an O7 star the live star must be for the Orion marker, as a factor. */
const ORION_FACTOR = 3;
/** The expansion readout's age, s. */
const EXPANSION_AGE = 1e6 * JULIAN_YEAR;
/** The defaults the spectrum's brightness is measured against. */
const Q_REFERENCE = Q_O7V;
const N_REFERENCE = 1e8;

/** The strongest line's relative intensity, which sets the tallest bar. */
const STRONGEST = Math.max(...EMISSION_LINES.map((line) => line.relative));

/** The bottom panel's wavelength axis, m. */
const L_AXIS_MIN = 380e-9;
const L_AXIS_MAX = 750e-9;

type Units = 'friendly' | 'technical';

interface View {
  /** Photon rate as currently drawn, s⁻¹ — mid-tween while it slides. */
  Q: number;
  /** Density as currently drawn, m⁻³. */
  n: number;
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

/** A small filled dot, whose box every later label must avoid. */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hollow: boolean): LabelBox {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (hollow) {
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fill();
  }
  return { x0: x - r - 1, x1: x + r + 1, y0: y - r - 1, y1: y + r + 1 };
}

/**
 * An approximate sRGB colour for a visible wavelength, for the spectrum strip
 * only (the piecewise-linear fit astronomers' teaching plots use, dimmed at
 * the ends of vision).
 */
function wavelengthColour(lambda_m: number): number[] {
  const nm = lambda_m * 1e9;
  const [r, g, b] =
    nm < 440
      ? [(440 - nm) / 60, 0, 1]
      : nm < 490
        ? [0, (nm - 440) / 50, 1]
        : nm < 510
          ? [0, 1, (510 - nm) / 20]
          : nm < 580
            ? [(nm - 510) / 70, 1, 0]
            : nm < 645
              ? [1, (645 - nm) / 65, 0]
              : [1, 0, 0];
  const edge = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const f = Math.max(0, Math.min(1, edge));
  return [r, g, b].map((c) => Math.round(255 * Math.max(0, Math.min(1, c)) * f));
}

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Density ticks: every other decade, labelled in atoms per cm³. */
const N_TICKS: [number, string][] = [
  [1e6, '1'],
  [1e8, '100'],
  [1e10, '10⁴'],
];

/** Radius ticks in light-years (friendly) or parsecs (technical). */
const R_TICKS_LY: [number, string][] = [
  [0.1 * LIGHT_YEAR, '0.1 ly'],
  [1 * LIGHT_YEAR, '1 ly'],
  [10 * LIGHT_YEAR, '10 ly'],
  [100 * LIGHT_YEAR, '100 ly'],
];
const R_TICKS_PC: [number, string][] = [
  [0.01 * PARSEC, '0.01'],
  [0.1 * PARSEC, '0.1'],
  [1 * PARSEC, '1'],
  [10 * PARSEC, '10'],
  [100 * PARSEC, '100'],
];

function drawBubble(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const schemeW = Math.max(80, Math.min(180, Math.round(w * 0.26)));
  const plotLeft = PLOT_LEFT;
  const plotRight = w - PAD.right - schemeW - 8;
  const plotTop = 36;
  const plotBottom = splitY - 36;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return;

  const ln0 = Math.log10(N_AXIS_MIN);
  const ln1 = Math.log10(N_AXIS_MAX);
  const lr0 = Math.log10(R_AXIS_MIN);
  const lr1 = Math.log10(R_AXIS_MAX);
  const xOf = (n: number) => plotLeft + ((Math.log10(n) - ln0) / (ln1 - ln0)) * plotW;
  const yOf = (R: number) => plotBottom - ((Math.log10(R) - lr0) / (lr1 - lr0)) * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'How big the glowing bubble is', PAD.left, 14, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'R (pc)' : 'radius', PAD.left, 27, 'left', obstacles);

  /* Axes and ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  for (const [R, label] of deep ? R_TICKS_PC : R_TICKS_LY) {
    placeText(ctx, label, plotLeft - 4, yOf(R) + 3, 'right', obstacles);
  }
  for (const [n, label] of N_TICKS) {
    const x = xOf(n);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    centredWithin(ctx, label, x, plotBottom + 13, 0, plotRight + 8, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'n (cm⁻³)' : 'gas density (per cm³)',
    (plotLeft + plotRight) / 2,
    plotBottom + 26,
    PAD.left,
    plotRight + 8,
    obstacles,
  );

  /* The Strömgren line for a star, clipped to the panel: straight in log-log. */
  const line = (Q: number) => {
    ctx.beginPath();
    ctx.moveTo(xOf(N_AXIS_MIN), yOf(stromgrenRadius(Q, N_AXIS_MIN)));
    ctx.lineTo(xOf(N_AXIS_MAX), yOf(stromgrenRadius(Q, N_AXIS_MAX)));
    ctx.stroke();
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotW, plotH);
  ctx.clip();
  ctx.strokeStyle = 'rgba(152,162,184,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  line(Q_FAINTEST);
  line(Q_BRIGHTEST);
  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  line(view.Q);
  ctx.restore();

  /* The dot at the slider's density. Off the chart, it sits on the edge, hollow. */
  const R = stromgrenRadius(view.Q, view.n);
  const xD = xOf(view.n);
  const offChart = R > R_AXIS_MAX || R < R_AXIS_MIN;
  const yD = R > R_AXIS_MAX ? plotTop : R < R_AXIS_MIN ? plotBottom : yOf(R);
  ctx.fillStyle = COLORS.ember;
  ctx.strokeStyle = COLORS.ember;
  const marks: LabelBox[] = [dot(ctx, xD, yD, 4, offChart)];

  /* Orion's core, when the star is within a factor of 3 of an O7. */
  const orion = view.Q >= Q_O7V / ORION_FACTOR && view.Q <= Q_O7V * ORION_FACTOR;
  const xO = xOf(N_ORION_CORE);
  const yO = yOf(stromgrenRadius(Q_O7V, N_ORION_CORE));
  if (orion) {
    ctx.fillStyle = COLORS.ink;
    marks.push(dot(ctx, xO, yO, 2.5, false));
  }

  /* Labels: the dot's radius first, then the fixed ones around it. */
  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, formatRadiusShort(R, view.units), xD, yD, plotBox, obstacles, marks);
  if (orion) {
    ctx.fillStyle = COLORS.ink;
    labelNear(ctx, 'Orion’s core', xO, yO, plotBox, obstacles, marks);
  }
  /* Each faint line's label near the middle of its visible stretch. */
  const onChart = (Q: number): [number, number] => {
    // The densities at which this star's line crosses the top and bottom edges.
    const nAt = (Rt: number) => N_AXIS_MIN * (stromgrenRadius(Q, N_AXIS_MIN) / Rt) ** 1.5;
    const lo = Math.max(N_AXIS_MIN, nAt(R_AXIS_MAX));
    const hi = Math.min(N_AXIS_MAX, nAt(R_AXIS_MIN));
    return [lo, hi];
  };
  ctx.fillStyle = COLORS.inkFaint;
  for (const [Q, text] of [
    [Q_FAINTEST, 'faintest star'],
    [Q_BRIGHTEST, 'brightest star'],
  ] as const) {
    const [lo, hi] = onChart(Q);
    const n = Math.sqrt(lo * hi);
    labelNear(ctx, text, xOf(n), yOf(stromgrenRadius(Q, n)), plotBox, obstacles, marks);
  }

  /* The schematic beside the plot. */
  const sx0 = plotRight + 8;
  const sx1 = w - PAD.right;
  const cx = (sx0 + sx1) / 2;
  const cy = (plotTop + plotBottom) / 2 - 6;
  const rMax = Math.max(6, Math.min((sx1 - sx0) / 2 - 4, plotH / 2 - 16));
  const share = (Math.log10(Math.max(R, R_AXIS_MIN)) - lr0) / (lr1 - lr0);
  const r = Math.max(2, rMax * Math.min(1, share));
  ctx.fillStyle = COLORS.glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = COLORS.front;
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  const star = dot(ctx, cx, cy, 2.5, false);
  ctx.fillStyle = COLORS.front;
  labelNear(
    ctx,
    'ionization front',
    cx,
    cy + r + 4,
    { x0: plotLeft + 2, x1: sx1, y0: plotTop, y1: plotBottom + 16 },
    obstacles,
    [...marks, star],
  );
}

const WAVE_TICKS = [400e-9, 500e-9, 600e-9, 700e-9];

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const plotLeft = PAD.left + 4;
  const plotRight = w - PAD.right;
  const plotTop = splitY + 26;
  const stripBottom = h - 40;
  const stripTop = stripBottom - 14;
  const plotW = plotRight - plotLeft;
  if (plotW <= 0 || stripTop - plotTop <= 0) return;

  const xOf = (lambda: number) => plotLeft + ((lambda - L_AXIS_MIN) / (L_AXIS_MAX - L_AXIS_MIN)) * plotW;
  const barMax = Math.min(90, (stripTop - plotTop) * 0.45);

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'Why it glows the colours it does', PAD.left, splitY + 16, 'left', obstacles);

  /*
   * Overall brightness from the emission measure n² R, against the defaults,
   * on a log scale so the strip neither vanishes nor saturates across the
   * sliders' twelve decades of it.
   */
  const measure = (view.n ** 2 * stromgrenRadius(view.Q, view.n)) / (N_REFERENCE ** 2 * stromgrenRadius(Q_REFERENCE, N_REFERENCE));
  const brightness = Math.max(0.12, Math.min(1, 0.6 + 0.08 * Math.log10(measure)));

  /* The strip. */
  const gradient = ctx.createLinearGradient(xOf(L_AXIS_MIN), 0, xOf(L_AXIS_MAX), 0);
  for (let nm = 380; nm <= 750; nm += 10) {
    gradient.addColorStop((nm - 380) / 370, rgb(wavelengthColour(nm * 1e-9)));
  }
  ctx.globalAlpha = brightness * 0.55;
  ctx.fillStyle = gradient;
  ctx.fillRect(plotLeft, stripTop, plotW, stripBottom - stripTop);

  /* The lines, as bars on the strip. */
  ctx.globalAlpha = brightness;
  for (const line of EMISSION_LINES) {
    const x = xOf(line.wavelength_m);
    const height = (line.relative / STRONGEST) * barMax;
    ctx.fillStyle = rgb(wavelengthColour(line.wavelength_m));
    ctx.fillRect(x - 1, stripTop - height, 2, height + (stripBottom - stripTop));
  }
  ctx.globalAlpha = 1;

  /* The axis. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.inkFaint;
  for (const lambda of WAVE_TICKS) {
    const x = xOf(lambda);
    ctx.beginPath();
    ctx.moveTo(x, stripBottom);
    ctx.lineTo(x, stripBottom + 3);
    ctx.stroke();
    const nm = Math.round(lambda * 1e9);
    centredWithin(ctx, deep ? String(nm) : `${nm} nm`, x, stripBottom + 13, 0, w, obstacles);
  }
  centredWithin(ctx, deep ? 'λ (nm)' : 'wavelength', (plotLeft + plotRight) / 2, stripBottom + 26, PAD.left, w - PAD.right, obstacles);

  /*
   * Line names, in rows above the tallest bar with a leader down to each.
   * Taken in order of wavelength, each goes in the lowest row where it fits to
   * the right of that row's previous name, moved sideways no more than
   * `SHIFT` from its line; otherwise it climbs a row. Names in a row therefore
   * keep the order of their lines, and no two leaders cross within a row.
   */
  const SHIFT = 48;
  const ROW = 15;
  const base = stripTop - barMax - 8;
  const rows: number[] = [];
  for (let y = base; y - 10 >= plotTop; y -= ROW) rows.push(y);
  const rightEdge = rows.map(() => plotLeft);
  const byWavelength = [...EMISSION_LINES].sort((a, b) => a.wavelength_m - b.wavelength_m);
  for (const line of byWavelength) {
    const text = `${line.label} ${(line.wavelength_m * 1e9).toFixed(1)}`;
    const x = xOf(line.wavelength_m);
    const half = ctx.measureText(text).width / 2;
    let spot: { x: number; y: number } | null = null;
    for (const [i, y] of rows.entries()) {
      const lowest = Math.max(plotLeft + half, (rightEdge[i] ?? plotLeft) + 6 + half);
      const cx = Math.min(plotRight - half, Math.max(lowest, x));
      if (cx < lowest || Math.abs(cx - x) > SHIFT) continue;
      if (obstacles.some((o) => overlaps(labelBox(ctx, text, cx, y, 'center'), o, 2))) continue;
      spot = { x: cx, y };
      rightEdge[i] = cx + half;
      break;
    }
    if (!spot) continue;
    ctx.strokeStyle = 'rgba(152,162,184,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(spot.x, spot.y + 3);
    ctx.lineTo(x, stripTop - (line.relative / STRONGEST) * barMax - 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    platedText(ctx, text, { x: spot.x, y: spot.y, align: 'center' }, obstacles);
  }
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size.
 *
 * One obstacle list runs through both panels in drawing order, so every label
 * placed by measurement is placed against every label already on the canvas.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): void {
  ctx.clearRect(0, 0, w, h);
  if (w <= PLOT_LEFT + PAD.right + 120 || h <= 0) return;

  const splitY = Math.round(h * TOP_SHARE);
  const obstacles: LabelBox[] = [];

  ctx.save();
  drawBubble(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawSpectrum(ctx, w, h, splitY, view, obstacles);
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

type Shown = { Q: number; n: number };

/**
 * Slides `shown[key]` to `to` in log space, painting each frame; a changed
 * target cancels the frame in flight. Returns the cleanup.
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

export default function NebulaeSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const Q = readParam(params, values, 'Q');
  const n = readParam(params, values, 'n');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/nebula`, once per render.
  const R = stromgrenRadius(Q, n);
  const mass = ionizedMass(R, n);
  const tRec = recombinationTime(n);
  const front = frontThickness(n);
  const later = expansionRadius(R, EXPANSION_AGE);

  /** The values the panels are drawn at, which trail the sliders while they slide. */
  const shownRef = useRef<Shown>({ Q, n });

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

  /* Each slider's value slides on its own; reduced motion, or no rAF, jumps. */
  useEffect(() => slide(shownRef, 'Q', Q, reduced, paint), [Q, reduced, paint]);
  useEffect(() => slide(shownRef, 'n', n, reduced, paint), [n, reduced, paint]);

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
          aria-label="Above, the radius of the glowing gas around a hot star against the gas density, on logarithmic axes, for this star and faintly for the faintest and brightest stars, beside a drawing of the star, its glowing disc and the ionization front at its edge. Below, the visible spectrum with the bright lines of glowing hydrogen, oxygen, nitrogen and sulphur as bars, brighter when the gas is denser."
          aria-describedby="nebulae-readouts"
        />
      </div>

      <dl id="nebulae-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Strömgren radius' : 'How far the glow reaches'} value={formatRadius(R, units)} />
        <Readout label={deep ? 'Ionized mass' : 'How much gas is lit'} value={formatSolarMasses(mass)} />
        <Readout label={deep ? 'Recombination time' : 'How long an atom stays ionized'} value={formatYears(tRec)} />
        <Readout label={deep ? 'Ionization-front thickness' : 'How sharp the edge is'} value={formatFront(front, R)} />
        <Readout
          label={deep ? 'Spitzer expansion at 1 Myr' : 'Where it will be in a million years'}
          value={formatRadius(later, units)}
        />
        <Readout label={deep ? 'Dominant visible line' : 'Its colour to the eye'} value={dominantLine()} />
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
  formatRadius,
  formatSolarMasses,
  formatYears,
  formatFront,
  dominantLine,
};

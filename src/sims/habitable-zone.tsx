/**
 * The habitable zone — where the zone sits, above; how warm the planet is, below.
 *
 * Top panel: distance from the star on a log axis from 0.01 to 100 AU, with
 * the star drawn at the left edge, sized and coloured gently by its luminosity.
 * The conservative zone (Kopparapu et al. moist-greenhouse to maximum-greenhouse
 * edges) is shaded green, the optimistic extensions (recent Venus, early Mars)
 * paler, and the planet sits at the slider's distance, tinted by its
 * equilibrium temperature.
 *
 * Bottom panel: temperature against the same distance axis. The solid curve is
 * the equilibrium temperature with no atmosphere; the dashed one adds Earth's
 * 33 K of greenhouse warming. Reference lines mark where water freezes and
 * boils at Earth's pressure, and a dot sits on the solid curve at the planet.
 *
 * No physics lives in this file. Every flux, temperature and edge comes from
 * `@/physics/habitable`, and the year from `@/physics/kepler`; the sanity block
 * reads the same functions. This file owns pixels and formatting only.
 *
 * Motion: when the luminosity or the albedo changes, the zone and the curves
 * slide to their new places over `DURATION.slow` on the `EASE.out` curve (in
 * log L, and linearly in A); when the distance changes, the planet and its dot
 * slide in log d. Under reduced motion they jump.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import {
  AU,
  GREENHOUSE_EARTH,
  JULIAN_YEAR,
  L_SUN,
  S_SUN,
  SEFF_EARLY_MARS,
  SEFF_MAXGH,
  SEFF_MOIST,
  SEFF_RECENT_VENUS,
} from '@/physics/constants';
import {
  VERDICT_LABELS,
  equilibriumTemperature,
  massFromLuminosity,
  stellarFlux,
  surfaceTemperatureEarthLike,
  zoneEdge,
  zoneVerdict,
} from '@/physics/habitable';
import { period } from '@/physics/kepler';
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

/** "1.4 × 10⁷" — rounded before it reaches the screen, mantissa renormalised. */
function scientific(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  const places = Math.max(0, digits - 1);
  if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
  return `${(value / 10 ** exp).toFixed(places)} × 10${exponentGlyph(exp)}`;
}

/** A true minus sign in place of the hyphen Intl prints. */
function minus(text: string): string {
  return text.replace(/^-/, '−');
}

/** Plain inside the skill's 0.01 to 10 000 band, scientific outside it. */
function plainOrScientific(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 0.01 && abs < 1e4) return minus(SIG3.format(value));
  return scientific(value, 3);
}

/** A distance in m as AU, three significant figures. */
function formatAU(metres: number): string {
  return Number.isFinite(metres) ? SIG3.format(metres / AU) : '—';
}

/** The zone's conservative edges: "0.993 to 1.71 AU". */
function formatEdges(inner_m: number, outer_m: number): string {
  return `${formatAU(inner_m)} to ${formatAU(outer_m)} AU`;
}

/** Flux in W/m² with its ratio to Earth's: "1,360 W/m² (1.00 × Earth’s)". */
function formatFlux(flux: number): string {
  if (!Number.isFinite(flux)) return '—';
  const ratio = flux / S_SUN;
  const times = ratio >= 0.01 && ratio < 1e4 ? ratio.toFixed(2) : scientific(ratio, 2);
  return `${plainOrScientific(flux)} W/m² (${times} × Earth’s)`;
}

/**
 * A temperature in K with Celsius beside it: "255 K (−18 °C)".
 *
 * The Celsius figure is converted from the kelvin figure as shown, three
 * significant figures, and kept to the same decimal place, so the two agree
 * on the page: 255 K is −18 °C, not the −18.6 of the unrounded 254.6 K.
 */
function formatKelvinCelsius(kelvin: number): string {
  if (!Number.isFinite(kelvin) || kelvin <= 0) return '—';
  const shown = Number(kelvin.toPrecision(3));
  const places = Math.min(2, Math.max(0, 2 - Math.floor(Math.log10(shown))));
  // In whole hundredths of a degree, so the .x5 that every one-decimal kelvin
  // figure leaves after subtracting 273.15 rounds half away from zero, not by
  // whichever side of the tie binary floating point lands on.
  const hundredths = Math.round(shown * 100) - 27_315;
  const unit = 10 ** (2 - places);
  const rounded = (Math.sign(hundredths) * Math.round(Math.abs(hundredths) / unit) * unit) / 100;
  const celsius = new Intl.NumberFormat('en', { minimumFractionDigits: places, maximumFractionDigits: places });
  return `${plainOrScientific(kelvin)} K (${minus(celsius.format(rounded))} °C)`;
}

/** An orbital period in s as years, or days below one year: three significant figures. */
function formatPeriod(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const years = seconds / JULIAN_YEAR;
  if (years >= 1) {
    const text = plainOrScientific(years);
    return `${text} ${text === '1' ? 'year' : 'years'}`;
  }
  const text = plainOrScientific(seconds / 86_400);
  return `${text} ${text === '1' ? 'day' : 'days'}`;
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
  zone: 'rgba(95,191,127,0.5)',
  zonePale: 'rgba(95,191,127,0.2)',
  zoneInk: '#8fd9a6',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const PLOT_LEFT = 44;
const TOP_SHARE = 0.36;

/** Both panels' distance axis, m. */
const D_AXIS_MIN = 0.01 * AU;
const D_AXIS_MAX = 100 * AU;
/** The bottom panel's temperature axis, K. */
const T_AXIS_MAX = 700;
/** Reference temperatures at Earth's surface pressure, K. */
const T_FREEZE = 273.15;
const T_BOIL = 373.15;
/** Where the dashed curve's label sits, K on that curve. */
const T_LABEL = 520;

type Units = 'friendly' | 'technical';

interface View {
  /** Luminosity as currently drawn, W — mid-tween while it slides. */
  L: number;
  /** Orbital distance as currently drawn, m. */
  d: number;
  /** Bond albedo as currently drawn. */
  A: number;
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

/** Linear interpolation between two RGB triples. */
function mix(a: number[], b: number[], t: number): number[] {
  const u = Math.min(1, Math.max(0, t));
  return a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * u));
}

const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** The star's colour, orange-red when faint through warm white to blue-white when bright. */
function starColour(L: number): string {
  const x = Math.log10(L / L_SUN);
  return x < 0 ? rgb(mix([255, 122, 72], [255, 236, 200], (x + 4) / 4)) : rgb(mix([255, 236, 200], [200, 220, 255], x / 2));
}

/** The star's drawn radius, px: gently larger for brighter stars. */
function starRadius(L: number): number {
  return 7 + 1.2 * Math.log10(L / L_SUN);
}

/** The planet's tint by equilibrium temperature: blue below 200 K, white near 275, red above 350. */
function planetColour(T: number): string {
  if (T <= 275) return rgb(mix([110, 160, 255], [240, 240, 240], (T - 200) / 75));
  return rgb(mix([240, 240, 240], [255, 90, 70], (T - 275) / 75));
}

const AU_TICKS: [number, string][] = [
  [0.01, '0.01 AU'],
  [0.1, '0.1 AU'],
  [1, '1 AU'],
  [10, '10 AU'],
  [100, '100 AU'],
];

const AU_TICKS_DEEP: [number, string][] = [
  [0.01, '0.01'],
  [0.1, '0.1'],
  [1, '1'],
  [10, '10'],
  [100, '100'],
];

function drawZone(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const plotLeft = PLOT_LEFT;
  const plotRight = w - PAD.right;
  const bandTop = 24;
  const axisY = splitY - 36;
  const plotW = plotRight - plotLeft;
  if (plotW <= 0 || axisY - bandTop <= 0) return;

  const l0 = Math.log10(D_AXIS_MIN);
  const l1 = Math.log10(D_AXIS_MAX);
  const xOf = (d: number) => plotLeft + ((Math.log10(d) - l0) / (l1 - l0)) * plotW;
  const clampX = (x: number) => Math.min(plotRight, Math.max(plotLeft, x));
  const midY = (bandTop + axisY) / 2;

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'The star and its zone', PAD.left, 14, 'left', obstacles);

  /* The optimistic zone, then the conservative one over it. */
  const optIn = clampX(xOf(zoneEdge(view.L, SEFF_RECENT_VENUS)));
  const optOut = clampX(xOf(zoneEdge(view.L, SEFF_EARLY_MARS)));
  const conIn = clampX(xOf(zoneEdge(view.L, SEFF_MOIST)));
  const conOut = clampX(xOf(zoneEdge(view.L, SEFF_MAXGH)));
  ctx.fillStyle = COLORS.zonePale;
  ctx.fillRect(optIn, bandTop, optOut - optIn, axisY - bandTop);
  ctx.fillStyle = COLORS.zone;
  ctx.fillRect(conIn, bandTop, conOut - conIn, axisY - bandTop);

  /* Axis and ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, axisY);
  ctx.lineTo(plotRight, axisY);
  ctx.stroke();
  ctx.fillStyle = COLORS.inkFaint;
  for (const [au, label] of deep ? AU_TICKS_DEEP : AU_TICKS) {
    const x = xOf(au * AU);
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, axisY + 3);
    ctx.stroke();
    centredWithin(ctx, label, x, axisY + 13, 0, w, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'd (AU)' : 'distance from the star',
    (plotLeft + plotRight) / 2,
    axisY + 26,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The star, at the axis's left end. */
  const r = starRadius(view.L);
  ctx.fillStyle = starColour(view.L);
  ctx.beginPath();
  ctx.arc(PAD.left + 10, midY, r, 0, TAU);
  ctx.fill();

  /*
   * Zone names, centred over their bands on plates. The conservative band is
   * a quarter of a decade wide, narrower than its own name at any width, so a
   * name may spill past its band's edges; it is drawn only where it stays in
   * the panel and clear of every label already placed.
   */
  const panel: LabelBox = { x0: plotLeft, x1: plotRight, y0: bandTop, y1: axisY };
  // The planet is drawn last, on top, so its box is reserved first: no label
  // placed below may sit under the dot.
  const xP = xOf(view.d);
  const planet: LabelBox = { x0: xP - 6, x1: xP + 6, y0: midY - 6, y1: midY + 6 };
  const blocked = (box: LabelBox) => [...obstacles, planet].some((o) => overlaps(box, o, 2));
  const named = (text: string, x0: number, x1: number, rows: number[]) => {
    if (x1 - x0 < 1) return;
    const half = ctx.measureText(text).width / 2;
    const x = Math.min(plotRight - half - 2, Math.max(plotLeft + half + 2, (x0 + x1) / 2));
    const spot = rows
      .map((y) => ({ x, y, align: 'center' as const }))
      .find(
        (c) =>
          inside(ctx, text, c, panel) && !blocked(labelBox(ctx, text, c.x, c.y, c.align)),
      );
    if (!spot) return;
    ctx.fillStyle = COLORS.zoneInk;
    platedText(ctx, text, spot, obstacles);
  };
  named('liquid water possible', conIn, conOut, [bandTop + 12]);
  named('at the edge', optIn, conIn, [bandTop + 26, bandTop + 40]);
  named('at the edge', conOut, optOut, [bandTop + 26, bandTop + 40]);

  /* At Deep, the four edges' distances, wherever each fits. */
  if (deep) {
    const edges: [number, number][] = [
      [SEFF_MOIST, axisY - 5],
      [SEFF_MAXGH, axisY - 5],
      [SEFF_RECENT_VENUS, axisY - 17],
      [SEFF_EARLY_MARS, axisY - 17],
    ];
    ctx.fillStyle = COLORS.ink;
    for (const [sEff, y] of edges) {
      const d = zoneEdge(view.L, sEff);
      const x = xOf(d);
      if (x < plotLeft || x > plotRight) continue;
      const text = formatAU(d);
      const spot = [0, -12, -24, -36]
        .map((dy) => ({ x, y: y + dy, align: 'center' as const }))
        .find(
          (c) =>
            inside(ctx, text, c, { x0: plotLeft, x1: plotRight, y0: bandTop, y1: axisY }) &&
            !blocked(labelBox(ctx, text, c.x, c.y, c.align)),
        );
      if (spot) platedText(ctx, text, spot, obstacles);
    }
  }

  /* The planet, over everything else in the panel. */
  const T = equilibriumTemperature(view.L, view.d, view.A);
  ctx.fillStyle = planetColour(T);
  ctx.beginPath();
  ctx.arc(xP, midY, 5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = COLORS.void;
  ctx.lineWidth = 1;
  ctx.stroke();
}

const T_TICKS = [0, 200, 400, 600];

function drawTemperature(
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

  const l0 = Math.log10(D_AXIS_MIN);
  const l1 = Math.log10(D_AXIS_MAX);
  const xOf = (d: number) => plotLeft + ((Math.log10(d) - l0) / (l1 - l0)) * plotW;
  const yOf = (T: number) => plotBottom - (T / T_AXIS_MAX) * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'How warm the planet is', PAD.left, splitY + 16, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'T (K)' : 'temperature', PAD.left, splitY + 29, 'left', obstacles);

  /* Axes and ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  for (const T of T_TICKS) {
    placeText(ctx, deep ? String(T) : `${T} K`, plotLeft - 4, yOf(T) + 3, 'right', obstacles);
  }
  for (const [au, label] of deep ? AU_TICKS_DEEP : AU_TICKS) {
    const x = xOf(au * AU);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    centredWithin(ctx, label, x, plotBottom + 13, 0, w, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'd (AU)' : 'distance from the star',
    (plotLeft + plotRight) / 2,
    plotBottom + 27,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* Water's reference lines. */
  ctx.strokeStyle = 'rgba(133,142,162,0.45)';
  ctx.setLineDash([4, 4]);
  for (const T of [T_FREEZE, T_BOIL]) {
    ctx.beginPath();
    ctx.moveTo(plotLeft, yOf(T));
    ctx.lineTo(plotRight, yOf(T));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* The two curves, clipped to the panel. */
  const steps = 160;
  const trace = (offset: number) => {
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const d = D_AXIS_MIN * (D_AXIS_MAX / D_AXIS_MIN) ** (i / steps);
      const T = equilibriumTemperature(view.L, d, view.A);
      const y = yOf(offset ? surfaceTemperatureEarthLike(T) : T);
      if (i === 0) ctx.moveTo(xOf(d), y);
      else ctx.lineTo(xOf(d), y);
    }
    ctx.stroke();
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(plotLeft, plotTop, plotW, plotH);
  ctx.clip();
  ctx.strokeStyle = COLORS.warm;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([5, 4]);
  trace(1);
  ctx.setLineDash([]);
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  trace(0);
  ctx.restore();

  /* The planet's dot. Hotter than the top of the axis, it sits on it, hollow. */
  const T = equilibriumTemperature(view.L, view.d, view.A);
  const xD = xOf(view.d);
  const offChart = T > T_AXIS_MAX;
  const yD = offChart ? plotTop : yOf(T);
  ctx.beginPath();
  ctx.arc(xD, yD, 4, 0, TAU);
  if (offChart) {
    ctx.strokeStyle = COLORS.ember;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = COLORS.ember;
    ctx.fill();
  }
  const marks: LabelBox[] = [{ x0: xD - 5, x1: xD + 5, y0: yD - 5, y1: yD + 5 }];

  /* Labels: the fixed ones first, then the ones that move. */
  ctx.fillStyle = COLORS.inkFaint;
  labelAtEnd(ctx, 'water freezes', yOf(T_FREEZE), plotBox, obstacles, marks);
  labelAtEnd(ctx, 'water boils, at Earth’s pressure', yOf(T_BOIL), plotBox, obstacles, marks);

  // The dashed curve's label, where that curve crosses 520 K, kept on the chart.
  const Tref = equilibriumTemperature(view.L, AU, view.A);
  const dLabel = Math.min(
    D_AXIS_MAX / 2,
    Math.max(D_AXIS_MIN * 2, AU * (Tref / (T_LABEL - GREENHOUSE_EARTH)) ** 2),
  );
  const yLabel = yOf(Math.min(T_AXIS_MAX, surfaceTemperatureEarthLike(equilibriumTemperature(view.L, dLabel, view.A))));
  ctx.fillStyle = COLORS.warm;
  labelNear(ctx, 'with an Earth-like atmosphere', xOf(dLabel), yLabel, plotBox, obstacles, marks);

  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, `${plainOrScientific(T)} K`, xD, yD, plotBox, obstacles, marks);
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
  drawZone(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawTemperature(ctx, w, h, splitY, view, obstacles);
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

type Shown = { L: number; d: number; A: number };

/**
 * Slides `shown[key]` to `to` — in log space for L and d, linearly for A —
 * painting each frame; a changed target cancels the frame in flight.
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
  const log = key !== 'A';
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

export default function HabitableZoneSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const L = readParam(params, values, 'L');
  const d = readParam(params, values, 'd');
  const A = readParam(params, values, 'A');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/habitable` and `@/physics/kepler`, once per render.
  const verdict = zoneVerdict(L, d);
  const inner = zoneEdge(L, SEFF_MOIST);
  const outer = zoneEdge(L, SEFF_MAXGH);
  const flux = stellarFlux(L, d);
  const Teq = equilibriumTemperature(L, d, A);
  const Tsurface = surfaceTemperatureEarthLike(Teq);
  const year = period(massFromLuminosity(L), d);

  /** The values the panels are drawn at, which trail the sliders while they slide. */
  const shownRef = useRef<Shown>({ L, d, A });

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

  /* The zone and curves follow L and A; the planet follows d. Reduced motion jumps. */
  useEffect(() => slide(shownRef, 'L', L, reduced, paint), [L, reduced, paint]);
  useEffect(() => slide(shownRef, 'A', A, reduced, paint), [A, reduced, paint]);
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
    <div className="flex min-h-[30rem] flex-col gap-4">
      <div className="relative h-[30rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Above, distance from a star on a logarithmic axis from a hundredth of an AU to a hundred, with the star at the left, the habitable zone shaded green, paler optimistic margins either side, and the planet as a dot tinted by its temperature. Below, the planet's temperature against the same distance: a solid curve with no atmosphere, a dashed one with Earth's greenhouse warming, and lines where water freezes and boils."
          aria-describedby="habitable-zone-readouts"
        />
      </div>

      <dl id="habitable-zone-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Verdict' : 'Is the planet in the zone?'} value={VERDICT_LABELS[verdict]} />
        <Readout label={deep ? 'Conservative edges' : 'The zone runs from'} value={formatEdges(inner, outer)} />
        <Readout label={deep ? 'Stellar flux S' : 'Light reaching the planet'} value={formatFlux(flux)} />
        <Readout
          label={deep ? 'Equilibrium temperature' : 'Temperature with no atmosphere'}
          value={formatKelvinCelsius(Teq)}
        />
        <Readout label={deep ? 'Equilibrium plus 33 K' : 'With an Earth-like atmosphere'} value={formatKelvinCelsius(Tsurface)} />
        <Readout
          label={deep ? 'Orbital period, star mass from L' : 'How long a year is'}
          value={formatPeriod(year)}
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
  formatEdges,
  formatFlux,
  formatKelvinCelsius,
  formatPeriod,
};

/**
 * The cosmic microwave background — a blackbody spectrum above, the whole sky
 * below.
 *
 * Top panel: B_λ against wavelength on log-log axes, from the ultraviolet to
 * radio, with the visible band shaded. The live curve is Planck's law at the
 * slider's temperature; today's curve stays behind it, faint, once the reader
 * heats the universe up. The maximum is marked with Wien's peak wavelength —
 * the maximum of B_λ *is* Wien's peak, so the dot and its label agree by
 * construction rather than by approximation. A dashed line marks the
 * observing wavelength.
 *
 * Bottom panel: an all-sky oval tinted warm ahead and cool behind, with the
 * contrast scaled to the observer's speed and the base colour to the
 * temperature. It is a picture of the kinematic dipole, not a map.
 *
 * No physics lives in this file. Every radiance, temperature, wavelength and
 * count comes from `@/physics/cosmology`, which the math layer and the sanity
 * block also read. This file owns pixels and formatting only.
 *
 * Motion: when the temperature changes, the drawn curve slides to its new
 * position over `DURATION.slow` on the `EASE.out` curve, interpolated in
 * log T so a jump of three decades moves at the same pace as a jump of one.
 * Under reduced motion it jumps, and the canvas is still between drags.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { C, T_CMB } from '@/physics/constants';
import {
  dipoleAmplitude,
  photonNumberDensity,
  planckSpectralRadiance,
  planckSpectralRadianceWavelength,
  redshiftAtTemperature,
  scaleFactorAtTemperature,
  wienPeakWavelength,
} from '@/physics/cosmology';
import { DURATION, EASE, type Bezier } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, type LabelBox } from './labels';

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
  // Rounding the mantissa can carry it to 10, so renormalise when it does.
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

/** m → "1.06 mm", "966 nm", "10.6 µm": the named unit the value warrants. */
function formatWavelength(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  if (metres >= 1) return `${SIG3.format(metres)} m`;
  if (metres >= 1e-3) return `${SIG3.format(metres * 1e3)} mm`;
  if (metres >= 1e-6) return `${SIG3.format(metres * 1e6)} µm`;
  return `${SIG3.format(metres * 1e9)} nm`;
}

/** Below this redshift the reader is looking at today's sky. */
const NOW_Z = 1e-6;

/** One jansky, W m⁻² Hz⁻¹. A unit definition, not a measured constant. */
const JANSKY = 1e-26;

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
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const AXIS_GUTTER = 40;
const SPECTRUM_SHARE = 0.6;

/** The spectrum's axes, in SI: wavelength in m, B_λ in W m⁻³ sr⁻¹. */
const LAMBDA_MIN = 1e-7;
const LAMBDA_MAX = 1;
/**
 * Fixed, so the reader sees the curve move rather than the axis: B_λ at its
 * peak scales as T⁵, and 3000 K peaks about 10¹⁵ times brighter than today.
 * The top leaves a decade of margin over the 3000 K peak (≈ 10¹²); the bottom
 * keeps today's curve about six decades tall.
 */
const B_MIN = 1e-9;
const B_MAX = 1e13;

/** The visible band, m. */
const VISIBLE_FROM = 4.0e-7;
const VISIBLE_TO = 7.5e-7;

/** Penzias and Wilson's horn: 4080 MHz, 7.35 cm. */
const PENZIAS_WILSON_WAVELENGTH = 7.35e-2;

/** Samples along the curve, log-spaced. */
const CURVE_SAMPLES = 240;

type Units = 'friendly' | 'technical';

interface View {
  /** Radiation temperature as currently drawn, K — mid-tween while it slides. */
  T: number;
  /** Observing wavelength, m. */
  lambda: number;
  /** Observer speed relative to the CMB, m/s. */
  v: number;
  /** The v slider's maximum, m/s: sets full dipole contrast. */
  vMax: number;
  /** The T slider's maximum, K: sets the sky's orange end. */
  TMax: number;
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

/**
 * A label near a point, in the first spot that is inside `bounds` and clear of
 * everything already drawn. The grid of candidates is wide enough that one is
 * always free; the canvas tests hold that to be true at every slider extreme.
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
  for (const dy of [-9, 15, -21, 27, -33, 39, -45, 51, -57, 63]) {
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

  // A plate of the background behind the words. These labels sit among curves
  // that sweep across the whole panel as the temperature changes, and no
  // placement keeps every curve off them; the plate keeps them readable.
  const box = labelBox(ctx, text, spot.x, spot.y, spot.align);
  const ink = ctx.fillStyle;
  ctx.fillStyle = 'rgba(5,7,12,0.82)';
  ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
  ctx.fillStyle = ink;
  placeText(ctx, text, spot.x, spot.y, spot.align, obstacles);
}

/** Decade tick labels on the wavelength axis, in the reader's units. */
const FRIENDLY_DECADES: Record<number, string> = {
  [-7]: '100 nm',
  [-6]: '1 µm',
  [-5]: '10 µm',
  [-4]: '100 µm',
  [-3]: '1 mm',
  [-2]: '1 cm',
  [-1]: '10 cm',
  0: '1 m',
};

function decadeLabel(exp: number, units: Units): string {
  return units === 'friendly' ? (FRIENDLY_DECADES[exp] ?? '') : `10${exponentGlyph(exp)}`;
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const plotLeft = AXIS_GUTTER;
  const plotRight = w - PAD.right;
  const plotTop = 28;
  const plotBottom = splitY - 38;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return;

  const logL0 = Math.log10(LAMBDA_MIN);
  const logL1 = Math.log10(LAMBDA_MAX);
  const logB0 = Math.log10(B_MIN);
  const logB1 = Math.log10(B_MAX);
  const xOf = (lambda: number) => plotLeft + ((Math.log10(lambda) - logL0) / (logL1 - logL0)) * plotW;
  const yOf = (b: number) => plotBottom - ((Math.log10(b) - logB0) / (logB1 - logB0)) * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';

  /* Title row. */
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'The glow’s spectrum', PAD.left, 14, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(
    ctx,
    view.units === 'technical' ? 'B_λ (W m⁻³ sr⁻¹)' : 'brightness',
    plotRight,
    14,
    'right',
    obstacles,
  );

  /* The visible band, shaded first so everything else sits on top of it. */
  const xv0 = xOf(VISIBLE_FROM);
  const xv1 = xOf(VISIBLE_TO);
  ctx.fillStyle = 'rgba(232,189,125,0.14)';
  ctx.fillRect(xv0, plotTop, xv1 - xv0, plotH);

  /* Axes. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();

  /* Brightness decades, labelled at the Deep tier only: at the others the
     axis is "brightness", and a column of powers of ten is noise. */
  if (view.units === 'technical') {
    ctx.fillStyle = COLORS.inkFaint;
    for (let exp = -5; exp <= 10; exp += 5) {
      placeText(ctx, `10${exponentGlyph(exp)}`, plotLeft - 4, yOf(10 ** exp) + 3, 'right', obstacles);
    }
  }

  /* Wavelength decades, thinned until they fit side by side. */
  const decades: number[] = [];
  for (let exp = Math.round(logL0); exp <= Math.round(logL1); exp += 1) decades.push(exp);
  const widest = Math.max(...decades.map((exp) => ctx.measureText(decadeLabel(exp, view.units)).width));
  const spacing = plotW / Math.max(1, decades.length - 1);
  const stride = Math.max(1, Math.ceil((widest + 8) / spacing));
  ctx.fillStyle = COLORS.inkFaint;
  ctx.strokeStyle = COLORS.edge;
  decades.forEach((exp, i) => {
    const x = xOf(10 ** exp);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    if (i % stride === 0) centredWithin(ctx, decadeLabel(exp, view.units), x, plotBottom + 14, 0, w, obstacles);
  });
  centredWithin(
    ctx,
    view.units === 'technical' ? 'λ (m)' : 'wavelength',
    (plotLeft + plotRight) / 2,
    plotBottom + 28,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* Penzias and Wilson, a tick up from the axis. Labelled below, with the rest. */
  const xPW = xOf(PENZIAS_WILSON_WAVELENGTH);
  ctx.strokeStyle = COLORS.inkDim;
  ctx.beginPath();
  ctx.moveTo(xPW, plotBottom);
  ctx.lineTo(xPW, plotBottom - 6);
  ctx.stroke();

  /* A curve of B_λ at temperature T, clipped to the axis range. */
  const traceCurve = (T: number) => {
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
      const lambda = 10 ** (logL0 + ((logL1 - logL0) * i) / CURVE_SAMPLES);
      const b = planckSpectralRadianceWavelength(lambda, T);
      const visible = Number.isFinite(b) && b >= B_MIN;
      const y = visible ? Math.max(plotTop, yOf(b)) : plotBottom;
      if (visible) {
        if (!drawing) ctx.moveTo(xOf(lambda), y);
        else ctx.lineTo(xOf(lambda), y);
        drawing = true;
      } else if (drawing) {
        ctx.lineTo(xOf(lambda), plotBottom);
        drawing = false;
      }
    }
    ctx.stroke();
  };

  /* Today, faint, once the reader has left it. */
  const showToday = view.T > T_CMB * (1 + NOW_Z);
  const todayPeak = wienPeakWavelength(T_CMB);
  if (showToday) {
    ctx.strokeStyle = 'rgba(152,162,184,0.5)';
    ctx.lineWidth = 1;
    traceCurve(T_CMB);
  }

  /* The live curve. */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  traceCurve(view.T);

  /* The observing wavelength: a dashed line, and where it meets the curve. */
  const xObs = xOf(view.lambda);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = COLORS.inkDim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xObs, plotTop);
  ctx.lineTo(xObs, plotBottom);
  ctx.stroke();
  ctx.setLineDash([]);
  const bObs = planckSpectralRadianceWavelength(view.lambda, view.T);
  const obsBox: LabelBox[] = [];
  if (Number.isFinite(bObs) && bObs >= B_MIN) {
    const yObs = Math.max(plotTop, yOf(bObs));
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.arc(xObs, yObs, 3, 0, TAU);
    ctx.fill();
    obsBox.push({ x0: xObs - 4, x1: xObs + 4, y0: yObs - 4, y1: yObs + 4 });
  }

  /* The maximum, and Wien's wavelength for it. */
  const peak = wienPeakWavelength(view.T);
  const xPeak = xOf(peak);
  const yPeak = Math.max(plotTop, yOf(planckSpectralRadianceWavelength(peak, view.T)));
  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(xPeak, yPeak, 4, 0, TAU);
  ctx.fill();
  const peakDot: LabelBox = { x0: xPeak - 5, x1: xPeak + 5, y0: yPeak - 5, y1: yPeak + 5 };

  /*
   * Every label in the panel goes on last, once every line and dot is down, and
   * each is placed clear of the two dots and of the dashed observing line —
   * a label threaded on a vertical line reads as struck through. "Visible
   * light" sits at the foot of its band, out of the way of the 3000 K peak,
   * which lands inside the band's top at the hot end of the slider.
   */
  const dots: LabelBox[] = [peakDot, ...obsBox];
  const marks: LabelBox[] = [...dots, { x0: xObs - 1, x1: xObs + 1, y0: plotTop, y1: plotBottom }];

  // The two labels with a fixed home avoid the dots but not the dashed line:
  // on a phone the Penzias & Wilson label cannot fit beside its tick without
  // crossing the line, and pushed clear of it the label drifts over the
  // millimetre peak and names the wrong thing. Its plate masks the line.
  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, 'visible light', (xv0 + xv1) / 2, plotBottom - 3, plotBox, obstacles, dots);

  ctx.fillStyle = COLORS.inkFaint;
  labelNear(ctx, 'Penzias & Wilson, 1965', xPW, plotBottom - 3, plotBox, obstacles, dots);

  if (showToday) {
    const yToday = yOf(planckSpectralRadianceWavelength(todayPeak, T_CMB));
    ctx.fillStyle = COLORS.inkDim;
    labelNear(ctx, 'today', xOf(todayPeak), yToday, plotBox, obstacles, marks);
  }

  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, `peak ${formatWavelength(peak)}`, xPeak, yPeak, plotBox, obstacles, marks);
}

/** A channel pair, blended. */
function mix(a: number[], b: number[], t: number): number[] {
  return a.map((x, i) => x + ((b[i] ?? x) - x) * t);
}

function rgb(c: number[]): string {
  const [r, g, b] = c.map((x) => Math.round(Math.min(255, Math.max(0, x))));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Sky tints: a dim grey-blue today, lamp-filament orange at 3000 K. */
const SKY_COLD = [44, 50, 68];
const SKY_HOT = [236, 142, 58];
/** The directions the dipole pushes a colour, at full contrast. */
const WARM_SHIFT = [70, 18, -40];
const COOL_SHIFT = [-40, -6, 70];

function drawSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const left = PAD.left;
  const right = w - PAD.right;
  if (right - left <= 0) return;

  const titleY = splitY + 18;
  const rowY = splitY + 34;
  const top = splitY + 42;
  const bottom = h - 24;
  const available = bottom - top;
  if (available <= 0) return;

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'The whole sky', left, titleY, 'left', obstacles);

  /* The oval: 2:1, as wide as fits. */
  const rx = Math.min((right - left) / 2, available);
  const ry = rx / 2;
  const cx = (left + right) / 2;
  const cy = top + available / 2;

  // Base colour from the temperature, in log T, so the slider's travel and the
  // colour's travel match.
  const heat =
    view.TMax > T_CMB
      ? Math.min(1, Math.max(0, Math.log(view.T / T_CMB) / Math.log(view.TMax / T_CMB)))
      : 0;
  const base = mix(SKY_COLD, SKY_HOT, heat);
  const contrast = view.vMax > 0 ? Math.min(1, Math.max(0, view.v / view.vMax)) : 0;
  const warm = base.map((c, i) => c + (WARM_SHIFT[i] ?? 0) * contrast);
  const cool = base.map((c, i) => c + (COOL_SHIFT[i] ?? 0) * contrast);

  const gradient = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  gradient.addColorStop(0, rgb(warm));
  gradient.addColorStop(0.5, rgb(base));
  gradient.addColorStop(1, rgb(cool));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(213,220,234,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* Which side is which — or, standing still, that there are no sides. */
  ctx.fillStyle = COLORS.inkDim;
  if (view.v > 0) {
    placeText(ctx, 'hotter, ahead', cx - rx, rowY, 'left', obstacles);
    placeText(ctx, 'cooler, behind', cx + rx, rowY, 'right', obstacles);
  } else {
    centredWithin(ctx, 'the same in every direction', cx, rowY, left, right, obstacles);
  }

  /* The dipole's size, below. */
  const deltaMk = (dipoleAmplitude(view.T, view.v) * 1e3).toFixed(2);
  ctx.fillStyle = COLORS.ember;
  centredWithin(
    ctx,
    view.units === 'technical' ? `ΔT = ${deltaMk} mK` : `ahead is ${deltaMk} mK above average`,
    cx,
    h - 8,
    left,
    right,
    obstacles,
  );
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size.
 *
 * One obstacle list runs through both panels in drawing order, so every label
 * placed by measurement is placed against every label already on the canvas.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): void {
  ctx.clearRect(0, 0, w, h);
  if (w <= PAD.left + PAD.right + AXIS_GUTTER || h <= 0) return;

  const splitY = Math.round(h * SPECTRUM_SHARE);
  const obstacles: LabelBox[] = [];

  ctx.save();
  drawSpectrum(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawSky(ctx, w, h, splitY, view, obstacles);
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

function paramMax(params: Param[], id: string): number {
  return params.find((p) => p.id === id)?.max ?? NaN;
}

export default function CmbSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const T = readParam(params, values, 'T');
  const lambda = readParam(params, values, 'lambda');
  const v = readParam(params, values, 'v');
  const vMax = paramMax(params, 'v');
  const TMax = paramMax(params, 'T');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/cosmology`, once per render.
  const z = redshiftAtTemperature(Math.max(T, T_CMB));
  const a = scaleFactorAtTemperature(T);
  const peak = wienPeakWavelength(T);
  const bNu = planckSpectralRadiance(C / lambda, T);
  const nGamma = photonNumberDensity(T);
  const dipole = dipoleAmplitude(T, v);
  const now = z < NOW_Z;

  /** The temperature the curve is drawn at, which trails `T` while it slides. */
  const shownRef = useRef(T);

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
    drawScene(ctx, rect.width, rect.height, { T: shownRef.current, lambda, v, vMax, TMax, units });
  }, [lambda, v, vMax, TMax, units]);

  /*
   * The slide. A new temperature starts a tween, in log T, from wherever the
   * curve is drawn now, so a continuous drag never snaps back; a changed target
   * cancels the frame in flight. Everything else repaints at once. Reduced
   * motion, or no rAF at all, puts the curve straight on target.
   */
  useEffect(() => {
    const from = shownRef.current;
    const to = T;
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
  }, [T, reduced, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  return (
    <div className="flex min-h-[26rem] flex-col gap-4">
      <div className="relative h-[26rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="A blackbody spectrum of brightness against wavelength, with the visible band shaded and the peak marked, above an oval of the whole sky tinted warmer on the side we move toward and cooler behind."
          aria-describedby="cosmic-microwave-background-readouts"
        />
      </div>

      <dl
        id="cosmic-microwave-background-readouts"
        className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4"
      >
        <Readout label={deep ? 'Redshift z' : 'How far back this is'} value={now ? 'now' : SIG3.format(z)} />
        <Readout
          label={deep ? 'Scale factor a' : 'How much smaller the universe was'}
          value={now ? '1 (today)' : SIG3.format(a)}
        />
        <Readout label={deep ? 'Peak wavelength λ_peak' : 'Where the glow peaks'} value={formatWavelength(peak)} />
        <Readout
          label={deep ? 'Spectral radiance B_ν at c/λ_obs' : 'How bright the glow is at your wavelength'}
          value={`${plainOrScientific(bNu / JANSKY / 1e6)} MJy/sr`}
        />
        <Readout
          label={deep ? 'Photon number density n_γ' : 'Photons in every cubic centimetre'}
          value={`${plainOrScientific(nGamma / 1e6)} cm⁻³`}
        />
        <Readout
          label={deep ? 'Dipole amplitude ΔT' : 'How much hotter the sky is ahead of us'}
          value={`${(dipole * 1e3).toFixed(2)} mK`}
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
export const __internals = { drawScene, formatWavelength, B_MIN, B_MAX };

/**
 * Why the Sun shines — where fusion happens, above; the barrier it crosses, below.
 *
 * Top panel: three curves against collision energy at the live core
 * temperature. The Boltzmann factor falls (few protons are fast), the
 * tunnelling probability rises (fast ones get through more often), and their
 * product is the narrow Gamow window where nearly all fusion happens.
 *
 * Bottom panel: the Coulomb barrier between two protons on log-log axes, the
 * nuclear well inside 1.4 fm, and the Gamow-peak energy as a line that meets
 * the barrier far outside the well. The shaded gap between them is the region
 * the protons cross by tunnelling.
 *
 * No physics lives in this file. Every energy, probability and rate comes from
 * `@/physics/fusion`, which the sanity block also reads. This file owns pixels
 * and formatting only.
 *
 * Motion: when the temperature changes, the curves, the peak, the Gamow line
 * and the shading slide to their new places over `DURATION.slow` on the
 * `EASE.out` curve, in log T. Under reduced motion they jump.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { EV, FEMTOMETRE, K_B, X_SUN_CORE } from '@/physics/constants';
import {
  PP_BARRIER,
  PP_GAMOW_ENERGY,
  PP_WELL_RADIUS,
  boltzmannFraction,
  classicalTurningPoint,
  coulombBarrier,
  gamowPeak,
  gamowWindowWidth,
  ppEnergyRate,
  temperatureExponent,
  tunnellingProbability,
} from '@/physics/fusion';
import { DURATION, EASE, type Bezier } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const SIG2 = new Intl.NumberFormat('en', { maximumSignificantDigits: 2 });

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

/** "1.2 × 10⁻⁴" — rounded before it reaches the screen, mantissa renormalised. */
function scientific(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  let exp = Math.floor(Math.log10(Math.abs(value)));
  const places = Math.max(0, digits - 1);
  if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
  return `${(value / 10 ** exp).toFixed(places)} × 10${exponentGlyph(exp)}`;
}

const KEV = 1e3 * EV;
const MEV = 1e6 * EV;

/** J → "6.09 keV", three significant figures. */
function formatKeV(joules: number): string {
  return Number.isFinite(joules) ? `${SIG3.format(joules / KEV)} keV` : '—';
}

/** J → "1.03 MeV", three significant figures. */
function formatMeV(joules: number): string {
  return Number.isFinite(joules) ? `${SIG3.format(joules / MEV)} MeV` : '—';
}

/** A temperature, two significant figures, plain inside the skill's band. */
function formatKelvin2(kelvin: number): string {
  if (!Number.isFinite(kelvin)) return '—';
  return kelvin >= 0.01 && kelvin < 1e4 ? `${SIG2.format(kelvin)} K` : `${scientific(kelvin, 2)} K`;
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
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const TOP_SHARE = 0.55;

/** The top panel's energy axis, J. */
const E_AXIS_MAX = 40 * KEV;
/** Samples across it. */
const E_SAMPLES = 320;

/** The bottom panel's axes: separation in m, energy in J. */
const R_MIN = 1 * FEMTOMETRE;
const R_MAX = 1000 * FEMTOMETRE;
const V_MIN = 1 * KEV;
const V_MAX = 3 * MEV;

type Units = 'friendly' | 'technical';

interface View {
  /** Core temperature as currently drawn, K — mid-tween while it slides. */
  T: number;
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
 * A plated label near a point, in the first spot inside `bounds` and clear of
 * everything already drawn — the candidate grid the template sims use.
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
  for (const dy of [-9, 15, -21, 27, -33, 39, -45, 51, -57, 63, -69, 75, -81, 87]) {
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
  const box = labelBox(ctx, text, spot.x, spot.y, spot.align);
  const ink = ctx.fillStyle;
  ctx.fillStyle = 'rgba(5,7,12,0.82)';
  ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
  ctx.fillStyle = ink;
  placeText(ctx, text, spot.x, spot.y, spot.align, obstacles);
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const plotLeft = 36;
  const plotRight = w - PAD.right;
  const plotTop = 28;
  const plotBottom = splitY - 38;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return;

  const xOf = (E: number) => plotLeft + (E / E_AXIS_MAX) * plotW;
  const yOf = (v: number) => plotBottom - Math.min(1, Math.max(0, v)) * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'Where fusion happens', PAD.left, 14, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'normalised' : 'relative', plotRight, 14, 'right', obstacles);

  /* Axes and ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  ctx.fillStyle = COLORS.inkFaint;
  for (const v of [0, 0.5, 1]) placeText(ctx, String(v), plotLeft - 4, yOf(v) + 3, 'right', obstacles);
  for (let e = 0; e <= 40; e += 10) {
    const x = xOf(e * KEV);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    centredWithin(ctx, String(e), x, plotBottom + 14, 0, w, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'E (keV)' : 'collision energy (keV)',
    (plotLeft + plotRight) / 2,
    plotBottom + 28,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The three curves, sampled once. */
  const T = view.T;
  const tunnelScale = tunnellingProbability(PP_GAMOW_ENERGY, E_AXIS_MAX);
  const energies: number[] = [];
  const boltzmann: number[] = [];
  const tunnel: number[] = [];
  const product: number[] = [];
  for (let i = 0; i <= E_SAMPLES; i += 1) {
    const E = (E_AXIS_MAX * i) / E_SAMPLES;
    const f = boltzmannFraction(E, T);
    const P = E > 0 ? tunnellingProbability(PP_GAMOW_ENERGY, E) : 0;
    energies.push(E);
    boltzmann.push(f);
    tunnel.push(P / tunnelScale);
    product.push(f * P);
  }
  const E0 = gamowPeak(PP_GAMOW_ENERGY, T);
  const peakRaw = boltzmannFraction(E0, T) * tunnellingProbability(PP_GAMOW_ENERGY, E0);
  const productMax = Math.max(peakRaw, ...product);
  const normalised = product.map((v) => (productMax > 0 ? v / productMax : 0));

  const trace = (values: number[]) => {
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = xOf(energies[i] ?? 0);
      const y = yOf(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  /* kT, faint: where a typical proton sits. */
  const kT = K_B * T;
  const xKT = xOf(Math.min(E_AXIS_MAX, kT));
  ctx.strokeStyle = 'rgba(152,162,184,0.4)';
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xKT, plotTop);
  ctx.lineTo(xKT, plotBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 1.25;
  ctx.strokeStyle = 'rgba(232,189,125,0.7)';
  trace(boltzmann);
  ctx.strokeStyle = 'rgba(157,180,255,0.7)';
  trace(tunnel);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.ink;
  trace(normalised);

  /* The peak, and the window around it. */
  const xPeak = xOf(Math.min(E_AXIS_MAX, E0));
  const yPeak = yOf(productMax > 0 ? peakRaw / productMax : 0);
  const width = gamowWindowWidth(E0, T);
  const xa = xOf(Math.max(0, E0 - width / 2));
  const xb = xOf(Math.min(E_AXIS_MAX, E0 + width / 2));
  const yBracket = Math.min(plotBottom - 4, yPeak + 12);
  ctx.strokeStyle = COLORS.warm;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(xa, yBracket - 4);
  ctx.lineTo(xa, yBracket);
  ctx.lineTo(xb, yBracket);
  ctx.lineTo(xb, yBracket - 4);
  ctx.stroke();
  ctx.fillStyle = COLORS.warm;
  ctx.beginPath();
  ctx.arc(xPeak, yPeak, 4, 0, TAU);
  ctx.fill();
  const marks: LabelBox[] = [
    { x0: xPeak - 5, x1: xPeak + 5, y0: yPeak - 5, y1: yPeak + 5 },
    { x0: xa, x1: xb, y0: yBracket - 5, y1: yBracket + 1 },
  ];

  /* Labels, each near the part of its curve that is easiest to see. */
  const eHalf = Math.min(E_AXIS_MAX * 0.9, kT * Math.log(2));
  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, 'how many protons have this energy', xOf(eHalf), yOf(0.5), plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.star;
  labelNear(ctx, 'chance of tunnelling', xOf(E_AXIS_MAX * 0.85), yOf(tunnel[Math.round(E_SAMPLES * 0.85)] ?? 0.5), plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.ink;
  labelNear(ctx, 'fusion happens here', xPeak, yPeak, plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.inkFaint;
  labelNear(ctx, 'typical proton', xKT, plotTop + 12, plotBox, obstacles, marks);
}

function drawBarrier(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const plotLeft = 44;
  const plotRight = w - PAD.right;
  const plotTop = splitY + 28;
  const plotBottom = h - 34;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0) return;

  const lr0 = Math.log10(R_MIN);
  const lr1 = Math.log10(R_MAX);
  const lv0 = Math.log10(V_MIN);
  const lv1 = Math.log10(V_MAX);
  const xOf = (r: number) => plotLeft + ((Math.log10(r) - lr0) / (lr1 - lr0)) * plotW;
  const yOf = (V: number) => plotBottom - ((Math.log10(V) - lv0) / (lv1 - lv0)) * plotH;
  const plotBox: LabelBox = { x0: plotLeft + 2, x1: plotRight - 2, y0: plotTop + 2, y1: plotBottom - 3 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'The barrier', PAD.left, splitY + 18, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, deep ? 'V (keV, MeV)' : 'energy', plotRight, splitY + 18, 'right', obstacles);

  /* Axes and decade ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  ctx.fillStyle = COLORS.inkFaint;
  for (const [V, label] of [
    [1 * KEV, '1 keV'],
    [10 * KEV, '10 keV'],
    [100 * KEV, '100 keV'],
    [1 * MEV, '1 MeV'],
  ] as const) {
    placeText(ctx, label, plotLeft - 4, yOf(V) + 3, 'right', obstacles);
  }
  for (const [r, label] of [
    [1, '1 fm'],
    [10, '10 fm'],
    [100, '100 fm'],
    [1000, '1000 fm'],
  ] as const) {
    const x = xOf(r * FEMTOMETRE);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    centredWithin(ctx, label, x, plotBottom + 14, 0, w, obstacles);
  }
  centredWithin(
    ctx,
    deep ? 'r (fm)' : 'distance between the protons',
    (plotLeft + plotRight) / 2,
    plotBottom + 27,
    PAD.left,
    w - PAD.right,
    obstacles,
  );

  /* The Gamow-peak energy, and where it meets the barrier. */
  const E0 = gamowPeak(PP_GAMOW_ENERGY, view.T);
  const rTurn = classicalTurningPoint(1, 1, E0);
  const onChart = E0 >= V_MIN;
  const rEnd = Math.min(R_MAX, rTurn);

  /* The forbidden region: under the barrier, above the Gamow line. */
  if (onChart && rEnd > PP_WELL_RADIUS) {
    ctx.fillStyle = 'rgba(240,168,104,0.18)';
    ctx.beginPath();
    const steps = 60;
    for (let i = 0; i <= steps; i += 1) {
      const r = PP_WELL_RADIUS * (rEnd / PP_WELL_RADIUS) ** (i / steps);
      const x = xOf(r);
      const y = yOf(Math.min(V_MAX, coulombBarrier(1, 1, r)));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(xOf(rEnd), yOf(E0));
    ctx.lineTo(xOf(PP_WELL_RADIUS), yOf(E0));
    ctx.closePath();
    ctx.fill();
  }

  /* The barrier itself, from the edge of the well outward. */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const steps = 120;
  for (let i = 0; i <= steps; i += 1) {
    const r = PP_WELL_RADIUS * (R_MAX / PP_WELL_RADIUS) ** (i / steps);
    const x = xOf(r);
    const y = yOf(coulombBarrier(1, 1, r));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  /* The drop into the nuclear well. */
  const xWell = xOf(PP_WELL_RADIUS);
  const yTop = yOf(PP_BARRIER);
  ctx.beginPath();
  ctx.moveTo(xWell, yTop);
  ctx.lineTo(xWell, plotBottom);
  ctx.stroke();

  /* The Gamow line. */
  const marks: LabelBox[] = [];
  if (onChart) {
    const yE = yOf(E0);
    ctx.strokeStyle = COLORS.warm;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotLeft, yE);
    ctx.lineTo(xOf(rEnd), yE);
    ctx.stroke();
    if (rTurn <= R_MAX) {
      ctx.fillStyle = COLORS.warm;
      ctx.beginPath();
      ctx.arc(xOf(rTurn), yE, 3, 0, TAU);
      ctx.fill();
      marks.push({ x0: xOf(rTurn) - 4, x1: xOf(rTurn) + 4, y0: yE - 4, y1: yE + 4 });
    }
  }

  /* Labels. */
  ctx.fillStyle = COLORS.ink;
  labelNear(ctx, formatMeV(PP_BARRIER), xWell, yTop, plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.inkFaint;
  labelNear(ctx, 'nuclear well', xWell, plotBottom - 4, plotBox, obstacles, marks);
  ctx.fillStyle = COLORS.warm;
  if (onChart) {
    const yE = yOf(E0);
    labelNear(ctx, formatKeV(E0), plotLeft + 30, yE, plotBox, obstacles, marks);
    if (rEnd > PP_WELL_RADIUS) {
      // Centre of the shaded gap, in log r, a little above the Gamow line.
      const rMid = Math.sqrt(PP_WELL_RADIUS * rEnd);
      const yMid = (yE + yOf(Math.min(V_MAX, coulombBarrier(1, 1, rMid)))) / 2;
      labelNear(ctx, 'must tunnel across this', xOf(rMid), yMid, plotBox, obstacles, marks);
    }
  } else {
    labelNear(ctx, `Gamow peak ${formatKeV(E0)}: below this chart`, (plotLeft + plotRight) / 2, plotBottom - 6, plotBox, obstacles, marks);
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
  if (w <= PAD.left + PAD.right + 44 || h <= 0) return;

  const splitY = Math.round(h * TOP_SHARE);
  const obstacles: LabelBox[] = [];

  ctx.save();
  drawWindow(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawBarrier(ctx, w, h, splitY, view, obstacles);
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

export default function StellarFusionSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const T = readParam(params, values, 'T');
  const rho = readParam(params, values, 'rho');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/fusion`, once per render.
  const kT = K_B * T;
  const E0 = gamowPeak(PP_GAMOW_ENERGY, T);
  const tunnel = tunnellingProbability(PP_GAMOW_ENERGY, E0);
  const fraction = boltzmannFraction(E0, T);
  const rate = ppEnergyRate(rho, X_SUN_CORE, T);
  const nu = temperatureExponent(T);

  /** The temperature the panels are drawn at, which trails `T` while they slide. */
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
    drawScene(ctx, rect.width, rect.height, { T: shownRef.current, units });
  }, [units]);

  /*
   * The slide, in log T, from wherever the panels are drawn now; a changed
   * target cancels the frame in flight. Reduced motion, or no rAF, jumps.
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
          aria-label="Above, three curves against collision energy: the falling share of protons with that energy, the rising chance of tunnelling, and their product, a narrow peak where fusion happens. Below, the electrical barrier between two protons against distance, with the peak energy drawn across it and the region they must tunnel through shaded."
          aria-describedby="stellar-fusion-readouts"
        />
      </div>

      <dl id="stellar-fusion-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'kT' : 'Typical energy of a proton here'} value={formatKeV(kT)} />
        <Readout
          label={deep ? 'Coulomb barrier at 1.4 fm' : 'Energy to touch without tunnelling'}
          value={formatMeV(PP_BARRIER)}
        />
        <Readout label={deep ? 'E_C / k' : 'Temperature that would need'} value={formatKelvin2(PP_BARRIER / K_B)} />
        <Readout label={deep ? 'Gamow peak E₀' : 'Energy where most fusion happens'} value={formatKeV(E0)} />
        <Readout
          label={deep ? 'exp(−√(E_G / E₀))' : 'Chance a collision there tunnels'}
          value={scientific(tunnel, 2)}
        />
        <Readout label={deep ? 'exp(−E₀ / kT)' : 'Fraction of protons with that energy'} value={scientific(fraction, 2)} />
        <Readout label={deep ? 'ε_pp' : 'Heat released per kilogram'} value={`${scientific(rate, 2)} W/kg`} />
        <Readout
          label={deep ? 'ν = d ln ε / d ln T' : 'How steeply that depends on temperature'}
          value={`T to the power ${nu.toFixed(1)}`}
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
export const __internals = { drawScene, scientific, formatKelvin2 };

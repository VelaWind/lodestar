/**
 * Neutron stars and pulsars — a spinning star seen side-on, its beams, and what
 * a radio telescope on Earth records.
 *
 * Top panel: the star, its vertical spin axis, its magnetic axis tilted by α
 * and turning around the spin axis, a radio beam from each magnetic pole, and
 * the line of sight to Earth at ζ from the spin axis. Side-on, each beam's tip
 * traces a horizontal line (a circle seen edge-on), drawn dashed. A beam is
 * drawn brighter while it points toward the viewer and lit while it covers the
 * line of sight. The star is not to scale: 12 km against beams that reach
 * across the panel.
 *
 * Middle: the spin period on a log strip from half a millisecond to ten
 * seconds, with the breakup period for this mass shaded, the fastest known
 * pulsar (716 Hz) and the Crab marked, and a dot at the slider.
 *
 * Bottom: the received intensity over two turns, on a time axis in real
 * seconds, with a cursor at the phase being drawn above.
 *
 * Above 2.3 M☉ the star is drawn collapsed to a black hole, with no beams.
 *
 * No physics lives in this file. Every density, gravity, speed, breakup spin,
 * pulse rate and beam intensity comes from `@/physics/neutronstar`, which the
 * sanity block also reads. This file owns pixels and formatting only.
 *
 * Motion: the star turns slowed down, one turn every half second at the fastest
 * spin, so faster stars still look faster; from a 3.55 s period up it turns at
 * the real speed, never faster.
 * Under reduced motion there is no loop: the star is drawn at the moment its
 * first beam swings closest to Earth, and the cursor marks that moment.
 */
import { useCallback, useEffect, useRef } from 'react';
import { canvasSize, observeCanvasSize } from './canvasSize';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { CRAB_F0, FASTEST_PULSAR_FREQUENCY, G_STANDARD } from '@/physics/constants';
import {
  BEAM_HALF_WIDTH,
  beamAngle,
  beamIntensity,
  beamVisibility,
  breakupPeriod,
  collapses,
  densityOverNuclear,
  equatorialSpeedFraction,
  escapeSpeedFraction,
  insideBeam,
  keplerFrequency,
  pulsesPerSecond,
  surfaceGravity,
} from '@/physics/neutronstar';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { labelBox, overlaps, textWidth, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

const NUMBER_WORDS: [number, number, string][] = [
  [1e12, 1e12, 'trillion'],
  [1e9, 1e9, 'billion'],
  [1e6, 1e6, 'million'],
];

/**
 * A positive number to three significant figures: plain from 0.01 to 10 000,
 * with thousands separators to a million, in number words beyond.
 */
function formatSig3(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const rounded = Number(value.toPrecision(3));
  const abs = Math.abs(rounded);
  if (abs < 1e4) return String(rounded);
  if (abs < 1e6) return SIG3.format(rounded);
  const [, divisor, word] = NUMBER_WORDS.find(([threshold]) => abs >= threshold) ?? NUMBER_WORDS[0]!;
  return `${Number((rounded / divisor).toPrecision(3))} ${word}`;
}

/** A time in s: ms below a second, s above, three significant figures. */
function formatTime(seconds: number): string {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return '—';
  if (Number(seconds.toPrecision(3)) < 1) return `${formatSig3(seconds * 1e3)} ms`;
  return `${formatSig3(seconds)} s`;
}

/** A fraction of c as a percentage of light speed. */
function formatFractionOfC(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${formatSig3(fraction * 100)}% of light speed`;
}

/** Surface gravity in m/s², as a multiple of Earth's standard gravity. */
function formatGravity(g: number): string {
  if (!Number.isFinite(g)) return '—';
  return `${formatSig3(g / G_STANDARD)} × Earth’s`;
}

/** A pulse rate, s⁻¹. */
function formatPulseRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  if (rate === 0) return 'none';
  return `${formatSig3(rate)} a second`;
}

/** A spin frequency, Hz, with its period. */
function formatSpin(frequency: number): string {
  if (!(frequency > 0)) return '—';
  return `${formatSig3(frequency)} turns a second (${formatTime(1 / frequency)})`;
}

type Verdict = 'collapsed' | 'both' | 'one' | 'brightening' | 'steady' | 'none';

/**
 * What a distant observer sees, from `beamVisibility`, the rule the trace's
 * intensity and the drawing's lit line of sight also use. "Always on" is
 * exactly "the drawn intensity never reaches zero".
 */
function verdictFor(M: number, alpha: number, zeta: number): Verdict {
  if (collapses(M)) return 'collapsed';
  const v = beamVisibility(alpha, zeta);
  if (v.alwaysOn) return v.modulated ? 'brightening' : 'steady';
  if (v.first && v.second) return 'both';
  return v.first || v.second ? 'one' : 'none';
}

const VERDICT_TEXT: Record<Verdict, string> = {
  collapsed: 'No: too heavy, it has collapsed to a black hole',
  both: 'Yes: both beams sweep past Earth, two pulses a turn',
  one: 'Yes: one beam sweeps past Earth, one pulse a turn',
  brightening: 'Always on, brightening once a turn: not a pulsar’s on–off flash',
  steady: 'Always on and steady: the beam never sweeps away from Earth',
  none: 'No: both beams miss Earth',
};

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
  beam: '#c7a0e8',
  danger: 'rgba(240,120,104,0.14)',
  dangerInk: '#f08c78',
  plate: 'rgba(5,7,12,0.82)',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;
const PAD = { left: 12, right: 12 };

/** Share of the height for the star panel, then the period strip; the trace takes the rest. */
const STAR_SHARE = 0.52;
const STRIP_HEIGHT = 82;

/** The period strip's range, s: below the breakup period at every slider mass, up to the slider's top. */
const STRIP_AXIS: [number, number] = [5e-4, 10];
const STRIP_TICKS: [number, string][] = [
  [1e-3, '1 ms'],
  [1e-2, '10 ms'],
  [1e-1, '100 ms'],
  [1, '1 s'],
  [10, '10 s'],
];

type Units = 'friendly' | 'technical';

interface View {
  /** Mass, kg. */
  M: number;
  /** Spin period, s. */
  P: number;
  /** Magnetic tilt from the spin axis, rad. */
  alpha: number;
  /** Line of sight from the spin axis, rad. */
  zeta: number;
  /**
   * Rotation phase across the trace's two turns, 0 to 4π. The magnetic axis's
   * azimuth is this minus π/2, so the first beam swings closest to Earth a
   * quarter of the way into each turn, where its pulse is centred.
   */
  turn: number;
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

interface Spot {
  x: number;
  y: number;
  align: CanvasTextAlign;
}

/**
 * The first spot, of several tried in order, that keeps `text` inside `bounds`
 * and clear of every obstacle and mark; drawn there on a dark plate. Nothing is
 * drawn if none fits, which is what "labelled where there is room" means.
 */
function placeClear(
  ctx: CanvasRenderingContext2D,
  text: string,
  spots: Spot[],
  bounds: LabelBox,
  obstacles: LabelBox[],
  marks: LabelBox[] = [],
): boolean {
  const font = ctx.font;
  for (const spot of spots) {
    const box = labelBox(ctx, text, spot.x, spot.y, spot.align, font);
    const inside = box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
    if (!inside) continue;
    if ([...obstacles, ...marks].some((o) => overlaps(box, o, 2))) continue;
    const ink = ctx.fillStyle;
    ctx.fillStyle = COLORS.plate;
    ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
    ctx.fillStyle = ink;
    placeText(ctx, text, spot.x, spot.y, spot.align, obstacles);
    return true;
  }
  return false;
}

/** Candidate spots around a point, nearest first. */
function spotsAround(x: number, y: number): Spot[] {
  const spots: Spot[] = [];
  for (const dy of [-8, 14, -18, 24, -28, 34]) {
    spots.push({ x: x + 6, y: y + dy, align: 'left' });
    spots.push({ x: x - 6, y: y + dy, align: 'right' });
    spots.push({ x, y: y + dy, align: 'center' });
  }
  return spots;
}

/** The first of several texts that fits, tried longest first. */
function placeFirstOf(
  ctx: CanvasRenderingContext2D,
  texts: string[],
  spots: Spot[],
  bounds: LabelBox,
  obstacles: LabelBox[],
  marks: LabelBox[] = [],
): boolean {
  return texts.some((text) => placeClear(ctx, text, spots, bounds, obstacles, marks));
}

/* ----------------------------- the star ------------------------------ */

/**
 * The star panel. Screen x is to the right, screen y down; z, toward the
 * viewer, sets only how bright a beam is drawn. The spin axis is vertical. The
 * first magnetic pole points along
 *
 *     m = (sin α cos φ, cos α, sin α sin φ)    (x, up, z)
 *
 * and the line of sight along (sin ζ, cos ζ, 0), so the angle between them is
 * the physics module's `beamAngle(α, ζ, φ)`.
 */
function drawStar(ctx: CanvasRenderingContext2D, w: number, bottom: number, view: View, obstacles: LabelBox[]): void {
  const deep = view.units === 'technical';
  const collapsed = collapses(view.M);
  const bounds: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: 2, y1: bottom - 2 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, deep ? 'Side view, spin axis vertical' : 'The star, seen from the side', PAD.left, 14, 'left', obstacles);

  const cx = Math.round(PAD.left + (w - PAD.left - PAD.right) * 0.38);
  const cy = Math.round(24 + (bottom - 24) / 2);
  const reach = Math.max(20, Math.min((bottom - 24) / 2 - 8, (w - PAD.left - PAD.right) * 0.36));
  const r = Math.max(6, Math.min(14, reach * 0.14));
  /** Half a beam's width at its tip, px. */
  const beamHalf = reach * Math.tan(BEAM_HALF_WIDTH);
  const phi = view.turn - Math.PI / 2;
  const { alpha, zeta } = view;

  /* The line of sight, out to the panel's edge. */
  const sx = Math.sin(zeta);
  const sy = -Math.cos(zeta);
  const tEdge = Math.min(
    sx > 1e-9 ? (w - PAD.right - 4 - cx) / sx : Infinity,
    sy < -1e-9 ? (cy - 22) / -sy : Infinity,
  );
  const sightLen = Math.max(r + 4, tEdge);
  const theta = beamAngle(alpha, zeta, phi);
  const lit = !collapsed && (insideBeam(theta) || insideBeam(Math.PI - theta));
  ctx.strokeStyle = lit ? COLORS.ember : COLORS.warm;
  ctx.lineWidth = lit ? 2 : 1;
  ctx.setLineDash(lit ? [] : [5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx + sx * r, cy + sy * r);
  ctx.lineTo(cx + sx * sightLen, cy + sy * sightLen);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  const earth = { x: cx + sx * sightLen, y: cy + sy * sightLen };
  const marks: LabelBox[] = [{ x0: cx - r - 2, x1: cx + r + 2, y0: cy - r - 2, y1: cy + r + 2 }];

  if (collapsed) {
    ctx.fillStyle = '#000';
    ctx.strokeStyle = COLORS.warm;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = COLORS.dangerInk;
    placeFirstOf(
      ctx,
      ['collapsed to a black hole', 'a black hole'],
      [...spotsAround(cx, cy + r + 6), ...spotsAround(cx, cy - r - 6)],
      bounds,
      obstacles,
      marks,
    );
  } else {
    /* The spin axis. */
    ctx.strokeStyle = COLORS.inkFaint;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - reach - 4);
    ctx.lineTo(cx, cy + reach + 4);
    ctx.stroke();

    /* Where each beam's tip travels over a turn: a circle, edge-on. */
    const tipY = reach * Math.cos(alpha);
    const tipX = reach * Math.sin(alpha);
    ctx.strokeStyle = COLORS.grid;
    for (const y of [cy - tipY, cy + tipY]) {
      ctx.beginPath();
      ctx.moveTo(cx - tipX, y);
      ctx.lineTo(cx + tipX, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    /* The two beams, the one turned away first, then the star, then the near one. */
    const mx = Math.sin(alpha) * Math.cos(phi);
    const my = -Math.cos(alpha);
    const mz = Math.sin(alpha) * Math.sin(phi);
    const beams = [
      { sign: 1, front: mz >= 0, on: insideBeam(theta) },
      { sign: -1, front: mz < 0, on: insideBeam(Math.PI - theta) },
    ];
    const half = beamHalf;
    const drawBeam = (sign: number, front: boolean, on: boolean) => {
      const dx = sign * mx;
      const dy = sign * my;
      const len = Math.hypot(dx, dy);
      // Perpendicular to the projected axis; a beam seen end-on is a dot of light.
      const px = len > 1e-6 ? -dy / len : 1;
      const py = len > 1e-6 ? dx / len : 0;
      const tx = cx + dx * reach;
      const ty = cy + dy * reach;
      /* The beam as obstacles for the labels: boxes along its axis, as wide as the beam there. */
      for (let t = 0.2; t <= 1.001; t += 0.1) {
        const bx = cx + dx * reach * t;
        const by = cy + dy * reach * t;
        const pad = half * t + 1;
        marks.push({ x0: bx - pad, x1: bx + pad, y0: by - pad, y1: by + pad });
      }
      ctx.globalAlpha = on ? 0.85 : front ? 0.5 : 0.22;
      ctx.fillStyle = on ? COLORS.ember : COLORS.beam;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx + px * half, ty + py * half);
      ctx.lineTo(tx - px * half, ty - py * half);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    for (const b of beams) if (!b.front) drawBeam(b.sign, b.front, b.on);

    /* The magnetic axis, through the star. */
    ctx.strokeStyle = COLORS.beam;
    ctx.beginPath();
    ctx.moveTo(cx - mx * reach * 0.7, cy - my * reach * 0.7);
    ctx.lineTo(cx + mx * reach * 0.7, cy + my * reach * 0.7);
    ctx.stroke();

    ctx.fillStyle = COLORS.star;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();

    for (const b of beams) if (b.front) drawBeam(b.sign, b.front, b.on);

    /* Labels: the spin axis at its top, then the beam where it fits. */
    ctx.font = FONT;
    ctx.fillStyle = COLORS.inkFaint;
    placeFirstOf(
      ctx,
      [deep ? 'spin axis' : 'spins around this line', 'spin axis'],
      [
        { x: cx - 6, y: cy - reach + 4, align: 'right' },
        { x: cx + 6, y: cy - reach + 4, align: 'left' },
        { x: cx - 6, y: cy + reach, align: 'right' },
        { x: cx + 6, y: cy + reach, align: 'left' },
        // Clear of a beam lying close along the axis, at small tilt.
        { x: cx - half - 6, y: cy - reach + 4, align: 'right' },
        { x: cx + half + 6, y: cy - reach + 4, align: 'left' },
        { x: cx - half - 6, y: cy + reach, align: 'right' },
        { x: cx + half + 6, y: cy + reach, align: 'left' },
      ],
      bounds,
      obstacles,
      marks,
    );
    ctx.fillStyle = COLORS.beam;
    placeFirstOf(
      ctx,
      [deep ? 'radio beams along the magnetic axis' : 'radio beams from the magnetic poles', 'radio beams'],
      [
        { x: PAD.left, y: bottom - 6, align: 'left' },
        { x: PAD.left, y: 28, align: 'left' },
      ],
      bounds,
      obstacles,
      marks,
    );
  }

  ctx.fillStyle = lit ? COLORS.ember : COLORS.warm;
  // Beside the line first; then, for a line of sight lying inside a beam, out past the beam's edge.
  const besideBeam: Spot[] = [-8, 14, -18, 24].flatMap((dy) => [
    { x: earth.x + beamHalf + 6, y: earth.y + dy, align: 'left' as const },
    { x: earth.x - beamHalf - 6, y: earth.y + dy, align: 'right' as const },
  ]);
  placeFirstOf(ctx, ['to Earth', 'Earth'], [...spotsAround(earth.x, earth.y), ...besideBeam], bounds, obstacles, marks);
}

/* -------------------------- the period strip ------------------------- */

function xOfPeriod(left: number, right: number, P: number): number {
  const [lo, hi] = STRIP_AXIS.map(Math.log10) as [number, number];
  return left + ((Math.log10(P) - lo) / (hi - lo)) * (right - left);
}

function drawStrip(ctx: CanvasRenderingContext2D, w: number, top: number, view: View, obstacles: LabelBox[]): void {
  const deep = view.units === 'technical';
  const left = PAD.left + 4;
  const right = w - PAD.right - 4;
  const lineY = top + 44;
  const bounds: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: top + 2, y1: top + STRIP_HEIGHT - 2 };

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, deep ? 'Spin period P' : 'Time for one turn', PAD.left, top + 14, 'left', obstacles);

  /* Faster than breakup: shaded, from the strip's left end to the breakup period. */
  const xBreak = Math.max(left, Math.min(right, xOfPeriod(left, right, breakupPeriod(view.M))));
  if (!collapses(view.M)) {
    ctx.fillStyle = COLORS.danger;
    ctx.fillRect(left, lineY - 10, xBreak - left, 20);
  }

  ctx.strokeStyle = COLORS.edge;
  ctx.beginPath();
  ctx.moveTo(left, lineY);
  ctx.lineTo(right, lineY);
  ctx.stroke();

  ctx.fillStyle = COLORS.inkFaint;
  for (const [P, label] of STRIP_TICKS) {
    const x = xOfPeriod(left, right, P);
    ctx.strokeStyle = COLORS.edge;
    ctx.beginPath();
    ctx.moveTo(x, lineY);
    ctx.lineTo(x, lineY + 4);
    ctx.stroke();
    const half = textWidth(ctx, label) / 2;
    const cx = Math.min(right - half, Math.max(left + half, x));
    const box = labelBox(ctx, label, cx, lineY + 16, 'center');
    if (!obstacles.some((o) => overlaps(box, o, 2))) placeText(ctx, label, cx, lineY + 16, 'center', obstacles);
  }

  /* The slider's dot, then the named marks, which give way to it. */
  const xP = xOfPeriod(left, right, view.P);
  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(xP, lineY, 4, 0, TAU);
  ctx.fill();
  const marks: LabelBox[] = [{ x0: xP - 5, x1: xP + 5, y0: lineY - 5, y1: lineY + 5 }];

  const xFast = xOfPeriod(left, right, 1 / FASTEST_PULSAR_FREQUENCY);
  const xCrab = xOfPeriod(left, right, 1 / CRAB_F0);
  ctx.strokeStyle = COLORS.star;
  for (const x of [xFast, xCrab]) {
    ctx.beginPath();
    ctx.moveTo(x, lineY - 7);
    ctx.lineTo(x, lineY);
    ctx.stroke();
  }

  const above = (x: number): Spot[] => [
    { x: x - 2, y: lineY - 13, align: 'left' },
    { x: x + 2, y: lineY - 13, align: 'right' },
    { x, y: lineY - 13, align: 'center' },
  ];
  /* At the default the dot sits on the Crab, so the one label names both. */
  const atCrab = Math.abs(view.P * CRAB_F0 - 1) < 1e-6;
  ctx.fillStyle = COLORS.ember;
  placeFirstOf(
    ctx,
    atCrab ? [`${formatTime(view.P)} (the Crab)`, formatTime(view.P)] : [formatTime(view.P)],
    [...above(xP), { x: xP + 7, y: lineY + 30, align: 'left' }],
    bounds,
    obstacles,
    marks,
  );
  ctx.fillStyle = COLORS.star;
  placeFirstOf(
    ctx,
    [
      `fastest known, ${FASTEST_PULSAR_FREQUENCY} a second`,
      `fastest, ${FASTEST_PULSAR_FREQUENCY} a second`,
      `${FASTEST_PULSAR_FREQUENCY} a second`,
      'fastest',
    ],
    above(xFast),
    bounds,
    obstacles,
    marks,
  );
  if (!atCrab) placeFirstOf(ctx, ['the Crab'], above(xCrab), bounds, obstacles, marks);
  if (!collapses(view.M)) {
    ctx.fillStyle = COLORS.dangerInk;
    placeFirstOf(
      ctx,
      ['would fly apart', 'flies apart'],
      [
        { x: left + 2, y: lineY + 30, align: 'left' },
        { x: xBreak, y: lineY + 30, align: 'center' },
      ],
      bounds,
      obstacles,
      marks,
    );
  }
}

/* ----------------------------- the trace ----------------------------- */

/** Samples across the trace's two turns. φ = 0 falls on sample 45. */
const TRACE_STEPS = 360;

/**
 * The received intensity across the trace's two turns, 0 to 1, from
 * `beamIntensity`: the curve drawn, and what the tests check the verdict against.
 */
function traceSamples(view: Pick<View, 'M' | 'alpha' | 'zeta'>): number[] {
  const collapsed = collapses(view.M);
  const samples: number[] = [];
  for (let i = 0; i <= TRACE_STEPS; i += 1) {
    const turn = (i / TRACE_STEPS) * 2 * TAU;
    samples.push(collapsed ? 0 : beamIntensity(view.alpha, view.zeta, turn - Math.PI / 2));
  }
  return samples;
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const deep = view.units === 'technical';
  const left = PAD.left + 4;
  const right = w - PAD.right - 4;
  const plotTop = top + 26;
  const plotBottom = h - 22;
  if (plotBottom - plotTop < 12) return;
  const bounds: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: top + 2, y1: h - 2 };
  const verdict = verdictFor(view.M, view.alpha, view.zeta);

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeFirstOf(
    ctx,
    [deep ? 'Received intensity, two turns' : 'What a radio telescope on Earth records', 'Radio signal at Earth'],
    [{ x: PAD.left, y: top + 14, align: 'left' }],
    bounds,
    obstacles,
  );

  ctx.strokeStyle = COLORS.edge;
  ctx.beginPath();
  ctx.moveTo(left, plotBottom);
  ctx.lineTo(right, plotBottom);
  ctx.stroke();

  /* Time ticks at 0, P and 2P, in real time. */
  ctx.fillStyle = COLORS.inkFaint;
  const ticks: [number, string][] = [
    [0, '0'],
    [0.5, formatTime(view.P)],
    [1, formatTime(2 * view.P)],
  ];
  for (const [frac, label] of ticks) {
    const x = left + frac * (right - left);
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    const align: CanvasTextAlign = frac === 0 ? 'left' : frac === 1 ? 'right' : 'center';
    const box = labelBox(ctx, label, x, plotBottom + 14, align);
    if (!obstacles.some((o) => overlaps(box, o, 2))) placeText(ctx, label, x, plotBottom + 14, align, obstacles);
  }

  /* The signal. */
  const samples = traceSamples(view);
  const steps = samples.length - 1;
  ctx.strokeStyle = COLORS.ember;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const x = left + (i / steps) * (right - left);
    const y = plotBottom - samples[i]! * (plotBottom - plotTop - 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1;

  /* The moment drawn above. */
  const xNow = left + (view.turn / (2 * TAU)) * (right - left);
  ctx.strokeStyle = COLORS.inkFaint;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xNow, plotTop);
  ctx.lineTo(xNow, plotBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  if (verdict === 'both' || verdict === 'one') return;
  const note: Record<Exclude<Verdict, 'both' | 'one'>, string[]> = {
    collapsed: ['no signal: a black hole has no beams', 'no signal'],
    brightening: ['always on, never dropping to zero: no pulses', 'always on, no pulses'],
    steady: ['always on and steady: no pulses', 'always on, no pulses'],
    none: ['no pulses: both beams miss Earth', 'no pulses'],
  };
  ctx.fillStyle = COLORS.inkDim;
  const midY = (plotTop + plotBottom) / 2;
  placeFirstOf(
    ctx,
    note[verdict],
    [
      { x: (left + right) / 2, y: midY, align: 'center' },
      { x: (left + right) / 2, y: plotTop + 10, align: 'center' },
    ],
    bounds,
    obstacles,
  );
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size.
 *
 * One obstacle list runs through all three panels in drawing order, so every
 * label placed by measurement is placed against every label already drawn.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): void {
  ctx.clearRect(0, 0, w, h);
  if (w <= PAD.left + PAD.right + 60 || h <= 0) return;

  const starBottom = Math.round(h * STAR_SHARE);
  const stripTop = starBottom;
  const traceTop = stripTop + STRIP_HEIGHT;
  const obstacles: LabelBox[] = [];

  ctx.save();
  drawStar(ctx, w, starBottom, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  for (const y of [stripTop, traceTop]) {
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(w - PAD.right, y);
    ctx.stroke();
  }

  drawStrip(ctx, w, stripTop, view, obstacles);
  drawTrace(ctx, w, h, traceTop, view, obstacles);
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
 * Seconds per turn on screen: half a second at the fastest known pulsar,
 * growing as the fourth root of the period, so about 1.1 s at the Crab. Never
 * faster than the real spin: from 3.55 s up, where the fourth-root rule would
 * turn the drawing faster than the star, it turns at the real period. Display
 * only.
 */
function shownTurnSeconds(P: number): number {
  return Math.max(P, 0.5 * (P * FASTEST_PULSAR_FREQUENCY) ** 0.25);
}

/** The phase the static drawing holds: the first beam swung closest to Earth. */
const STATIC_TURN = Math.PI / 2;

export default function NeutronStarsSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';
  const units: Units = deep ? 'technical' : 'friendly';

  const M = readParam(params, values, 'M');
  const P = readParam(params, values, 'P');
  const alpha = readParam(params, values, 'alpha');
  const zeta = readParam(params, values, 'zeta');

  // Every number below comes from `@/physics/neutronstar`, once per render.
  const collapsed = collapses(M);
  const verdict = verdictFor(M, alpha, zeta);
  const pulses = collapsed ? NaN : pulsesPerSecond(P, alpha, zeta);
  const speed = collapsed ? NaN : equatorialSpeedFraction(P);
  const gravity = collapsed ? NaN : surfaceGravity(M);
  const escape = collapsed ? NaN : escapeSpeedFraction(M);
  const density = collapsed ? NaN : densityOverNuclear(M);
  const breakup = collapsed ? NaN : keplerFrequency(M);
  const shownTurn = shownTurnSeconds(P);

  /** The scene being drawn: the sliders, and the phase, which the loop advances. */
  const sceneRef = useRef<View | null>(null);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;

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
    drawScene(ctx, rect.width, rect.height, scene);
  }, []);

  /* The spin, restarted from where it was on any change. Under reduced motion,
     or for a collapsed star, one still frame. */
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const still = reduced || collapsed || typeof requestAnimationFrame === 'undefined';
    const turn = still ? STATIC_TURN : (sceneRef.current?.turn ?? STATIC_TURN);
    sceneRef.current = { M, P, alpha, zeta, turn, units };
    paint();
    if (still) return;

    let last: number | null = null;
    const tick = (now: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      // Clamped so a backgrounded tab does not resume with one enormous step.
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      scene.turn = (scene.turn + (dt / shownTurn) * TAU) % (2 * TAU);
      paint();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [M, P, alpha, zeta, units, reduced, collapsed, shownTurn, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return observeCanvasSize(canvas, () => paint());
  }, [paint]);

  return (
    <div className="flex min-h-[32rem] flex-col gap-4">
      <div className="relative h-[32rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="A neutron star seen from the side, its spin axis vertical and its magnetic axis tilted, with a radio beam from each magnetic pole sweeping around as it turns and a line toward Earth that lights up when a beam crosses it. Below, the spin period on a scale from half a millisecond to ten seconds, with the breakup spin, the fastest known pulsar and the Crab marked, and beneath that the radio signal Earth receives over two turns."
          aria-describedby="neutron-stars-readouts"
        />
      </div>

      <dl id="neutron-stars-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Pulsar?' : 'Can we see it from Earth?'} value={VERDICT_TEXT[verdict]} />
        <Readout label={deep ? 'Pulse rate' : 'Pulses we receive'} value={formatPulseRate(pulses)} />
        <Readout label={deep ? 'Equatorial speed' : 'How fast its equator moves'} value={formatFractionOfC(speed)} />
        <Readout label={deep ? 'Breakup spin, f_K' : 'Fastest spin before it flies apart'} value={formatSpin(breakup)} />
        <Readout label={deep ? 'Surface gravity (proper)' : 'Gravity at the surface'} value={formatGravity(gravity)} />
        <Readout label={deep ? 'Escape speed (relativistic)' : 'Speed to escape it'} value={formatFractionOfC(escape)} />
        <Readout
          label={deep ? 'Mean density / nuclear saturation' : 'How dense, against an atomic nucleus'}
          value={Number.isFinite(density) ? `${formatSig3(density)} ×` : '—'}
        />
      </dl>

      <p className="font-ui text-[0.7rem] text-ink-faint">
        {/* Collapse first: under reduced motion too, there are no beams or signal to describe. */}
        {collapsed ? (
          <>The star is past the collapse threshold: it is drawn as a black hole, with no beams and no signal.</>
        ) : reduced ? (
          <>
            Animation disabled by your reduced-motion setting; the star is drawn at the moment its first beam swings
            closest to Earth, marked on the signal below.
          </>
        ) : shownTurn > P ? (
          <>
            Drawn slowed down: one turn takes{' '}
            <span className="font-mono text-ember">{SIG3.format(shownTurn)} s</span> here and{' '}
            <span className="font-mono text-ember">{formatTime(P)}</span> in reality. The signal’s time axis is real.
          </>
        ) : (
          <>
            Drawn at the real speed: one turn takes <span className="font-mono text-ember">{formatTime(P)}</span>.
          </>
        )}
      </p>
      {!collapsed && (
        <p className="font-ui text-[0.7rem] text-ink-faint">
          Seen from the side, a beam can look as if it lies along the line to Earth without lighting it: it is
          pointing out of the screen or into it, past Earth.
        </p>
      )}
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
  formatTime,
  formatFractionOfC,
  formatGravity,
  formatPulseRate,
  formatSpin,
  verdictFor,
  VERDICT_TEXT,
  traceSamples,
  TRACE_STEPS,
  STATIC_TURN,
  shownTurnSeconds,
};

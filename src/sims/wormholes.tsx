/**
 * Wormholes — the shape of the tunnel, above; the negative mass it needs, below.
 *
 * Top panel: the embedding diagram of the Ellis wormhole. The surface's
 * profile, z = ±b₀ arccosh(r/b₀), is drawn as a funnel opening upward and
 * downward from the throat circle, with rings at the throat, part-way out and
 * at each mouth. The drawing is scaled so the throat is always the same size on
 * screen, so what changes with the slider is the ruler across the throat and
 * which reference, a person, the Earth or the Sun, is the right size to show
 * beside it at that scale.
 *
 * Bottom panel: the size of the negative mass the throat needs against its
 * radius, log–log, with the Earth, Jupiter and the Sun marked, and a dot at
 * the slider's radius.
 *
 * No physics lives in this file. Every length, mass and density comes from
 * `@/physics/wormhole`, which the sanity block also reads. This file owns
 * pixels and formatting only.
 *
 * Motion: when the slider changes, the ruler, the reference and the dot slide
 * to the new radius in log b₀ over `DURATION.slow` on the `EASE.out` curve.
 * Under reduced motion the drawing is static and jumps.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { AU, M_EARTH, M_JUPITER, M_SUN, PROTON_RADIUS, R_EARTH, R_SUN } from '@/physics/constants';
import { PERSON_HEIGHT } from '@/physics/blackhole';
import {
  casimirGapForThroat,
  embeddingHeight,
  exoticMass,
  throatCircumference,
  throatDensity,
} from '@/physics/wormhole';
import { eased } from '@/motion/ease';
import { DURATION, EASE } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, overlaps, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

/** A true minus sign, U+2212. */
const MINUS = '−';

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

/** 10ⁿ as text: "1", "10", "10²⁵", "10⁻³". */
function powerOfTen(exponent: number): string {
  if (exponent === 0) return '1';
  if (exponent === 1) return '10';
  return `10${String(exponent)
    .split('')
    .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join('')}`;
}

/** "2.12 × 10²⁷" for a positive value: three significant figures, the mantissa renormalised if rounding carries it to 10. */
function scientific(value: number): string {
  let exponent = Math.floor(Math.log10(value));
  if (Number((value / 10 ** exponent).toFixed(2)) >= 10) exponent += 1;
  return `${(value / 10 ** exponent).toFixed(2)} × ${powerOfTen(exponent)}`;
}

/** Number words for the large band, largest first: [threshold, divisor, word]. */
const NUMBER_WORDS: [number, number, string][] = [
  [1e12, 1e12, 'trillion'],
  [1e9, 1e9, 'billion'],
  [1e6, 1e6, 'million'],
];

/**
 * A number to three significant figures in the site's reader bands: plain
 * from 0.01 to 10 000, with thousands separators to a million, in number words
 * to a thousand trillion, and as a power of ten outside that. Negative values
 * carry a true minus sign.
 */
function formatSig3(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const sign = value < 0 ? MINUS : '';
  const abs = Math.abs(value);
  const rounded = Number(abs.toPrecision(3));
  if (rounded >= 0.01 && rounded < 1e4) return `${sign}${rounded}`;
  if (rounded >= 1e4 && rounded < 1e6) return `${sign}${SIG3.format(rounded)}`;
  if (rounded >= 1e6 && rounded < 1e15) {
    const [, divisor, word] = NUMBER_WORDS.find(([threshold]) => rounded >= threshold)!;
    return `${sign}${Number((rounded / divisor).toPrecision(3))} ${word}`;
  }
  return `${sign}${scientific(abs)}`;
}

/**
 * A length in m, in the unit its magnitude warrants: mm below a centimetre, m
 * below a kilometre, km below 10¹¹ m (two-thirds of an AU), and AU beyond. A
 * throat a hair under a metre reads "0.998 m", not "998 mm".
 */
function formatLength(metres: number): string {
  if (!(metres > 0) || !Number.isFinite(metres)) return '—';
  const rounded = Number(metres.toPrecision(3));
  if (rounded < 0.01) return `${formatSig3(metres * 1e3)} mm`;
  if (rounded < 1e3) return `${formatSig3(metres)} m`;
  if (rounded < 1e11) return `${formatSig3(metres / 1e3)} km`;
  return `${formatSig3(metres / AU)} AU`;
}

/** The comparison bodies, largest first: [mass in kg, plural name]. */
const BODIES: [number, string][] = [
  [M_SUN, 'Suns'],
  [M_JUPITER, 'Jupiters'],
  [M_EARTH, 'Earths'],
];

/**
 * The exotic mass in kg, then the largest body of which it is at least a
 * tenth: "−2.12 × 10²⁷ kg (minus 1.11 Jupiters)". Below a tenth of a Sun the
 * count of Jupiters is under 105, and below a tenth of Jupiter the count of
 * Earths is under 32, so only Suns can run past a thousand.
 */
function formatExoticMass(kg: number): string {
  if (!Number.isFinite(kg)) return '—';
  const size = Math.abs(kg);
  const [mass, name] = BODIES.find(([m]) => size / m >= 0.1) ?? BODIES[BODIES.length - 1]!;
  return `${formatSig3(kg)} kg (minus ${formatSig3(size / mass)} ${name})`;
}

/** A density in kg/m³, signed, three significant figures. */
function formatDensity(kgPerM3: number): string {
  return `${formatSig3(kgPerM3)} kg/m³`;
}

/** The Casimir gap in m, then as a multiple of the proton's radius. */
function formatCasimirGap(metres: number): string {
  if (!(metres > 0) || !Number.isFinite(metres)) return '—';
  return `${formatSig3(metres)} m (${formatSig3(metres / PROTON_RADIUS)} times a proton’s radius)`;
}

const STATUS = 'No. Allowed by the equations, never seen.';

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#858ea2',
  edge: '#232b3b',
  grid: 'rgba(35,43,59,0.55)',
  ring: 'rgba(157,180,255,0.35)',
  star: '#9db4ff',
  ember: '#e8bd7d',
  warm: '#f0a868',
  body: 'rgba(240,168,104,0.28)',
  level: '#c7a0e8',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const FONT_SUB = '7px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;

const PAD = { left: 12, right: 12 };
const PLOT_LEFT = 52;
const TOP_SHARE = 0.55;

/** The funnel is drawn from the throat out to this many throat radii at each mouth. */
const MOUTH_RADII = 3;
/** Rings are drawn as ellipses this many times as tall as they are wide: the diagram's tilt. */
const TILT = 0.22;
/** The throat's on-screen radius as a share of the canvas width, where the height allows. */
const THROAT_SHARE = 0.1;

/** The axes' ranges, display only: throat radius in m, mass in kg. */
const B_AXIS: [number, number] = [1e-3, 1.5e13];
const M_AXIS: [number, number] = [1e23, 1e41];

const B_TICKS: [number, string][] = [
  [1e-3, '1 mm'],
  [1, '1 m'],
  [1e3, '1 km'],
  [1e6, '1,000 km'],
  [1e9, `${powerOfTen(6)} km`],
  [AU, '1 AU'],
];
const M_TICKS = [1e25, 1e30, 1e35, 1e40];
const LEVELS: [number, string][] = [
  [M_EARTH, 'the Earth'],
  [M_JUPITER, 'Jupiter'],
  [M_SUN, 'the Sun'],
];

type Units = 'friendly' | 'technical';

interface View {
  /** Throat radius as currently drawn, m — mid-tween while it slides. */
  b0: number;
  units: Units;
}

interface Frame {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type Spot = { x: number; y: number; align: CanvasTextAlign };

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
function platedText(ctx: CanvasRenderingContext2D, text: string, spot: Spot, obstacles: LabelBox[]): void {
  const box = labelBox(ctx, text, spot.x, spot.y, spot.align);
  const ink = ctx.fillStyle;
  ctx.fillStyle = 'rgba(5,7,12,0.82)';
  ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
  ctx.fillStyle = ink;
  placeText(ctx, text, spot.x, spot.y, spot.align, obstacles);
}

function inside(ctx: CanvasRenderingContext2D, text: string, c: Spot, bounds: LabelBox): boolean {
  const box = labelBox(ctx, text, c.x, c.y, c.align);
  return box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
}

/**
 * The first spot, of several tried in order, that fits inside `bounds` clear
 * of every obstacle and mark; drawn plated. Nothing is drawn if none fits.
 */
function placeFirstClear(
  ctx: CanvasRenderingContext2D,
  text: string,
  spots: Spot[],
  bounds: LabelBox,
  obstacles: LabelBox[],
  marks: LabelBox[],
): boolean {
  const spot = spots.find(
    (c) =>
      inside(ctx, text, c, bounds) &&
      ![...obstacles, ...marks].some((o) => overlaps(labelBox(ctx, text, c.x, c.y, c.align), o, 2)),
  );
  if (spot) platedText(ctx, text, spot, obstacles);
  return spot !== undefined;
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
  const candidates: Spot[] = [];
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

/** An axis title with a subscript, drawn left-aligned at (x, y); each piece is recorded as an obstacle. */
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

/** A tilted ring: an ellipse centred at (cx, cy) with horizontal radius rx. */
function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * TILT, 0, 0, TAU);
  ctx.stroke();
}

/** A person, `height` px tall, standing with their middle at (cx, cy): head, body, arms and legs. */
function drawPerson(ctx: CanvasRenderingContext2D, cx: number, cy: number, height: number): void {
  const top = cy - height / 2;
  const head = height * 0.13;
  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = COLORS.warm;
  ctx.lineWidth = Math.max(1, height / 30);
  ctx.beginPath();
  ctx.arc(cx, top + head / 2, head / 2, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, top + head);
  ctx.lineTo(cx, top + height * 0.58);
  ctx.moveTo(cx - height * 0.18, top + height * 0.3);
  ctx.lineTo(cx + height * 0.18, top + height * 0.3);
  ctx.moveTo(cx, top + height * 0.58);
  ctx.lineTo(cx - height * 0.12, top + height);
  ctx.moveTo(cx, top + height * 0.58);
  ctx.lineTo(cx + height * 0.12, top + height);
  ctx.stroke();
}

/** A body drawn as a disc of the given on-screen radius, centred at (cx, cy). */
function drawDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  ctx.fillStyle = COLORS.body;
  ctx.strokeStyle = COLORS.warm;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

function drawTunnel(ctx: CanvasRenderingContext2D, w: number, splitY: number, view: View, obstacles: LabelBox[]): void {
  const deep = view.units === 'technical';
  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'The shape of the tunnel', PAD.left, 14, 'left', obstacles);

  const b0 = view.b0;
  const zMouth = embeddingHeight(MOUTH_RADII * b0, b0) / b0; // mouth height, in throat radii
  // Room above and below for the two mouth labels, 18 px each.
  const top = 24 + 18;
  const bottom = splitY - 8 - 18;
  const heightInRadii = 2 * zMouth + 2 * TILT * MOUTH_RADII;
  const throat = Math.max(
    6,
    Math.min(THROAT_SHARE * w, (w - PAD.left - PAD.right) / (2 * MOUTH_RADII) - 4, (bottom - top) / heightInRadii),
  );
  const cx = w / 2;
  const cy = (top + bottom) / 2;
  const scale = throat / b0; // px per metre

  /* The profile: z = ±b₀ arccosh(r/b₀), sampled from the throat to each mouth. */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    for (const up of [-1, 1]) {
      ctx.beginPath();
      const steps = 60;
      for (let i = 0; i <= steps; i += 1) {
        const r = b0 * (1 + ((MOUTH_RADII - 1) * i) / steps);
        const x = cx + side * r * scale;
        const y = cy + up * embeddingHeight(r, b0) * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /* Rings part-way out and at each mouth, then the throat itself. */
  for (const radii of [1.5, 2, MOUTH_RADII]) {
    const z = embeddingHeight(radii * b0, b0) * scale;
    for (const up of [-1, 1]) ring(ctx, cx, cy + up * z, radii * throat, COLORS.ring, radii === MOUTH_RADII ? 1.25 : 1);
  }
  ring(ctx, cx, cy, throat, COLORS.ember, 1.5);

  /* The reference that suits this scale, if any: a person, the Earth or the Sun, drawn at the throat. */
  const tallest = 2 * zMouth * throat;
  const references: { size: number; name: string; draw: () => void }[] = [
    { size: PERSON_HEIGHT * scale, name: 'a person', draw: () => drawPerson(ctx, cx, cy, PERSON_HEIGHT * scale) },
    { size: 2 * R_EARTH * scale, name: 'the Earth', draw: () => drawDisc(ctx, cx, cy, R_EARTH * scale) },
    { size: 2 * R_SUN * scale, name: 'the Sun', draw: () => drawDisc(ctx, cx, cy, R_SUN * scale) },
  ];
  const shown = references.find((ref) => ref.size >= 6 && ref.size <= tallest);
  shown?.draw();

  /* The ruler: centre to rim along the throat, with end ticks. */
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + throat, cy);
  ctx.moveTo(cx, cy - 3);
  ctx.lineTo(cx, cy + 3);
  ctx.moveTo(cx + throat, cy - 3);
  ctx.lineTo(cx + throat, cy + 3);
  ctx.stroke();

  /* Labels: the two mouths, the ruler, and the reference. */
  const frame: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: 20, y1: splitY - 4 };
  const mouthTop = cy - zMouth * throat - TILT * MOUTH_RADII * throat;
  const mouthBottom = cy + zMouth * throat + TILT * MOUTH_RADII * throat;
  ctx.fillStyle = COLORS.inkDim;
  placeFirstClear(ctx, 'this mouth', [{ x: cx, y: mouthTop - 5, align: 'center' }], frame, obstacles, []);
  placeFirstClear(ctx, 'the other mouth', [{ x: cx, y: mouthBottom + 13, align: 'center' }], frame, obstacles, []);

  ctx.fillStyle = COLORS.ember;
  const rulerText = deep ? `b₀ = ${formatLength(b0)}` : formatLength(b0);
  const below = cy + TILT * throat + 12;
  placeFirstClear(
    ctx,
    rulerText,
    [
      { x: cx + throat / 2, y: below, align: 'center' },
      { x: cx + throat + 6, y: cy + 4, align: 'left' },
      { x: cx + throat / 2, y: cy - TILT * throat - 4, align: 'center' },
      { x: cx - throat - 6, y: cy + 4, align: 'right' },
    ],
    frame,
    obstacles,
    [],
  );

  if (shown) {
    ctx.fillStyle = COLORS.warm;
    const half = shown.size / 2;
    labelNear(ctx, shown.name, cx - throat * 0.5, cy - Math.min(half, throat), frame, obstacles, [
      { x0: cx - half, x1: cx + half, y0: cy - half, y1: cy + half },
    ]);
  }
}

/** x for a throat radius on the log axis. */
function xOfB(f: Frame, b0: number): number {
  const [lo, hi] = B_AXIS.map(Math.log10) as [number, number];
  return f.left + ((Math.log10(b0) - lo) / (hi - lo)) * (f.right - f.left);
}

/** y for a mass on the log axis. */
function yOfM(f: Frame, M: number): number {
  const [lo, hi] = M_AXIS.map(Math.log10) as [number, number];
  return f.bottom - ((Math.log10(M) - lo) / (hi - lo)) * (f.bottom - f.top);
}

function drawMass(
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
  placeText(ctx, 'The negative mass it needs', PAD.left, splitY + 16, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  if (deep) subscripted(ctx, ['|M', 'exotic', '| (kg)'], PAD.left, splitY + 29, obstacles);
  else placeText(ctx, 'negative mass needed', PAD.left, splitY + 29, 'left', obstacles);

  /* Axes. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(f.left, f.top);
  ctx.lineTo(f.left, f.bottom);
  ctx.lineTo(f.right, f.bottom);
  ctx.stroke();

  /* Mass ticks, with faint gridlines; labels set clear of a dot sitting on the axis. */
  for (const M of M_TICKS) {
    const y = yOfM(f, M);
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    ctx.moveTo(f.left, y);
    ctx.lineTo(f.right, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.inkFaint;
    const label = `${powerOfTen(Math.round(Math.log10(M)))} kg`;
    const box = labelBox(ctx, label, f.left - 7, y + 3, 'right');
    if (!obstacles.some((o) => overlaps(box, o, 2))) placeText(ctx, label, f.left - 7, y + 3, 'right', obstacles);
  }

  /* Radius ticks, labelled where they fit. */
  const row = (text: string, x: number, y: number) => {
    const half = ctx.measureText(text).width / 2;
    const cx = Math.min(w - PAD.right - half, Math.max(PAD.left + half, x));
    const box = labelBox(ctx, text, cx, y, 'center');
    if (!obstacles.some((o) => overlaps(box, o, 2))) placeText(ctx, text, cx, y, 'center', obstacles);
  };
  ctx.strokeStyle = COLORS.edge;
  ctx.fillStyle = COLORS.inkFaint;
  for (const [b0, label] of B_TICKS) {
    const x = xOfB(f, b0);
    ctx.beginPath();
    ctx.moveTo(x, f.bottom);
    ctx.lineTo(x, f.bottom + 3);
    ctx.stroke();
    row(label, x, f.bottom + 13);
  }
  if (deep) {
    // Centred like the friendly title: measure the three pieces in their own fonts first.
    const base = ctx.measureText('b').width + ctx.measureText(' (m)').width;
    ctx.font = FONT_SUB;
    const sub = ctx.measureText('0').width;
    ctx.font = FONT;
    subscripted(ctx, ['b', '0', ' (m)'], (f.left + f.right) / 2 - (base + sub) / 2, f.bottom + 28, obstacles);
  } else {
    row('throat radius', (f.left + f.right) / 2, f.bottom + 28);
  }

  /* The reference masses, dashed across the plot. */
  ctx.strokeStyle = COLORS.level;
  ctx.setLineDash([4, 3]);
  for (const [M] of LEVELS) {
    const y = yOfM(f, M);
    ctx.beginPath();
    ctx.moveTo(f.left, y);
    ctx.lineTo(f.right, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* |M_exotic| against b₀: a straight line of slope one. */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  const steps = 100;
  for (let i = 0; i <= steps; i += 1) {
    const b0 = B_AXIS[0] * (B_AXIS[1] / B_AXIS[0]) ** (i / steps);
    const x = xOfB(f, b0);
    const y = yOfM(f, Math.abs(exoticMass(b0)));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1;

  /* The dot at the slider's radius. */
  const M = exoticMass(view.b0);
  const xD = xOfB(f, view.b0);
  const yD = yOfM(f, Math.abs(M));
  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(xD, yD, 4, 0, TAU);
  ctx.fill();
  const marks: LabelBox[] = [{ x0: xD - 5, x1: xD + 5, y0: yD - 5, y1: yD + 5 }];

  /* The reference lines' names at their right ends, above the line or below, then at the left end. */
  ctx.font = FONT;
  ctx.fillStyle = COLORS.level;
  for (const [mass, name] of LEVELS) {
    const y = yOfM(f, mass);
    placeFirstClear(
      ctx,
      name,
      [-4, 12, -10, 18].flatMap((dy) => [
        { x: f.right - 4, y: y + dy, align: 'right' as const },
        { x: f.left + 4, y: y + dy, align: 'left' as const },
      ]),
      plotBox,
      obstacles,
      marks,
    );
  }

  ctx.fillStyle = COLORS.ember;
  labelNear(ctx, `${formatSig3(M)} kg`, xD, yD, plotBox, obstacles, marks);
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
  drawTunnel(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawMass(ctx, w, h, splitY, view, obstacles);
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

export default function WormholesSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const b0 = readParam(params, values, 'b0');
  const units: Units = deep ? 'technical' : 'friendly';

  // Every number below comes from `@/physics/wormhole`, once per render.
  const circumference = throatCircumference(b0);
  const mass = exoticMass(b0);
  const density = throatDensity(b0);
  const gap = casimirGapForThroat(b0);

  /** The radius the drawing is at, which trails the slider while it slides. */
  const shownRef = useRef(b0);

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
    drawScene(ctx, rect.width, rect.height, { b0: shownRef.current, units });
  }, [units]);

  /* The ruler, the reference and the dot follow the radius. */
  useEffect(() => slide(shownRef, b0, reduced, paint), [b0, reduced, paint]);

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
          aria-label="Above, the embedding diagram of a wormhole: two funnels, one opening upward and one downward, joined at a narrow circular throat, with a ruler across the throat showing its radius and, where it fits at that scale, a person, the Earth or the Sun drawn for size. Below, the negative mass needed to hold the throat open against its radius, rising in a straight line on logarithmic axes past the masses of the Earth, Jupiter and the Sun."
          aria-describedby="wormholes-readouts"
        />
      </div>

      <dl id="wormholes-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Throat circumference' : 'Around the throat'} value={formatLength(circumference)} />
        <Readout label={deep ? 'Exotic mass' : 'Negative mass needed'} value={formatExoticMass(mass)} />
        <Readout label={deep ? 'Throat density' : 'How negative, at the throat'} value={formatDensity(density)} />
        <Readout
          label={deep ? 'Casimir gap to match' : 'Casimir plates would need to be this close'}
          value={formatCasimirGap(gap)}
        />
        <Readout label={deep ? 'Observational status' : 'Ever observed?'} value={STATUS} />
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
  formatSig3,
  formatLength,
  formatExoticMass,
  formatDensity,
  formatCasimirGap,
};

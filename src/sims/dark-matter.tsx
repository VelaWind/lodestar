/**
 * Dark matter — a disc galaxy seen from above, and its rotation curve.
 *
 * Top panel: the galaxy face-on. Its stars are scattered the way the disc's mass
 * is, thick near the centre and thinning outward, and each one orbits at the
 * total circular speed for its radius. A faint violet glow stands for the dark
 * halo, which in reality gives off no light at all. One star, at the radius of
 * the marker slider, is drawn bright on its dashed orbit; a hollow ring beside
 * it moves at the speed the visible matter alone would give, and falls behind.
 *
 * Bottom panel: orbital speed against radius, out to 30 kpc. Three curves: the
 * visible disc alone, the halo alone, and the two together. A vertical line
 * marks the marker radius, with a dot where it crosses each curve.
 *
 * No physics lives in this file. Every speed, mass and period comes from
 * `@/physics/darkmatter`, through `rotationCurve` and `markerReadout`, which the
 * sanity block also reads. The picture and the readouts call the same function,
 * so the stars, the curves and the numbers cannot disagree.
 *
 * Motion: time is sped up by one fixed factor, one second on screen for 25
 * million years, at every setting. Under reduced motion there is no loop: each
 * star is drawn with a streak showing how far it travels in 20 million years,
 * and the marked star and its ring are drawn where they are after 100 million.
 */
import { useCallback, useEffect, useRef } from 'react';
import { canvasSize, observeCanvasSize } from './canvasSize';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { JULIAN_YEAR, KILOPARSEC, LIGHT_YEAR, M_SUN, R0_GALACTIC } from '@/physics/constants';
import { markerReadout, rotationCurve, type Galaxy } from '@/physics/darkmatter';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { labelBox, overlaps, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const MYR = 1e6 * JULIAN_YEAR;

/** A positive number to three significant figures, with thousands separators. */
function formatSig3(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return SIG3.format(Number(value.toPrecision(3)));
}

/** A speed in m/s, as km/s. */
function formatSpeed(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v < 0.5e3) return '0 km/s';
  return `${formatSig3(v / 1e3)} km/s`;
}

/** A mass in kg, as billions of Suns. */
function formatMass(m: number): string {
  if (!Number.isFinite(m)) return '—';
  return `${formatSig3(m / (1e9 * M_SUN))} billion Suns`;
}

/** A period in s, as millions of years; "never" for a star with nothing holding it. */
function formatPeriod(T: number): string {
  if (!Number.isFinite(T)) return 'never: nothing holds it';
  if (T >= 1e3 * MYR) return `${formatSig3(T / (1e3 * MYR))} billion years`;
  return `${formatSig3(T / MYR)} million years`;
}

/** A distance in m: kpc at the Deep tier, light-years in words at the others. */
function formatDistance(R: number, deep: boolean): string {
  if (!Number.isFinite(R)) return '—';
  if (deep) return `${formatSig3(R / KILOPARSEC)} kpc`;
  return `about ${formatSig3(R / LIGHT_YEAR)} light-years`;
}

/** The dark-to-visible mass ratio. */
function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  if (ratio === 0) return 'none: no halo';
  return `${formatSig3(ratio)} to 1`;
}

/* ------------------------------------------------------------------ */
/* The galaxy's contents                                               */
/* ------------------------------------------------------------------ */

/** The plot's and the picture's outer radius, m. */
const R_VIEW = 30 * KILOPARSEC;
/** Stars drawn in the disc, plus the marked one. */
const N_STARS = 240;
/** Real time per second on screen, s: 25 million years, at every setting. */
const REAL_SECONDS_PER_SCREEN_SECOND = 25 * MYR;
/** The reduced-motion frame: streaks this long, the marked star this far on. */
const STREAK_TIME = 20 * MYR;
const STATIC_TIME = 100 * MYR;

/** A small deterministic generator, so every load draws the same galaxy. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fixed per-star draws: where in the disc's mass each star sits, its angle, size and brightness. */
const STAR_DRAWS = (() => {
  const rand = mulberry32(20_260_903);
  return Array.from({ length: N_STARS }, () => ({
    quantile: rand(),
    phase: rand() * 2 * Math.PI,
    size: rand() < 0.15 ? 2 : 1.4,
    alpha: 0.45 + 0.5 * rand(),
  }));
})();

/** The fraction of an exponential disc's mass inside x scale lengths. */
function massFraction(x: number): number {
  return 1 - (1 + x) * Math.exp(-x);
}

/** The radius, in scale lengths, holding fraction u of the disc's mass (bisection). */
function radiusForFraction(u: number): number {
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (massFraction(mid) < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

interface Star {
  /** Radius, m. */
  R: number;
  /** Angle at t = 0, rad. */
  phase: number;
  /** Angular speed, rad/s, from the total rotation curve. */
  omega: number;
  size: number;
  alpha: number;
}

/** One sample of the three curves, m and m/s. */
interface Sample {
  R: number;
  visible: number;
  halo: number;
  total: number;
}

interface Model {
  stars: Star[];
  samples: Sample[];
  /** The largest speed on the plot, m/s. */
  vMax: number;
}

/** Curve samples across the plot. */
const CURVE_STEPS = 240;

/**
 * The stars' radii for one disc scale length, m. They depend on nothing else,
 * so a drag of the mass or halo slider reuses them.
 */
let cachedRadiiRd = NaN;
let cachedRadii: number[] = [];

function starRadii(Rd: number): number[] {
  if (Rd === cachedRadiiRd) return cachedRadii;
  // Stars only out to the edge of the view: quantiles of the mass inside it.
  const inView = massFraction(R_VIEW / Rd);
  cachedRadii = STAR_DRAWS.map((draw) => Math.max(0.15 * KILOPARSEC, radiusForFraction(draw.quantile * inView) * Rd));
  cachedRadiiRd = Rd;
  return cachedRadii;
}

/**
 * The stars and the curves for one galaxy, from `rotationCurve`. Kept for the
 * last galaxy only: the loop redraws the same galaxy every frame, and a slider
 * move makes a new one.
 */
let cachedKey = '';
let cachedModel: Model | null = null;

function modelFor(galaxy: Galaxy): Model {
  const key = `${galaxy.M}|${galaxy.Rd}|${galaxy.vInf}`;
  if (cachedModel && key === cachedKey) return cachedModel;

  const radii = starRadii(galaxy.Rd);
  const stars: Star[] = STAR_DRAWS.map((draw, i) => {
    const R = radii[i]!;
    const v = rotationCurve(R, galaxy).total;
    return { R, phase: draw.phase, omega: v / R, size: draw.size, alpha: draw.alpha };
  });

  const samples: Sample[] = [];
  let vMax = 0;
  for (let i = 0; i <= CURVE_STEPS; i += 1) {
    const R = (i / CURVE_STEPS) * R_VIEW;
    const point = rotationCurve(R, galaxy);
    samples.push({ R, ...point });
    vMax = Math.max(vMax, point.total, point.visible, point.halo);
  }

  cachedKey = key;
  cachedModel = { stars, samples, vMax };
  return cachedModel;
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
  star: '#c9d6ff',
  visible: '#9db4ff',
  halo: '#c7a0e8',
  total: '#e8bd7d',
  ghost: '#9db4ff',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;
const PAD = { left: 12, right: 12 };
/** Share of the height for the galaxy; the curve plot takes the rest. */
const GALAXY_SHARE = 0.5;

type Units = 'friendly' | 'technical';

interface View {
  /** Disc mass, kg. */
  M: number;
  /** Disc scale length, m. */
  Rd: number;
  /** Halo asymptotic speed, m/s. */
  vInf: number;
  /** The marked star's radius, m. */
  R: number;
  /** Real time elapsed, s. */
  t: number;
  /** The reduced-motion frame: streaks rather than motion. */
  still: boolean;
  units: Units;
}

/** What `drawScene` placed: every label box, and every obstacle it kept them off. */
export interface Layout {
  labels: LabelBox[];
  obstacles: LabelBox[];
  /** The obstacles again, bucketed by `GRID_CELL` px columns and rows, for placement. */
  grid: Map<number, LabelBox[]>;
}

const GRID_CELL = 32;

function newLayout(): Layout {
  return { labels: [], obstacles: [], grid: new Map() };
}

/** Every grid cell a box touches, as one integer key each. */
function cellsOf(box: LabelBox, pad: number): number[] {
  const keys: number[] = [];
  const c0 = Math.floor((box.x0 - pad) / GRID_CELL);
  const c1 = Math.floor((box.x1 + pad) / GRID_CELL);
  const r0 = Math.floor((box.y0 - pad) / GRID_CELL);
  const r1 = Math.floor((box.y1 + pad) / GRID_CELL);
  for (let c = c0; c <= c1; c += 1) for (let r = r0; r <= r1; r += 1) keys.push(c * 4096 + r);
  return keys;
}

function addObstacle(layout: Layout, box: LabelBox): void {
  layout.obstacles.push(box);
  for (const key of cellsOf(box, 0)) {
    const bucket = layout.grid.get(key);
    if (bucket) bucket.push(box);
    else layout.grid.set(key, [box]);
  }
}

function hitsObstacle(layout: Layout, box: LabelBox, pad: number): boolean {
  for (const key of cellsOf(box, pad)) {
    const bucket = layout.grid.get(key);
    if (bucket?.some((o) => overlaps(box, o, pad))) return true;
  }
  return false;
}

/** Text at (x, y), recorded as placed. */
function placeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  layout: Layout,
): void {
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  layout.labels.push(labelBox(ctx, text, x, y, align));
}

interface Spot {
  x: number;
  y: number;
  align: CanvasTextAlign;
}

/**
 * The first text, longest first, at the first spot that keeps it inside
 * `bounds` and clear of every label and obstacle placed so far. Nothing is
 * drawn if none fits.
 */
function placeFirstOf(
  ctx: CanvasRenderingContext2D,
  texts: string[],
  spots: Spot[],
  bounds: LabelBox,
  layout: Layout,
): boolean {
  const font = ctx.font;
  for (const text of texts) {
    for (const spot of spots) {
      const box = labelBox(ctx, text, spot.x, spot.y, spot.align, font);
      const inside = box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
      if (!inside) continue;
      if (layout.labels.some((o) => overlaps(box, o, 2))) continue;
      if (hitsObstacle(layout, box, 1)) continue;
      placeText(ctx, text, spot.x, spot.y, spot.align, layout);
      return true;
    }
  }
  return false;
}

/* ----------------------------- the galaxy ---------------------------- */

/** Where the galaxy sits in its panel, px, and px per metre. */
interface GalaxyGeometry {
  cx: number;
  cy: number;
  radius: number;
  scale: number;
}

function galaxyGeometry(w: number, bottom: number): GalaxyGeometry {
  const top = 22;
  const radius = Math.max(10, Math.min((w - PAD.left - PAD.right) / 2, (bottom - top - 4) / 2));
  return { cx: w / 2, cy: top + (bottom - top) / 2, radius, scale: radius / R_VIEW };
}

/** The halo's glow and the disc's light, centred on (cx, cy). */
function drawGlows(ctx: CanvasRenderingContext2D, geometry: GalaxyGeometry, view: View): void {
  const { cx, cy, radius, scale } = geometry;

  /* The halo: a glow as strong as its share of the speed at the edge of the view. */
  const edge = rotationCurve(R_VIEW, view);
  const haloShare = edge.total > 0 ? edge.halo / edge.total : 0;
  if (haloShare > 0.01) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0, `rgba(199,160,232,${(0.16 * haloShare).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(199,160,232,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fill();
  }

  /* The disc's own light: brightest at the centre, fading over a few scale lengths. */
  const discRadius = Math.min(radius, 3 * view.Rd * scale);
  const discGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, discRadius);
  discGlow.addColorStop(0, 'rgba(232,214,180,0.35)');
  discGlow.addColorStop(1, 'rgba(232,214,180,0)');
  ctx.fillStyle = discGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, discRadius, 0, TAU);
  ctx.fill();
}

/**
 * The glows, drawn once into their own canvas so an animation frame can copy
 * them rather than fill two gradients across the whole galaxy again.
 */
export interface GlowImage {
  image: CanvasImageSource;
  key: string;
}

function glowKey(w: number, bottom: number, dpr: number, view: View): string {
  return `${w}|${bottom}|${dpr}|${view.M}|${view.Rd}|${view.vInf}`;
}

function drawGalaxy(
  ctx: CanvasRenderingContext2D,
  w: number,
  bottom: number,
  view: View,
  model: Model,
  layout: Layout,
  glow?: GlowImage,
): void {
  const deep = view.units === 'technical';
  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, deep ? 'Face-on, R ≤ 30 kpc' : 'The galaxy, seen from above', PAD.left, 14, 'left', layout);

  const geometry = galaxyGeometry(w, bottom);
  const { cx, cy, radius, scale } = geometry;

  /* The galaxy as an obstacle: one box per horizontal slice of its disc. */
  for (let y = cy - radius; y < cy + radius; y += 6) {
    const dy = Math.min(Math.abs(y - cy), Math.abs(y + 6 - cy));
    const half = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    addObstacle(layout, { x0: cx - half, x1: cx + half, y0: y, y1: y + 6 });
  }

  if (glow) ctx.drawImage(glow.image, cx - radius, cy - radius, 2 * radius, 2 * radius);
  else drawGlows(ctx, geometry, view);

  /* The stars, each at its own angular speed. */
  ctx.fillStyle = COLORS.star;
  if (view.still) {
    ctx.strokeStyle = COLORS.star;
    ctx.lineWidth = 1;
  }
  for (const star of model.stars) {
    const r = star.R * scale;
    const phi = star.phase + star.omega * view.t;
    ctx.globalAlpha = star.alpha;
    const x = cx + r * Math.cos(phi);
    const y = cy - r * Math.sin(phi);
    ctx.fillRect(x - star.size / 2, y - star.size / 2, star.size, star.size);
    if (view.still) {
      // How far it goes in 20 million years: a streak behind it, counter-clockwise motion.
      const sweep = Math.min(TAU, star.omega * STREAK_TIME);
      ctx.globalAlpha = star.alpha * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -phi, -phi + sweep);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  /* The marked star's orbit, the star, and the ring at the visible-only speed. */
  const rm = Math.min(view.R, R_VIEW) * scale;
  ctx.strokeStyle = COLORS.inkFaint;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, rm, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  const readout = markerReadout(view.R, view);
  const t = view.still ? STATIC_TIME : view.t;
  const phiStar = (readout.withHalo / view.R) * t;
  const phiGhost = (readout.visibleOnly / view.R) * t;
  ctx.strokeStyle = COLORS.ghost;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx + rm * Math.cos(phiGhost), cy - rm * Math.sin(phiGhost), 4.5, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = COLORS.total;
  ctx.beginPath();
  ctx.arc(cx + rm * Math.cos(phiStar), cy - rm * Math.sin(phiStar), 3.5, 0, TAU);
  ctx.fill();
}

/* ------------------------------ the curves --------------------------- */

/** A tick step that gives three to six ticks over `span`. */
function niceStep(span: number): number {
  const raw = span / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const mantissa = raw / power;
  const step = mantissa < 1.5 ? 1 : mantissa < 3.5 ? 2 : mantissa < 7.5 ? 5 : 10;
  return step * power;
}

function drawCurves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: number,
  view: View,
  model: Model,
  layout: Layout,
): void {
  const deep = view.units === 'technical';
  const left = PAD.left + 30;
  const right = w - PAD.right - 4;
  const plotTop = top + 24;
  /* Room below the plot for the tick row, then the axis title's own row. */
  const plotBottom = h - 32;
  if (plotBottom - plotTop < 20 || right - left < 40) return;
  const bounds: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: top + 2, y1: h - 2 };

  /* The speed axis: from zero to a round number above the fastest curve. */
  const vStepKm = niceStep(Math.max(100, model.vMax / 1e3));
  const vTopKm = Math.max(vStepKm, Math.ceil((model.vMax / 1e3) * 1.08 / vStepKm) * vStepKm);
  const xOf = (R: number) => left + (R / R_VIEW) * (right - left);
  const yOf = (v: number) => plotBottom - (v / 1e3 / vTopKm) * (plotBottom - plotTop);

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, deep ? 'Circular speed v_c (km/s)' : 'How fast stars orbit (km/s)', PAD.left, top + 14, 'left', layout);

  /* Axes and speed ticks. */
  ctx.strokeStyle = COLORS.edge;
  ctx.beginPath();
  ctx.moveTo(left, plotTop);
  ctx.lineTo(left, plotBottom);
  ctx.lineTo(right, plotBottom);
  ctx.stroke();
  ctx.fillStyle = COLORS.inkFaint;
  for (let v = 0; v <= vTopKm + 1e-9; v += vStepKm) {
    const y = yOf(v * 1e3);
    if (v > 0) {
      ctx.strokeStyle = COLORS.grid;
      ctx.beginPath();
      ctx.moveTo(left + 1, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    const label = SIG3.format(v);
    const box = labelBox(ctx, label, left - 4, y + 3.5, 'right');
    if (!layout.labels.some((o) => overlaps(box, o, 1))) placeText(ctx, label, left - 4, y + 3.5, 'right', layout);
  }

  /* Distance ticks: kpc at the Deep tier, thousands of light-years otherwise. */
  const unit = deep ? KILOPARSEC : 1e3 * LIGHT_YEAR;
  const rStep = deep ? 10 : 20;
  for (let d = 0; d * unit <= R_VIEW + 1e-6 * unit; d += rStep) {
    const x = xOf(d * unit);
    ctx.strokeStyle = COLORS.edge;
    ctx.beginPath();
    ctx.moveTo(x, plotBottom);
    ctx.lineTo(x, plotBottom + 3);
    ctx.stroke();
    const label = String(d);
    const box = labelBox(ctx, label, x, plotBottom + 12, 'center');
    if (!layout.labels.some((o) => overlaps(box, o, 1))) placeText(ctx, label, x, plotBottom + 12, 'center', layout);
  }

  /* The curves, as polylines dense enough that no segment spans more than 3 px. */
  const curves: { key: 'visible' | 'halo' | 'total'; color: string; width: number; dash: number[] }[] = [
    { key: 'halo', color: COLORS.halo, width: 1.25, dash: [4, 3] },
    { key: 'visible', color: COLORS.visible, width: 1.5, dash: [] },
    { key: 'total', color: COLORS.total, width: 2, dash: [] },
  ];
  // From the drawn curve itself, so the labels can never describe a halo that is not drawn.
  const noHalo = model.samples.every((s) => s.halo === 0);
  for (const curve of curves) {
    if (noHalo && curve.key !== 'visible') continue;
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = curve.width;
    ctx.setLineDash(curve.dash);
    ctx.beginPath();
    let px = NaN;
    let py = NaN;
    for (const s of model.samples) {
      const x = xOf(s.R);
      const y = yOf(s[curve.key]);
      if (Number.isNaN(px)) {
        ctx.moveTo(x, y);
      } else {
        const pieces = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 3));
        for (let k = 1; k <= pieces; k += 1) {
          const f = k / pieces;
          const qx = px + (x - px) * f;
          const qy = py + (y - py) * f;
          ctx.lineTo(qx, qy);
          addObstacle(layout, { x0: qx - 1.5, x1: qx + 1.5, y0: qy - 1.5, y1: qy + 1.5 });
        }
      }
      px = x;
      py = y;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 1;

  /* The marker: a line at its radius, a dot on each curve. */
  const xm = xOf(Math.min(view.R, R_VIEW));
  const point = rotationCurve(view.R, view);
  ctx.strokeStyle = COLORS.inkFaint;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xm, plotTop);
  ctx.lineTo(xm, plotBottom);
  ctx.stroke();
  ctx.setLineDash([]);
  addObstacle(layout, { x0: xm - 1, x1: xm + 1, y0: plotTop, y1: plotBottom });
  const dots: [number, string][] = noHalo
    ? [[point.visible, COLORS.visible]]
    : [
        [point.visible, COLORS.visible],
        [point.total, COLORS.total],
      ];
  for (const [v, color] of dots) {
    const y = yOf(v);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(xm, y, 3, 0, TAU);
    ctx.fill();
    addObstacle(layout, { x0: xm - 4, x1: xm + 4, y0: y - 4, y1: y + 4 });
  }

  /* Curve labels, near the outer end of each, above or below it. */
  const plotBounds: LabelBox = { x0: left + 2, x1: right, y0: plotTop - 12, y1: plotBottom - 2 };
  const near = (key: 'visible' | 'halo' | 'total'): Spot[] => {
    const spots: Spot[] = [];
    for (const frac of [0.98, 0.85, 0.7, 0.55, 0.4]) {
      const s = model.samples[Math.round(frac * CURVE_STEPS)]!;
      const x = xOf(s.R);
      const y = yOf(s[key]);
      for (const dy of [-6, 13, -14, 21]) spots.push({ x, y: y + dy, align: 'right' });
    }
    return spots;
  };
  const labels: { key: 'visible' | 'halo' | 'total'; color: string; texts: string[] }[] = noHalo
    ? [
        {
          key: 'visible',
          color: COLORS.visible,
          texts: deep ? ['disc only (no halo)', 'disc only'] : ['visible matter only (no halo)', 'visible only'],
        },
      ]
    : [
        { key: 'total', color: COLORS.total, texts: deep ? ['total', 'total'] : ['with the dark halo', 'total'] },
        {
          key: 'visible',
          color: COLORS.visible,
          texts: deep ? ['disc: stars + gas', 'disc'] : ['visible matter only', 'visible only', 'visible'],
        },
        { key: 'halo', color: COLORS.halo, texts: deep ? ['halo', 'halo'] : ['dark halo alone', 'halo alone', 'halo'] },
      ];
  for (const label of labels) {
    ctx.fillStyle = label.color;
    placeFirstOf(ctx, label.texts, near(label.key), plotBounds, layout);
  }

  ctx.fillStyle = COLORS.inkFaint;
  const atSun = Math.abs(view.R / R0_GALACTIC - 1) < 0.01;
  const markerTexts = deep
    ? [atSun ? 'R₀ (the Sun)' : 'marker', 'R']
    : [atSun ? 'the Sun’s distance' : 'marked star', atSun ? 'Sun' : 'star'];
  placeFirstOf(
    ctx,
    markerTexts,
    [
      { x: xm + 4, y: plotTop - 2, align: 'left' },
      { x: xm - 4, y: plotTop - 2, align: 'right' },
      { x: xm + 4, y: plotTop + 8, align: 'left' },
      { x: xm - 4, y: plotTop + 8, align: 'right' },
    ],
    bounds,
    layout,
  );
  placeFirstOf(
    ctx,
    [deep ? 'R (kpc)' : 'distance from the centre (thousand light-years)', deep ? 'kpc' : 'thousand light-years', 'thousand ly'],
    [{ x: right, y: h - 4, align: 'right' }],
    bounds,
    layout,
  );
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size; returns
 * where it put every label and what it kept them off, for the tests.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View, glow?: GlowImage): Layout {
  const layout = newLayout();
  ctx.clearRect(0, 0, w, h);
  if (w <= PAD.left + PAD.right + 60 || h <= 0) return layout;

  const model = modelFor(view);
  const galaxyBottom = Math.round(h * GALAXY_SHARE);

  ctx.save();
  drawGalaxyPanel(ctx, w, galaxyBottom, view, model, layout, glow);
  drawCurves(ctx, w, h, galaxyBottom, view, model, layout);
  ctx.restore();
  return layout;
}

/** The galaxy and the line under it. */
function drawGalaxyPanel(
  ctx: CanvasRenderingContext2D,
  w: number,
  galaxyBottom: number,
  view: View,
  model: Model,
  layout: Layout,
  glow?: GlowImage,
): void {
  drawGalaxy(ctx, w, galaxyBottom, view, model, layout, glow);
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, galaxyBottom);
  ctx.lineTo(w - PAD.right, galaxyBottom);
  ctx.stroke();
}

/**
 * One animation frame: only the galaxy moves, so only its panel is cleared and
 * redrawn. The curves below it change only when a slider does, and every such
 * change repaints the whole scene through `drawScene` first. `glow`, when
 * given, is the glows already drawn, copied in rather than refilled.
 */
function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, view: View, glow?: GlowImage): void {
  if (w <= PAD.left + PAD.right + 60 || h <= 0) return;
  const galaxyBottom = Math.round(h * GALAXY_SHARE);
  ctx.clearRect(0, 0, w, galaxyBottom + 1);
  ctx.save();
  drawGalaxyPanel(ctx, w, galaxyBottom, view, modelFor(view), newLayout(), glow);
  ctx.restore();
}

/**
 * The glows for this size and galaxy, at device resolution, drawn into
 * `canvas`: the same canvas every time, cleared, so a slider drag allocates
 * nothing.
 */
function renderGlow(canvas: HTMLCanvasElement, w: number, h: number, dpr: number, view: View): GlowImage | undefined {
  const bottom = Math.round(h * GALAXY_SHARE);
  const { radius, scale } = galaxyGeometry(w, bottom);
  const side = Math.ceil(2 * radius * dpr);
  if (canvas.width !== side || canvas.height !== side) {
    canvas.width = side;
    canvas.height = side;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, side, side);
  ctx.setTransform(side / (2 * radius), 0, 0, side / (2 * radius), 0, 0);
  drawGlows(ctx, { cx: radius, cy: radius, radius, scale }, view);
  return { image: canvas, key: glowKey(w, bottom, dpr, view) };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function DarkMatterSim({ params, values, setValue }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';
  const units: Units = deep ? 'technical' : 'friendly';

  const M = readParam(params, values, 'M');
  const Rd = readParam(params, values, 'Rd');
  const vInf = readParam(params, values, 'vInf');
  const R = readParam(params, values, 'R');
  const vInfDefault = params.find((p) => p.id === 'vInf')?.default ?? 0;

  /** The last halo the reader had on, for the toggle to put back. */
  const lastHaloRef = useRef(vInfDefault);
  useEffect(() => {
    if (vInf > 0) lastHaloRef.current = vInf;
  }, [vInf]);
  const haloOn = vInf > 0;

  // Every number below comes from `@/physics/darkmatter`, once per render.
  const readout = markerReadout(R, { M, Rd, vInf });

  const sceneRef = useRef<View | null>(null);
  /** The glows for the current size and galaxy, reused by every animation frame. */
  const glowRef = useRef<GlowImage | null>(null);
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /** The whole scene by default; with `full` false, only the galaxy panel, for an animation frame. */
  const paint = useCallback((full = true) => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;

    const rect = canvasSize(canvas);
    if (rect.width === 0 || rect.height === 0) return;

    // DPR-aware: back the canvas with device pixels, draw in CSS pixels.
    const dpr = window.devicePixelRatio || 1;
    const wantW = Math.round(rect.width * dpr);
    const wantH = Math.round(rect.height * dpr);
    // Resizing the backing store clears it, so a resized frame is always a full one.
    const resized = canvas.width !== wantW || canvas.height !== wantH;
    if (resized) {
      canvas.width = wantW;
      canvas.height = wantH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The glows, redrawn only when the size or the galaxy changes.
    const key = glowKey(rect.width, Math.round(rect.height * GALAXY_SHARE), dpr, scene);
    if (glowRef.current?.key !== key) {
      glowCanvasRef.current ??= document.createElement('canvas');
      glowRef.current = renderGlow(glowCanvasRef.current, rect.width, rect.height, dpr, scene) ?? null;
    }
    const glow = glowRef.current ?? undefined;
    if (full || resized) drawScene(ctx, rect.width, rect.height, scene, glow);
    else drawFrame(ctx, rect.width, rect.height, scene, glow);
  }, []);

  /* The galaxy turning, restarted from t = 0 on any change, so the marked star
     and its ring always set off together. Under reduced motion, one still frame. */
  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const still = reduced || typeof requestAnimationFrame === 'undefined';
    sceneRef.current = { M, Rd, vInf, R, t: 0, still, units };
    paint();
    if (still) return;

    let last: number | null = null;
    const tick = (now: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      // Clamped so a backgrounded tab does not resume with one enormous step.
      const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      scene.t += dt * REAL_SECONDS_PER_SCREEN_SECOND;
      paint(false);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [M, Rd, vInf, R, units, reduced, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return observeCanvasSize(canvas, () => paint());
  }, [paint]);

  const toggleHalo = () => setValue('vInf', haloOn ? 0 : lastHaloRef.current);

  return (
    <div className="flex min-h-[32rem] flex-col gap-4">
      <div className="relative h-[32rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="A disc galaxy seen from above, its stars orbiting the centre, with one marked star on a dashed orbit and a hollow ring beside it that moves at the speed visible matter alone would give. Below, a graph of orbital speed against distance from the centre out to 30 kiloparsecs, with three curves: visible matter only, the dark halo alone, and the two together, and a line at the marked star's distance."
          aria-describedby="dark-matter-readouts"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={toggleHalo}
          aria-pressed={!haloOn}
          className="rounded border border-edge-soft px-3 py-1.5 font-ui text-sm text-ink hover:border-ember focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember"
        >
          {haloOn ? 'Remove the dark halo' : 'Put the dark halo back'}
        </button>
      </div>

      <dl id="dark-matter-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Marker radius R' : 'The marked star’s distance from the centre'} value={formatDistance(R, deep)} />
        {!deep && <Readout label="How spread out the visible disc is" value={formatDistance(Rd, false)} />}
        <Readout label={deep ? 'v_c(R), with halo' : 'Its orbital speed'} value={formatSpeed(readout.withHalo)} />
        <Readout label={deep ? 'v_disc(R), no halo' : 'Its speed from visible matter alone'} value={formatSpeed(readout.visibleOnly)} />
        <Readout label={deep ? 'Orbital period' : 'One orbit takes'} value={formatPeriod(readout.period)} />
        <Readout label={deep ? 'M_disc(<R)' : 'Visible mass inside its orbit'} value={formatMass(readout.visibleMass)} />
        <Readout label={deep ? 'M_disc(<R) + M_halo(<R)' : 'Total mass inside its orbit'} value={formatMass(readout.totalMass)} />
        <Readout label={deep ? 'M_halo / M_disc inside R' : 'Dark to visible, inside its orbit'} value={formatRatio(readout.darkToVisible)} />
      </dl>

      <p className="font-ui text-[0.7rem] text-ink-faint">
        {reduced ? (
          <>
            Animation disabled by your reduced-motion setting. Each star trails a streak as long as the distance it
            travels in 20 million years. The marked star and the hollow ring started together; they are drawn where
            they are 100 million years later.
          </>
        ) : (
          <>
            Time is sped up: one second here is 25 million years, at every setting. The bright star and the hollow
            ring start together each time you move a slider; the ring moves at the speed visible matter alone would
            give.
          </>
        )}
      </p>
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
  drawFrame,
  modelFor,
  formatSpeed,
  formatMass,
  formatPeriod,
  formatDistance,
  formatRatio,
  R_VIEW,
  REAL_SECONDS_PER_SCREEN_SECOND,
  STATIC_TIME,
};

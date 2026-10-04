/**
 * Tides — Earth from above its North Pole, the Moon's and Sun's stretch, and
 * the water's height at one coastal point over two days.
 *
 * Top panel: Earth, with its ocean drawn far too deep and its equilibrium tide
 * exaggerated by `EXAGGERATION`, both stated on screen. Arrows round the coast
 * show the tidal acceleration, the exact difference between the Moon's and
 * Sun's pull there and on Earth's centre: out along the line to the Moon, in
 * across it. The Moon sits on a schematic orbit at the phase angle (distances
 * not to scale); the Sun is far off the canvas, so an arrow at the edge points
 * to it. A dot on the coast at the chosen latitude turns with Earth.
 *
 * Bottom panel: the water's height at the dot over two lunar days, with a
 * cursor at the moment drawn above.
 *
 * No physics lives in this file. Every height, range, acceleration and period
 * comes from `@/physics/tides`: the water outline, the trace, the arrows and
 * every readout read the same functions.
 *
 * Motion: one second on screen is two hours, at every setting and frame rate
 * (real elapsed time; gaps over a second are skipped). The Moon's phase is held
 * at the slider's value while Earth turns. Painting happens once per animation
 * frame, and the moving readout is written at most ten times a second. Under
 * reduced motion there is no loop: the dot is drawn at the first high tide.
 */
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { canvasSize, observeCanvasSize } from './canvasSize';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { AU, D_MOON, G_STANDARD, M_MOON, M_SUN, R_EARTH, TIDE_DRAW_EXAGGERATION } from '@/physics/constants';
import {
  equilibriumCrest,
  equilibriumRange,
  heightAt,
  highTideHeight,
  lunarDay,
  semidiurnalPeriod,
  springNeap,
  tidalAccelerationAt,
  nearSideTide,
  type TideState,
} from '@/physics/tides';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { labelBox, overlaps, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const DEG = Math.PI / 180;

function formatSig3(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return SIG3.format(Number(value.toPrecision(3)));
}

/** A height in m: centimetres below a metre, words at the beginner tiers. */
function formatHeight(h: number, deep: boolean): string {
  if (!Number.isFinite(h)) return '—';
  if (Math.abs(h) < 1) return deep ? `${formatSig3(h * 100)} cm` : `${formatSig3(h * 100)} centimetres`;
  return deep ? `${formatSig3(h)} m` : `${formatSig3(h)} metres`;
}

/** A tidal acceleration, m/s²: as ten-millionths of Earth's gravity at the beginner tiers. */
function formatTidalAcceleration(a: number, deep: boolean): string {
  if (!Number.isFinite(a)) return '—';
  if (deep) {
    const exp = Math.floor(Math.log10(a));
    const mant = a / 10 ** exp;
    const sup = String(exp).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]!);
    return `${mant.toFixed(2)} × 10${sup} m/s²`;
  }
  return `${formatSig3((a / G_STANDARD) * 1e7)} ten-millionths of Earth’s gravity`;
}

/** A duration in s, as hours and minutes. */
function formatDuration(s: number, deep: boolean): string {
  if (!Number.isFinite(s)) return '—';
  const totalMin = Math.round(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return deep ? `${h} h ${m} min` : `${h} hours ${m} minutes`;
}

/** The Moon's phase, named from the Sun–Earth–Moon angle. */
function phaseName(phase: number): string {
  const deg = ((phase / DEG) % 360 + 360) % 360;
  const names = [
    'new Moon',
    'waxing crescent',
    'first quarter',
    'waxing gibbous',
    'full Moon',
    'waning gibbous',
    'last quarter',
    'waning crescent',
  ];
  return names[Math.round(deg / 45) % 8]!;
}

/**
 * Spring, neap or between, from the range itself: within the top fifth of the
 * span from neap range to spring range is "spring tides", within the bottom
 * fifth "neap tides". The same `equilibriumRange` as the readout's.
 */
function tideKind(s: TideState): 'spring' | 'neap' | 'between' {
  const { spring, neap } = springNeap(s);
  const r = equilibriumRange(s);
  if (spring - neap < 1e-12) return 'between';
  const f = (r - neap) / (spring - neap);
  return f >= 0.8 ? 'spring' : f <= 0.2 ? 'neap' : 'between';
}

const KIND_TEXT = { spring: 'spring tides', neap: 'neap tides', between: 'between spring and neap' } as const;

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

/** Water heights are drawn this many times too large; stated on screen and in the module. */
const EXAGGERATION = TIDE_DRAW_EXAGGERATION;
/** "two million", for the label and the notes. */
const EXAGGERATION_WORDS = `${['', 'one', 'two', 'three', 'four', 'five'][EXAGGERATION / 1e6] ?? EXAGGERATION / 1e6} million`;
/**
 * The ocean's drawn depth, as a fraction of Earth's drawn radius: far too deep,
 * so that the lowest low anywhere on the sliders (0.91 m below the undisturbed
 * level, Moon at 0.6 times its distance, spring tide), exaggerated to 0.29 of
 * the radius, still sits above the rock.
 */
const OCEAN_DEPTH = 0.32;
/** Arrows: the Moon's stretch at today's distance is drawn this fraction of Earth's drawn radius long. */
const ARROW_REF = 0.3;
const ARROW_POINTS = 16;
/** One second on screen is this many seconds of real time: two hours, at every setting. */
const REAL_SECONDS_PER_SCREEN_SECOND = 7200;
/** The trace covers two lunar days. */
const TRACE_DAYS = 2;
const TRACE_SAMPLES = 240;

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#858ea2',
  edge: '#232b3b',
  land: '#2a3446',
  water: 'rgba(90,150,230,0.55)',
  waterEdge: '#7fb2f0',
  arrow: '#e8bd7d',
  moon: '#cfd6e4',
  sun: '#f6c35c',
  dot: '#f08c78',
  trace: '#7fb2f0',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;
const PAD = { left: 12, right: 12 };
const TOP_STRIP = 34;
const TRACE_HEIGHT = 128;

type Units = 'friendly' | 'technical';

interface View {
  /** Sun–Earth–Moon angle, rad. */
  phase: number;
  /** Moon distance, m. */
  dMoon: number;
  /** Coastal point latitude, rad. */
  lat: number;
  /** Real time elapsed since the dot's first high tide, s. */
  t: number;
  units: Units;
}

export interface Layout {
  labels: LabelBox[];
  /** The area the Earth, Moon and arrows are drawn in. */
  plot: LabelBox;
  /** The trace's plot area. */
  trace: LabelBox;
}

/** The two bodies' crests and the sliders, as the physics module takes them. */
function stateFor(view: Pick<View, 'phase' | 'dMoon' | 'lat'>): TideState {
  return {
    phase: view.phase,
    lat: view.lat,
    lunar: equilibriumCrest(M_MOON, view.dMoon),
    solar: equilibriumCrest(M_SUN, AU),
  };
}

/** The dot's longitude angle at time t: it starts under the Moon and turns once a lunar day. */
function dotAngle(view: Pick<View, 'phase' | 'dMoon' | 't'>): number {
  return view.phase + (TAU * view.t) / lunarDay(view.dMoon);
}

/**
 * The trace's samples: the dot's height over two lunar days, from `heightAt`,
 * the function the water outline and the readouts use. Kept for the last
 * settings, since the loop redraws the same trace every frame.
 */
let traceKey = '';
let traceCache: number[] = [];
function traceSamples(view: Pick<View, 'phase' | 'dMoon' | 'lat'>): number[] {
  const key = `${view.phase}|${view.dMoon}|${view.lat}`;
  if (key === traceKey) return traceCache;
  const s = stateFor(view);
  const day = lunarDay(view.dMoon);
  traceCache = Array.from({ length: TRACE_SAMPLES + 1 }, (_, i) =>
    heightAt(dotAngle({ ...view, t: (i / TRACE_SAMPLES) * TRACE_DAYS * day }), s),
  );
  traceKey = key;
  return traceCache;
}

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

function placeFirstOf(
  ctx: CanvasRenderingContext2D,
  texts: string[],
  spots: { x: number; y: number; align: CanvasTextAlign }[],
  bounds: LabelBox,
  layout: Layout,
): boolean {
  const font = ctx.font;
  for (const text of texts) {
    for (const spot of spots) {
      const box = labelBox(ctx, text, spot.x, spot.y, spot.align, font);
      const inside = box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
      if (!inside || layout.labels.some((o) => overlaps(box, o, 2))) continue;
      placeText(ctx, text, spot.x, spot.y, spot.align, layout);
      return true;
    }
  }
  return false;
}

/** Screen geometry of the top panel. */
function geometry(w: number, h: number) {
  const plot: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: TOP_STRIP, y1: h - TRACE_HEIGHT };
  const cx = (plot.x0 + plot.x1) / 2;
  const cy = (plot.y0 + plot.y1) / 2;
  const half = Math.min(plot.x1 - plot.x0, plot.y1 - plot.y0) / 2;
  const R = Math.max(8, half * 0.3);
  /** The Moon's drawn radius: its true size against Earth's, 0.27. */
  const moonR = Math.max(3, R * 0.27);
  /** The Moon's drawn orbit: from 2.3 R at the slider's nearest to the plot's edge, less the Moon, at its farthest. */
  const orbitAt = (dMoon: number) => {
    const f = Math.max(0, Math.min(1, (dMoon / D_MOON - 0.6) / 1.4));
    return R * 2.3 + f * Math.max(0, half - moonR - 4 - R * 2.3);
  };
  return { plot, cx, cy, half, R, moonR, orbitAt };
}

/**
 * Physics angle (Sun at 0, counter-clockwise seen from above the pole) to
 * screen, turned half a turn so the Sun is to the left: (−cos a, −sin a) in
 * y-up coordinates, so y-down screen gets (−cos a, +sin a). Counter-clockwise
 * stays counter-clockwise on screen.
 */
function toScreen(cx: number, cy: number, angle: number, r: number): [number, number] {
  return [cx - r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size; returns
 * where it put every label and the two plot areas.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): Layout {
  const { plot, cx, cy, R, moonR, orbitAt } = geometry(w, h);
  const trace: LabelBox = { x0: PAD.left + 30, x1: w - PAD.right - 4, y0: h - TRACE_HEIGHT + 30, y1: h - 22 };
  const layout: Layout = { labels: [], plot, trace };
  ctx.clearRect(0, 0, w, h);
  if (w <= PAD.left + PAD.right + 80 || plot.y1 - plot.y0 < 60) return layout;

  const deep = view.units === 'technical';
  const s = stateFor(view);
  const ocean = R * OCEAN_DEPTH;
  const pxPerMetre = (R / R_EARTH) * EXAGGERATION;

  ctx.save();
  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';

  /* The Moon's schematic orbit and the Moon at the phase angle. */
  const orbit = orbitAt(view.dMoon);
  ctx.strokeStyle = COLORS.edge;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, orbit, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  const [mx, my] = toScreen(cx, cy, view.phase, orbit);
  ctx.fillStyle = COLORS.moon;
  ctx.beginPath();
  ctx.arc(mx, my, moonR, 0, TAU);
  ctx.fill();

  /* The Sun is far off to the left: an arrow at the plot's edge, on Earth's level. */
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath();
  ctx.moveTo(plot.x0 + 2, cy);
  ctx.lineTo(plot.x0 + 12, cy - 6);
  ctx.lineTo(plot.x0 + 12, cy + 6);
  ctx.closePath();
  ctx.fill();

  /* The ocean, its height from `heightAt` on the equator, exaggerated. */
  const equator = { ...s, lat: 0 };
  ctx.beginPath();
  const N = 180;
  for (let i = 0; i <= N; i += 1) {
    const lambda = (i / N) * TAU;
    const r = R + ocean + heightAt(lambda, equator) * pxPerMetre;
    const [x, y] = toScreen(cx, cy, lambda, r);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = COLORS.water;
  ctx.fill();
  ctx.strokeStyle = COLORS.waterEdge;
  ctx.stroke();

  /* The solid Earth, and the dot's latitude circle. */
  ctx.fillStyle = COLORS.land;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  const rDot = R * Math.cos(view.lat);
  if (view.lat > 0.01) {
    ctx.strokeStyle = COLORS.edge;
    ctx.beginPath();
    ctx.arc(cx, cy, rDot, 0, TAU);
    ctx.stroke();
  }

  /* The tidal acceleration round the coast, Moon and Sun together, exact; one path. */
  const aRef = nearSideTide(M_MOON, D_MOON);
  const arrowScale = (ARROW_REF * R) / aRef;
  const [moonX, moonY] = [view.dMoon * Math.cos(view.phase), view.dMoon * Math.sin(view.phase)];
  ctx.strokeStyle = COLORS.arrow;
  ctx.fillStyle = COLORS.arrow;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const heads: [number, number, number, number][] = [];
  for (let k = 0; k < ARROW_POINTS; k += 1) {
    const lambda = (k / ARROW_POINTS) * TAU;
    const px = R_EARTH * Math.cos(lambda);
    const py = R_EARTH * Math.sin(lambda);
    const [amx, amy] = tidalAccelerationAt(px, py, moonX, moonY, M_MOON);
    const [asx, asy] = tidalAccelerationAt(px, py, AU, 0, M_SUN);
    const ax = (amx + asx) * arrowScale;
    const ay = (amy + asy) * arrowScale;
    const [bx, by] = toScreen(cx, cy, lambda, R + ocean * 0.5);
    // Screen direction of (ax, ay): the same mapping as toScreen, without the centre.
    const ex = bx - ax;
    const ey = by + ay;
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    heads.push([bx, by, ex, ey]);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [bx, by, ex, ey] of heads) {
    const len = Math.hypot(ex - bx, ey - by);
    if (len < 4) continue;
    const ux = (ex - bx) / len;
    const uy = (ey - by) / len;
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - ux * 4 - uy * 2.5, ey - uy * 4 + ux * 2.5);
    ctx.lineTo(ex - ux * 4 + uy * 2.5, ey - uy * 4 - ux * 2.5);
    ctx.closePath();
  }
  ctx.fill();

  /* The coastal dot, turning with Earth. */
  const lambdaDot = dotAngle(view);
  const [dx, dy] = toScreen(cx, cy, lambdaDot, rDot);
  ctx.fillStyle = COLORS.dot;
  ctx.beginPath();
  ctx.arc(dx, dy, 4, 0, TAU);
  ctx.fill();

  /* The top strip. */
  const top: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: 2, y1: TOP_STRIP - 2 };
  ctx.fillStyle = COLORS.inkDim;
  placeFirstOf(
    ctx,
    [deep ? 'Above the North Pole; Sun to the left' : 'Earth from above the North Pole, Sun to the left', 'From above the North Pole'],
    [{ x: PAD.left, y: 13, align: 'left' }],
    top,
    layout,
  );
  ctx.fillStyle = COLORS.ink;
  placeFirstOf(
    ctx,
    [
      deep ? `water heights × ${EXAGGERATION_WORDS}` : `water heights drawn ${EXAGGERATION_WORDS} times too big`,
      `heights × ${EXAGGERATION_WORDS}`,
    ],
    [
      { x: w - PAD.right, y: 13, align: 'right' },
      { x: w - PAD.right, y: 28, align: 'right' },
      { x: PAD.left, y: 28, align: 'left' },
    ],
    top,
    layout,
  );

  /* The trace: the dot's height over two lunar days, from the same `heightAt`. */
  drawTrace(ctx, w, h, view, layout);
  ctx.restore();
  return layout;
}

function drawTrace(ctx: CanvasRenderingContext2D, w: number, h: number, view: View, layout: Layout): void {
  const deep = view.units === 'technical';
  const { trace } = layout;
  if (trace.y1 - trace.y0 < 30 || trace.x1 - trace.x0 < 60) return;
  const samples = traceSamples(view);
  const day = lunarDay(view.dMoon);
  const span = Math.max(0.05, ...samples.map(Math.abs));
  const yOf = (v: number) => (trace.y0 + trace.y1) / 2 - (v / span) * ((trace.y1 - trace.y0) / 2);
  const xOf = (i: number) => trace.x0 + (i / TRACE_SAMPLES) * (trace.x1 - trace.x0);

  ctx.strokeStyle = COLORS.edge;
  ctx.beginPath();
  ctx.moveTo(trace.x0, trace.y0);
  ctx.lineTo(trace.x0, trace.y1);
  ctx.moveTo(trace.x0, yOf(0));
  ctx.lineTo(trace.x1, yOf(0));
  ctx.stroke();

  ctx.strokeStyle = COLORS.trace;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  samples.forEach((v, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v))));
  ctx.stroke();
  ctx.lineWidth = 1;

  /* The moment drawn above. */
  const frac = ((view.t / (TRACE_DAYS * day)) % 1 + 1) % 1;
  const xNow = trace.x0 + frac * (trace.x1 - trace.x0);
  ctx.strokeStyle = COLORS.dot;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xNow, trace.y0);
  ctx.lineTo(xNow, trace.y1);
  ctx.stroke();
  ctx.setLineDash([]);

  /* Labels: the panel's title, the height scale, and hours along the bottom. */
  ctx.font = FONT;
  ctx.fillStyle = COLORS.inkDim;
  const strip: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: h - TRACE_HEIGHT + 2, y1: trace.y0 - 2 };
  placeFirstOf(
    ctx,
    [
      deep ? 'Height at the dot (cm) over two lunar days (h)' : 'Water height at the red dot, in centimetres, over two days in hours',
      deep ? 'Height at the dot (cm), time (h)' : 'Height at the red dot, centimetres; hours',
      'Height (cm), time (h)',
    ],
    [{ x: PAD.left, y: h - TRACE_HEIGHT + 16, align: 'left' }],
    strip,
    layout,
  );
  ctx.fillStyle = COLORS.inkFaint;
  const left: LabelBox = { x0: 0, x1: trace.x0 - 2, y0: trace.y0 - 8, y1: trace.y1 + 8 };
  for (const v of [span, -span]) {
    placeFirstOf(
      ctx,
      [deep ? `${v > 0 ? '+' : '−'}${formatSig3(Math.abs(v * 100))} cm` : `${v > 0 ? '+' : '−'}${formatSig3(Math.abs(v * 100))}`],
      [{ x: trace.x0 - 4, y: yOf(v) + (v > 0 ? 8 : 0), align: 'right' }],
      left,
      layout,
    );
  }
  const bottom: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: trace.y1 + 2, y1: h - 1 };
  const hours = (TRACE_DAYS * day) / 3600;
  for (const hr of [0, 12, 24, 36, 48]) {
    if (hr > hours) continue;
    const x = trace.x0 + (hr / hours) * (trace.x1 - trace.x0);
    placeFirstOf(ctx, [String(hr)], [{ x, y: h - 9, align: 'center' }], bottom, layout);
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function TidesSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';
  const units: Units = deep ? 'technical' : 'friendly';

  const phase = readParam(params, values, 'phase');
  const dMoon = readParam(params, values, 'dMoon');
  const lat = readParam(params, values, 'lat');

  const loopRef = useRef<{ raf: number | null; last: number | null }>({ raf: null, last: null });
  const sceneRef = useRef<View & { still: boolean }>({ phase, dMoon, lat, t: 0, units, still: false });
  const requestPaintRef = useRef<() => void>(() => {});

  // Every number below comes from `@/physics/tides`, once per render.
  const readouts = useMemo(() => {
    const s = stateFor({ phase, dMoon, lat });
    const { spring, neap } = springNeap(s);
    const lunarA = nearSideTide(M_MOON, dMoon);
    const solarA = nearSideTide(M_SUN, AU);
    return {
      phaseName: phaseName(phase),
      kind: KIND_TEXT[tideKind(s)],
      lunarA,
      solarA,
      ratio: solarA / lunarA,
      range: equilibriumRange(s),
      spring,
      neap,
      high: highTideHeight(s),
      period: semidiurnalPeriod(dMoon),
    };
  }, [phase, dMoon, lat]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvasSize(canvas);
    if (rect.width === 0 || rect.height === 0) return;
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
    drawScene(ctx, rect.width, rect.height, sceneRef.current);
  }, []);

  /* Any change: the new settings, painted at the next frame. Time keeps running. */
  useEffect(() => {
    const scene = sceneRef.current;
    Object.assign(scene, { phase, dMoon, lat, units, still: reduced || typeof requestAnimationFrame === 'undefined' });
    if (scene.still) scene.t = 0;
    requestPaintRef.current();
  }, [phase, dMoon, lat, units, reduced]);

  /* The loop: one paint per frame, time from real elapsed time. */
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = loopRef.current;
    const frame = (now: number) => {
      loop.raf = null;
      const scene = sceneRef.current;
      if (!scene.still) {
        const dt = loop.last === null ? 0 : (now - loop.last) / 1000;
        if (dt <= 1) scene.t += dt * REAL_SECONDS_PER_SCREEN_SECOND;
        loop.last = now;
      } else {
        loop.last = null;
      }
      paint();
      if (!scene.still) loop.raf = requestAnimationFrame(frame);
    };
    requestPaintRef.current = () => {
      if (loop.raf === null) loop.raf = requestAnimationFrame(frame);
    };
    requestPaintRef.current();
    return () => {
      if (loop.raf !== null) cancelAnimationFrame(loop.raf);
      loop.raf = null;
      requestPaintRef.current = () => {};
    };
  }, [paint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return observeCanvasSize(canvas, () => requestPaintRef.current());
  }, []);

  return (
    <div className="flex min-h-[30rem] flex-col gap-4">
      <div className="relative h-[30rem] w-full sm:h-[34rem]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Earth seen from above the North Pole with the Sun off to the left and the Moon on a dotted orbit. A blue ocean layer, its heights hugely exaggerated, bulges toward the Moon and away from it, and arrows round the coast point outward along the Moon's line and inward across it. A red dot on the coast turns with Earth; below, a trace of the water's height at the dot rises and falls twice a day."
          aria-describedby="tides-readouts"
        />
      </div>

      <dl id="tides-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Phase' : 'The Moon’s phase'} value={`${readouts.phaseName}: ${readouts.kind}`} />
        <Readout label={deep ? 'Lunar tidal acceleration, sub-Moon point' : 'The Moon’s stretch, under the Moon'} value={formatTidalAcceleration(readouts.lunarA, deep)} />
        <Readout label={deep ? 'Solar tidal acceleration, sub-Sun point' : 'The Sun’s stretch, under the Sun'} value={formatTidalAcceleration(readouts.solarA, deep)} />
        <Readout label={deep ? 'Solar / lunar' : 'The Sun’s stretch against the Moon’s'} value={formatSig3(readouts.ratio)} />
        <Readout label={deep ? 'Range at the dot (high − low)' : 'Rise and fall at the dot, high to low'} value={formatHeight(readouts.range, deep)} />
        <Readout
          label={deep ? 'Spring / neap range at the dot' : 'At spring tides, and at neap tides'}
          value={`${formatHeight(readouts.spring, deep)} · ${formatHeight(readouts.neap, deep)}`}
        />
        <Readout label={deep ? 'High water at the dot, above undisturbed' : 'Highest water at the dot, above its level with no Moon or Sun'} value={formatHeight(readouts.high, deep)} />
        <Readout label={deep ? 'Between high tides' : 'Time between high tides'} value={formatDuration(readouts.period, deep)} />
      </dl>

      <p className="font-ui text-[0.7rem] text-ink-faint">
        {reduced ? (
          <>
            Animation disabled by your reduced-motion setting: the red dot is drawn at its first high tide, marked on
            the trace below. The water is the equilibrium tide for the Moon and Sun together, its heights drawn{' '}
            {EXAGGERATION_WORDS} times too big.
          </>
        ) : (
          <>
            Time is sped up: one second here is two hours, at every setting. The Moon’s phase is held at the slider’s
            value while Earth turns. The water is the equilibrium tide for the Moon and Sun together, its heights drawn{' '}
            {EXAGGERATION_WORDS} times too big.
          </>
        )}
      </p>
    </div>
  );
}

const Readout = memo(function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-ui text-xs text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums text-ember">{value}</dd>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Test surface                                                        */
/* ------------------------------------------------------------------ */

/**
 * Internals exposed for `tests/canvas.test.ts`, and for nothing else — the same
 * deliberately ugly name the other sims use.
 */
export const __internals = {
  drawScene,
  traceSamples,
  phaseName,
  tideKind,
  stateFor,
  formatHeight,
  formatTidalAcceleration,
  formatDuration,
  geometry,
  EXAGGERATION,
  REAL_SECONDS_PER_SCREEN_SECOND,
};

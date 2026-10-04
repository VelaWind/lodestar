/**
 * Galaxies — two galaxies passing each other, in the style of Toomre & Toomre
 * (1972), seen from above the plane of their orbit.
 *
 * The main panel replays one encounter from `@/physics/galaxies`: two softened
 * point masses on a parabolic orbit, each carrying a disc of massless test
 * stars. The view follows the main galaxy's core, at a fixed scale for the
 * current settings, so its disc stays put and whatever is pulled out of it is
 * visible as it goes. The companion's whole path is drawn faintly, with a tick
 * at closest approach. A strip above names the moment shown; a strip below
 * carries the scale bar. Stars are drawn only inside the plot, so the strips'
 * words never sit on a star.
 *
 * No physics lives in this file. The picture, the time caption and every
 * readout read the same stored encounter: positions, the tail fraction, the
 * closest approach and its speed and time.
 *
 * Motion: simulated time runs at one fixed rate, 50 million years for each
 * second on screen, at every setting and frame rate (real elapsed time; only
 * gaps over a second are skipped). At the end the replay holds for a moment,
 * then starts again. Painting happens once per animation frame. A slider change
 * keeps the moment being shown, so a tilt can be compared at the same instant.
 * While a slider is moving the encounter is recomputed with fewer stars, and in
 * full once it has been still for a fifth of a second. Under reduced motion
 * there is no loop: the run's last moment is drawn, 300 Myr after closest
 * approach, tails near their longest. When the companion is outside the plot an
 * arrow at the edge points to it.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { canvasSize, observeCanvasSize } from './canvasSize';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { GALAXY_DISC_RADIUS, GALAXY_MAIN_MASS, JULIAN_YEAR, KILOPARSEC, LIGHT_YEAR } from '@/physics/constants';
import {
  COMPANION_STARS,
  MAIN_STARS,
  encounterSteps,
  endTime,
  simulateEncounter,
  stepAt,
  type Encounter,
  type EncounterSettings,
} from '@/physics/galaxies';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { labelBox, overlaps, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const MYR = 1e6 * JULIAN_YEAR;

function formatSig3(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return SIG3.format(Number(value.toPrecision(3)));
}

/** A distance, m: kpc at the Deep tier, light-years in words at the others. */
function formatDistance(R: number, deep: boolean): string {
  if (!Number.isFinite(R)) return '—';
  if (deep) return `${formatSig3(R / KILOPARSEC)} kpc`;
  return `about ${formatSig3(R / LIGHT_YEAR)} light-years`;
}

/** A speed, m/s: km/s at the Deep tier, written out at the others. */
function formatSpeed(v: number, deep: boolean): string {
  if (!Number.isFinite(v)) return '—';
  return deep ? `${formatSig3(v / 1e3)} km/s` : `${formatSig3(v / 1e3)} kilometres a second`;
}

/** Time from closest approach, s, as "N million years after" or "before". */
const INTEGER = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

function formatSincePeri(dt: number, deep: boolean): string {
  if (!Number.isFinite(dt)) return '—';
  const myr = Math.round(dt / MYR);
  const size = INTEGER.format(Math.abs(myr));
  if (deep) return `${myr > 0 ? '+' : myr < 0 ? '−' : ''}${size} Myr`;
  if (myr === 0) return 'at closest approach';
  return `${size} million years ${myr > 0 ? 'after' : 'before'}`;
}

/** A fraction, as a whole percentage. */
function formatPercent(f: number): string {
  if (!Number.isFinite(f)) return '—';
  return `${Math.round(f * 100)}%`;
}

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

/** Simulated time per second on screen, s: 50 million years, at every setting. */
const SIM_SECONDS_PER_SCREEN_SECOND = 50 * MYR;
/** How long the replay holds on its last moment before starting again, s of real time. */
const END_HOLD = 2.5;
/** A slider still for this long, ms, gets the full star count. */
const SETTLE_MS = 200;
/**
 * The draft's budget, in star-steps: while a slider moves, the encounter is
 * recomputed with only as many stars as keep steps × stars under this, so a
 * drag stays smooth on a slow phone even for the longest runs.
 */
const DRAFT_BUDGET = 100_000;

/** Stars for a draft of these settings: in proportion, main to companion, and at least a sixth of each. */
function draftCounts(settings: EncounterSettings): { nMain: number; nComp: number } {
  const steps = encounterSteps(settings);
  const share = Math.min(1, DRAFT_BUDGET / (steps * (MAIN_STARS + COMPANION_STARS)));
  return {
    nMain: Math.max(Math.round(MAIN_STARS / 6), Math.round(MAIN_STARS * share)),
    nComp: Math.max(Math.round(COMPANION_STARS / 6), Math.round(COMPANION_STARS * share)),
  };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#858ea2',
  edge: '#232b3b',
  main: '#c9d6ff',
  companion: '#f0b98a',
  core: '#ffffff',
  path: 'rgba(240,185,138,0.45)',
};

const FONT = '10px Inter, system-ui, -apple-system, sans-serif';
const TAU = 2 * Math.PI;
const PAD = { left: 12, right: 12 };
/** The strips above and below the plot, px. */
const TOP_STRIP = 34;
const BOTTOM_STRIP = 24;

type Units = 'friendly' | 'technical';

interface View {
  enc: Encounter;
  /** Simulated time shown, s from closest approach. */
  t: number;
  units: Units;
}

/** What `drawScene` placed: every label box, and the area stars may be drawn in. */
export interface Layout {
  labels: LabelBox[];
  plot: LabelBox;
}

/** Half the plot's height, m: the view always reaches past the disc and past closest approach. */
function viewHalfHeight(rp: number): number {
  // At every setting the companion ends 41–57 kpc from the main core with a disc
  // of up to 15 kpc: 72 kpc keeps all of it in view at the end. Before then,
  // when the run starts outside the view, an arrow points to it.
  return Math.max(4.8 * GALAXY_DISC_RADIUS, 1.9 * rp);
}

/** Interpolated star or core coordinate between the stored states either side of t. */
function frameAt(enc: Encounter, t: number): { i: number; f: number } {
  const u = Math.max(0, Math.min(enc.steps, (t - enc.t0) / enc.dt));
  const i = Math.min(enc.steps - 1, Math.floor(u));
  return { i: Math.max(0, i), f: Math.max(0, Math.min(1, u - Math.max(0, i))) };
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

/** The first text, longest first, at the first spot inside `bounds` clear of every placed label. */
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

/**
 * A small triangle just inside the plot's edge, on the line from (x0, y0) to
 * an off-plot point (x1, y1), pointing toward it. Null if the two coincide.
 */
function edgeArrow(x0: number, y0: number, x1: number, y1: number, plot: LabelBox) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const ux = dx / len;
  const uy = dy / len;
  const inset = 10;
  // How far along the ray the inset plot edge is reached.
  const tx = ux > 0 ? (plot.x1 - inset - x0) / ux : ux < 0 ? (plot.x0 + inset - x0) / ux : Infinity;
  const ty = uy > 0 ? (plot.y1 - inset - y0) / uy : uy < 0 ? (plot.y0 + inset - y0) / uy : Infinity;
  const s = Math.max(0, Math.min(tx, ty, len));
  const tipX = x0 + ux * s;
  const tipY = y0 + uy * s;
  const size = 7;
  return {
    tipX,
    tipY,
    leftX: tipX - ux * size - uy * size * 0.6,
    leftY: tipY - uy * size + ux * size * 0.6,
    rightX: tipX - ux * size + uy * size * 0.6,
    rightY: tipY - uy * size - ux * size * 0.6,
  };
}

/** A round scale-bar length, m, no wider than `maxMetres`. */
function scaleBarLength(maxMetres: number): number {
  const kpc = maxMetres / KILOPARSEC;
  const candidates = [100, 50, 20, 10, 5];
  return (candidates.find((c) => c <= kpc) ?? 5) * KILOPARSEC;
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size; returns
 * where it put every label and the plot area stars are confined to.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): Layout {
  const plot: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: TOP_STRIP, y1: h - BOTTOM_STRIP };
  const layout: Layout = { labels: [], plot };
  ctx.clearRect(0, 0, w, h);
  if (w <= PAD.left + PAD.right + 60 || plot.y1 - plot.y0 < 40) return layout;

  const { enc, t, units } = view;
  const deep = units === 'technical';
  const scale = (plot.y1 - plot.y0) / (2 * viewHalfHeight(enc.settings.rp));
  const cx = (plot.x0 + plot.x1) / 2;
  const cy = (plot.y0 + plot.y1) / 2;
  const { i, f } = frameAt(enc, t);
  const o0 = i * 6;
  const o1 = Math.min(enc.steps, i + 1) * 6;
  const lerp = (a: number, b: number) => a + (b - a) * f;
  const mx = lerp(enc.cores[o0]!, enc.cores[o1]!);
  const my = lerp(enc.cores[o0 + 1]!, enc.cores[o1 + 1]!);
  const sx = (x: number) => cx + (x - mx) * scale;
  // The orbit plane seen from above, its angular momentum toward the viewer: y up.
  const sy = (y: number) => cy - (y - my) * scale;
  const inPlot = (x: number, y: number) => x >= plot.x0 && x <= plot.x1 && y >= plot.y0 && y <= plot.y1;

  ctx.save();
  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';

  /* The companion's whole path relative to the main core, faint, and its closest point. */
  ctx.strokeStyle = COLORS.path;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  let started = false;
  const pathStride = Math.max(1, Math.floor(enc.steps / 120));
  for (let k = 0; k <= enc.steps; k += pathStride) {
    const o = k * 6;
    const px = cx + (enc.cores[o + 3]! - enc.cores[o]!) * scale;
    const py = cy - (enc.cores[o + 4]! - enc.cores[o + 1]!) * scale;
    if (!inPlot(px, py)) {
      started = false;
      continue;
    }
    if (started) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
    started = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const peri = stepAt(enc, enc.tPeri) * 6;
  const pxp = cx + (enc.cores[peri + 3]! - enc.cores[peri]!) * scale;
  const pyp = cy - (enc.cores[peri + 4]! - enc.cores[peri + 1]!) * scale;
  if (inPlot(pxp, pyp)) {
    ctx.fillStyle = COLORS.companion;
    ctx.fillRect(pxp - 1.5, pyp - 1.5, 3, 3);
  }

  /*
   * The stars, interpolated between stored states; only those inside the plot.
   * One path and one fill per galaxy: hundreds of separate fills, each with its
   * own style, were most of an idle frame's cost.
   */
  const N = enc.nStars;
  const b0 = i * N * 2;
  const b1 = Math.min(enc.steps, i + 1) * N * 2;
  const batches: [number, number, string, number][] = [
    [0, enc.nMain, COLORS.main, 0.85],
    [enc.nMain, N, COLORS.companion, 0.8],
  ];
  for (const [from, to, color, alpha] of batches) {
    if (to <= from) continue;
    ctx.beginPath();
    for (let s = from; s < to; s += 1) {
      const x = sx(lerp(enc.xy[b0 + s * 2]!, enc.xy[b1 + s * 2]!));
      const y = sy(lerp(enc.xy[b0 + s * 2 + 1]!, enc.xy[b1 + s * 2 + 1]!));
      if (inPlot(x, y)) ctx.rect(x - 0.9, y - 0.9, 1.8, 1.8);
    }
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* The two cores, sized by the cube root of their mass. */
  const coreR = (m: number) => 2.5 + 2.5 * Math.cbrt(m / GALAXY_MAIN_MASS);
  const cores: [number, number, number][] = [
    [sx(mx), sy(my), GALAXY_MAIN_MASS],
    [
      sx(lerp(enc.cores[o0 + 3]!, enc.cores[o1 + 3]!)),
      sy(lerp(enc.cores[o0 + 4]!, enc.cores[o1 + 4]!)),
      enc.settings.M2,
    ],
  ];
  for (const [x, y, m] of cores) {
    if (!(m > 0) || !inPlot(x, y)) continue;
    ctx.fillStyle = COLORS.core;
    ctx.beginPath();
    ctx.arc(x, y, coreR(m), 0, TAU);
    ctx.fill();
  }

  /* The companion out of view: an arrow at the plot's edge, pointing to it. */
  const [cx2, cy2, m2] = cores[1]!;
  if (m2 > 0 && !inPlot(cx2, cy2)) {
    const arrow = edgeArrow(cx, cy, cx2, cy2, plot);
    if (arrow) {
      ctx.fillStyle = COLORS.companion;
      ctx.beginPath();
      ctx.moveTo(arrow.tipX, arrow.tipY);
      ctx.lineTo(arrow.leftX, arrow.leftY);
      ctx.lineTo(arrow.rightX, arrow.rightY);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* The top strip: what is shown, and when, from the same encounter. */
  const top: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: 2, y1: TOP_STRIP - 2 };
  const since = formatSincePeri(t - enc.tPeri, deep);
  ctx.fillStyle = COLORS.inkDim;
  placeFirstOf(
    ctx,
    [deep ? 'Orbital plane, centred on the main galaxy' : 'Seen from above the orbit', deep ? 'Orbital plane' : 'From above'],
    [{ x: PAD.left, y: 13, align: 'left' }],
    top,
    layout,
  );
  ctx.fillStyle = COLORS.ink;
  const when = deep ? `t − t_p = ${since}` : since === 'at closest approach' ? since : `${since} closest approach`;
  placeFirstOf(
    ctx,
    [when, since],
    [
      { x: w - PAD.right, y: 13, align: 'right' },
      { x: w - PAD.right, y: 28, align: 'right' },
      { x: PAD.left, y: 28, align: 'left' },
    ],
    top,
    layout,
  );

  /* The bottom strip: a scale bar and its length. */
  const barLen = scaleBarLength(0.3 * (plot.x1 - plot.x0) / scale);
  const barPx = barLen * scale;
  const barY = h - BOTTOM_STRIP + 9;
  ctx.strokeStyle = COLORS.inkFaint;
  ctx.beginPath();
  ctx.moveTo(PAD.left, barY);
  ctx.lineTo(PAD.left + barPx, barY);
  ctx.moveTo(PAD.left, barY - 3);
  ctx.lineTo(PAD.left, barY + 3);
  ctx.moveTo(PAD.left + barPx, barY - 3);
  ctx.lineTo(PAD.left + barPx, barY + 3);
  ctx.stroke();
  ctx.fillStyle = COLORS.inkFaint;
  const bottom: LabelBox = { x0: PAD.left, x1: w - PAD.right, y0: h - BOTTOM_STRIP + 10, y1: h - 1 };
  placeFirstOf(
    ctx,
    deep
      ? [`${formatSig3(barLen / KILOPARSEC)} kpc`]
      : [`${formatSig3(barLen / LIGHT_YEAR)} light-years`, `${formatSig3(barLen / (1e3 * LIGHT_YEAR))} thousand ly`],
    [{ x: PAD.left, y: h - 3, align: 'left' }],
    bottom,
    layout,
  );

  ctx.restore();
  return layout;
}

/* ------------------------------------------------------------------ */
/* Hubble types: a static strip of sketches                            */
/* ------------------------------------------------------------------ */

/** Hubble's classes, drawn as sketches. `kind` picks the drawing; `label` is the class. */
const HUBBLE_TYPES: { label: string; name: string; kind: 'e' | 's0' | 's' | 'sb' | 'irr'; e?: number; arms?: number; bulge?: number }[] = [
  { label: 'E0', name: 'round elliptical', kind: 'e', e: 0 },
  { label: 'E4', name: 'elliptical', kind: 'e', e: 0.4 },
  { label: 'E7', name: 'flattened elliptical', kind: 'e', e: 0.7 },
  { label: 'S0', name: 'lenticular', kind: 's0' },
  { label: 'Sa', name: 'spiral, tight arms', kind: 's', arms: 0.6, bulge: 7 },
  { label: 'Sb', name: 'spiral', kind: 's', arms: 1, bulge: 5 },
  { label: 'Sc', name: 'spiral, open arms', kind: 's', arms: 1.5, bulge: 3 },
  { label: 'SBb', name: 'barred spiral', kind: 'sb', arms: 1, bulge: 4 },
  { label: 'Irr', name: 'irregular', kind: 'irr' },
];

/** One sketch, 48 × 40 user units. */
function HubbleSketch({ kind, e = 0, arms = 1, bulge = 4 }: (typeof HUBBLE_TYPES)[number]) {
  const glow = '#c9d6ff';
  if (kind === 'e') {
    return <ellipse cx={24} cy={20} rx={14} ry={14 * (1 - e)} fill={glow} opacity={0.75} />;
  }
  if (kind === 's0') {
    return (
      <g>
        <ellipse cx={24} cy={20} rx={20} ry={4} fill={glow} opacity={0.4} />
        <ellipse cx={24} cy={20} rx={7} ry={5} fill={glow} opacity={0.85} />
      </g>
    );
  }
  if (kind === 'irr') {
    return (
      <g fill={glow}>
        <ellipse cx={18} cy={18} rx={8} ry={6} opacity={0.6} />
        <ellipse cx={29} cy={23} rx={7} ry={5} opacity={0.5} />
        <circle cx={25} cy={13} r={3} opacity={0.7} />
        <circle cx={33} cy={15} r={2} opacity={0.6} />
      </g>
    );
  }
  // Spirals: two arms from the bulge (or the bar's ends), opening by `arms`.
  const bar = kind === 'sb';
  const startX = bar ? 9 : 2;
  const spread = 7 * arms;
  const arm = (sign: number) =>
    `M ${24 + sign * startX} 20 Q ${24 + sign * (startX + 10)} ${20 - sign * (4 + spread)} ${24 - sign * 4} ${20 - sign * (9 + spread * 0.6)}`;
  return (
    <g>
      <path d={arm(1)} stroke={glow} strokeWidth={2} fill="none" opacity={0.75} />
      <path d={arm(-1)} stroke={glow} strokeWidth={2} fill="none" opacity={0.75} />
      {bar && <rect x={15} y={18.5} width={18} height={3} rx={1.5} fill={glow} opacity={0.85} />}
      <circle cx={24} cy={20} r={bulge} fill={glow} opacity={0.9} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

/** The readouts that change as the replay runs, written straight to the DOM once per frame. */
interface LiveReadouts {
  since: HTMLElement | null;
  tail: HTMLElement | null;
  rPeri: HTMLElement | null;
  vPeri: HTMLElement | null;
}

export default function GalaxiesSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';
  const units: Units = deep ? 'technical' : 'friendly';

  const M2 = readParam(params, values, 'M2');
  const rp = readParam(params, values, 'rp');
  const tilt = readParam(params, values, 'tilt');

  const [playing, setPlaying] = useState(true);

  /** The loop's state: pending frame, a full paint owed, last frame time, a hold at the end. */
  const loopRef = useRef<{ raf: number | null; dirty: boolean; last: number | null; holdUntil: number | null }>({
    raf: null,
    dirty: true,
    last: null,
    holdUntil: null,
  });
  const requestPaintRef = useRef<() => void>(() => {});
  /** What is shown: the settings, the encounter computed for them, the moment, the mode. */
  const stateRef = useRef<{
    settings: EncounterSettings;
    enc: Encounter | null;
    draft: boolean;
    /** An integration the next frame owes: a quick draft, the full run, or none. */
    pending: 'draft' | 'full' | null;
    t: number | null;
    playing: boolean;
    still: boolean;
    units: Units;
    deep: boolean;
  }>({ settings: { M2, rp, tilt }, enc: null, draft: false, pending: 'full', t: null, playing: true, still: false, units, deep });
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRef = useRef(true);
  const liveRef = useRef<LiveReadouts>({ since: null, tail: null, rPeri: null, vPeri: null });
  const shownRef = useRef<Record<string, string>>({});

  /** Writes a readout only when its text changes. */
  const write = useCallback((key: keyof LiveReadouts, text: string) => {
    const el = liveRef.current[key];
    if (!el || shownRef.current[key] === text) return;
    el.textContent = text;
    shownRef.current[key] = text;
  }, []);

  /** When the moving readouts were last written, ms (performance clock). */
  const lastWriteRef = useRef(-Infinity);

  /**
   * Paints the frame. The readouts that change as the replay runs are written
   * at most ten times a second, and always on a full repaint: rewriting DOM text
   * every frame forced a layout per frame, most of an idle frame's cost on a slow
   * phone. The canvas's own caption still changes every frame.
   */
  const paint = useCallback((full: boolean, now: number) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state.enc || state.t === null) return;
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
    const enc = state.enc;
    drawScene(ctx, rect.width, rect.height, { enc, t: state.t, units: state.units });
    if (!full && now - lastWriteRef.current < 100) return;
    lastWriteRef.current = now;
    // The readouts, from the same encounter and the same moment as the picture.
    write('since', formatSincePeri(state.t - enc.tPeri, state.deep));
    write('tail', formatPercent(enc.tail[stepAt(enc, state.t)]!));
    // The closest approach the slider sets, rounded as the scale bar is; the integrated orbit reaches it within 0.2%.
    write('rPeri', formatDistance(enc.settings.rp, state.deep));
    write('vPeri', formatSpeed(enc.vPeri, state.deep));
  }, [write]);

  /*
   * Settings or mode changed: ask the next frame for a draft (or, on the first
   * paint, the full run), and for the full run once the sliders have been still
   * for SETTLE_MS. The integration itself happens in the frame, so a drag that
   * fires several events in one frame integrates once.
   */
  useEffect(() => {
    const state = stateRef.current;
    state.settings = { M2, rp, tilt };
    state.still = reduced || typeof requestAnimationFrame === 'undefined';
    const requested = firstRef.current ? 'full' : 'draft';
    state.pending = requested;
    firstRef.current = false;
    requestPaintRef.current();
    if (settleRef.current) clearTimeout(settleRef.current);
    // Decided by what was asked for, not by `state.draft`, which the frame may not have computed yet.
    if (requested === 'draft') {
      settleRef.current = setTimeout(() => {
        stateRef.current.pending = 'full';
        requestPaintRef.current();
      }, SETTLE_MS);
    }
    return () => {
      if (settleRef.current) clearTimeout(settleRef.current);
    };
  }, [M2, rp, tilt, reduced]);

  /* A tier change repaints in its own words; the encounter is unchanged. */
  useEffect(() => {
    stateRef.current.units = units;
    stateRef.current.deep = deep;
    requestPaintRef.current();
  }, [units, deep]);

  useEffect(() => {
    stateRef.current.playing = playing;
    loopRef.current.last = null;
    requestPaintRef.current();
  }, [playing]);

  /* The loop: one paint per frame; time advances only while playing and not still. */
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = loopRef.current;
    const frame = (now: number) => {
      loop.raf = null;
      const state = stateRef.current;
      if (state.pending) {
        const draft = state.pending === 'draft';
        const counts = draft ? draftCounts(state.settings) : { nMain: MAIN_STARS, nComp: COMPANION_STARS };
        const next = simulateEncounter(state.settings, counts);
        state.enc = next;
        state.draft = draft && counts.nMain < MAIN_STARS;
        state.pending = null;
        // Keep the moment being shown, inside the new run; a still frame shows the end.
        if (state.still) state.t = endTime(next);
        else state.t = state.t === null ? next.t0 : Math.max(next.t0, Math.min(endTime(next), state.t));
        loop.dirty = true;
      }
      const enc = state.enc;
      if (!enc || state.t === null) return;
      const moving = !state.still && state.playing;
      if (moving) {
        const dt = loop.last === null ? 0 : (now - loop.last) / 1000;
        loop.last = now;
        if (loop.holdUntil !== null) {
          if (now >= loop.holdUntil) {
            loop.holdUntil = null;
            state.t = enc.t0;
          }
        } else if (dt <= 1) {
          state.t += dt * SIM_SECONDS_PER_SCREEN_SECOND;
          if (state.t >= endTime(enc)) {
            state.t = endTime(enc);
            loop.holdUntil = now + END_HOLD * 1000;
          }
        }
      } else {
        loop.last = null;
      }
      paint(loop.dirty, now);
      loop.dirty = false;
      if (moving) loop.raf = requestAnimationFrame(frame);
    };
    requestPaintRef.current = () => {
      loop.dirty = true;
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

  const restart = () => {
    const state = stateRef.current;
    if (!state.enc) return;
    state.t = state.enc.t0;
    loopRef.current.holdUntil = null;
    loopRef.current.last = null;
    setPlaying(true);
    requestPaintRef.current();
  };

  const ratio = M2 / GALAXY_MAIN_MASS;

  return (
    <div className="flex min-h-[26rem] flex-col gap-4">
      <div className="relative h-[26rem] w-full sm:h-[32rem]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Two galaxies passing each other, seen from above the plane of their orbit and centred on the main galaxy: a disc of pale blue stars around a bright core, and a smaller companion with orange stars that swings past along a faint dashed path. Depending on the tilt, the main disc is pulled out into long curved tails or barely disturbed."
          aria-describedby="galaxies-readouts"
        />
      </div>

      {!reduced && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="rounded border border-edge-soft px-3 py-1.5 font-ui text-sm text-ink hover:border-ember focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={restart}
            className="rounded border border-edge-soft px-3 py-1.5 font-ui text-sm text-ink hover:border-ember focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember"
          >
            Restart
          </button>
        </div>
      )}

      <dl id="galaxies-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label={deep ? 'Closest approach, r_p' : 'Closest approach'} ddRef={(el) => (liveRef.current.rPeri = el)} />
        <Readout label={deep ? 'Relative speed at r_p' : 'Speed past each other there'} ddRef={(el) => (liveRef.current.vPeri = el)} />
        <Readout label={deep ? 'Time since closest approach' : 'Moment shown'} ddRef={(el) => (liveRef.current.since = el)} />
        <Readout
          label={deep ? 'Main-disc stars beyond 2 R_disc' : 'Main galaxy’s stars pulled far out (tails or onto the companion)'}
          ddRef={(el) => (liveRef.current.tail = el)}
        />
        <div>
          <dt className="font-ui text-xs text-ink-faint">{deep ? 'Mass ratio M₂/M₁' : 'Companion’s mass, against the main galaxy'}</dt>
          <dd className="mt-0.5 font-mono text-lg tabular-nums text-ember">
            {deep ? formatSig3(ratio) : `${formatSig3(ratio * 100)}%`}
          </dd>
        </div>
      </dl>

      <p className="font-ui text-[0.7rem] text-ink-faint">
        {reduced ? (
          <>
            Animation disabled by your reduced-motion setting: the encounter is drawn at its last moment, 300 million
            years after closest approach, with the tails near their longest. Pale blue stars belong to the main galaxy,
            orange ones to the companion; the dashed line is the companion’s path, and an orange arrow at the edge
            points to the companion when it is out of view.
          </>
        ) : (
          <>
            Time is sped up: one second here is 50 million years, at every setting. The replay holds at the end, then
            starts again. Pale blue stars belong to the main galaxy, orange ones to the companion; the dashed line is the
            companion’s path, and an orange arrow at the edge points to the companion when it is out of view. While a
            slider moves, fewer stars are drawn until it stops, and the tail percentage is approximate.
          </>
        )}
      </p>

      <HubbleStrip />
    </div>
  );
}

/** The static strip of Hubble types; memoised, so a slider drag never re-renders it. */
const HubbleStrip = memo(function HubbleStrip() {
  return (
    <figure className="border-t border-edge-soft pt-4">
      <ul className="flex flex-wrap gap-x-3 gap-y-2" aria-label="Hubble’s galaxy types, as sketches">
        {HUBBLE_TYPES.map((type) => (
          <li key={type.label} className="flex w-14 flex-col items-center">
            <svg viewBox="0 0 48 40" className="h-10 w-12" role="img" aria-label={`${type.label}: ${type.name}`}>
              <HubbleSketch {...type} />
            </svg>
            <span className="font-mono text-xs text-ink">{type.label}</span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-2 font-ui text-[0.7rem] text-ink-faint">
        Hubble’s types, as sketches rather than photographs: E for elliptical (the number grows with flattening), S0
        for lenticular, S for spiral (a to c, arms opening and the central bulge shrinking), SB for barred spiral, Irr
        for irregular.
      </figcaption>
    </figure>
  );
});

function Readout({ label, ddRef }: { label: string; ddRef: (el: HTMLElement | null) => void }) {
  return (
    <div>
      <dt className="font-ui text-xs text-ink-faint">{label}</dt>
      <dd ref={ddRef} className="mt-0.5 font-mono text-lg tabular-nums text-ember">
        —
      </dd>
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
  draftCounts,
  formatDistance,
  formatSpeed,
  formatSincePeri,
  formatPercent,
  viewHalfHeight,
  edgeArrow,
  SIM_SECONDS_PER_SCREEN_SECOND,
  DRAFT_BUDGET,
  HUBBLE_TYPES,
};

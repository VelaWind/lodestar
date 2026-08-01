/**
 * Kepler orbits — one planet, one star, one closed ellipse.
 *
 * Three things the picture has to make undeniable, because they are the three
 * laws: the path is an ellipse, the star sits at a *focus* rather than the
 * centre, and the planet moves fastest where it is closest. The first two are
 * geometry and fall out of drawing the orbit honestly. The third is the sweep
 * overlay: twelve wedges, each swept in exactly one twelfth of the period, all
 * of equal area and visibly different shape.
 *
 * No physics lives in this file. Every number comes from `@/physics/kepler`,
 * which the math layer also reads — per the physics-accuracy skill, the sim's
 * calculation and the displayed equation must be one shared function or they
 * will drift. This file owns pixels, playback timing, and formatting only.
 *
 * Rendering notes, matching the escape-velocity sim:
 *   - The rAF loop never touches React state. It advances `sceneRef.current.t`
 *     and draws. React re-renders only when a slider or the sweep toggle moves.
 *   - The one live readout that changes every frame (current speed) is written
 *     imperatively through a ref, for the same reason: sixty React renders a
 *     second to retype four characters would be absurd.
 *   - Under `prefers-reduced-motion` there is no loop at all: the ellipse is
 *     drawn once, statically, with the planet at periapsis and both apsides
 *     marked.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { AU, JULIAN_YEAR } from '@/physics/constants';
import {
  orbitGeometry,
  period,
  stateAt,
  visViva,
  type OrbitGeometry,
} from '@/physics/kepler';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const SPEED = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const COMPACT = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const DAY = 86_400; // s, exact by definition
const HOUR = 3_600;

/** Seconds → the largest natural time unit that keeps the number readable. */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 2 * HOUR) return `${SIG3.format(seconds / 60)} min`;
  if (seconds < 2 * DAY) return `${SIG3.format(seconds / HOUR)} hours`;
  if (seconds < 2 * JULIAN_YEAR) return `${SIG3.format(seconds / DAY)} days`;
  return `${SIG3.format(seconds / JULIAN_YEAR)} years`;
}

/** Metres → km below a hundredth of an AU, AU above it. */
function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  if (metres < AU / 100) return `${SIG3.format(metres / 1000)} km`;
  return `${SIG3.format(metres / AU)} AU`;
}

/** Speed in m/s → km/s, the natural unit for orbits. */
function formatSpeed(mps: number): string {
  if (!Number.isFinite(mps)) return '—';
  return `${SPEED.format(mps / 1000)} km/s`;
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

/** Wall-clock seconds for one full orbit, whatever the real period is. */
const ORBIT_SECONDS = 12;
/** Equal-time slices in the sweep overlay. Twelve reads as a clock face. */
const SWEEP_SLICES = 12;
/**
 * Samples per wedge arc. The wedges are drawn as polygons, so the chords cut
 * the corners of the real arc and each shaded area comes out slightly under the
 * true one — worse where the arc curves hardest, which is periapsis. At e = 0.97
 * (the slider's maximum, Halley's orbit) 24 samples leaves the twelve *drawn*
 * areas differing by 2.2%, which would make an equal-area figure visibly unequal
 * exactly where the reader goes looking. 96 brings that to 0.2%, matching what
 * e = 0.8 already had, for about a millisecond of work per slider move.
 */
const WEDGE_SAMPLES = 96;

const TAU = 2 * Math.PI;

interface Point {
  x: number;
  y: number;
}

interface Scene {
  M: number;
  a: number;
  e: number;
  /** Orbital period, s. */
  T: number;
  geom: OrbitGeometry;
  /** Simulated seconds since periapsis. */
  t: number;
  /** Simulated seconds per wall-clock second. */
  rate: number;
  /** Equal-time wedges in world coordinates, focus at the origin. */
  wedges: Point[][];
  sweep: boolean;
  /** No animation: draw the planet parked at periapsis. */
  frozen: boolean;
}

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#6b7488',
  edge: '#232b3b',
  star: '#9db4ff',
  ember: '#e8bd7d',
};

const PAD = { left: 18, right: 18, top: 26, bottom: 26 };

/**
 * The equal-time wedges, in world coordinates. Precomputed per parameter change
 * rather than per frame: they depend only on the orbit, not on the clock.
 */
function buildWedges(M: number, a: number, e: number, T: number): Point[][] {
  if (!(T > 0)) return [];
  const wedges: Point[][] = [];
  for (let slice = 0; slice < SWEEP_SLICES; slice += 1) {
    const arc: Point[] = [];
    for (let k = 0; k <= WEDGE_SAMPLES; k += 1) {
      const t = ((slice + k / WEDGE_SAMPLES) * T) / SWEEP_SLICES;
      const s = stateAt(M, a, e, t);
      arc.push({ x: s.x, y: s.y });
    }
    wedges.push(arc);
  }
  return wedges;
}

/**
 * Draws the whole scene. Pure function of `scene` plus the canvas size — the
 * animation loop calls this and nothing else.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene): void {
  const { geom } = scene;
  ctx.clearRect(0, 0, w, h);

  const plotLeft = PAD.left;
  const plotW = w - PAD.left - PAD.right;
  const plotTop = PAD.top;
  const plotH = h - PAD.top - PAD.bottom;
  if (plotW <= 0 || plotH <= 0 || !(geom.semiMajor > 0)) return;

  /* --- auto-scale: the ellipse always fills the frame ---
     Which is a real distortion across slider settings and is disclosed as one:
     a 0.007 AU orbit and a 67 AU orbit are drawn the same size. */
  const halfHeight = Math.max(geom.semiMinor, geom.semiMajor * 0.02);
  const scale = Math.min(plotW / (2 * geom.semiMajor), plotH / (2 * halfHeight)) * 0.9;
  if (!(scale > 0)) return;

  // The *ellipse* is centred in the frame, which puts the focus — and so the
  // star — visibly off-centre by a·e. That offset is the first law.
  const cx = plotLeft + plotW / 2;
  const cy = plotTop + plotH / 2;
  const X = (x: number) => cx + (x + geom.focusOffset) * scale;
  const Y = (y: number) => cy - y * scale;

  ctx.font = '11px Inter, system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';

  /* --- equal-time wedges --- */
  if (scene.sweep && scene.wedges.length > 0) {
    const current = scene.frozen
      ? -1
      : Math.min(
          SWEEP_SLICES - 1,
          Math.floor((scene.t / scene.T) * SWEEP_SLICES),
        );

    scene.wedges.forEach((arc, i) => {
      ctx.beginPath();
      ctx.moveTo(X(0), Y(0));
      for (const point of arc) ctx.lineTo(X(point.x), Y(point.y));
      ctx.closePath();
      ctx.fillStyle =
        i === current
          ? 'rgba(232,189,125,0.30)'
          : i % 2 === 0
            ? 'rgba(157,180,255,0.10)'
            : 'rgba(157,180,255,0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(157,180,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Longest caption that fits the frame. There is only one text line's worth
    // of room above the plot, so a caption too wide for a phone cannot wrap —
    // it drops to a shorter phrasing that still carries both facts.
    const captions = [
      'equal areas, equal times — each wedge is one twelfth of the period',
      'equal areas, equal times — a twelfth each',
      'equal areas, equal times',
    ];
    const caption =
      captions.find((text) => ctx.measureText(text).width <= plotW) ??
      captions[captions.length - 1]!;

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.inkFaint;
    ctx.fillText(caption, plotLeft, plotTop - 12);
  }

  /* --- the major axis, apsis to apsis --- */
  ctx.strokeStyle = 'rgba(107,116,136,0.20)';
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(X(-geom.apoapsis), Y(0));
  ctx.lineTo(X(geom.periapsis), Y(0));
  ctx.stroke();
  ctx.setLineDash([]);

  /* --- the orbit itself --- */
  ctx.strokeStyle = 'rgba(157,180,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, geom.semiMajor * scale, geom.semiMinor * scale, 0, 0, TAU);
  ctx.stroke();

  /* --- apsis markers --- */
  ctx.fillStyle = COLORS.inkFaint;
  for (const apsis of [
    { x: geom.periapsis, label: 'periapsis', align: 'left' as const, dx: 8 },
    { x: -geom.apoapsis, label: 'apoapsis', align: 'right' as const, dx: -8 },
  ]) {
    const px = X(apsis.x);
    ctx.beginPath();
    ctx.arc(px, Y(0), 2, 0, TAU);
    ctx.fill();

    // Each label sits outboard of its marker, which is where the room is on a
    // wide frame. The ellipse is auto-scaled to fill 90% of the plot, so on a
    // phone both markers sit within a few pixels of the frame edge and the
    // outboard label runs off it — flip inboard when it will not fit.
    const width = ctx.measureText(apsis.label).width;
    const fitsOutboard =
      apsis.align === 'left'
        ? px + apsis.dx + width <= plotLeft + plotW
        : px + apsis.dx - width >= plotLeft;

    ctx.textAlign = fitsOutboard ? apsis.align : apsis.align === 'left' ? 'right' : 'left';
    ctx.fillText(apsis.label, px + (fitsOutboard ? apsis.dx : -apsis.dx), Y(0) - 12);
  }

  /* --- the star, at the focus --- */
  const sx = X(0);
  const sy = Y(0);
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
  glow.addColorStop(0, 'rgba(157,180,255,0.55)');
  glow.addColorStop(1, 'rgba(157,180,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, 22, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx, sy, 5.5, 0, TAU);
  ctx.fillStyle = COLORS.star;
  ctx.fill();

  /* --- the planet --- */
  const now = stateAt(scene.M, scene.a, scene.e, scene.frozen ? 0 : scene.t);
  const px = X(now.x);
  const py = Y(now.y);

  ctx.strokeStyle = 'rgba(232,189,125,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(px, py);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, TAU);
  ctx.fillStyle = COLORS.ember;
  ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function KeplerOrbitsSim({ params, values }: SimProps) {
  const reduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const speedRef = useRef<HTMLSpanElement | null>(null);

  const M = readParam(params, values, 'M');
  const a = readParam(params, values, 'a');
  const e = readParam(params, values, 'e');

  const [sweep, setSweep] = useState(false);

  // Derived once per render, never per frame. The readouts below and the canvas
  // read these same values.
  const T = useMemo(() => period(M, a), [M, a]);
  const geom = useMemo(() => orbitGeometry(a, e), [a, e]);
  const rate = T / ORBIT_SECONDS;

  /** Paints the current scene at the canvas's current size. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;

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
    drawScene(ctx, rect.width, rect.height, scene);

    // The one per-frame readout, written straight to the DOM node so the
    // animation never re-renders the tree.
    const node = speedRef.current;
    if (node) {
      const state = stateAt(scene.M, scene.a, scene.e, scene.frozen ? 0 : scene.t);
      node.textContent = formatSpeed(state.speed);
    }
  }, []);

  /* Rebuild and restart whenever a parameter changes. A path drawn for one
     eccentricity while the slider says another is exactly the kind of quiet lie
     this project exists to avoid. */
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    sceneRef.current = {
      M,
      a,
      e,
      T,
      geom,
      t: 0,
      rate,
      wedges: buildWedges(M, a, e, T),
      sweep,
      frozen: Boolean(reduced),
    };
    paint();

    if (reduced || !(T > 0)) return;

    let last = performance.now();
    const tick = (now: number) => {
      const scene = sceneRef.current;
      if (!scene) return;
      // Clamped so a backgrounded tab does not resume with one enormous step.
      const dtWall = Math.min(0.1, (now - last) / 1000);
      last = now;
      scene.t = (scene.t + dtWall * scene.rate) % scene.T;
      paint();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // `sweep` is deliberately absent: toggling the overlay must not restart the
    // orbit. The effect below hands it to the live scene instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [M, a, e, T, geom, rate, reduced, paint]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.sweep = sweep;
    if (reduced) paint(); // no loop running to pick the change up
  }, [sweep, reduced, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  /* Never leave a loop running past unmount. */
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const periapsisSpeed = visViva(M, a, geom.periapsis);

  return (
    <div className="flex min-h-[20rem] flex-col gap-4">
      <div className="relative h-[24rem] w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-edge-soft pt-4">
        <dl className="flex flex-wrap gap-x-7 gap-y-2">
          <Readout label="period" value={formatDuration(T)} />
          <Readout label="periapsis" value={formatDistance(geom.periapsis)} />
          <Readout label="apoapsis" value={formatDistance(geom.apoapsis)} />
          <div>
            <dt className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
              {reduced ? 'speed at periapsis' : 'current speed'}
            </dt>
            <dd className="mt-0.5 font-mono text-lg tabular-nums text-ember">
              <span ref={speedRef}>{formatSpeed(periapsisSpeed)}</span>
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => setSweep((on) => !on)}
          aria-pressed={sweep}
          className={`shrink-0 rounded-md border px-4 py-1.5 font-ui text-xs transition-colors ${
            sweep
              ? 'border-star/60 bg-void-500 text-star'
              : 'border-edge bg-void-500 text-ink hover:border-star/50 hover:text-star'
          }`}
        >
          {/* Constant label, state carried by aria-pressed and the active
              styling: layer 4 sends the reader to "the sweep toggle", so the
              word has to be on the control whichever way it is set. */}
          Sweep equal areas
        </button>
      </div>

      {/* Playback speed is a property of the current orbit, not of the frame, so
          it belongs beside the readouts rather than painted on the canvas. */}
      <p className="font-ui text-[0.7rem] text-ink-faint">
        {reduced ? (
          <>Animation disabled by your reduced-motion setting; the orbit is drawn statically, planet at periapsis.</>
        ) : (
          <>
            Time-accelerated ×
            <span className="font-mono text-ember">{COMPACT.format(rate)}</span> — one orbit
            takes {ORBIT_SECONDS} seconds on screen, so one second here is{' '}
            {formatDuration(rate)} out there.
          </>
        )}
      </p>
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

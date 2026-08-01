/**
 * Black holes — the anatomy of a Schwarzschild hole, drawn from one number.
 *
 * A non-rotating hole has exactly one parameter, so there is nothing to
 * integrate and nothing to play back: every radius, temperature and timescale
 * below is closed form in `M`. The sim is therefore a live *diagram* rather than
 * an animation — it redraws when the mass slider moves and is otherwise still.
 *
 * That also settles the reduced-motion question, which every other sim in this
 * project has to handle: there is no rAF loop, no transition and no playback
 * here, so `prefers-reduced-motion` needs no special case. A reader who has it
 * set sees exactly the same picture as everyone else, which is why this file
 * imports no `useReducedMotion`.
 *
 * No physics lives in this file. Every number comes from `@/physics/blackhole`,
 * which the math layer and the sanity checks also read — per the
 * physics-accuracy skill, the sim's calculation and the displayed equation must
 * be one shared function or they will drift. This file owns pixels and
 * formatting only.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import { AU, JULIAN_YEAR, R_EARTH, R_SUN } from '@/physics/constants';
import {
  PERSON_HEIGHT,
  evaporationTime,
  hawkingTemperature,
  iscoRadius,
  photonSphereRadius,
  schwarzschildRadius,
  tidalAccelerationAtHorizon,
} from '@/physics/blackhole';

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
  // Rounding the mantissa can carry it to 10 — "10.0 × 10³" is not scientific
  // notation — so renormalise when it does. Same guard as `lib/format.ts`.
  if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
  return `${(value / 10 ** exp).toFixed(places)} × 10${exponentGlyph(exp)}`;
}

/**
 * The skill's plain-decimal band, applied to a sim readout: inside
 * [0.01, 10 000) a plain decimal is easier to read than an exponent, outside it
 * the exponent is the only thing keeping the number legible.
 */
function plainOrScientific(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 0.01 && abs < 1e4) return SIG3.format(value);
  return scientific(value);
}

/**
 * A horizon radius in the largest named unit that keeps the number human.
 * The slider spans 1.5 km (half a solar mass) to about 1 300 AU (65 billion),
 * so no single unit works across it.
 */
function formatLength(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  if (metres < 1e3) return `${SIG3.format(metres)} m`;
  if (metres < 1e9) return `${SIG3.format(metres / 1e3)} km`;
  if (metres < 0.05 * AU) return `${SIG3.format(metres / 1e9)} million km`;
  return `${SIG3.format(metres / AU)} AU`;
}

/** Standard gravity, m/s² — the unit the tidal readout is quoted in. */
const G0 = 9.806_65;

/**
 * Where the one-word verdict flips, in g.
 *
 * There is no clean threshold in the literature, because a tidal stretch is not
 * the load any of the human tolerance data was gathered under: g-tolerance
 * figures describe whole-body acceleration, where a trained pilot in a g-suit
 * greys out somewhere around 9–10 g sustained and the skeleton fails only in the
 * hundreds. A stretch pulls head from feet instead, and 10 g of it — about 800 N
 * across a spine — is where the honest answer stops being "you would be fine".
 * It is a judgement call, marked as one, and the readout prints the number
 * beside the word so a reader can disagree with the threshold and not the
 * physics.
 */
const LETHAL_G = 10;

/* ------------------------------------------------------------------ */
/* Size comparison ladder                                              */
/* ------------------------------------------------------------------ */

/**
 * A familiar object the horizon can be set beside, each with a real extent in
 * metres. Earth and the Sun are derived from `constants.ts`; the other two carry
 * their citation here rather than being added to that file, which is for
 * quantities the physics layer computes with, not figures a picture quotes.
 */
interface Comparison {
  id: 'city' | 'earth' | 'sun' | 'neptune-orbit';
  name: string;
  /** Widest dimension, m — diameter for the round ones. */
  extent: number;
}

const COMPARISONS: Comparison[] = [
  // Manhattan is 21.6 km end to end; "a large city, about 20 km across" is the
  // round figure this stands for, and it is a scale, not a measurement.
  { id: 'city', name: 'A city, ~20 km', extent: 2e4 },
  { id: 'earth', name: 'Earth', extent: 2 * R_EARTH },
  { id: 'sun', name: 'The Sun', extent: 2 * R_SUN },
  // NASA Planetary Fact Sheet: Neptune's semi-major axis, 30.07 AU.
  { id: 'neptune-orbit', name: 'Neptune’s orbit', extent: 2 * 30.07 * AU },
];

/** The comparison closest to the horizon in log space — nearest in *ratio*. */
function chooseComparison(horizonDiameter: number): Comparison {
  let best = COMPARISONS[0] as Comparison;
  let bestDistance = Infinity;
  for (const candidate of COMPARISONS) {
    const distance = Math.abs(Math.log10(candidate.extent / horizonDiameter));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#6b7488',
  edge: '#232b3b',
  void: '#05070c',
  star: '#9db4ff',
  ember: '#e8bd7d',
};

const TAU = 2 * Math.PI;
const PAD = { left: 14, right: 14, top: 18, bottom: 26 };
/** Share of the canvas given to the geometry panel, along the splitting axis. */
const GEOMETRY_SHARE = 0.6;
/**
 * Below this width the two panels stack instead of sitting side by side. At a
 * phone width a 40% column leaves the comparison about 120 px to hold a horizon,
 * an object and two captions, and the captions collide.
 */
const STACK_BELOW = 560;

interface View {
  rs: number;
  rPhoton: number;
  rIsco: number;
  comparison: Comparison;
}

/**
 * Centred text, nudged inward when it would cross the edge of its panel. A
 * caption sits under whatever it names, and at the extremes of the mass slider
 * that object can end up hard against the frame — "Neptune's orbit" centred on a
 * disc at the right margin ran off the canvas before this existed.
 */
function fillTextClamped(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  left: number,
  right: number,
): void {
  const half = ctx.measureText(text).width / 2;
  const lo = left + half;
  const hi = right - half;
  // When the text is wider than the panel there is no position that fits;
  // centring it is the least-bad option and keeps it symmetric.
  ctx.fillText(text, hi >= lo ? Math.min(hi, Math.max(lo, cx)) : (left + right) / 2, y);
}

/**
 * The three radii, concentric and to one scale within this panel — the ratios
 * 1 : 1.5 : 3 are the content here, so they are drawn rather than schematised.
 */
function drawGeometry(
  ctx: CanvasRenderingContext2D,
  view: View,
  left: number,
  right: number,
  cy: number,
  available: number,
): void {
  const cx = (left + right) / 2;
  // The ISCO is the outermost ring, so it sets the scale for all three.
  const rIscoPx = available * 0.5 * 0.84;
  if (!(rIscoPx > 0) || !(view.rIsco > 0)) return;
  const pxPerMetre = rIscoPx / view.rIsco;
  const rPhotonPx = view.rPhoton * pxPerMetre;
  const rsPx = view.rs * pxPerMetre;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';

  /* ISCO — dotted */
  ctx.strokeStyle = 'rgba(157,180,255,0.55)';
  ctx.setLineDash([1.5, 4]);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(cx, cy, rIscoPx, 0, TAU);
  ctx.stroke();

  /* Photon sphere — dashed */
  ctx.strokeStyle = 'rgba(232,189,125,0.7)';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, rPhotonPx, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  /* Horizon — filled, and filled with nothing. The disc is the darkest value on
     the page on purpose: it is not a surface with a shaded side. */
  ctx.fillStyle = COLORS.void;
  ctx.beginPath();
  ctx.arc(cx, cy, rsPx, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(213,220,234,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* Labels, each above its own ring. Adjacent captions are separated by half the
     horizon radius in pixels, so below a certain diagram size they would sit on
     top of one another; there, a single line naming the three line styles says
     the same thing without the collision. */
  if (rsPx >= 24) {
    ctx.fillStyle = 'rgba(157,180,255,0.85)';
    fillTextClamped(ctx, 'ISCO · 3 r_s', cx, cy - rIscoPx - 6, left, right);
    ctx.fillStyle = 'rgba(232,189,125,0.9)';
    fillTextClamped(ctx, 'photon sphere · 1.5 r_s', cx, cy - rPhotonPx - 6, left, right);
    ctx.fillStyle = COLORS.ink;
    fillTextClamped(ctx, 'horizon · r_s', cx, cy - rsPx - 6, left, right);
  } else {
    ctx.fillStyle = COLORS.inkDim;
    fillTextClamped(
      ctx,
      'filled r_s · dashed 1.5 r_s · dotted 3 r_s',
      cx,
      cy + rIscoPx + 16,
      left,
      right,
    );
  }

  ctx.fillStyle = COLORS.inkFaint;
  fillTextClamped(
    ctx,
    'geometry — the three radii to one scale',
    cx,
    cy + rIscoPx + (rsPx >= 24 ? 16 : 30),
    left,
    right,
  );
  ctx.restore();
}

/** One familiar object, centred on (cx, cy), drawn at `pxPerMetre`. */
function drawSilhouette(
  ctx: CanvasRenderingContext2D,
  comparison: Comparison,
  cx: number,
  cy: number,
  pxPerMetre: number,
): void {
  const half = Math.max(0.5, (comparison.extent * pxPerMetre) / 2);

  switch (comparison.id) {
    case 'city': {
      // A skyline spanning the object's width. Below a few pixels it collapses
      // to a bar, which is the honest rendering of a city at that scale.
      const w = half * 2;
      const h = Math.max(1, w * 0.22);
      ctx.fillStyle = 'rgba(213,220,234,0.75)';
      const towers = [0.18, 0.42, 0.3, 0.62, 0.45, 1, 0.72, 0.35, 0.24];
      const step = w / towers.length;
      towers.forEach((height, i) => {
        const tw = Math.max(0.6, step * 0.72);
        ctx.fillRect(cx - half + i * step, cy + h / 2 - h * height, tw, h * height);
      });
      ctx.strokeStyle = 'rgba(213,220,234,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - half, cy + h / 2);
      ctx.lineTo(cx + half, cy + h / 2);
      ctx.stroke();
      break;
    }

    case 'earth':
      ctx.fillStyle = 'rgba(93,132,208,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, half, 0, TAU);
      ctx.fill();
      break;

    case 'sun':
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(cx, cy, half, 0, TAU);
      ctx.fill();
      break;

    case 'neptune-orbit':
      ctx.strokeStyle = 'rgba(157,180,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, half, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, half * 0.04), 0, TAU);
      ctx.fill();
      break;
  }
}

/**
 * Horizon and familiar object side by side, sharing one scale. The pair is
 * fitted to whichever is larger, so when the hole dwarfs the comparison the
 * comparison really does shrink to a speck — that is the reading.
 */
function drawComparison(
  ctx: CanvasRenderingContext2D,
  view: View,
  left: number,
  right: number,
  cy: number,
  maxHeight: number,
): void {
  const horizonDiameter = 2 * view.rs;
  const { extent } = view.comparison;
  const gapPx = 14;
  const width = right - left;
  if (width <= gapPx || !(horizonDiameter > 0)) return;

  // Fit both objects and the gap between them into the panel, and keep the
  // taller of the two inside the panel height as well.
  const byWidth = (width - gapPx) / (horizonDiameter + extent);
  const byHeight = maxHeight / Math.max(horizonDiameter, extent);
  const pxPerMetre = Math.min(byWidth, byHeight);

  const horizonPx = horizonDiameter * pxPerMetre;
  const extentPx = extent * pxPerMetre;
  const totalPx = horizonPx + gapPx + extentPx;
  const startX = left + (width - totalPx) / 2;
  const horizonCx = startX + horizonPx / 2;
  const comparisonCx = startX + horizonPx + gapPx + extentPx / 2;

  ctx.save();

  ctx.fillStyle = COLORS.void;
  ctx.beginPath();
  ctx.arc(horizonCx, cy, Math.max(0.5, horizonPx / 2), 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(213,220,234,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  drawSilhouette(ctx, view.comparison, comparisonCx, cy, pxPerMetre);

  ctx.textAlign = 'center';
  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  const yLabel = cy + Math.max(horizonPx, extentPx) / 2 + 16;
  ctx.fillStyle = COLORS.ink;
  fillTextClamped(ctx, 'event horizon', horizonCx, yLabel, left, right);
  ctx.fillStyle = COLORS.inkDim;
  fillTextClamped(ctx, view.comparison.name, comparisonCx, yLabel, left, right);

  ctx.fillStyle = COLORS.inkFaint;
  fillTextClamped(ctx, 'size — these two to one scale', (left + right) / 2, yLabel + 16, left, right);
  ctx.restore();
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size.
 *
 * The two panels each carry their own scale, and say so on the canvas: the
 * geometry panel would be useless if a comparison object eighty times the ISCO
 * squashed the rings into a dot, and the size panel would be a lie if it did not
 * share one scale between the hole and the object. Disclosed beside the sim.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): void {
  ctx.clearRect(0, 0, w, h);

  const left = PAD.left;
  const right = w - PAD.right;
  const top = PAD.top;
  const bottom = h - PAD.bottom;
  if (right - left <= 0 || bottom - top <= 0) return;

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;

  if (w >= STACK_BELOW) {
    const split = left + (right - left) * GEOMETRY_SHARE;
    const cy = (top + bottom) / 2;

    ctx.beginPath();
    ctx.moveTo(split, top);
    ctx.lineTo(split, bottom);
    ctx.stroke();

    const geometryWidth = split - left - 12;
    drawGeometry(ctx, view, left, split - 12, cy, Math.min(geometryWidth, bottom - top - 34));
    drawComparison(ctx, view, split + 12, right, cy, (bottom - top) * 0.72);
    return;
  }

  // Stacked: geometry above, size comparison below.
  const split = top + (bottom - top) * GEOMETRY_SHARE;
  ctx.beginPath();
  ctx.moveTo(left, split);
  ctx.lineTo(right, split);
  ctx.stroke();

  const upperH = split - top - 10;
  const lowerH = bottom - split - 10;
  drawGeometry(ctx, view, left, right, top + upperH / 2, Math.min(right - left, upperH - 34));
  drawComparison(ctx, view, left, right, split + 10 + lowerH / 2, lowerH * 0.5);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function BlackHolesSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const M = readParam(params, values, 'M');

  // Derived once per render. The canvas and the readouts below read these same
  // values, and both read them from `@/physics/blackhole`.
  const rs = useMemo(() => schwarzschildRadius(M), [M]);
  const tidal = useMemo(() => tidalAccelerationAtHorizon(M, PERSON_HEIGHT), [M]);
  const temperature = useMemo(() => hawkingTemperature(M), [M]);
  const lifetime = useMemo(() => evaporationTime(M), [M]);

  const view = useMemo<View>(
    () => ({
      rs,
      rPhoton: photonSphereRadius(M),
      rIsco: iscoRadius(M),
      comparison: chooseComparison(2 * rs),
    }),
    [M, rs],
  );

  /** Paints the current view at the canvas's current size. */
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
    drawScene(ctx, rect.width, rect.height, view);
  }, [view]);

  /* The only trigger there is: the mass changed, so redraw. No loop to start,
     nothing to cancel, and nothing for reduced-motion to opt out of. */
  useEffect(() => {
    paint();
  }, [paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const tidalG = tidal / G0;
  const lethal = tidalG >= LETHAL_G;
  const years = lifetime / JULIAN_YEAR; // seconds → years, display only

  return (
    <div className="flex min-h-[20rem] flex-col gap-4">
      <div className="relative h-[20rem] w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>

      <dl className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label="event horizon r_s" value={formatLength(rs)} />
        <Readout
          label={`head-to-foot stretch (${PERSON_HEIGHT} m)`}
          value={`${plainOrScientific(tidalG)} g`}
          suffix={lethal ? 'lethal' : 'survivable'}
          accent={!lethal}
        />
        <Readout label="Hawking temperature" value={`${scientific(temperature)} K`} />
        <Readout label="evaporation time" value={`${scientific(years)} yr`} />
      </dl>

      <p className="font-ui text-[0.75rem] leading-relaxed text-ink-faint">
        “Survivable” means the stretch alone would not tear you apart at the moment you
        cross — nothing beyond it. The temperature is far below the 2.725 K microwave
        background at every mass this slider reaches, so a real hole here absorbs more than
        it radiates and the evaporation clock has not started.
      </p>
    </div>
  );
}

function Readout({
  label,
  value,
  suffix,
  accent = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums text-ember">
        {value}
        {suffix && (
          <span
            className={`ml-2 font-ui text-xs uppercase tracking-[0.12em] ${
              accent ? 'text-star' : 'text-ink-dim'
            }`}
          >
            {suffix}
          </span>
        )}
      </dd>
    </div>
  );
}

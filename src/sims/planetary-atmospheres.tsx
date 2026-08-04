/**
 * Planetary atmospheres — one distribution against one threshold.
 *
 * The whole argument of thermal escape fits in a single picture: the speeds a
 * gas actually has, and the speed it would need to leave. Draw both on one axis
 * and the answer is the area of the overlap — which is why the tail past the
 * escape line is shaded rather than described.
 *
 * The gas chips carry each species' verdict as a coloured dot, so the picture
 * for the whole atmosphere is visible while only one curve is drawn. That is the
 * point of the module: the same planet keeps some gases and loses others, and
 * the only thing that changed is the mass of the molecule.
 *
 * No physics lives in this file. Every number comes from `@/physics/atmosphere`
 * — which in turn takes its escape velocity from `@/physics/escape`, the same
 * function the escape-velocity module runs on — and the math layer and the
 * sanity checks read the same functions.
 *
 * Rendering notes: there is no animation here at all. The distribution is a
 * static curve that changes only when a slider or a chip does, so there is no
 * rAF loop, nothing to cancel, and nothing for `prefers-reduced-motion` to opt
 * out of; a reader with it set sees exactly what everyone else sees.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Param, ParamValues, SimProps } from '@/content/types';
import {
  GASES,
  gasById,
  maxwellBoltzmannPdf,
  mostProbableSpeed,
  retentionVerdict,
  type Gas,
  type Retention,
} from '@/physics/atmosphere';
import { vEsc } from '@/physics/escape';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });

/** Speeds are read in km/s here, as they are for escape velocity. */
function formatSpeed(mps: number): string {
  if (!Number.isFinite(mps)) return '—';
  if (mps < 100) return `${SIG3.format(mps)} m/s`;
  return `${SIG3.format(mps / 1000)} km/s`;
}

const VERDICT_LABEL: Record<Retention, string> = {
  retains: 'retained',
  marginal: 'marginal',
  loses: 'lost',
};

const VERDICT_COLOR: Record<Retention, string> = {
  retains: '#9db4ff',
  marginal: '#e8bd7d',
  loses: '#6b7488',
};

/** Clear space kept between two labels that share a line. */
const LABEL_GAP = 8;

/** Centred text nudged inward when it would cross the frame — as the other sims do. */
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
  ctx.fillText(text, hi >= lo ? Math.min(hi, Math.max(lo, cx)) : (left + right) / 2, y);
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

const COLORS = {
  ink: '#d5dcea',
  inkDim: '#98a2b8',
  inkFaint: '#858ea2',
  edge: '#232b3b',
  star: '#9db4ff',
  ember: '#e8bd7d',
};

const PAD = { left: 16, right: 16, top: 22, bottom: 34 };

export interface Scene {
  /** Escape velocity, m/s. */
  escapeSpeed: number;
  /** Exosphere temperature, K. */
  temperature: number;
  gas: Gas;
  verdict: Retention;
}

/**
 * Where to stop the speed axis.
 *
 * Four times the most probable speed puts the whole distribution in frame with
 * room past the tail; but the escape line has to be on the axis too, or the
 * picture answers a question it is not being asked. So the axis takes whichever
 * is larger. At Jupiter's escape velocity against hot hydrogen that squeezes the
 * curve into the left sixth of the frame, which is the correct reading — nothing
 * in that distribution is going anywhere.
 */
function speedAxisMax(escapeSpeed: number, thermalSpeed: number): number {
  return Math.max(4 * thermalSpeed, 1.15 * escapeSpeed);
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: Scene): void {
  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';

  const left = PAD.left;
  const right = w - PAD.right;
  const top = PAD.top;
  const bottom = h - PAD.bottom;
  const plotW = right - left;
  const plotH = bottom - top;
  if (plotW <= 0 || plotH <= 0) return;

  const thermal = mostProbableSpeed(scene.temperature, scene.gas.mass);
  if (!(thermal > 0) || !(scene.escapeSpeed > 0)) return;

  const vMax = speedAxisMax(scene.escapeSpeed, thermal);
  const xAt = (v: number) => left + (v / vMax) * plotW;
  // The peak of a Maxwell-Boltzmann distribution is at the most probable speed,
  // so the curve is normalised against its own maximum: the shape is the
  // content, and the absolute probability density is unreadable in any units.
  const peak = maxwellBoltzmannPdf(thermal, scene.temperature, scene.gas.mass);
  const yAt = (density: number) => bottom - (density / peak) * plotH * 0.86;

  /* --- the curve, sampled once and reused for the fill --- */
  const samples = Math.max(160, Math.round(plotW * 2));
  const points: { x: number; y: number; v: number }[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const v = (i / samples) * vMax;
    points.push({ x: xAt(v), y: yAt(maxwellBoltzmannPdf(v, scene.temperature, scene.gas.mass)), v });
  }

  /* --- the escaping tail, shaded --- */
  const escapeX = xAt(scene.escapeSpeed);
  if (scene.escapeSpeed < vMax) {
    ctx.fillStyle = 'rgba(232,189,125,0.22)';
    ctx.beginPath();
    ctx.moveTo(escapeX, bottom);
    for (const point of points) if (point.v >= scene.escapeSpeed) ctx.lineTo(point.x, point.y);
    ctx.lineTo(right, bottom);
    ctx.closePath();
    ctx.fill();
  }

  /* --- the distribution --- */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  points.forEach((point, i) => (i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
  ctx.stroke();

  /* --- the baseline --- */
  ctx.strokeStyle = 'rgba(107,116,136,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  /* --- the most probable speed, where the curve peaks --- */
  const peakX = xAt(thermal);
  ctx.strokeStyle = 'rgba(157,180,255,0.35)';
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(peakX, yAt(peak));
  ctx.lineTo(peakX, bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  /* --- the escape threshold --- */
  ctx.strokeStyle = COLORS.ember;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(escapeX, top - 4);
  ctx.lineTo(escapeX, bottom);
  ctx.stroke();

  /*
   * The escape label shares its line with the chart title, so its left bound is
   * the title's right edge rather than the frame's.
   *
   * Both sit on `top - 12`: the title left-aligned at `left`, the escape label
   * centred on the escape line and clamped inward when that line is near an
   * edge. On a light world with a hot exosphere — the mass slider at minimum,
   * the temperature at maximum — the escape line is far enough left that the
   * clamp parked the label exactly on top of the title, and the two rendered as
   * "CO₂ æescapet 0.458 km/s". Measured and dodged rather than moved to another
   * line, which is what the other sims' collision fixes do and what keeps the
   * label beside the line it names.
   */
  const title = `${scene.gas.label} at ${Math.round(scene.temperature)} K`;
  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  const titleRight = left + ctx.measureText(title).width;

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.ember;
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  fillTextClamped(
    ctx,
    `escape ${formatSpeed(scene.escapeSpeed)}`,
    escapeX,
    top - 12,
    titleRight + LABEL_GAP,
    right,
  );

  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(157,180,255,0.75)';
  fillTextClamped(ctx, `most likely ${formatSpeed(thermal)}`, peakX, top + 4, left, right);

  /* --- axis --- */
  ctx.fillStyle = COLORS.inkFaint;
  for (let i = 0; i <= 4; i += 1) {
    const v = (i / 4) * vMax;
    fillTextClamped(ctx, formatSpeed(v), xAt(v), bottom + 12, left, right);
  }
  ctx.fillStyle = COLORS.inkFaint;
  fillTextClamped(ctx, 'molecular speed', (left + right) / 2, bottom + 26, left, right);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.inkFaint;
  ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
  ctx.fillText(title, left, top - 12);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function readParam(params: Param[], values: ParamValues, id: string): number {
  const live = values[id];
  if (live !== undefined && Number.isFinite(live)) return live;
  return params.find((p) => p.id === id)?.default ?? 0;
}

export default function PlanetaryAtmospheresSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [gasId, setGasId] = useState<string>('N2');

  const bodyMass = readParam(params, values, 'M');
  const radius = readParam(params, values, 'R');
  const temperature = readParam(params, values, 'T');

  const gas = useMemo(() => gasById(gasId), [gasId]);
  const escapeSpeed = useMemo(() => vEsc(bodyMass, radius), [bodyMass, radius]);
  const active = useMemo(
    () => retentionVerdict(bodyMass, radius, temperature, gas.mass),
    [bodyMass, radius, temperature, gas.mass],
  );
  /** Every gas's verdict, for the chips — the whole atmosphere at a glance. */
  const verdicts = useMemo(
    () => GASES.map((g) => ({ gas: g, ...retentionVerdict(bodyMass, radius, temperature, g.mass) })),
    [bodyMass, radius, temperature],
  );

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
  }, []);

  /* The only trigger there is: a slider or a chip changed, so redraw. */
  useEffect(() => {
    sceneRef.current = { escapeSpeed, temperature, gas, verdict: active.verdict };
    paint();
  }, [escapeSpeed, temperature, gas, active.verdict, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  return (
    <div className="flex min-h-[20rem] flex-col gap-4">
      <div className="relative h-[19rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="The distribution of molecular speeds for the selected gas, with the escape velocity marked as a threshold and the escaping tail shaded."
          aria-describedby="planetary-atmospheres-readouts"
        />
      </div>

      {/* One curve is drawn, but every gas's fate is on the chips. */}
      <div className="flex flex-wrap gap-2">
        {verdicts.map(({ gas: g, verdict }) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGasId(g.id)}
            aria-pressed={g.id === gasId}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 font-ui text-xs transition-colors ${
              g.id === gasId
                ? 'border-star/60 bg-void-500 text-star'
                : 'border-edge bg-void-500 text-ink-dim hover:border-star/40 hover:text-ink'
            }`}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: VERDICT_COLOR[verdict] }}
            />
            {g.label}
            <span className="sr-only">— {VERDICT_LABEL[verdict]}</span>
          </button>
        ))}
      </div>

      <dl id="planetary-atmospheres-readouts" className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4">
        <Readout label="escape velocity" value={formatSpeed(escapeSpeed)} />
        <Readout label={`most likely ${gas.label} speed`} value={formatSpeed(active.thermalSpeed)} />
        <Readout label="ratio" value={Number.isFinite(active.ratio) ? SIG3.format(active.ratio) : '—'} />
        <Readout
          label="over geologic time"
          value={VERDICT_LABEL[active.verdict]}
          tone={active.verdict}
        />
      </dl>

      <p className="font-ui text-[0.75rem] leading-relaxed text-ink-faint">
        The dot on each chip is that gas's verdict at these settings: blue retained, amber
        marginal, grey lost. The rule is a threshold on one ratio, not a calculation of how fast a
        gas actually leaves — real escape is exponential in that ratio, so the band in the middle
        is where the rule stops answering and history takes over.
      </p>
    </div>
  );
}

function Readout({ label, value, tone }: { label: string; value: string; tone?: Retention }) {
  const color = tone === undefined ? 'text-ember' : tone === 'loses' ? 'text-ink-faint' : tone === 'marginal' ? 'text-ember' : 'text-star';
  return (
    <div>
      <dt className="font-ui text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 font-mono text-lg tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Test surface                                                        */
/* ------------------------------------------------------------------ */

/**
 * Internals exposed for `tests/canvas.test.ts`, and for nothing else.
 *
 * The canvas tests replay the drawing at every width the shell produces and at
 * each parameter's extremes, across all six gases — including the two corners
 * where the axis has to stretch hardest: hydrogen at 2500 K, where the curve is
 * wide and the escape line sits near the origin, and carbon dioxide at 50 K,
 * where it is a spike against an escape line far to the right.
 */
export const __internals = { drawScene, speedAxisMax };

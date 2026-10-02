/**
 * The expansion of the universe — a Hubble diagram above, a hydrogen line below.
 *
 * Top panel: velocity against distance, both linear, with the live line
 * v = H₀ d, faint reference lines at the two disputed measurements, and the
 * reader's galaxy as a dot that its own motion lifts off the line. Bottom
 * panel: a visible spectrum with Hα marked where the laboratory puts it and
 * where this galaxy's light actually lands.
 *
 * No physics lives in this file. Every speed, redshift, wavelength and time
 * comes from `@/physics/cosmology`, which the math layer's worked example and
 * the sanity block also read. This file owns pixels and formatting only.
 *
 * Motion: the observed line slides to its new wavelength over `DURATION.slow`
 * on the `EASE.out` curve, so a drag reads as the line being carried toward red
 * rather than teleporting. That is the only animation. Under reduced motion the
 * line jumps, no frame is requested, and the canvas is still between drags.
 */
import { useCallback, useEffect, useRef } from 'react';
import { canvasSize, observeCanvasSize } from './canvasSize';
import type { Param, ParamValues, SimProps } from '@/content/types';
import {
  H0_PLANCK_2018,
  H0_SH0ES_2022,
  H_ALPHA_AIR,
  KM_S_PER_MPC,
  LIGHT_YEAR,
  MEGAPARSEC,
  JULIAN_YEAR,
} from '@/physics/constants';
import {
  hubbleTime,
  lightTravelTime,
  lineOfSightVelocity,
  observedWavelength,
  recessionVelocity,
  redshiftFromVelocity,
} from '@/physics/cosmology';
import { formatLightTravelTime } from '@/physics/scale';
import { trueMinus } from '@/lib/format';
import { eased } from '@/motion/ease';
import { DURATION, EASE } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { useTier } from '@/store/useAppStore';
import { firstClearPlacement, labelBox, type LabelBox } from './labels';

/* ------------------------------------------------------------------ */
/* Display helpers — formatting only, never used to compute            */
/* ------------------------------------------------------------------ */

const SIG3 = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
const GROUPED = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** m/s → "6,740 km/s", three significant figures; a true minus when approaching. */
function formatKmS(mps: number): string {
  if (!Number.isFinite(mps)) return '—';
  return `${trueMinus(SIG3.format(mps / 1e3))} km/s`;
}

/**
 * z to four decimals, with a true minus (U+2212) for a blueshift, through the
 * shared formatter's `trueMinus` — a hyphen reads as a dash and is spoken as
 * one — and without the "−0.0000" a tiny blueshift would round to.
 */
function formatRedshift(z: number): string {
  if (!Number.isFinite(z)) return '—';
  return trueMinus(z.toFixed(4));
}

/** m → "671.0 nm". */
function formatNm(metres: number): string {
  if (!Number.isFinite(metres)) return '—';
  return `${(metres * 1e9).toFixed(1)} nm`;
}

/** s → "14.5 billion years". */
function formatGyr(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  return `${(seconds / JULIAN_YEAR / 1e9).toFixed(1)} billion years`;
}

/** A Hubble constant in s⁻¹, as the one-decimal km/s/Mpc figure people quote. */
function h0Label(H0_s: number): string {
  return (H0_s / KM_S_PER_MPC).toFixed(1);
}

/**
 * An approximate sRGB colour for a visible wavelength, for the spectrum strip.
 *
 * The standard piecewise fit (after Dan Bruton), with the intensity rolled off
 * toward both ends of vision. It is a picture of the spectrum, not a
 * colorimetric rendering, and nothing reads a number back out of it.
 */
function wavelengthColour(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = (440 - nm) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = (510 - nm) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = (645 - nm) / 65;
  } else {
    r = 1;
  }
  const fade = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const channel = (c: number) => Math.round(255 * Math.max(0, Math.min(1, c * fade)) ** 0.8);
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
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

/** Frame margins, and the gutter the velocity axis's labels live in. */
const PAD = { left: 12, right: 12 };
const AXIS_GUTTER = 44;

/** Share of the canvas height given to the Hubble diagram. */
const DIAGRAM_SHARE = 0.6;

/** The strip's wavelength range, and where the eye stops seeing, in nm. */
const SPECTRUM_MIN_NM = 380;
const SPECTRUM_MAX_NM = 850;
const INFRARED_FROM_NM = 750;

/** Velocity gridline spacing, m/s, and distance tick spacing in each unit system. */
const VELOCITY_TICK = 2e7;
const DISTANCE_TICK = {
  friendly: { metres: 1e9 * LIGHT_YEAR, perUnit: 1e6 * LIGHT_YEAR, caption: 'distance, million light-years' },
  technical: { metres: 250 * MEGAPARSEC, perUnit: MEGAPARSEC, caption: 'distance, Mpc' },
} as const;

type Units = keyof typeof DISTANCE_TICK;

interface View {
  /** Proper distance, m. */
  d: number;
  /** Hubble constant, s⁻¹. */
  H0: number;
  /** Peculiar velocity, m/s, positive away. */
  vPec: number;
  /** Line-of-sight velocity, m/s — from `lineOfSightVelocity`, not recomputed here. */
  vLos: number;
  /** The d slider's maximum, m: the diagram's x extent. */
  dMax: number;
  /** The H₀ slider's maximum, s⁻¹: with dMax, the diagram's y extent. */
  H0Max: number;
  /** The observed Hα wavelength as currently drawn, m — mid-tween while it slides. */
  lambdaShown: number;
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

function drawHubbleDiagram(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const plotLeft = AXIS_GUTTER;
  const plotRight = w - PAD.right;
  const plotTop = 28;
  const plotBottom = splitY - 36;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;
  if (plotW <= 0 || plotH <= 0 || !(view.dMax > 0) || !(view.H0Max > 0)) return;

  const vMax = recessionVelocity(view.H0Max, view.dMax);
  const xOf = (d: number) => plotLeft + (d / view.dMax) * plotW;
  const yOf = (v: number) => plotBottom - (v / vMax) * plotH;

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';

  /* Title row. */
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'Hubble diagram', PAD.left, 14, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, 'velocity, km/s', plotRight, 14, 'right', obstacles);

  /* Axes. */
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();

  /* Velocity ticks, with faint gridlines. */
  ctx.fillStyle = COLORS.inkFaint;
  for (let v = 0; v <= vMax; v += VELOCITY_TICK) {
    const y = yOf(v);
    if (v > 0) {
      ctx.strokeStyle = 'rgba(35,43,59,0.6)';
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
    }
    placeText(ctx, GROUPED.format(v / 1e3), plotLeft - 4, y + 3, 'right', obstacles);
  }

  /* Distance ticks, in the reader's units. */
  const tick = DISTANCE_TICK[view.units];
  for (let d = 0; d <= view.dMax; d += tick.metres) {
    centredWithin(ctx, GROUPED.format(d / tick.perUnit), xOf(d), plotBottom + 13, 0, w, obstacles);
  }
  centredWithin(ctx, tick.caption, (plotLeft + plotRight) / 2, plotBottom + 27, PAD.left, w - PAD.right, obstacles);

  /* The two measurements, faint and dashed, labelled at their right ends.
     SH0ES is the steeper line, so its label sits above its end and Planck's
     below: the two can never meet however close the lines are drawn. */
  const references: { H0: number; name: string; above: boolean }[] = [
    { H0: H0_PLANCK_2018, name: `Planck 2018: ${h0Label(H0_PLANCK_2018)}`, above: false },
    { H0: H0_SH0ES_2022, name: `SH0ES 2022: ${h0Label(H0_SH0ES_2022)}`, above: true },
  ];
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(152,162,184,0.45)';
  for (const ref of references) {
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(0));
    ctx.lineTo(xOf(view.dMax), yOf(recessionVelocity(ref.H0, view.dMax)));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /* The live law. */
  ctx.strokeStyle = COLORS.star;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(0));
  ctx.lineTo(xOf(view.dMax), yOf(recessionVelocity(view.H0, view.dMax)));
  ctx.stroke();

  /* The reference labels go on after every line, each on a plate of the
     background: they sit inside the fan the three lines make, and the live one
     sweeps through both of them as H₀ is dragged, so no placement keeps every
     line off them. The plate keeps the words readable wherever the line is. */
  for (const ref of references) {
    const yEnd = yOf(recessionVelocity(ref.H0, view.dMax));
    const y = ref.above ? yEnd - 4 : yEnd + 12;
    const box = labelBox(ctx, ref.name, plotRight, y, 'right');
    ctx.fillStyle = 'rgba(5,7,12,0.82)';
    ctx.fillRect(box.x0 - 2, box.y0 - 1, box.x1 - box.x0 + 4, box.y1 - box.y0 + 2);
    ctx.fillStyle = COLORS.inkFaint;
    placeText(ctx, ref.name, plotRight, y, 'right', obstacles);
  }

  /* The galaxy, and the part of its speed that is its own. */
  const xd = xOf(view.d);
  const yLine = yOf(recessionVelocity(view.H0, view.d));
  const yDot = yOf(view.vLos);

  if (view.vPec !== 0) {
    ctx.strokeStyle = COLORS.ember;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xd, yLine);
    ctx.lineTo(xd, yDot);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(232,189,125,0.25)';
  ctx.beginPath();
  ctx.arc(xd, yDot, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.ember;
  ctx.beginPath();
  ctx.arc(xd, yDot, 3.5, 0, TAU);
  ctx.fill();

  if (view.vPec !== 0) {
    const text = 'its own motion';
    const midY = (yLine + yDot) / 2 + 3;
    const offsets = [0, -12, 12, -24, 24, -36, 36, -48, 48, 60, 72, 84, 96, 108];
    const candidates: { x: number; y: number; align: CanvasTextAlign }[] = [];
    for (const dy of offsets) {
      candidates.push({ x: xd + 9, y: midY + dy, align: 'left' });
      candidates.push({ x: xd - 9, y: midY + dy, align: 'right' });
    }
    // Only positions that sit wholly inside the plot are worth trying.
    const inside = candidates.filter((c) => {
      const box = labelBox(ctx, text, c.x, c.y, c.align);
      return box.x0 >= plotLeft + 2 && box.x1 <= plotRight && box.y0 >= plotTop && box.y1 <= plotBottom - 2;
    });
    // The galaxy dot itself is an obstacle too: the label names the tick, and
    // printed over the dot it would hide the thing it describes.
    const dotBox: LabelBox = { x0: xd - 7, x1: xd + 7, y0: yDot - 7, y1: yDot + 7 };
    const spot =
      inside.length > 0
        ? firstClearPlacement(ctx, text, inside, [...obstacles, dotBox])
        : { x: (plotLeft + plotRight) / 2, y: (plotTop + plotBottom) / 2, align: 'center' as const };
    ctx.fillStyle = COLORS.ember;
    placeText(ctx, text, spot.x, spot.y, spot.align, obstacles);
  }
}

function drawSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  splitY: number,
  view: View,
  obstacles: LabelBox[],
): void {
  const left = PAD.left;
  const right = w - PAD.right;
  if (right - left <= 0) return;
  const xOfNm = (nm: number) =>
    left + ((nm - SPECTRUM_MIN_NM) / (SPECTRUM_MAX_NM - SPECTRUM_MIN_NM)) * (right - left);
  const clampNm = (nm: number) => Math.min(SPECTRUM_MAX_NM, Math.max(SPECTRUM_MIN_NM, nm));

  const titleY = splitY + 18;
  const labRowY = splitY + 34;
  const stripTop = splitY + 42;
  const stripBottom = stripTop + 34;
  const arrowY = stripBottom + 10;
  const arrowLabelY = stripBottom + 25;

  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.inkDim;
  placeText(ctx, 'The hydrogen line', left, titleY, 'left', obstacles);
  ctx.fillStyle = COLORS.inkFaint;
  placeText(ctx, `${SPECTRUM_MIN_NM} to ${SPECTRUM_MAX_NM} nm`, right, titleY, 'right', obstacles);

  /* The strip: visible colours, then the infrared shaded dark. */
  const xInfrared = xOfNm(INFRARED_FROM_NM);
  const gradient = ctx.createLinearGradient(left, 0, xInfrared, 0);
  for (let nm = SPECTRUM_MIN_NM; nm <= INFRARED_FROM_NM; nm += 10) {
    gradient.addColorStop((nm - SPECTRUM_MIN_NM) / (INFRARED_FROM_NM - SPECTRUM_MIN_NM), wavelengthColour(nm));
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(left, stripTop, xInfrared - left, stripBottom - stripTop);
  ctx.fillStyle = 'rgba(30,26,38,0.95)';
  ctx.fillRect(xInfrared, stripTop, right - xInfrared, stripBottom - stripTop);
  ctx.fillStyle = COLORS.inkFaint;
  centredWithin(ctx, 'infrared', (xInfrared + right) / 2, (stripTop + stripBottom) / 2 + 3, xInfrared, right, obstacles);

  /* Where the laboratory puts Hα: dashed grey. */
  const labNm = H_ALPHA_AIR * 1e9;
  const xLab = xOfNm(labNm);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = COLORS.inkDim;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(xLab, stripTop - 6);
  ctx.lineTo(xLab, stripBottom + 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.inkDim;
  centredWithin(ctx, 'in the lab', xLab, labRowY, left, right, obstacles);

  /* Where this galaxy's Hα actually arrives: solid and bright. */
  const shownNm = clampNm(view.lambdaShown * 1e9);
  const xObs = xOfNm(shownNm);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xObs, stripTop - 4);
  ctx.lineTo(xObs, stripBottom + 4);
  ctx.stroke();

  /* The shift between them, named by its sign. */
  const dx = xObs - xLab;
  const word = shownNm > labNm ? 'redshift' : shownNm < labNm ? 'blueshift' : 'no shift';
  if (Math.abs(dx) >= 4) {
    const dir = Math.sign(dx);
    ctx.strokeStyle = word === 'blueshift' ? COLORS.star : COLORS.ember;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(xLab, arrowY);
    ctx.lineTo(xObs, arrowY);
    ctx.moveTo(xObs, arrowY);
    ctx.lineTo(xObs - dir * 4, arrowY - 3);
    ctx.moveTo(xObs, arrowY);
    ctx.lineTo(xObs - dir * 4, arrowY + 3);
    ctx.stroke();
  }
  ctx.fillStyle = word === 'blueshift' ? COLORS.star : word === 'redshift' ? COLORS.ember : COLORS.inkDim;
  centredWithin(ctx, word, (xLab + xObs) / 2, arrowLabelY, left, right, obstacles);
}

/**
 * Draws the whole scene. Pure function of `view` plus the canvas size.
 *
 * The obstacle list is threaded through both panels in drawing order, so a
 * label placed by measurement ("its own motion") is placed against every label
 * already on the canvas rather than against a guess about where they are.
 */
function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, view: View): void {
  ctx.clearRect(0, 0, w, h);
  if (w <= PAD.left + PAD.right + AXIS_GUTTER || h <= 0) return;

  const splitY = Math.round(h * DIAGRAM_SHARE);
  const obstacles: LabelBox[] = [];

  ctx.save();
  drawHubbleDiagram(ctx, w, splitY, view, obstacles);

  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, splitY);
  ctx.lineTo(w - PAD.right, splitY);
  ctx.stroke();

  drawSpectrum(ctx, w, splitY, view, obstacles);
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

export default function ExpansionSim({ params, values }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const tier = useTier();
  const deep = tier === 'deep';

  const d = readParam(params, values, 'd');
  const H0 = readParam(params, values, 'H0');
  const vPec = readParam(params, values, 'vPec');

  // Every number below comes from `@/physics/cosmology`, once per render; the
  // canvas and the readouts read these same values.
  const vH = recessionVelocity(H0, d);
  const vLos = lineOfSightVelocity(H0, d, vPec);
  const z = redshiftFromVelocity(vLos);
  const lambdaObs = observedWavelength(H_ALPHA_AIR, z);
  const travel = lightTravelTime(d);
  const tH = hubbleTime(H0);

  const dMax = paramMax(params, 'd');
  const H0Max = paramMax(params, 'H0');
  const units: Units = deep ? 'technical' : 'friendly';

  /** The wavelength the observed line is drawn at, which trails `lambdaObs` while it slides. */
  const shownRef = useRef(lambdaObs);

  /** Paints the current view at the canvas's current size. */
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    drawScene(ctx, rect.width, rect.height, {
      d,
      H0,
      vPec,
      vLos,
      dMax,
      H0Max,
      units,
      lambdaShown: shownRef.current,
    });
  }, [d, H0, vPec, vLos, dMax, H0Max, units]);

  /*
   * The slide. A new target wavelength starts a tween from wherever the line is
   * drawn now — mid-slide included, so a continuous drag never snaps back — and
   * a changed target cancels the frame in flight. Anything else that changes the
   * picture (the dot, the axes, the tier) repaints at once with the line where
   * it is. Reduced motion, or no rAF at all, puts the line straight on target.
   */
  useEffect(() => {
    const from = shownRef.current;
    const to = lambdaObs;
    if (reduced || from === to || typeof requestAnimationFrame === 'undefined') {
      shownRef.current = to;
      paint();
      return;
    }

    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / DURATION.slow);
      shownRef.current = from + (to - from) * eased(EASE.out, progress);
      paint();
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lambdaObs, reduced, paint]);

  /* Resize-safe: repaint on any container size change, including DPR moves. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return observeCanvasSize(canvas, () => paint());
  }, [paint]);

  const direction = vLos > 0 ? 'away from us' : vLos < 0 ? 'toward us' : undefined;
  const redshiftLabel = deep ? 'Redshift z' : 'How much the light is stretched';

  return (
    <div className="flex min-h-[25rem] flex-col gap-4">
      <div className="relative h-[25rem] w-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="A Hubble diagram of recession velocity against distance, with the reader’s galaxy as a dot on the line, above a spectrum strip showing where the galaxy’s hydrogen line lands compared with where it sits in the laboratory."
          aria-describedby="expansion-of-the-universe-readouts"
        />
      </div>

      <dl
        id="expansion-of-the-universe-readouts"
        className="flex flex-wrap gap-x-7 gap-y-3 border-t border-edge-soft pt-4"
      >
        <Readout
          label={deep ? 'Recession velocity v_H' : 'Speed from stretching'}
          value={formatKmS(vH)}
        />
        <Readout
          label={deep ? 'Line-of-sight velocity v' : 'Speed we actually see'}
          value={formatKmS(Math.abs(vLos))}
          suffix={direction}
          accent={vLos < 0}
        />
        <Readout label={z < 0 ? `blueshift: ${redshiftLabel}` : redshiftLabel} value={formatRedshift(z)} />
        <Readout
          label={deep ? 'Observed Hα wavelength' : 'Where the hydrogen line lands'}
          value={formatNm(lambdaObs)}
        />
        <Readout
          label={deep ? 'Light travel time' : 'How long the light travelled'}
          value={formatLightTravelTime(travel)}
        />
        <Readout
          label={deep ? 'Hubble time t_H' : 'Age if it had always stretched this fast'}
          value={formatGyr(tH)}
        />
      </dl>
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
      <dt className="font-ui text-xs text-ink-faint">
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

/* ------------------------------------------------------------------ */
/* Test surface                                                        */
/* ------------------------------------------------------------------ */

/**
 * Internals exposed for `tests/canvas.test.ts`, and for nothing else — the same
 * deliberately ugly name the other sims use, so the module's real surface stays
 * a default export taking SimProps.
 */
export const __internals = { drawScene, eased, formatRedshift, formatKmS };

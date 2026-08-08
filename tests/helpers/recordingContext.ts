/**
 * A Canvas 2D context that draws nothing and remembers everything.
 *
 * Every sim's `drawScene` is a pure function of a scene plus a width and a
 * height, which makes it testable without a browser, a DOM or a real canvas —
 * hand it this stub and inspect what it was asked to draw. That is why the test
 * suite runs in a plain node environment: nothing here needs jsdom.
 *
 * Two things are checked with the records it produces:
 *
 *   1. No *text* lands outside the frame. Canvas silently clips, so a label
 *      drawn at a negative x is invisible rather than broken, and the only way
 *      to find one is to measure. Four real defects were found this way.
 *   2. No coordinate is non-finite. A single NaN in a path drops the rest of it
 *      without an error anywhere.
 *
 * Geometry is deliberately *not* asserted against the frame: sims legitimately
 * draw outside it — the escape-velocity planet is an arc of radius 1.35× the
 * plot width, clipped to a sliver — so an out-of-frame arc is a design, while an
 * out-of-frame label is a bug.
 *
 * Text width is estimated at 0.52 em per character, close enough to Inter's mean
 * advance for the ±5% this is used for, and applied consistently to both the
 * stub's `measureText` and the assertion, so a sim that clamps against
 * `measureText` is judged by the same ruler it used.
 */

export type DrawKind = 'text' | 'arc' | 'rect' | 'point' | 'ellipse' | 'gradient';

export interface DrawRecord {
  kind: DrawKind;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  text?: string;
  /** False when any coordinate handed to the context was NaN or Infinity. */
  finite: boolean;
}

/** Mean advance width as a fraction of font size. */
export const WIDTH_RATIO = 0.52;

export interface Recording {
  ctx: CanvasRenderingContext2D;
  records: DrawRecord[];
  /** Every radius a radial gradient was built with, outer first-class. */
  glowRadii: number[];
  /** Every value assigned to `globalAlpha` — how trails are checked. */
  alphas: number[];
}

export function recordingContext(): Recording {
  const records: DrawRecord[] = [];
  const glowRadii: number[] = [];
  const alphas: number[] = [];
  let fontPx = 10;
  let align: CanvasTextAlign = 'start';
  let alpha = 1;

  const allFinite = (...values: number[]) => values.every((v) => Number.isFinite(v));

  const push = (kind: DrawKind, x0: number, x1: number, y0: number, y1: number, text?: string) => {
    records.push({
      kind,
      x0,
      x1,
      y0,
      y1,
      finite: allFinite(x0, x1, y0, y1),
      ...(text === undefined ? {} : { text }),
    });
  };

  const gradient = { addColorStop: () => {} };

  const ctx = {
    /* State the sims set. `font` is parsed because text extent depends on it. */
    set font(value: string) {
      const match = /(\d+(?:\.\d+)?)px/.exec(value);
      if (match?.[1]) fontPx = Number(match[1]);
    },
    get font() {
      return `${fontPx}px sans-serif`;
    },
    set textAlign(value: CanvasTextAlign) {
      align = value;
    },
    get textAlign() {
      return align;
    },
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillStyle: '' as string | CanvasGradient,
    strokeStyle: '' as string | CanvasGradient,
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,

    /* `globalAlpha` is an accessor rather than a field so every value a sim
       assigns is recorded. It is the only channel a trail's fade travels
       through — the dots themselves are plain arcs — so without this there is
       no way to assert that a trail stayed within bounds. */
    set globalAlpha(value: number) {
      alpha = value;
      alphas.push(value);
    },
    get globalAlpha() {
      return alpha;
    },

    /* No-ops: transforms and path bookkeeping do not change what is *reachable*
       on screen for any sim here, and modelling them would mean writing a
       renderer rather than a recorder. */
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    clip: () => {},
    rect: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setLineDash: () => {},
    setTransform: () => {},
    /* Recorded as geometry as well as radii: a glow is a filled circle, and a
       NaN in its radius drops it exactly the way a NaN in an arc does. */
    createRadialGradient: (_x0: number, _y0: number, r0: number, x1: number, y1: number, r1: number) => {
      glowRadii.push(r0, r1);
      push('gradient', x1 - r1, x1 + r1, y1 - r1, y1 + r1);
      return gradient;
    },
    createLinearGradient: () => gradient,

    moveTo: (x: number, y: number) => push('point', x, x, y, y),
    lineTo: (x: number, y: number) => push('point', x, x, y, y),
    arc: (x: number, y: number, r: number) => push('arc', x - r, x + r, y - r, y + r),
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      push('ellipse', x - rx, x + rx, y - ry, y + ry),
    fillRect: (x: number, y: number, w: number, h: number) =>
      push('rect', Math.min(x, x + w), Math.max(x, x + w), Math.min(y, y + h), Math.max(y, y + h)),

    measureText: (text: string) => ({ width: text.length * fontPx * WIDTH_RATIO }) as TextMetrics,

    fillText: (text: string, x: number, y: number) => {
      const width = text.length * fontPx * WIDTH_RATIO;
      const left =
        align === 'center'
          ? x - width / 2
          : align === 'right' || align === 'end'
            ? x - width
            : x;
      // Ascent and descent as fractions of the font size: enough to catch a
      // caption pushed off the top or bottom edge.
      push('text', left, left + width, y - fontPx * 0.8, y + fontPx * 0.2, text);
    },
  };

  return { ctx: ctx as unknown as CanvasRenderingContext2D, records, glowRadii, alphas };
}

/**
 * Glow radii that are not a finite, non-negative number.
 *
 * A glow is sized from the body it sits behind, and the body's drawn radius is
 * itself derived from an auto-scale that divides by a span the sliders can take
 * to zero. That is the path by which a glow radius becomes `NaN` or `Infinity`,
 * and canvas answers a non-finite gradient by throwing on some engines and
 * silently drawing nothing on others.
 */
export function badGlowRadii(radii: number[]): number[] {
  return radii.filter((r) => !Number.isFinite(r) || r < 0);
}

/**
 * Alphas outside `[0, limit]`.
 *
 * Canvas clamps `globalAlpha` silently, so an out-of-range value is invisible in
 * the picture and still wrong: a trail computed to alpha 3 is a trail whose fade
 * has stopped fading, and one computed to `NaN` is ignored entirely, leaving the
 * *previous* alpha applied to everything drawn after it.
 */
export function alphasOutOfRange(alphas: number[], limit = 1): number[] {
  return alphas.filter((a) => !Number.isFinite(a) || a < 0 || a > limit);
}

/** Text records that fall outside the frame, with half a pixel of slack. */
export function textOutsideFrame(records: DrawRecord[], w: number, h: number): DrawRecord[] {
  return records.filter(
    (r) => r.kind === 'text' && (r.x0 < -0.5 || r.x1 > w + 0.5 || r.y0 < -0.5 || r.y1 > h + 0.5),
  );
}

/**
 * Pairs of labels that share screen area.
 *
 * Canvas has no layout: a label goes where it is told and paints over whatever
 * is already there, so two captions can merge into one unreadable run — "strain
 * h" and "35.1 Hz" arriving as `strai35.1 Hz` — with nothing outside the frame
 * and nothing non-finite. The only way to see it without eyes on the picture is
 * to compare the rectangles.
 *
 * A pixel of slack in each axis: glyph boxes include side bearing, so labels
 * that merely sit next to each other should not read as a collision.
 */
export function textCollisions(records: DrawRecord[]): [DrawRecord, DrawRecord][] {
  const texts = records.filter((r) => r.kind === 'text');
  const pairs: [DrawRecord, DrawRecord][] = [];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i]!;
      const b = texts[j]!;
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (overlapX > 1 && overlapY > 1) pairs.push([a, b]);
    }
  }
  return pairs;
}

/** Anything drawn with a NaN or an Infinity in it. */
export function nonFiniteDraws(records: DrawRecord[]): DrawRecord[] {
  return records.filter((r) => !r.finite);
}

/** A one-line description for an assertion message. */
export function describeRecord(r: DrawRecord): string {
  const label = r.text === undefined ? r.kind : `${r.kind} "${r.text}"`;
  return `${label} x[${r.x0.toFixed(1)}, ${r.x1.toFixed(1)}] y[${r.y0.toFixed(1)}, ${r.y1.toFixed(1)}]`;
}

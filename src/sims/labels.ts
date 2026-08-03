/**
 * Keeping canvas labels off each other.
 *
 * A label drawn on a canvas has no layout: it goes where it is told and paints
 * over whatever is already there. Two labels that read cleanly at 900 px can
 * merge into `strai35.1 Hz` at 390 px, and nothing fails — the frame is still
 * full of text, none of it outside the edges, and only a person looking at the
 * picture can tell.
 *
 * So placement is measured rather than nudged. Every helper here works from
 * `measureText` and the current font, produces a rectangle, and resolves
 * conflicts against other rectangles. A hardcoded offset would be a guess about
 * one string at one width; these hold for any string at any width, which is what
 * a sim with live readouts and seven decades of slider range needs.
 *
 * The ascent and descent fractions match the recording context the canvas tests
 * replay against, so a sim that places itself with these is judged by the same
 * ruler it used.
 */

export interface LabelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Ascent above the baseline, as a fraction of the font size. */
const ASCENT = 0.8;
/** Descent below it. */
const DESCENT = 0.2;

/** The font size in px, read back off the context. */
export function fontSizeOf(ctx: CanvasRenderingContext2D): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
  return match?.[1] ? Number(match[1]) : 10;
}

/**
 * Where a string would land if drawn at (x, y) with the context's alignment.
 *
 * Measured, not estimated: the caller has already set the font it will draw
 * with, so `measureText` answers for that font and this box is the truth about
 * where the glyphs go.
 */
export function labelBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign = ctx.textAlign,
): LabelBox {
  const width = ctx.measureText(text).width;
  const size = fontSizeOf(ctx);
  const x0 = align === 'center' ? x - width / 2 : align === 'right' || align === 'end' ? x - width : x;
  return { x0, x1: x0 + width, y0: y - size * ASCENT, y1: y + size * DESCENT };
}

/** Do two boxes share any area? `pad` widens both first. */
export function overlaps(a: LabelBox, b: LabelBox, pad = 0): boolean {
  return (
    Math.min(a.x1, b.x1) + pad > Math.max(a.x0, b.x0) - pad &&
    Math.min(a.y1, b.y1) + pad > Math.max(a.y0, b.y0) - pad
  );
}

/** The same box moved horizontally. */
export function shifted(box: LabelBox, dx: number): LabelBox {
  return { ...box, x0: box.x0 + dx, x1: box.x1 + dx };
}

/**
 * The first candidate baseline that clears every obstacle, or the last one.
 *
 * Candidates are tried in order of preference, so a caller lists where it would
 * *like* the label and what it will settle for. Falling back to the last
 * candidate rather than refusing to draw is deliberate: a label that vanishes at
 * one slider setting is a worse bug than one that is merely in its second-choice
 * position, and the canvas tests would not catch the disappearance.
 */
export function firstClearPlacement(
  ctx: CanvasRenderingContext2D,
  text: string,
  candidates: { x: number; y: number; align: CanvasTextAlign }[],
  obstacles: LabelBox[],
  pad = 2,
): { x: number; y: number; align: CanvasTextAlign } {
  for (const candidate of candidates) {
    const box = labelBox(ctx, text, candidate.x, candidate.y, candidate.align);
    if (!obstacles.some((obstacle) => overlaps(box, obstacle, pad))) return candidate;
  }
  return candidates[candidates.length - 1] ?? { x: 0, y: 0, align: 'left' };
}

export interface RowLabel {
  text: string;
  /** Where the label would sit if nothing else were on the row. */
  cx: number;
}

export interface PlacedLabel {
  text: string;
  cx: number;
  y: number;
}

/**
 * Two captions on one row, pulled apart until they stop touching.
 *
 * Used where a pair of labels each belong under a thing they name and the two
 * things can be any distance apart — a black hole beside a comparison object
 * whose relative sizes span twenty orders of magnitude. At most settings the
 * natural centres are far apart and nothing moves; where they are not, the pair
 * is separated by `gap` and slid as a unit until both fit between `left` and
 * `right`.
 *
 * When the row cannot hold both at any position they are stacked instead, one
 * per line, because a caption that has been squeezed until it overlaps its
 * neighbour is not a caption any more.
 */
export function layOutRow(
  ctx: CanvasRenderingContext2D,
  labels: [RowLabel, RowLabel],
  left: number,
  right: number,
  y: number,
  lineHeight: number,
  gap = 10,
): PlacedLabel[] {
  const [first, second] = labels;
  const widthOf = (label: RowLabel) => ctx.measureText(label.text).width;
  const wa = widthOf(first);
  const wb = widthOf(second);
  const available = right - left;

  if (wa + gap + wb > available) {
    // No arrangement fits: give each its own line, centred where it can be.
    const centre = (w: number, cx: number) =>
      w >= available ? (left + right) / 2 : Math.min(right - w / 2, Math.max(left + w / 2, cx));
    return [
      { text: first.text, cx: centre(wa, first.cx), y },
      { text: second.text, cx: centre(wb, second.cx), y: y + lineHeight },
    ];
  }

  // Both fit on the row. Start from where each wants to be, clamped to the
  // frame, then enforce the gap by moving whichever has room to give.
  let ax = Math.min(right - wa, Math.max(left, first.cx - wa / 2));
  let bx = Math.min(right - wb, Math.max(left, second.cx - wb / 2));

  if (bx < ax + wa + gap) {
    bx = ax + wa + gap;
    if (bx + wb > right) {
      bx = right - wb;
      ax = Math.max(left, bx - gap - wa);
    }
  }

  return [
    { text: first.text, cx: ax + wa / 2, y },
    { text: second.text, cx: bx + wb / 2, y },
  ];
}

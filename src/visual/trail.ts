/**
 * A fixed-length trail of prior positions, with no allocation after setup.
 *
 * The whole point of this file is what it does *not* do. A trail is the easiest
 * place in a canvas sim to accidentally allocate sixty times a second — push to
 * an array, `slice` off the tail, `map` to screen coordinates — and the cost
 * does not show up as a slow frame, it shows up as a garbage collection pause
 * every few seconds that reads as the animation stuttering. So: one
 * `Float64Array` allocated once, a write index, and integer arithmetic.
 *
 * **This holds pixels, never physics.** A position goes in after the physics has
 * already produced it, and nothing here is ever read back into a calculation or
 * a readout. The trail is a record of where a body *was*, drawn at decaying
 * alpha; it does not smooth, lead, lag or interpolate where the body *is*. The
 * head of the trail is the same point the body is drawn at, from the same
 * number, on the same frame.
 *
 * Length is a count of retained positions, not a duration. At a fixed frame rate
 * those are the same thing, but they part company the moment a frame is dropped
 * or the tab is backgrounded — and a time-based trail would then either stretch
 * or evaporate depending on how busy the machine was, which is a picture that
 * changes for reasons that have nothing to do with the physics.
 */

export interface Trail {
  /** Interleaved x, y pairs. Length is `2 * capacity`. Allocated once. */
  readonly xy: Float64Array;
  readonly capacity: number;
  /** Valid entries, saturating at `capacity`. */
  count: number;
  /** Index of the next write slot, in pairs. */
  head: number;
}

/** The most a trail may ever contribute to a pixel. Keeps it decoration. */
export const MAX_TRAIL_ALPHA = 0.5;

export function createTrail(capacity: number): Trail {
  return { xy: new Float64Array(capacity * 2), capacity, count: 0, head: 0 };
}

/**
 * Forget everything retained so far.
 *
 * Call this whenever the scene the positions were recorded in stops being the
 * scene being drawn — a parameter change, a reset, a resize. The stored points
 * are only meaningful against the geometry that produced them, and a trail left
 * over from the previous orbit is a line through space the planet never took.
 */
export function resetTrail(trail: Trail): void {
  trail.count = 0;
  trail.head = 0;
}

/** Record one position. Overwrites the oldest once full. */
export function pushTrail(trail: Trail, x: number, y: number): void {
  // A non-finite sample would poison the buffer for `capacity` frames, and the
  // canvas would silently drop every path containing it.
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const i = trail.head * 2;
  trail.xy[i] = x;
  trail.xy[i + 1] = y;
  trail.head = (trail.head + 1) % trail.capacity;
  if (trail.count < trail.capacity) trail.count += 1;
}

/**
 * Draw the trail, newest brightest, as dots of decaying alpha and radius.
 *
 * The transform is passed as four numbers rather than a projection function, so
 * that the hot loop closes over nothing and allocates nothing:
 *
 *     screenX = ax + x * bx
 *     screenY = ay + y * by
 *
 * For a sim whose trail already holds screen coordinates that is `(0, 1, 0, 1)`.
 * For one holding world coordinates it is the same scale-and-offset the rest of
 * its scene is drawn with, so the trail cannot drift away from the body it
 * belongs to.
 *
 * `fillStyle` is set once. Alpha varies through `globalAlpha`, which is a number
 * — a per-dot `rgba(...)` string would mint one string per dot per frame, which
 * is exactly the allocation this file exists to avoid.
 */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: Trail,
  color: string,
  headRadius: number,
  ax: number,
  bx: number,
  ay: number,
  by: number,
): void {
  if (trail.count === 0 || !(headRadius > 0)) return;

  ctx.fillStyle = color;

  for (let age = 0; age < trail.count; age += 1) {
    // 1 at the head, approaching 0 at the tail.
    const freshness = 1 - age / trail.count;
    const alpha = MAX_TRAIL_ALPHA * freshness * freshness;
    if (!(alpha > 0.004)) continue;

    // Walk backwards from the most recent write, wrapping.
    const slot = (trail.head - 1 - age + trail.capacity * 2) % trail.capacity;
    const x = trail.xy[slot * 2] ?? 0;
    const y = trail.xy[slot * 2 + 1] ?? 0;

    const radius = headRadius * (0.35 + 0.65 * freshness);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(ax + x * bx, ay + y * by, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

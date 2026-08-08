/**
 * A radial glow behind a luminous body, sized from the body and capped so it
 * cannot reach anything that carries meaning.
 *
 * Two constraints shaped this, and both are about the glow staying decoration:
 *
 * **It is measured from the body, never chosen.** The radius is a multiple of
 * the radius the body is actually drawn at, so a star that the auto-scaling
 * draws small gets a small glow. A fixed pixel radius would make the glow read
 * as a size in its own right, and on a sim that rescales across twenty orders of
 * magnitude it would silently become a claim about the body.
 *
 * **It is capped away from the frame and from labels.** A glow that runs off the
 * canvas looks like the body is larger than the frame, and a glow that washes
 * over a text label costs contrast on something a reader has to read.
 * `glowRadius` takes the keep-out rectangles and returns the largest radius that
 * clears them, which is often smaller than the aesthetic ideal — that is the
 * correct trade and it is made here rather than by eye.
 *
 * Nothing in this file is allocation-free by accident. `createRadialGradient`
 * mints an object every call, so a glow drawn naively is one allocation per body
 * per frame; the cache below makes it one per *change* of position or radius,
 * which for a body that holds still is one for the life of the scene.
 */

/** Single-entry memo for one glow site. Allocate once, outside the frame. */
export interface GlowCache {
  ctx: CanvasRenderingContext2D | null;
  x: number;
  y: number;
  r: number;
  gradient: CanvasGradient | null;
}

export function createGlowCache(): GlowCache {
  return { ctx: null, x: Number.NaN, y: Number.NaN, r: Number.NaN, gradient: null };
}

/** Shortest distance from a point to an axis-aligned rectangle; 0 if inside. */
function distanceToRect(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dy = Math.max(y0 - y, 0, y - y1);
  return Math.hypot(dx, dy);
}

/**
 * The largest glow radius at `(x, y)` that stays inside the canvas and clear of
 * every keep-out rectangle.
 *
 * `keepOut` is a flat `[x0, y0, x1, y1, …]` array so a caller can hold one
 * preallocated buffer and refill it per scene rather than building rectangles
 * per frame. Pass `null` when there is nothing to avoid.
 */
export function glowRadius(
  desired: number,
  x: number,
  y: number,
  width: number,
  height: number,
  keepOut: Float64Array | null,
  keepOutCount = 0,
): number {
  if (!Number.isFinite(desired) || !Number.isFinite(x) || !Number.isFinite(y)) return 0;

  // Never past an edge: the glow would read as a body wider than the frame.
  let limit = Math.min(desired, x, y, width - x, height - y);

  for (let i = 0; i < keepOutCount; i += 1) {
    const o = i * 4;
    const gap = distanceToRect(
      x,
      y,
      keepOut?.[o] ?? 0,
      keepOut?.[o + 1] ?? 0,
      keepOut?.[o + 2] ?? 0,
      keepOut?.[o + 3] ?? 0,
    );
    if (gap < limit) limit = gap;
  }

  return limit > 0 ? limit : 0;
}

/**
 * Paint the glow. Reuses the cached gradient when nothing about it has moved.
 *
 * The context is part of the cache key: a gradient belongs to the context that
 * created it, and a React remount hands us a new canvas with a new context while
 * a module-scoped cache survives. Comparing the reference is free and it is what
 * stops a stale gradient from being reused against a context it never came from.
 */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  cache: GlowCache,
  x: number,
  y: number,
  radius: number,
  inner: string,
  outer: string,
): void {
  if (!(radius > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;

  if (cache.gradient === null || cache.ctx !== ctx || cache.x !== x || cache.y !== y || cache.r !== radius) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    cache.ctx = ctx;
    cache.x = x;
    cache.y = y;
    cache.r = radius;
    cache.gradient = gradient;
  }

  ctx.fillStyle = cache.gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * A canvas's CSS size without a forced layout, shared by every sim.
 *
 * Each sim's paint used to open with `canvas.getBoundingClientRect()`. Called
 * after a React update, that read forces the browser to finish layout on the
 * spot, once per slider tick, before a single pixel is drawn. The size only
 * changes when the canvas is resized, so it is read once from the
 * `ResizeObserver` the sim already needed for repainting, and cached.
 *
 * The observer both records the size and repaints, in that order, in one
 * callback. Two separate observers would not be safe: callbacks run in the
 * order observers were created, so a sim's own repaint observer could fire
 * before a caching one and paint at the old size.
 */

import { trackSimCanvas } from '@/visual/simVisibility';

interface Size {
  width: number;
  height: number;
}

const sizes = new WeakMap<HTMLCanvasElement, Size>();

/**
 * The canvas's CSS width and height, px: the cached size once the observer has
 * reported, and a direct measurement before that (the first paint, which runs
 * before any observation has been delivered).
 */
export function canvasSize(canvas: HTMLCanvasElement): Size {
  const cached = sizes.get(canvas);
  if (cached) return cached;
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Watches a canvas: on every size change, records the new size, then calls
 * `onResize` (the sim's repaint). Returns the cleanup for a `useEffect`.
 */
export function observeCanvasSize(canvas: HTMLCanvasElement, onResize: () => void): () => void {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // The border box is what getBoundingClientRect measured; the canvases
      // carry no border or padding, so it equals the content box too.
      const box = entry.borderBoxSize?.[0];
      sizes.set(
        canvas,
        box
          ? { width: box.inlineSize, height: box.blockSize }
          : { width: entry.contentRect.width, height: entry.contentRect.height },
      );
    }
    onResize();
  });
  observer.observe(canvas);
  // Every sim registers here, so this is also where the starfield learns that
  // a sim is on screen and can pause (see `visual/simVisibility`).
  const untrack = trackSimCanvas(canvas);
  return () => {
    observer.disconnect();
    untrack();
    sizes.delete(canvas);
  };
}

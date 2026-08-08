/**
 * The starfield as a mounted canvas: one element, one loop, behind everything.
 *
 * Mounted once in `AppShell`, above the routed page in the tree, so it survives
 * navigation — the sky does not restart when a reader opens a module, because
 * this component never unmounts.
 *
 * It is `position: fixed` and therefore out of flow, which is the whole reason
 * it can be added to a released page at all: it contributes no height, occupies
 * no grid cell, and cannot move anything. The site's CLS of 0 is preserved by
 * construction rather than by measurement.
 *
 * Everything that moves is imperative and lives in refs. Not one frame of this
 * animation causes a React render — a `useState` per frame would re-render the
 * entire app shell sixty times a second to move some dots.
 */
import { useCallback, useEffect, useRef } from 'react';
import { DISTANCE, DURATION } from '@/motion/tokens';
import { useRafLoop } from '@/motion/useRafLoop';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { drawStars, generateStars, type Star } from './stars';

/**
 * Fixed, so the sky is the same on every visit and every reload. There is
 * nothing to tune here — a different value is a different sky, not a better one.
 */
const SEED = 0x10de57a2;

/**
 * Retina is worth it for one-pixel stars; a 3× phone is not. Past 2 the cost is
 * a backing store four times the area of a 1× one, to render dots the eye
 * cannot resolve any better.
 */
const MAX_DPR = 2;

/** Resizes arrive in bursts while a window is dragged. Regenerate once, at the end. */
const RESIZE_DEBOUNCE_MS = 150;

/** Peak pointer-driven displacement, before each layer's parallax factor. */
const POINTER_TRAVEL = DISTANCE.drift;

/** Peak scroll-driven displacement, across the whole length of the page. */
const SCROLL_TRAVEL = DISTANCE.drift;

/**
 * Time constant of the damping, in milliseconds — the offset closes ~63% of the
 * remaining gap to its target every `SMOOTHING_TAU` of elapsed time.
 */
const SMOOTHING_TAU = DURATION.slow;

interface Vec {
  x: number;
  y: number;
}

export function Starfield() {
  const reduced = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const sizeRef = useRef({ width: 0, height: 0 });

  /* Where the parallax is heading, and where it actually is. */
  const scrollTargetRef = useRef(0);
  const pointerTargetRef = useRef<Vec>({ x: 0, y: 0 });
  const offsetRef = useRef<Vec>({ x: 0, y: 0 });
  const elapsedRef = useRef(0);

  const paint = useCallback((timeMs: number, twinkle: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    ctx.clearRect(0, 0, width, height);
    const offset = offsetRef.current;
    drawStars(ctx, starsRef.current, offset.x, offset.y, timeMs, twinkle);
  }, []);

  /**
   * Size the backing store to the device pixels available, then scale the
   * context so everything downstream can keep thinking in CSS pixels.
   */
  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // Assigning `width`/`height` resets the whole context state, transform
    // included, so the scale has to be reapplied here and not at setup.
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    sizeRef.current = { width, height };
    // Same seed, so a resize re-cuts the same sky to a new frame rather than
    // dealing a new one — a reader rotating a phone should not get new stars.
    starsRef.current = generateStars(SEED, width, height);
  }, []);

  /* Size now, and again whenever the viewport changes. */
  useEffect(() => {
    measure();
    paint(0, false);

    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        measure();
        // Repaint immediately. Under reduced motion there is no loop coming
        // along behind to do it, and with one the extra frame is invisible.
        paint(elapsedRef.current, false);
      }, RESIZE_DEBOUNCE_MS);
    });
    observer.observe(canvas);

    return () => {
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
    };
  }, [measure, paint]);

  /*
   * Reduced motion: one frame, no twinkle, no parallax, and — because
   * `useRafLoop` is handed `active: false` below — no loop to cancel.
   */
  useEffect(() => {
    if (!reduced) return;
    offsetRef.current.x = 0;
    offsetRef.current.y = 0;
    paint(0, false);
  }, [reduced, paint]);

  /* Read the two inputs. Both are passive listeners: neither ever calls
     preventDefault, and a non-passive scroll listener on the window is one of
     the classic ways to make a page feel heavy. */
  useEffect(() => {
    if (reduced) return;

    const onScroll = () => {
      // `scrollHeight` is a layout read inside a scroll handler, which is the
      // classic way to force a synchronous reflow — it is safe here because
      // scrolling alone does not invalidate layout, so the value comes from the
      // cache the browser already has. The page height also genuinely changes
      // when a layer accordion opens, and re-reading is how this notices.
      const doc = document.documentElement;
      const travel = doc.scrollHeight - window.innerHeight;
      // As a fraction of the page rather than an absolute pixel count: the
      // offset then stays bounded on a page of any length, which is what lets
      // `drawStars` skip wrapping entirely.
      const progress = travel > 0 ? Math.min(1, Math.max(0, window.scrollY / travel)) : 0;
      // Negative: the reader moves down the page, the sky drifts up behind it.
      scrollTargetRef.current = -progress * SCROLL_TRAVEL;
    };

    const onPointerMove = (event: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === 0 || h === 0) return;
      // −1…1 from the centre of the viewport, inverted so the field leans away
      // from the cursor and reads as parallax rather than as a magnet.
      pointerTargetRef.current.x = -((event.clientX / w) * 2 - 1) * POINTER_TRAVEL;
      pointerTargetRef.current.y = -((event.clientY / h) * 2 - 1) * POINTER_TRAVEL;
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [reduced]);

  /*
   * The one loop. `useRafLoop` owns the frame, the visibility pause and the
   * teardown; nothing here starts a second one.
   *
   * The damping is frame-rate independent on purpose. The naive form —
   * `offset += (target − offset) × 0.1` — is a different curve at 144 Hz than
   * at 60 Hz, so the same page eases at two speeds on two machines. Solving the
   * decay over the real elapsed time instead makes the *time* constant, which
   * is the thing a reader can actually perceive.
   */
  useRafLoop((deltaMs) => {
    const factor = 1 - Math.exp(-deltaMs / SMOOTHING_TAU);
    const offset = offsetRef.current;
    const pointer = pointerTargetRef.current;

    offset.x += (pointer.x - offset.x) * factor;
    offset.y += (pointer.y + scrollTargetRef.current - offset.y) * factor;

    elapsedRef.current += deltaMs;
    paint(elapsedRef.current, true);
  }, !reduced);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      /* `role="presentation"` as well as `aria-hidden`: a bare <canvas> is an
         img-role element to some AT, and belt-and-braces costs nothing here.
         No `tabIndex` — a canvas with no fallback content is already outside
         the tab order, and adding `-1` would only make it focusable by script. */
      role="presentation"
      className="pointer-events-none fixed inset-0 h-full w-full"
    />
  );
}

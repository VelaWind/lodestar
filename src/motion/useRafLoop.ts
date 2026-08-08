/**
 * One `requestAnimationFrame` loop, correctly torn down.
 *
 * The sims each hand-roll their own loop, and they are staying as they are —
 * they are driving a physics integration and own their pacing. This is for the
 * decorative motion the visual passes add: one loop per component, paused when
 * the tab is not visible, cancelled on unmount, and handed a delta that is
 * already clamped so nothing can jump.
 *
 * The clamp is the part that is easy to leave out and expensive to leave out.
 * `requestAnimationFrame` does not fire in a background tab, so the first frame
 * after a reader comes back from ten minutes elsewhere reports a delta of ten
 * minutes. Anything integrating against that delta — a drift, a rotation, a
 * parallax offset — teleports. Capping the delta at `MAX_DELTA_MS` costs a few
 * milliseconds of lost simulated time at the resume and buys the guarantee that
 * a frame can never advance the animation by more than one frame's worth.
 */
import { useEffect, useRef } from 'react';

/** Two and a half frames at 50 Hz — generous for a slow frame, far short of a jump. */
const MAX_DELTA_MS = 50;

/**
 * The loop itself, with no React in it.
 *
 * Split out from the hook so it can be tested directly: this repo's test suite
 * runs in a plain Node environment with no DOM (see `vitest.config.ts`), so
 * there is no renderer to mount a hook into. Reading the globals by bare name
 * rather than capturing them lets a test stand up a fake `requestAnimationFrame`
 * and `document` on `globalThis` and drive the real code path. Exposed through
 * `__internals`, which is how the sims already publish test-only surface.
 */
function startRafLoop(callback: (deltaMs: number) => void): () => void {
  // No rAF at all — server render, or a test with no DOM. Nothing to start and
  // nothing to cancel, so hand back a teardown that is honestly a no-op.
  if (typeof requestAnimationFrame === 'undefined') return () => {};

  let frame: number | null = null;
  let last: number | null = null;
  let stopped = false;

  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

  const schedule = () => {
    // Three separate reasons not to schedule, and all three have to be checked
    // here rather than at the call sites: stopped (unmounted), already pending
    // (this is a *single* loop — a second frame in flight is the classic
    // double-speed bug), and hidden.
    if (stopped || frame !== null || hidden()) return;
    frame = requestAnimationFrame(tick);
  };

  function tick(now: number) {
    // Cleared before the callback runs, so a callback that itself triggers a
    // reschedule cannot see a stale pending frame.
    frame = null;
    const elapsed = last === null ? 0 : now - last;
    last = now;
    callback(Math.min(MAX_DELTA_MS, Math.max(0, elapsed)));
    schedule();
  }

  const onVisibilityChange = () => {
    if (!hidden()) {
      schedule();
      return;
    }
    // Hidden. The frame almost certainly will not fire anyway, but cancelling
    // is what makes "does not schedule while hidden" true rather than merely
    // usually true.
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  schedule();

  return () => {
    stopped = true;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}

export function useRafLoop(callback: (deltaMs: number) => void, active = true): void {
  /*
   * The callback lives in a ref so the loop does not restart when it changes.
   * Without this, a caller would have to wrap every callback in `useCallback`
   * with a complete dependency list, and the day they forgot, the loop would
   * tear down and rebuild on every render — which looks like a stutter and is
   * miserable to trace back to here.
   */
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!active) return;
    return startRafLoop((deltaMs) => latest.current(deltaMs));
  }, [active]);
}

/** Test-only surface. Not part of the API any component should reach for. */
export const __internals = { startRafLoop, MAX_DELTA_MS };

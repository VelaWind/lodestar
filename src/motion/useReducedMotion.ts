/**
 * `prefers-reduced-motion`, read as a boolean that is live for the lifetime of
 * the component.
 *
 * Framer Motion already ships a hook by this name, and the sims use it. This is
 * not a replacement for it and does not touch it — it exists because the
 * foundation needs two guarantees Framer's version does not give:
 *
 *   - It returns `boolean`, never `null`. Framer's returns `null` until it has
 *     resolved, which forces every call site into a three-way branch and, in
 *     practice, into treating "not yet known" as "motion is fine".
 *   - When `matchMedia` is unavailable it returns `true`, not `false`. That is
 *     the fail-safe direction: an environment we cannot ask is an environment
 *     where we do not animate. The cost of being wrong that way is a static
 *     page; the cost of being wrong the other way is motion shown to someone
 *     who asked not to see it, which is an accessibility defect.
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Read the preference now, or `true` if there is nothing to read it from —
 * server rendering, a test runner with no DOM, or a browser old enough to lack
 * `matchMedia`.
 */
function currentPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  // Lazy initialiser, not an effect: the correct value has to be there on the
  // *first* render, or a component that skips its entrance under reduced motion
  // would still play one frame of it before the effect corrected the state.
  const [reduced, setReduced] = useState(currentPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(QUERY);

    /*
     * No re-read here, deliberately. The obvious defensive move is to call
     * `setReduced(list.matches)` on subscribe, in case the preference changed
     * between the render that seeded the state and the effect that started
     * listening. That trade is a bad one: it costs a second render on every
     * mount of every component that uses motion, to cover a reader toggling an
     * OS setting inside a single commit. The initialiser ran in the same tick;
     * anything after this line is caught by the listener.
     */
    if (typeof list.addEventListener !== 'function') return;
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

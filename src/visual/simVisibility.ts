/**
 * Whether any simulation canvas is on screen right now.
 *
 * The starfield behind the page animates every frame, full screen. While a
 * reader is looking at a sim, which also animates and is what they came for,
 * the two compete for the same frame budget on a slow phone, and the sky loses
 * nothing by holding still: it is behind the sim panel and dim. So the
 * starfield pauses while a sim canvas intersects the viewport and resumes,
 * from where it stopped, when none does.
 *
 * Every sim already registers its canvas through `observeCanvasSize`, which
 * calls `trackSimCanvas` here, so no sim knows about the starfield.
 */
type Listener = () => void;

const onScreen = new Set<Element>();
const listeners = new Set<Listener>();
let observer: IntersectionObserver | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

/** Starts watching a sim canvas; returns the cleanup. */
export function trackSimCanvas(element: Element): () => void {
  if (typeof IntersectionObserver === 'undefined') return () => {};
  observer ??= new IntersectionObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        if (!onScreen.has(entry.target)) changed = true;
        onScreen.add(entry.target);
      } else if (onScreen.delete(entry.target)) {
        changed = true;
      }
    }
    if (changed) notify();
  });
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    if (onScreen.delete(element)) notify();
  };
}

/** For `useSyncExternalStore`. */
export function subscribeSimOnScreen(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** For `useSyncExternalStore`: true while any sim canvas is on screen. */
export function simOnScreen(): boolean {
  return onScreen.size > 0;
}

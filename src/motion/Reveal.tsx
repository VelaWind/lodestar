/**
 * An entrance that happens once, when the thing being revealed is actually on
 * screen.
 *
 * The whole design is constrained by one rule: **the children are in the DOM
 * from the first render, always.** They are never behind a conditional, never
 * behind `AnimatePresence`, never waiting on an effect. Everything this
 * component does is a style on a wrapper — the subtree it wraps is mounted and
 * readable before any observer has fired. That is what keeps the reveal from
 * touching anything that matters: a crawler, a screen reader, "find in page",
 * a printed page and the prose snapshots all see the finished document, and a
 * failure anywhere in the animation path degrades to "the content is simply
 * there", never to "the content is missing".
 *
 * Only `opacity` and `transform` are animated. Both are composited, neither
 * triggers layout, so a reveal cannot shift anything — the page's CLS of 0
 * survives this by construction rather than by measurement. Animating `height`,
 * `top`, `margin` or `padding` here would be a defect, not a style choice.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DISTANCE, DURATION, EASE } from './tokens';
import { useReducedMotion } from './useReducedMotion';

/**
 * A layout effect on the client, a plain effect on the server.
 *
 * `useLayoutEffect` is the whole mechanism below — it is the only hook that runs
 * after the DOM has been mutated and *before* the browser paints, which is the
 * one window in which an element's box can be measured and its style corrected
 * without a frame ever reaching the screen in between. On the server there is no
 * paint to be ahead of, and calling it there is only a warning in the log.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * What a Reveal is doing right now.
 *
 *   `unmeasured` — first render. Renders at its *final* state, styled with
 *                  nothing at all, because nothing is yet known about where the
 *                  box landed.
 *   `static`     — never animates: reduced motion, no IntersectionObserver, or
 *                  measured to be in the initial viewport.
 *   `waiting`    — measured to be entirely outside the initial viewport, so it
 *                  is hidden and waiting for its observer.
 *   `entered`    — the observer fired; this is the entrance.
 */
type Mode = 'unmeasured' | 'static' | 'waiting' | 'entered';

/**
 * Does this box have any part of it inside the initial viewport?
 *
 * Deliberately "any part", not the observer's 15%. The question this answers is
 * not "should this animate" but "can the reader see it right now", and one
 * visible pixel is enough to make a fade to opacity 0 a thing that happened on
 * screen. Pure, and exported for the test, because the alternative is asserting
 * it through a browser.
 */
function startsVisible(rect: { top: number; bottom: number }, viewportHeight: number): boolean {
  return rect.top < viewportHeight && rect.bottom > 0;
}

/**
 * Fire once 15% of the element's box is on screen. A pure `0` threshold trips
 * on the first sliver of a tall section, which starts the entrance while the
 * element is still essentially off screen and wastes it; waiting for a real
 * fraction means the reader sees the movement they were meant to see.
 */
const THRESHOLD = 0.15;

const EASE_OUT = `cubic-bezier(${EASE.out.join(', ')})`;

/**
 * The elements a Reveal is allowed to be.
 *
 * Deliberately a short list rather than `ElementType`. The wrapper has to be a
 * box that generates layout (see the note further down about `display:
 * contents`), and it has to be legal where it is used — the reason this exists
 * at all is that a grid of cards is a `<ul>`, and a `<div>` between the list and
 * its `<li>` is both invalid markup and a silent change to what the list means
 * to a screen reader.
 */
type RevealTag = 'div' | 'li' | 'section' | 'article' | 'span';

interface Props {
  children: ReactNode;
  /** Milliseconds to hold before starting. Stagger siblings with this. */
  delay?: number;
  /** Pixels of upward travel. Defaults to `DISTANCE.rise`. */
  distance?: number;
  className?: string;
  /**
   * What to render. Defaults to a `div`. Set it when a `div` would be illegal
   * or would change the document's meaning — inside a list, above all, where
   * the Reveal should *be* the `<li>` rather than sit inside one.
   */
  as?: RevealTag;
}

export function Reveal({
  children,
  delay = DURATION.instant,
  distance = DISTANCE.rise,
  className,
  as = 'div',
}: Props): JSX.Element {
  const reduced = useReducedMotion();
  /* A callback ref rather than an object one: the element type varies with
     `as`, and a callback taking the base `HTMLElement` is assignable to every
     concrete element's ref where an object ref would need a cast per tag. */
  const ref = useRef<HTMLElement | null>(null);
  const setNode = (node: HTMLElement | null) => {
    ref.current = node;
  };

  /*
   * Nothing animates unless it is asked to, and the asking happens *after* the
   * box exists. `inert` is derived every render rather than captured, so a
   * reader who turns reduced motion on mid-session is obeyed immediately.
   */
  const inert = reduced || typeof IntersectionObserver === 'undefined';
  const [mode, setMode] = useState<Mode>('unmeasured');

  /*
   * The measurement, and the reason this is a *layout* effect.
   *
   * The obvious implementation of "skip the animation for anything already on
   * screen" is to start hidden and un-hide inside the first IntersectionObserver
   * callback. That is wrong in a way that does not show up in the code: an
   * observer callback is asynchronous and is delivered after layout, so the
   * frame in between is a real frame, and an element that was always on screen
   * paints once at opacity 0 before being corrected. On a module page that
   * element is the hook paragraph, which is the largest contentful paint, and
   * the browser will not count a paint at opacity 0 — so the fix costs the page
   * its LCP, measured at 508ms against 40ms, while looking correct.
   *
   * So the default is inverted. Every Reveal renders at its final state with no
   * style at all, and this effect — which runs after the DOM is mutated and
   * before the browser paints — pushes *only* boxes that are entirely outside
   * the viewport into the hidden state. An element the reader can see is never
   * assigned opacity 0 in any commit; an element they cannot see is assigned it
   * before the first paint, where being invisible is the point.
   */
  useIsomorphicLayoutEffect(() => {
    if (inert || mode !== 'unmeasured') return;

    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    setMode(startsVisible(rect, viewportHeight) ? 'static' : 'waiting');
  }, [inert, mode]);

  useEffect(() => {
    if (inert || mode !== 'waiting') return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMode('entered');
          // Once only. Nothing here re-hides, so a live observer would just be
          // a callback the page keeps paying for on every scroll.
          observer.disconnect();
        }
      },
      { threshold: THRESHOLD },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inert, mode]);

  /*
   * The wrapper is a plain `<div>`, not `display: contents`.
   *
   * `display: contents` was the tempting choice, since it is the only wrapper
   * that provably cannot change layout — but it is unusable *here* for exactly
   * that reason: an element with `display: contents` generates no box, and an
   * element with no box cannot be transformed or faded. The wrapper has to
   * generate a box or there is nothing to animate.
   *
   * So: a bare div carrying nothing but `opacity`, `transform` and the
   * transition between them. No display, no width, no padding, no margin, no
   * border. In normal flow it is a block that fills the same inline size its
   * children would have taken; as a flex or grid item it is the single item the
   * children would have been. The one thing a caller has to know is that it is
   * *one* box: wrapping several siblings of a `gap`-ed grid in a single Reveal
   * collapses them into one cell. Wrap each child separately and stagger them
   * with `delay` instead.
   */
  const style = inert ? undefined : revealStyle(mode, distance, delay);

  const Tag = as;

  return (
    <Tag ref={setNode} className={className} style={style}>
      {children}
    </Tag>
  );
}

/**
 * The inline style for each mode.
 *
 * `unmeasured` and `static` return nothing at all — not `opacity: 1`, not
 * `transform: none`, not an idle `transition`. An element that is never going to
 * animate should carry no evidence that it might: `will-change` and a transform
 * each promote it to its own compositor layer, and a page of layers costs memory
 * for an effect that is not running.
 */
function revealStyle(mode: Mode, distance: number, delay: number): CSSProperties | undefined {
  if (mode === 'unmeasured' || mode === 'static') return undefined;

  const transition = `opacity ${DURATION.slow}ms ${EASE_OUT} ${delay}ms, transform ${DURATION.slow}ms ${EASE_OUT} ${delay}ms`;

  if (mode === 'entered') {
    // No `willChange` once it is on its way in: the transition is the last thing
    // this element will ever do, and holding the layer past it is pure cost.
    return { opacity: 1, transform: 'none', transition };
  }

  return {
    opacity: 0,
    transform: `translateY(${distance}px)`,
    transition,
    willChange: 'opacity, transform',
  };
}

/** Test-only surface. Not part of the API any component should reach for. */
export const __internals = { startsVisible, revealStyle };

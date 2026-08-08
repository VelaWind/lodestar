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
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DISTANCE, DURATION, EASE } from './tokens';
import { useReducedMotion } from './useReducedMotion';

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
   * Two inputs, one derived answer. `crossed` is the only piece of state — did
   * the observer ever see this element — and the reasons to skip the animation
   * entirely are *derived* during render rather than written into state by an
   * effect. That ordering is what guarantees the promise in the header: if
   * there is no `IntersectionObserver` to tell us when to reveal, or the reader
   * has asked for less motion, `shown` is already true on the very first paint,
   * so the "no animation" path never flashes a frame at opacity 0 on its way to
   * being corrected.
   */
  const [crossed, setCrossed] = useState(false);
  const shown = crossed || reduced || typeof IntersectionObserver === 'undefined';

  useEffect(() => {
    if (shown) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCrossed(true);
          // Once only. Nothing here re-hides, so a live observer would just be
          // a callback the page keeps paying for on every scroll.
          observer.disconnect();
        }
      },
      { threshold: THRESHOLD },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

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
  const style: CSSProperties | undefined = reduced
    ? undefined
    : {
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translateY(${distance}px)`,
        transition: `opacity ${DURATION.slow}ms ${EASE_OUT} ${delay}ms, transform ${DURATION.slow}ms ${EASE_OUT} ${delay}ms`,
        // Only while there is something still to composite. Left on
        // permanently it pins a layer per revealed element for the life of the
        // page, which on a long module is a real memory cost for no benefit.
        willChange: shown ? undefined : 'opacity, transform',
      };

  const Tag = as;

  return (
    <Tag ref={setNode} className={className} style={style}>
      {children}
    </Tag>
  );
}

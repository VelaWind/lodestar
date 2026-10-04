/**
 * A box that scrolls sideways when what is in it is wider than the column: a
 * long equation on a phone, for instance.
 *
 * A scrolled box has to be reachable by keyboard, or a reader without a pointer
 * can see the start of an equation and never the end (axe's
 * `scrollable-region-focusable`). It becomes a focusable, labelled group only
 * while it actually overflows, so an equation that fits adds no tab stop. A
 * focused region scrolls with the arrow keys natively.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function ScrollX({
  className,
  label,
  children,
}: {
  className?: string;
  /** What the region holds, for a screen reader: "Equation", say. */
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    if (typeof ResizeObserver === 'undefined') return;
    // The box resizes with the column; its content changes when an equation
    // switches to numbers, and is replaced outright when KaTeX arrives and
    // swaps a placeholder for the typeset maths. So the children are watched
    // for size, and the subtree for replacement, which re-watches them.
    const measure = () => setOverflows(box.scrollWidth > box.clientWidth + 1);
    const resize = new ResizeObserver(measure);
    // KaTeX's web fonts can arrive after the maths is laid out and widen it
    // without resizing the box or anything observed in it.
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts?.addEventListener('loadingdone', measure);
    void fonts?.ready.then(measure);
    const watch = () => {
      resize.disconnect();
      resize.observe(box);
      for (const child of Array.from(box.children)) resize.observe(child);
    };
    watch();
    const mutation = new MutationObserver(watch);
    mutation.observe(box, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
      fonts?.removeEventListener('loadingdone', measure);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`overflow-x-auto ${className ?? ''}`}
      // A group, not a region: a page with several wide equations would
      // otherwise fill the landmark list with them.
      {...(overflows ? { tabIndex: 0, role: 'group', 'aria-label': `${label}, scrolls sideways` } : {})}
    >
      {children}
    </div>
  );
}

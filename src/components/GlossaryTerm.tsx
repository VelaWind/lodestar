/**
 * A term a reader can ask about, and the panel that answers.
 *
 * Renders a `term` node from the rich-text AST: the author's words, dotted-
 * underlined, with the glossary definition one hover, tap or keypress away.
 *
 * Three decisions worth stating, because each has a plausible-looking
 * alternative that does not work here:
 *
 * 1. **The panel is portalled to `document.body` and positioned `fixed`.**
 *    Every layer's body lives inside the accordion's `overflow-hidden` box —
 *    that clip is what makes the height animation read as a collapse, and it
 *    cuts horizontally too. An absolutely positioned panel would be sliced off
 *    at the panel edge, and any ancestor gaining a transform or a filter would
 *    silently re-root a `fixed` child that had not been portalled. Out of the
 *    tree entirely is the only placement that cannot be clipped, and `fixed`
 *    then means the trigger's viewport rect is the whole of the arithmetic.
 *    The cost is that a `fixed` panel is pinned to the viewport rather than to
 *    the word it belongs to, so it has to be told when the page moves: it
 *    re-measures on every scroll while the page is still settling — which is
 *    how it rides out the smooth scroll that Tab uses to bring a term into
 *    view — and only once the page has been still for `SCROLL_SETTLE_MS` does
 *    a further scroll mean the reader has moved on, and dismiss it.
 *
 * 2. **A trigger is a `<button>`, and the term node is a leaf.** Anything else
 *    is a div with a tabindex and a hand-rolled Enter handler, and the AST
 *    forbids nesting so a button can never come to contain a link.
 *
 * 3. **Opening is claimed through a module-level registry.** Two panels open at
 *    once is a layout accident and a screen-reader one; "one at a time" is a
 *    property of the page, not of any component, so it lives outside all of
 *    them rather than in a context every consumer would have to remember to
 *    provide.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { lookup } from '@/content/glossary';

/* ------------------------------------------------------------------ */
/* One open at a time                                                  */
/* ------------------------------------------------------------------ */

/** Every mounted trigger's "close yourself", keyed by its own panel id. */
const closers = new Map<string, () => void>();

function claim(id: string): void {
  for (const [other, close] of closers) if (other !== id) close();
}

/* ------------------------------------------------------------------ */
/* Announcing the definition                                           */
/* ------------------------------------------------------------------ */

/**
 * One live region for the whole page, created empty and never removed.
 *
 * The panel is portalled to the end of `<body>`, which is right for painting
 * and wrong for hearing: a screen-reader user gets the expanded state from
 * `aria-expanded` and then nothing, because the text that appeared is nowhere
 * near where they are reading. `aria-describedby` would not help either — it is
 * read on focus, and the panel does not exist until focus has already happened.
 *
 * So the definition is spoken through a live region instead. Two properties it
 * has to have, both of them the reason this is imperative module state rather
 * than JSX:
 *
 *   - **It exists before the text does.** A live region that is inserted with
 *     its content already in it announces nothing in most screen readers; the
 *     region has to be in the accessibility tree first, and the *mutation* is
 *     what is announced. Rendering it inside `GlossaryTerm` would insert region
 *     and text together on the same commit.
 *   - **There is exactly one.** Forty-six triggers rendering forty-six live
 *     regions is forty-six things for a screen reader to watch, and the one
 *     that speaks would be whichever won the race.
 *
 * Created lazily rather than at module scope because `place` above is imported
 * by a Node-environment unit test, where `document` does not exist.
 */
const LIVE_REGION_ID = 'glossary-live-region';

/** Which panel last spoke, so a close only clears its own announcement. */
let announcedBy: string | null = null;

function liveRegion(): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const existing = document.getElementById(LIVE_REGION_ID);
  if (existing) return existing;

  const node = document.createElement('div');
  node.id = LIVE_REGION_ID;
  node.setAttribute('aria-live', 'polite');
  // The whole definition is one announcement; without this a screen reader may
  // read only the changed part of it.
  node.setAttribute('aria-atomic', 'true');
  // Visually hidden, inline rather than via a class: the node is built in
  // JavaScript, and a utility class on an element Tailwind's scanner cannot see
  // in markup is a class that might not survive a purge.
  node.style.cssText =
    'position:absolute;width:1px;height:1px;margin:-1px;padding:0;' +
    'overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
  document.body.appendChild(node);
  return node;
}

function announce(id: string, definition: string): void {
  const region = liveRegion();
  if (!region) return;
  announcedBy = id;
  region.textContent = definition;
}

function stopAnnouncing(id: string): void {
  if (announcedBy !== id) return;
  const region = liveRegion();
  if (!region) return;
  announcedBy = null;
  region.textContent = '';
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

/** Distance from the trigger, and the least the panel may sit from an edge. */
const GAP = 8;
const MARGIN = 8;
/** Hover has to be meant, not passed through. */
const HOVER_INTENT_MS = 150;
/**
 * Quiet time before a scroll counts as "the reader has moved on".
 *
 * Tabbing to a term below the fold scrolls it into view, and `scroll-behavior:
 * smooth` keeps that scroll running for a few hundred milliseconds after focus
 * has already opened the panel. Dismissing on the first scroll event therefore
 * closed the tooltip on the very keypress that asked for it — every keyboard
 * reader, every term not already on screen, and it took an e2e run to see it.
 * So the panel tracks the scroll that revealed it, and only arms its dismissal
 * once the page has been still this long.
 */
const SCROLL_SETTLE_MS = 200;

interface Placement {
  top: number;
  left: number;
  /** Above the trigger rather than below, because below did not fit. */
  flipped: boolean;
}

/**
 * Below the trigger if it fits, above if it does not and above is roomier,
 * horizontally centred and then clamped inside the viewport.
 *
 * Pure and exported for the unit test: the interesting cases are a trigger in
 * the last line of a tall page and one in the first word of a narrow one, and
 * neither is worth a browser to check.
 */
export function place(
  trigger: { top: number; bottom: number; left: number; width: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
): Placement {
  const roomBelow = viewport.height - trigger.bottom - GAP - MARGIN;
  const roomAbove = trigger.top - GAP - MARGIN;
  const flipped = panel.height > roomBelow && roomAbove > roomBelow;

  const top = flipped ? trigger.top - GAP - panel.height : trigger.bottom + GAP;
  const centred = trigger.left + trigger.width / 2 - panel.width / 2;
  const left = Math.min(
    Math.max(MARGIN, centred),
    Math.max(MARGIN, viewport.width - panel.width - MARGIN),
  );

  return { top: Math.max(MARGIN, top), left, flipped };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function GlossaryTerm({ text, termRef }: { text: string; termRef: string }) {
  const entry = lookup(termRef);
  const reduced = useReducedMotion();
  const generatedId = useId();
  const panelId = `glossary-${generatedId}`;
  const triggerId = `${panelId}-trigger`;

  const triggerEl = useRef<HTMLButtonElement | null>(null);
  const panelEl = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  /**
   * Opened deliberately — clicked or tapped — rather than hovered into.
   *
   * Without this, hover and click fight: the pointer opens the panel after
   * 150 ms, the click that follows finds it already open, and a plain toggle
   * closes the thing the reader was reaching for. A pinned panel survives the
   * pointer leaving and takes a second click to dismiss, which is also exactly
   * the tap-toggle a touch reader gets — touch never hovers, so its first tap
   * pins and its second closes.
   */
  const pinned = useRef(false);
  /**
   * A pointer press that landed inside the panel and has not been released.
   *
   * The panel is a plain div, so pressing in it to select the definition moves
   * focus off the trigger, and the trigger's blur closed the panel out from
   * under the selection — a reader could not copy a definition, or even
   * highlight one while reading it. Verified before it was fixed:
   * `aria-expanded` flipped to false on the mousedown, before the drag had
   * begun.
   *
   * Dropping `onBlur` altogether would be the smaller diff and the wrong one:
   * blur is what dismisses a panel the keyboard merely tabbed past. So blur
   * still closes, unless the press that caused it began inside the panel.
   */
  const pressInPanel = useRef(false);
  /**
   * Focus is being handed back by Escape, and must not be read as a request.
   *
   * `onFocus` opens the panel when focus arrives by keyboard, and Chromium
   * scores a programmatic `.focus()` as `:focus-visible` whenever the last
   * input was a key — which Escape is. So once a press inside the panel had
   * moved focus to the body, Escape closed the panel and the focus it restored
   * immediately reopened it. Invisible before this patch, because until then
   * the trigger always still had focus when Escape arrived, and calling
   * `.focus()` on the already-focused element fires no event at all.
   */
  const restoringFocus = useRef(false);

  const cancelHover = useCallback(() => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    cancelHover();
    pinned.current = false;
    pressInPanel.current = false;
    setOpen(false);
  }, [cancelHover]);

  const show = useCallback(() => {
    claim(panelId);
    setOpen(true);
  }, [panelId]);

  /* The registry, and the teardown that keeps a timer from outliving the page. */
  useEffect(() => {
    // Built here, on the first term to mount, and left empty. By the time any
    // panel opens the region has been in the accessibility tree since the page
    // rendered, which is the condition for the text landing in it to be
    // announced at all.
    liveRegion();

    closers.set(panelId, () => {
      pinned.current = false;
      setOpen(false);
    });
    return () => {
      closers.delete(panelId);
    };
  }, [panelId]);
  useEffect(() => cancelHover, [cancelHover]);

  /** Measure the trigger where it is now, and put the panel beside it. */
  const reposition = useCallback(() => {
    const trigger = triggerEl.current;
    const panel = panelEl.current;
    if (!trigger || !panel) return;

    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    setPlacement(
      place(
        { top: t.top, bottom: t.bottom, left: t.left, width: t.width },
        { width: p.width, height: p.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, []);

  /* Position before paint, so the panel never appears in the wrong place first. */
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    reposition();
  }, [open, reposition]);

  /* Escape, a tap elsewhere, and a settled scroll all dismiss. */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // The reader pressed Escape while reading; focus belongs back on the word
      // they pressed it from, not wherever it happened to be.
      event.stopPropagation();
      close();
      // `.focus()` dispatches focus and focusin synchronously, so the flag is
      // read and cleared within this call.
      restoringFocus.current = true;
      triggerEl.current?.focus();
      restoringFocus.current = false;
    };
    const onPointerDown = (event: Event): void => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerEl.current?.contains(target)) return;
      if (panelEl.current?.contains(target)) {
        // Capture phase, so this runs before the browser's default action moves
        // focus and before the blur it causes — which is the whole point.
        pressInPanel.current = true;
        return;
      }
      close();
    };
    const onPointerUp = (): void => {
      pressInPanel.current = false;
    };

    // Until the page has been still for a beat, a scroll is assumed to be the
    // one that brought this term into view, and the panel follows it rather
    // than treating it as a dismissal. After that, any scroll dismisses.
    let armed = false;
    let settle = window.setTimeout(() => {
      armed = true;
    }, SCROLL_SETTLE_MS);

    const onScroll = (): void => {
      if (armed) {
        close();
        return;
      }
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        armed = true;
      }, SCROLL_SETTLE_MS);
      reposition();
    };
    const onResize = (): void => close();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    // On `window`, not `document`: a drag that ends outside the panel — or
    // outside the document entirely — still has to clear the flag, or the next
    // blur would find a press that is long over and decline to close.
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    // Capture, because the scroll that matters is often a container's rather
    // than the window's, and those do not bubble.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(settle);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close, reposition]);

  /**
   * Speak the definition while the panel is open, and stop when it closes.
   *
   * Keyed on the panel id so that switching terms reads the new one: React runs
   * every destroy in a commit before every create, so the outgoing term's
   * `stopAnnouncing` cannot wipe the incoming term's announcement.
   */
  useEffect(() => {
    if (!open || !entry) return;
    announce(panelId, `${entry.title}: ${entry.body}`);
    return () => stopAnnouncing(panelId);
  }, [open, entry, panelId]);

  /**
   * An unknown ref renders as plain text rather than a dead control.
   *
   * `tests/content.test.ts` fails on one, so this is the belt to that braces —
   * but a reader should never meet a button that opens an empty box, and a
   * draft module mid-edit is exactly when that would happen.
   */
  if (!entry) return <>{text}</>;

  const onPointerEnter = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    // Touch raises pointerenter on tap, immediately before the click that
    // toggles — honouring it here would open and then instantly close.
    if (event.pointerType === 'touch') return;
    cancelHover();
    hoverTimer.current = window.setTimeout(show, HOVER_INTENT_MS);
  };

  const onPointerLeave = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.pointerType === 'touch') return;
    cancelHover();
    // A tooltip opened deliberately — clicked, or reached by keyboard — is not
    // dismissed by the pointer wandering off the word.
    if (pinned.current) return;
    if (document.activeElement !== triggerEl.current) close();
  };

  const onClick = (): void => {
    if (pinned.current) {
      close();
      return;
    }
    // Open, or already hover-open: either way the click means "keep this".
    pinned.current = true;
    show();
  };

  return (
    <>
      <button
        id={triggerId}
        ref={triggerEl}
        type="button"
        data-glossary-term={termRef}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onClick}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={(event) => {
          // Keyboard focus reveals it; a mouse click also focuses, and letting
          // that open the panel would fight the toggle on the very same event.
          if (restoringFocus.current) return;
          if (event.currentTarget.matches(':focus-visible')) show();
        }}
        onBlur={() => {
          // Focus left the word — unless it left because the reader pressed
          // into the panel to select the definition, which is reading, not
          // leaving.
          if (pressInPanel.current) return;
          close();
        }}
        /* Dotted, in the muted tone, on the prose's own colour — a link here is
           star-blue and solid-underlined, and the two must not be confusable at
           a glance. `decoration-dotted` rather than a bottom border so the
           underline breaks correctly across a line wrap. */
        className="cursor-help rounded-sm underline decoration-ink-faint decoration-dotted decoration-from-font underline-offset-[0.2em] transition-colors hover:text-ink hover:decoration-ink-dim focus-visible:text-ink focus-visible:decoration-ink-dim aria-expanded:text-ink aria-expanded:decoration-ink-dim"
      >
        {text}
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key={panelId}
                id={panelId}
                ref={panelEl}
                role="note"
                aria-labelledby={triggerId}
                data-glossary-panel={termRef}
                initial={reduced ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 1 } : { opacity: 0 }}
                transition={reduced ? { duration: 0 } : { duration: 0.14, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  top: placement?.top ?? 0,
                  left: placement?.left ?? 0,
                  // Hidden for the one frame between mount and measurement.
                  // `visibility` rather than unmounting, because the panel has
                  // to be in the document to have a height to measure.
                  visibility: placement ? 'visible' : 'hidden',
                }}
                className="z-50 w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-edge bg-void-700 px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
              >
                <p className="font-ui text-[0.7rem] font-medium uppercase tracking-[0.14em] text-star">
                  {entry.title}
                </p>
                <p className="mt-1.5 font-prose text-[0.9375rem] leading-[1.55] text-ink-dim">
                  {entry.body}
                </p>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

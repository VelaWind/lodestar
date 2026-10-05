import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, LazyMotion, m } from 'framer-motion';
import { BrowserRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { DISTANCE, DURATION, EASE } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { ModuleListPage } from '@/pages/ModuleListPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * The index is the entry point and stays eager. The other two routes are split
 * off it, and the reason is KaTeX: `RichText` pulls it in, it is a quarter of a
 * megabyte, and a reader who lands on the front page and leaves never needed a
 * single glyph of it. Lighthouse measured 57 kB of unused JavaScript on the
 * landing page before this, which is exactly that.
 */
const ModulePage = lazy(() =>
  import('@/pages/ModulePage').then((m) => ({ default: m.ModulePage })),
);
const AboutPage = lazy(() =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })),
);

/** Framer wants seconds and a mutable tuple; the tokens are ms and readonly. */
const EASE_OUT = [...EASE.out];
const ENTER_SECONDS = DURATION.base / 1000;
const EXIT_SECONDS = DURATION.fast / 1000;

/**
 * The routed outlet, and the routes themselves, kept in one place so the
 * animated and the reduced-motion paths cannot drift into rendering different
 * trees.
 *
 * `location` is passed explicitly rather than read from context. During a
 * transition two of these are mounted at once, and the one on its way out has
 * to keep rendering the route it *was* — read from context it would re-render
 * as the incoming route and the crossfade would be one page fading into itself.
 */
function AppRoutes({ location }: { location: Location }) {
  return (
    /* Empty rather than a spinner: these chunks arrive in tens of milliseconds
       and a flashed loading state costs more than it explains. But it reserves a
       full viewport, and that part is not cosmetic — at 60vh the footer sat on
       screen and was shoved down when the route arrived, which Lighthouse
       measured as 0.156 of layout shift on a module page. A screenful of
       placeholder puts it below the fold, so nothing visible moves. */
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <Routes location={location}>
        <Route path="/" element={<ModuleListPage />} />
        <Route path="/m/:id" element={<ModulePage />} />
        <Route path="/about" element={<AboutPage />} />
        {/* Not a redirect. Bouncing an unknown address to the index loses both
            the fact that it was wrong and the address itself. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

/**
 * One route's frame, which knows whether it is the one on the way out.
 *
 * `at` is the location this frame renders and never changes; `useLocation()`
 * reads the live one. When they disagree, this frame is the outgoing half of a
 * crossfade, and three things follow from that — all of them applied in the
 * same commit that mounts the incoming route, so none of them is ever a frame
 * late:
 *
 *   - **Out of flow.** Left in normal flow, the document would be both pages
 *     tall for 150ms and everything below — the footer above all — would be
 *     shoved down and pulled back. That is a layout shift, on a site whose CLS
 *     is 0. Absolute at the top of the (relatively positioned) outlet puts the
 *     fading copy exactly where it already was, in document coordinates, so it
 *     does not appear to jump as it goes.
 *   - **`inert`.** For the length of the fade there are two `<h1>`s and two
 *     copies of the page's links in the document. `inert` takes the outgoing
 *     one out of the accessibility tree and out of the tab order, so a screen
 *     reader never meets the duplicate and Tab cannot land in a page that is
 *     halfway gone. `aria-hidden` alongside it, for engines that predate
 *     `inert`.
 *   - **No pointer events.** It is painted over the incoming page while it
 *     fades; clicks belong to whatever is arriving.
 */
function RouteFrame({ at }: { at: Location }) {
  const now = useLocation();
  const leaving = now.pathname !== at.pathname;

  /* `inert` is a real HTML attribute that React 18's prop types predate; the
     cast is to the DOM, not around a type error in our own code. */
  const leavingAttrs: Record<string, unknown> = leaving
    ? { inert: '', 'aria-hidden': true }
    : {};

  return (
    <m.div
      className={leaving ? 'pointer-events-none absolute inset-x-0 top-0' : undefined}
      {...leavingAttrs}
      initial={{ opacity: 0, y: DISTANCE.nudge }}
      animate={{ opacity: 1, y: 0, transition: { duration: ENTER_SECONDS, ease: EASE_OUT } }}
      /* The outgoing half is the faster of the two, so it carries its own
         transition rather than inheriting the incoming one. */
      exit={{ opacity: 0, transition: { duration: EXIT_SECONDS, ease: EASE_OUT } }}
    >
      <AppRoutes location={at} />
    </m.div>
  );
}

/**
 * A crossfade between routes, and two constraints that decided its shape.
 *
 * **The incoming page is never gated on the animation.** It mounts in flow, at
 * its final position, on the same tick the URL changes; the only thing the
 * animation owns is its `opacity` and four pixels of `transform`. A reader — or
 * a test — can read and click the new page immediately, and if the animation
 * never ran the page would already be correct. This is why the mode is the
 * default overlap rather than `wait`: `wait` holds the incoming route unmounted
 * until the outgoing one has finished, which is exactly the thing being ruled
 * out here.
 *
 * **The two halves overlap.** Played in sequence, 150ms out plus 250ms in is
 * 400ms, which is past the point where a transition stops feeling like a
 * response to the click. Run together the whole thing is 250ms, bounded by the
 * longer of the two.
 */
function RoutedOutlet() {
  const location = useLocation();
  const reduced = useReducedMotion();

  /*
   * Reduced motion gets no AnimatePresence at all, rather than an
   * AnimatePresence with the durations set to zero. Held inside one, the
   * outgoing route stays mounted for the length of its exit, which delays its
   * unmount effects — `useNoindex` putting the canonical back, for one. "No
   * animation" should mean the old behaviour exactly: the route swaps, and it
   * is gone. The wrapper div stays so the DOM is the same shape either way.
   */
  if (reduced) {
    return (
      <div>
        <AppRoutes location={location} />
      </div>
    );
  }

  return (
    /* The positioning context the outgoing frame is placed against. It has no
       padding of its own, so "absolute, full width of this box" is the same
       rectangle the frame occupied while it was in flow — which is what stops
       the fading copy from appearing to change width as it leaves. */
    <div className="relative">
      {/* `initial={false}` suppresses the entrance on first paint only. A cold
          load has nothing to transition *from*, and fading the first view in
          would delay the largest contentful paint to buy an effect nobody is
          there to see. */}
      <AnimatePresence initial={false}>
        <RouteFrame key={location.pathname} at={location} />
      </AnimatePresence>
    </div>
  );
}

/**
 * Three routes, and depth is not one of them. Depth is a global setting rather
 * than a URL — the same link should read correctly for anyone regardless of the
 * tier they've chosen.
 *
 * Scroll is handled by `ScrollOnNavigate` below. There used to be none, and an
 * earlier pass kept it that way so as not to change behaviour inside a
 * refactor. Measured since, that cost readers the top of every page they
 * reached by a link: from a card low on the index, a module opened about four
 * thousand pixels down, past its title and hook, and the learning path's "Next"
 * (pressed at the very bottom of a page) did the same.
 */
/**
 * Framer Motion's features load in their own chunk (see `motion/features`), so
 * the entry carries only the `m` renderer. `strict` makes a stray `motion`
 * component throw rather than quietly pull the full bundle back in.
 */
const loadMotionFeatures = () => import('@/motion/features').then((mod) => mod.default);

/** Remember the window's scroll position for one history entry. */
function saveScroll(key: string): void {
  try {
    sessionStorage.setItem(`scroll:${key}`, String(Math.round(window.scrollY)));
  } catch {
    /* Storage can be unavailable (some private modes); the place is then not kept. */
  }
}

/** Whether this document was reached by a reload or by Back/Forward, not a fresh visit. */
function arrivedByReloadOrHistory(): boolean {
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return nav?.type === 'reload' || nav?.type === 'back_forward';
}

/** The scroll position remembered for a history entry, or null if none. */
function savedScroll(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(`scroll:${key}`);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * A link followed inside the app (PUSH or REPLACE) opens its page at the top,
 * or at the element its `#hash` names if that element is already rendered.
 *
 * Back/Forward and a reload (POP) without a hash return the reader to the
 * position saved for that history entry, once the page has rendered tall
 * enough (waiting at most two seconds); an entry with nothing saved, such as a
 * first visit, is left alone. With a hash whose element is already in the page
 * (the skip link, the step link under a module's title), the browser has
 * already scrolled to it. With a hash whose element is not there yet,
 * typically a direct load of `/m/<id>#path-footer` while the module's content
 * is still loading, the browser's own jump found nothing; so this waits for
 * the element to appear, for at most two seconds, and scrolls to it once.
 *
 * Layout effect, so a new page is never painted at the old position first.
 *
 * Smooth scrolling is switched on only for an in-page jump the reader sets
 * off: activating a `#fragment` link adds `smooth-jump` to <html> (see
 * index.css) for a second, long enough for the jump. Keyboard activation of a
 * link fires a click too. Everything else, the browser's own restoration on
 * Back included, scrolls instantly.
 */
function ScrollOnNavigate() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  /*
   * The reader's place on each history entry, kept by the app rather than the
   * browser. The browser restores scroll on Back before React has rendered the
   * page being returned to, against the page being left; when that one is
   * shorter, the position is clamped and the reader lands short of where they
   * were. So restoration is manual: each entry's position is remembered (in
   * sessionStorage, so a reload keeps it) and put back after the page renders.
   * It is saved on every scroll, and again on any click before the router acts
   * on it, so a link followed in the same frame as a scroll still leaves the
   * right position behind.
   */
  // The history entry's key alone is not enough: every fresh document load
  // gets the key "default", so the path is part of the name.
  const entry = `${key} ${pathname}`;
  const keyRef = useRef(entry);
  useLayoutEffect(() => {
    keyRef.current = entry;
  });
  const firstRenderRef = useRef(true);
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const save = () => saveScroll(keyRef.current);
    window.addEventListener('scroll', save, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('scroll', save);
      window.removeEventListener('pagehide', save);
      history.scrollRestoration = previous;
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;
    const onClick = (event: MouseEvent) => {
      saveScroll(keyRef.current);
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
      if (!link) return;
      root.classList.add('smooth-jump');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.classList.remove('smooth-jump'), 1000);
    };
    // Capture phase, so the class is on before the browser starts the jump.
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(timer);
      root.classList.remove('smooth-jump');
    };
  }, []);
  useLayoutEffect(() => {
    const firstRender = firstRenderRef.current;
    firstRenderRef.current = false;
    if (navigationType === 'POP' && !hash) {
      // A document's first render is a POP too. Only a reload, or a return to
      // this document through history, should put a saved place back; a fresh
      // visit (a typed or followed URL) starts at the top as a browser would.
      if (firstRender && !arrivedByReloadOrHistory()) return;
      const top = savedScroll(entry);
      if (top === null) return;
      const fits = () => document.documentElement.scrollHeight - window.innerHeight >= top - 1;
      if (fits()) {
        window.scrollTo({ top, left: 0, behavior: 'instant' });
        return;
      }
      // The page is still filling in (a module's content loading): wait for
      // it to be tall enough, for at most two seconds, then go there.
      const observer = new MutationObserver(() => {
        if (!fits()) return;
        stop();
        window.scrollTo({ top, left: 0, behavior: 'instant' });
      });
      const timer = window.setTimeout(() => {
        stop();
        window.scrollTo({ top, left: 0, behavior: 'instant' });
      }, 2000);
      function stop() {
        observer.disconnect();
        window.clearTimeout(timer);
      }
      observer.observe(document.body, { childList: true, subtree: true });
      return stop;
    }
    if (navigationType === 'POP') {
      const id = decodeURIComponent(hash.slice(1));
      if (document.getElementById(id)) return;
      const observer = new MutationObserver(() => {
        const target = document.getElementById(id);
        if (!target) return;
        stop();
        target.scrollIntoView({ behavior: 'instant' });
      });
      const timer = window.setTimeout(() => stop(), 2000);
      function stop() {
        observer.disconnect();
        window.clearTimeout(timer);
      }
      observer.observe(document.body, { childList: true, subtree: true });
      return stop;
    }
    // Focus can still be on the link just followed, inside the page that is
    // now fading out (inert). WebKit scrolls a focused element back into view,
    // which undid the scroll below; so focus leaves the outgoing page first.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[inert]')) active.blur();
    // Instant, even if a fragment link has just switched smooth scrolling on:
    // a new page should simply open at its top, not glide there across
    // thousands of pixels of the page it replaced.
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView({ behavior: 'instant' });
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, entry, navigationType]);
  return null;
}

export default function App() {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <BrowserRouter>
        <ScrollOnNavigate />
        <AppShell>
          <RoutedOutlet />
        </AppShell>
      </BrowserRouter>
    </LazyMotion>
  );
}

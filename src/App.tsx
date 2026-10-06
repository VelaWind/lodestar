import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, LazyMotion, m } from 'framer-motion';
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { LoadErrorBoundary } from '@/components/LoadErrorBoundary';
import { moduleLoadFailed, retryModule } from '@/content/catalog';
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
    <LoadErrorBoundary resetKey={location.pathname} onRetry={() => retryRoute(location.pathname)}>
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
    </LoadErrorBoundary>
  );
}

/**
 * "Try again" after a failed load. A module's own data can be fetched again in
 * place; anything else that failed (a page chunk or a simulation, which
 * `React.lazy` holds on to once it has failed) needs a reload, which the
 * boundary does when this rejects.
 */
async function retryRoute(pathname: string): Promise<void> {
  const id = /^\/m\/([^/]+)$/.exec(pathname)?.[1];
  if (id && moduleLoadFailed(id)) {
    await retryModule(id);
    return;
  }
  throw new Error('Only a reload can recover this load');
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

/** Ends the current smooth jump early, if one is running. */
let endSmoothJump: (() => void) | null = null;

/**
 * Turns smooth scrolling on (`smooth-jump` on <html>, see index.css) for one
 * in-page jump, and off again when the jump has finished: on `scrollend`
 * where the browser has it, otherwise (Safari before 26) after 2 s. Where
 * `scrollend` exists the 2 s timer is still kept as a guard, restarted by
 * every scroll event, so a jump that does not move at all still clears the
 * class and a long glide is never cut short. Whichever ends it clears the other.
 */
function holdSmoothJump(): void {
  endSmoothJump?.();
  const root = document.documentElement;
  const hasScrollEnd = 'onscrollend' in window;
  let timer = 0;
  const finish = () => {
    root.classList.remove('smooth-jump');
    window.clearTimeout(timer);
    document.removeEventListener('scrollend', finish);
    window.removeEventListener('scroll', rearm);
    endSmoothJump = null;
  };
  const rearm = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(finish, 2000);
  };
  root.classList.add('smooth-jump');
  if (hasScrollEnd) {
    document.addEventListener('scrollend', finish);
    window.addEventListener('scroll', rearm, { passive: true });
  }
  timer = window.setTimeout(finish, 2000);
  endSmoothJump = finish;
}

/**
 * Moves the keyboard's place to an in-page target, as following a fragment
 * link natively would: the next Tab continues from there. A target that is
 * not focusable is made focusable from script only (tabindex −1).
 */
function focusJumpTarget(target: HTMLElement): void {
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * Scrolls to `top` once the page is tall enough to, waiting at most two
 * seconds for content still loading. Returns a cleanup for the wait.
 */
function restoreScroll(top: number): (() => void) | undefined {
  const fits = () => document.documentElement.scrollHeight - window.innerHeight >= top - 1;
  if (fits()) {
    window.scrollTo({ top, left: 0, behavior: 'instant' });
    return undefined;
  }
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
 * A same-page `#fragment` link (the skip link, the step link under a module's
 * title) is pushed through the router as its own history entry and scrolled
 * to smoothly, or instantly under reduced motion, with keyboard focus moved to
 * the target. Smooth scrolling is on only for that jump: `smooth-jump` on
 * <html> (see index.css), removed when the jump ends. Keyboard activation of a
 * link fires a click too.
 *
 * Back/Forward and a reload (POP) return the reader to the position saved for
 * that history entry, once the page has rendered tall enough (waiting at most
 * two seconds). An entry with nothing saved is left at its #hash target if it
 * has one, or alone if not. A first visit is never restored: with a hash whose
 * element is already in the page the browser has made the jump; with a hash
 * whose element is not there yet, typically a direct load of
 * `/m/<id>#path-footer` while the module's content is still loading, this
 * waits for the element to appear, for at most two seconds, and scrolls to it
 * once.
 *
 * Every scroll the app makes outside an in-page jump is instant. Layout effect,
 * so a new page is never painted at the old position first.
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
  /*
   * In-page jumps (the skip link, the step link under a module's title, any
   * same-page `#fragment` link) go through the router rather than the
   * browser. Followed natively, a fragment link makes a history entry with no
   * state, which the router gives the same key, "default", as the entry before
   * it; both then shared one saved position and Back after a jump stayed put.
   * Pushed through the router, each jump is an entry of its own, so Back
   * returns to where the reader was and Forward to the target. A click with a
   * modifier key, or on a link to another page, is left alone.
   */
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useLayoutEffect(() => {
    navigateRef.current = navigate;
  });
  const pendingJumpRef = useRef<string | null>(null);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      saveScroll(keyRef.current);
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      const here = window.location;
      const samePage =
        (link.getAttribute('href') ?? '').startsWith('#') ||
        (url.origin === here.origin && url.pathname === here.pathname && url.search === here.search);
      if (!samePage || url.hash.length < 2) return;
      event.preventDefault();
      pendingJumpRef.current = decodeURIComponent(url.hash.slice(1));
      navigateRef.current({ pathname: here.pathname, search: here.search, hash: url.hash });
    };
    // Capture phase: before the browser follows the link natively.
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      endSmoothJump?.();
    };
  }, []);
  useLayoutEffect(() => {
    const firstRender = firstRenderRef.current;
    firstRenderRef.current = false;
    if (navigationType === 'POP') {
      // A document's first render is a POP too. Only a reload, or a return to
      // this document through history, should put a saved place back; a fresh
      // visit (a typed or followed URL) starts at the top as a browser would,
      // or at its #hash.
      const top = firstRender && !arrivedByReloadOrHistory() ? null : savedScroll(entry);
      if (top !== null) return restoreScroll(top);
      if (!hash) return;
      const id = decodeURIComponent(hash.slice(1));
      const present = document.getElementById(id);
      if (present) {
        // On a first load the browser has already made this jump; on a later
        // entry with nothing saved, make it here.
        if (!firstRender) present.scrollIntoView({ behavior: 'instant' });
        return;
      }
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
    const id = hash ? decodeURIComponent(hash.slice(1)) : null;
    const target = id ? document.getElementById(id) : null;
    // An in-page jump the reader set off: smooth, unless they prefer reduced
    // motion, and the keyboard's place moves to the target.
    const jump = pendingJumpRef.current;
    pendingJumpRef.current = null;
    if (target && jump === id) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced) holdSmoothJump();
      target.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
      focusJumpTarget(target);
      return;
    }
    // Instant, even if an in-page jump has just switched smooth scrolling on:
    // a new page should simply open at its top, not glide there across
    // thousands of pixels of the page it replaced.
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

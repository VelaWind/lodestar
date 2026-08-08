import { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
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
    <motion.div
      className={leaving ? 'pointer-events-none absolute inset-x-0 top-0' : undefined}
      {...leavingAttrs}
      initial={{ opacity: 0, y: DISTANCE.nudge }}
      animate={{ opacity: 1, y: 0, transition: { duration: ENTER_SECONDS, ease: EASE_OUT } }}
      /* The outgoing half is the faster of the two, so it carries its own
         transition rather than inheriting the incoming one. */
      exit={{ opacity: 0, transition: { duration: EXIT_SECONDS, ease: EASE_OUT } }}
    >
      <AppRoutes location={at} />
    </motion.div>
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
 * No scroll management here, deliberately, because there has never been any.
 * React Router leaves `window.scrollY` where it was and the browser clamps it
 * to whatever the incoming document allows — measured, from the index at 600px,
 * a module page lands at 305 rather than at 0. Adding a scroll-to-top would be
 * a behaviour change wearing the costume of a bug fix, so this pass preserves
 * it, and `popLayout` above is part of preserving it: keeping the outgoing route
 * in flow would hold the document tall enough that no clamp happened at all.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <RoutedOutlet />
      </AppShell>
    </BrowserRouter>
  );
}

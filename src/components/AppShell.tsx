/**
 * Persistent chrome: header (wordmark + depth control) and footer, with the
 * routed page in between. Nothing here is module-aware.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Starfield } from '@/visual/Starfield';
import { DepthControl } from './DepthControl';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-void-900 text-ink">
      {/* Mounted here, above the router, so the sky persists across navigation
          rather than restarting on every route change.

          First child, and no z-index on it or on anything else. Everything below
          — the wash, the header, `main`, the footer — is positioned with an auto
          or explicit z-index, so all of them paint after a positioned sibling
          that comes earlier in the DOM. A negative z-index was the obvious
          alternative and does not work: this wrapper's opaque `bg-void-900` is
          an in-flow background, and in-flow backgrounds paint *after* negative
          z-index descendants, so the starfield would be invisible behind it.
          Being first in the tree is what makes this work without touching the
          stacking of a single existing element. */}
      <Starfield />

      {/* A single, very faint radial wash. The theme is dark and quiet; the
          content should be the only thing with contrast. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(157,180,255,0.07),transparent_60%)]"
      />

      {/* First thing in the tab order: seven layers of accordion headers sit
          between the header and the prose, and a keyboard reader should not
          have to walk them on every page. Visually hidden until focused. */}
      <a
        href="#main"
        className="sr-only left-4 top-4 z-50 rounded-md border border-star/60 bg-void-800 px-4 py-2 font-ui text-sm text-ink focus:not-sr-only focus:absolute"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-edge-soft bg-void-900/85 backdrop-blur-md">
        {/* px-4 and gap-3 at base, not px-5/gap-4: the wordmark and the three
            depth pills together need 318 of the 343px a 375px phone leaves, and
            the old padding put that over the edge. */}
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-8">
          <Link
            to="/"
            className="group flex min-w-0 items-baseline gap-2.5 transition-opacity hover:opacity-90"
          >
            <span aria-hidden className="text-star">
              ✦
            </span>
            <span className="truncate font-prose text-lg tracking-wide text-ink">Lodestar</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Visible at every width now. It is the only route to the page
                besides the footer, and a link that disappears on the devices
                most people arrive on is not really in the header. It fits
                because the depth group's label is still hidden below `sm` — the
                pills and this link together leave room at 375px. */}
            <Link
              to="/about"
              className="shrink-0 font-ui text-xs text-ink-faint underline-offset-4 transition-colors hover:text-star hover:underline"
            >
              About
            </Link>
            <DepthControl />
          </div>
        </div>
      </header>

      {/* `xl:max-w-column`: above 1280px the window is wide enough that a
          1024px column leaves the prose stranded on the left of it, so the
          column narrows to the measure and the two elements that need the width
          — the sim stage and the landing card grid — break out of it instead.
          The header and footer keep `max-w-5xl`, which is exactly where the
          card grid lands, so the chrome still bounds the widest content. */}
      <main
        id="main"
        tabIndex={-1}
        className="relative mx-auto max-w-5xl px-5 pb-24 pt-10 focus:outline-none sm:px-8 xl:max-w-column"
      >
        {children}
      </main>

      <footer className="relative border-t border-edge-soft">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 font-ui text-xs leading-relaxed text-ink-faint sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:px-8">
          <p className="max-w-measure">
            Every simulation runs on real SI quantities (the same numbers the equations use),
            and every figure is cited to its source.
          </p>
          {/* One link now, but still a flex row: `shrink-0` is what keeps it
              off the paragraph's last line at narrow widths, and the baseline
              alignment is what lines it up with that paragraph on one row at
              `sm`. The repository link that used to sit beside it was removed
              when the repository went private — a footer that offers a 404 is
              worse than a footer with one link. */}
          <span className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            <Link
              to="/about"
              className="-my-2 py-2 text-ink-faint underline decoration-edge underline-offset-4 transition-colors hover:text-star hover:decoration-star"
            >
              How this is built
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Persistent chrome: header (wordmark + depth control) and footer, with the
 * routed page in between. Nothing here is module-aware.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DepthControl } from './DepthControl';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-void-900 text-ink">
      {/* A single, very faint radial wash. The theme is dark and quiet; the
          content should be the only thing with contrast. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(157,180,255,0.07),transparent_60%)]"
      />

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
            {/* Measured at 390px: the wordmark and the depth pills leave 62px of
                the 358px content box, and this link wants about 45 — it fits,
                but at 375px that margin falls to 2px. So it appears from the sm
                breakpoint up, and the footer carries it at every width. */}
            <Link
              to="/about"
              className="hidden font-ui text-xs text-ink-faint underline-offset-4 transition-colors hover:text-star hover:underline sm:inline"
            >
              About
            </Link>
            <DepthControl />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">{children}</main>

      <footer className="relative border-t border-edge-soft">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 font-ui text-xs leading-relaxed text-ink-faint sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 sm:px-8">
          <p className="max-w-measure">
            Every simulation runs on real SI quantities — the same numbers the equations use —
            and every figure is cited to its source.
          </p>
          <span className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            <Link
              to="/about"
              className="-my-2 py-2 text-ink-faint underline decoration-edge underline-offset-4 transition-colors hover:text-star hover:decoration-star"
            >
              How this is built
            </Link>
            <a
              href="https://github.com/VelaWind/lodestar"
              target="_blank"
              rel="noreferrer noopener"
              className="-my-2 py-2 text-ink-faint underline decoration-edge underline-offset-4 transition-colors hover:text-star hover:decoration-star"
            >
              Built in the open — source &amp; authoring standards
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

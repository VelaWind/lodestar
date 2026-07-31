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
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            to="/"
            className="group flex items-baseline gap-2.5 transition-opacity hover:opacity-90"
          >
            <span aria-hidden className="text-star">
              ✦
            </span>
            <span className="font-prose text-lg tracking-wide text-ink">Lodestar</span>
          </Link>
          <DepthControl />
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8">{children}</main>

      <footer className="relative border-t border-edge-soft">
        <div className="mx-auto max-w-5xl px-5 py-8 font-ui text-xs text-ink-faint sm:px-8">
          Lodestar — space, in layers you choose to open. Every simulation runs on real SI
          quantities.
        </div>
      </footer>
    </div>
  );
}

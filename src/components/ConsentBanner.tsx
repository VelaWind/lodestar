/**
 * The one question the site asks: may it count visits?
 *
 * Shown only when a measurement ID is configured and the reader has not
 * answered yet. Nothing from Google has loaded at that point; "Allow" loads it,
 * "No thanks" keeps it out, and either answer can be changed on the About page.
 * A bar at the foot of the window rather than a modal, so the page stays
 * readable and usable while it is up.
 */
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAvailable, getConsent, setConsent, subscribeConsent } from '@/lib/analytics';

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  if (!analyticsAvailable() || consent !== null) return null;

  return (
    <div
      role="region"
      aria-label="Usage statistics"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-edge-soft bg-void-900/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-4 font-ui text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="max-w-measure">
          May Lodestar count visits with Google Analytics? It sees which pages are read, never who
          reads them, and nothing is sent unless you allow it.{' '}
          <Link to="/about#statistics" className="text-ink-faint underline underline-offset-4 hover:text-star">
            Details
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent('denied')}
            className="rounded-md border border-edge px-4 py-2 text-ink transition-colors hover:border-star hover:text-star"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => setConsent('granted')}
            className="rounded-md border border-star/60 bg-star/15 px-4 py-2 text-ink transition-colors hover:bg-star/25"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

/** The same choice, on the About page, for a reader who wants to change it. */
export function StatisticsSetting() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, () => null);
  if (!analyticsAvailable()) return null;
  const allowed = consent === 'granted';

  return (
    <section id="statistics" className="scroll-mt-24">
      <h2 className="mb-3 font-ui text-xs font-medium uppercase tracking-[0.16em] text-star/80">
        Usage statistics
      </h2>
      <div className="max-w-measure space-y-4 text-[1.0625rem] leading-[1.75] text-ink-dim">
        <p>
          With permission, Lodestar counts visits with Google Analytics: which pages are opened, from
          which country and on what kind of device. It does not see who a reader is, shows no
          advertising, and has Google's advertising and data-sharing options switched off. Without
          permission, nothing from Google loads at all.
        </p>
        <p className="font-ui text-sm">
          Currently: <strong className="text-ink">{allowed ? 'allowed' : consent === 'denied' ? 'not allowed' : 'not chosen yet'}</strong>.{' '}
          <button
            type="button"
            onClick={() => setConsent(allowed ? 'denied' : 'granted')}
            className="text-star underline underline-offset-4"
          >
            {allowed ? 'Stop counting my visits' : 'Allow statistics'}
          </button>
        </p>
      </div>
    </section>
  );
}

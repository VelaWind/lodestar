/**
 * What a reader sees when part of a page fails to arrive: a lazily loaded
 * chunk that came back as a 502, or a connection that dropped mid-load.
 *
 * Without it the route stayed blank, with only "Failed to fetch dynamically
 * imported module" in the console. It sits around the routed content only, so
 * the header and footer stay and the reader can still go elsewhere.
 *
 * A class component because that is the only kind React lets catch an error
 * thrown while rendering. "Try again" asks the caller to re-fetch what failed;
 * if that cannot be done in place (a browser can cache a failed chunk, and
 * `React.lazy` keeps a failed import for good), it reloads the page. Changing
 * route clears the error. No animation.
 */
import { Component, useEffect, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** The route's address: a new one clears the error. */
  resetKey: string;
  /** Re-fetch what failed. Throw (or reject) when only a reload can help. */
  onRetry: () => Promise<void>;
}

interface State {
  failed: boolean;
}

/**
 * Reload the page, first asking the network again for the scripts it
 * preloads. WebKit was seen to keep a failed module response in its memory
 * cache across a plain reload, so the reload failed the same way; a fetch with
 * `cache: 'reload'` replaces what it holds. Capped at three seconds.
 */
async function reloadFresh(): Promise<void> {
  const hrefs = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]'), (l) => l.href);
  const refetch = Promise.allSettled(hrefs.map((href) => fetch(href, { cache: 'reload' })));
  await Promise.race([refetch, new Promise((resolve) => setTimeout(resolve, 3000))]);
  window.location.reload();
}

export class LoadErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  /**
   * Set when "Try again" re-fetched in place. If the page fails again before
   * the reader leaves it (the module's data came back, but its simulation,
   * which `React.lazy` keeps as failed, did not), a reload is the only way left,
   * and the reader has already asked to try again, so it reloads at once.
   */
  private retriedInPlace = false;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(): void {
    if (this.retriedInPlace) void reloadFresh();
  }

  override componentDidUpdate(previous: Props): void {
    if (previous.resetKey !== this.props.resetKey) {
      this.retriedInPlace = false;
      if (this.state.failed) this.setState({ failed: false });
    }
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <LoadFailed
        onRetry={async () => {
          try {
            await this.props.onRetry();
          } catch {
            await reloadFresh();
            return;
          }
          this.retriedInPlace = true;
          this.setState({ failed: false });
        }}
      />
    );
  }
}

function LoadFailed({ onRetry }: { onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Couldn’t load · Lodestar';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="py-24 text-center" role="alert">
      <h1 className="font-prose text-2xl text-ink">Couldn’t load this topic</h1>
      <p className="mt-3 font-prose text-[1.0625rem] text-ink-dim">
        This topic didn’t load. Check your connection and try again.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onRetry().finally(() => setBusy(false));
        }}
        className="mt-6 inline-flex h-9 items-center rounded-full border border-edge-soft bg-void-800/60 px-4 font-ui text-sm text-ink transition-colors hover:border-star-dim/60 hover:text-star disabled:opacity-60"
      >
        {busy ? 'Trying again…' : 'Try again'}
      </button>
    </div>
  );
}

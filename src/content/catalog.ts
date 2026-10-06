/**
 * What the app's pages read about modules: a manifest of summaries, always
 * present, and each module's full data on demand.
 *
 * The manifest (`virtual:lodestar-manifest`, generated from the registry at
 * build time) is a few kilobytes and carries everything the front page and the
 * Connections layer show. A module's prose, equations and references load only
 * on its own page, each as its own chunk, through the same `import.meta.glob`
 * the registry uses, made lazy. The per-route HTML preloads that chunk for the
 * page it serves, so a direct visit does not wait on an extra round trip.
 */
import { moduleManifest } from 'virtual:lodestar-manifest';
import { basename } from './sims';
import type { ModuleSummary } from './summary';
import type { Module } from './types';

export type { ModuleSummary } from './summary';

/** Every module, in the registry's order: published first, then alphabetical. */
export const moduleCatalog: readonly ModuleSummary[] = moduleManifest;

const byId = new Map(moduleCatalog.map((summary) => [summary.id, summary]));

export function getModuleSummary(id: string | undefined): ModuleSummary | undefined {
  return id ? byId.get(id) : undefined;
}

const loaders = Object.fromEntries(
  Object.entries(import.meta.glob<{ default: Module }>('./modules/*.ts')).map(([path, load]) => [
    basename(path),
    load,
  ]),
);

const loaded = new Map<string, Module>();
const pending = new Map<string, Promise<Module>>();

/** The module's full data if it has already arrived, else undefined. */
export function peekModule(id: string): Module | undefined {
  return loaded.get(id);
}

/**
 * Fetch a module's full data, or join the fetch already in flight. Safe to call
 * early and often: a link calls it on hover, focus or touch so the data is
 * usually in memory before the click lands.
 */
export function loadModule(id: string): Promise<Module> {
  const ready = loaded.get(id);
  if (ready) return Promise.resolve(ready);
  let promise = pending.get(id);
  if (!promise) {
    const load = loaders[id];
    if (!load) return Promise.reject(new Error(`No module data for "${id}"`));
    promise = load().then(
      (mod) => {
        loaded.set(id, mod.default);
        pending.delete(id);
        return mod.default;
      },
      (error: unknown) => {
        // Remembered as a failure rather than left as a rejected promise in
        // flight: re-thrown by `readModule`, the rejected promise only ever
        // suspended the page again, and a chunk that failed to arrive (a 502,
        // a dropped connection) left the reader with a blank page.
        pending.delete(id);
        failed.set(id, error);
        throw error;
      },
    );
    pending.set(id, promise);
  }
  return promise;
}

/** Load failures by module id, until a retry clears them. */
const failed = new Map<string, unknown>();

/** Whether this module's data failed to load and has not been retried since. */
export function moduleLoadFailed(id: string): boolean {
  return failed.has(id);
}

/**
 * Clear a failed load and fetch again. Rejects if it fails again; a browser
 * may also have cached the failed chunk, in which case only a reload helps.
 */
export function retryModule(id: string): Promise<Module> {
  failed.delete(id);
  return loadModule(id);
}

/** Start loading without waiting, for link-intent prefetching. Errors surface on the page. */
export function prefetchModule(id: string): void {
  if (loaded.has(id) || !loaders[id]) return;
  loadModule(id).catch(() => {});
}

/**
 * The module's full data, or a thrown promise: the Suspense protocol, the same
 * one `React.lazy` uses. The nearest boundary is the route's, whose fallback
 * is the same empty full-screen placeholder a page chunk shows while loading.
 */
export function readModule(id: string): Module {
  const ready = loaded.get(id);
  if (ready) return ready;
  // A failed load is thrown as an error, for the route's error boundary to
  // catch and offer a retry; see `LoadErrorBoundary`.
  if (failed.has(id)) throw failed.get(id);
  throw loadModule(id);
}

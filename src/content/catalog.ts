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
    promise = load().then((mod) => {
      loaded.set(id, mod.default);
      pending.delete(id);
      return mod.default;
    });
    pending.set(id, promise);
  }
  return promise;
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
  throw loadModule(id);
}

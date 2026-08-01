/**
 * Who a module is for.
 *
 * A draft module is in the registry — the glob is eager and `status` is just
 * data — so it is routable, linkable and reachable the moment its file exists.
 * That is what makes drafting in the repo comfortable, and it is also the one
 * way an unfinished page could reach a reader: the index filters drafts out, but
 * a Connections link resolves straight through the registry and would render a
 * live link to a page of TODO prose.
 *
 * So the rule lives here rather than being inlined at each call site, where the
 * two copies would eventually disagree: in development every module is visible,
 * in a production build only published ones are. `import.meta.env.DEV` is
 * statically false there, so the whole test folds away at build time.
 */
import type { Module } from '@/content/types';

/** A type predicate, so a visible module also narrows to a defined one. */
export function isReaderVisible<T extends Pick<Module, 'status'>>(
  module: T | undefined,
): module is T {
  if (!module) return false;
  return module.status === 'published' || import.meta.env.DEV;
}

/**
 * The registry — every module's full data, eagerly.
 *
 * Built by `import.meta.glob` at build time rather than by a hand-maintained
 * list, so dropping `src/content/modules/foo.ts` into the tree wires it up with
 * zero edits anywhere. Vite statically analyses the glob.
 *
 * The app's pages do not import this file. Eagerly, all eighteen modules' prose
 * was about 91 kB gzipped, and it used to sit in the entry chunk of every route.
 * The pages read `catalog.ts` instead: a small manifest generated from this
 * registry at build time, plus a lazy loader per module. The registry is what
 * the build reads to write per-route heads and the manifest, and what the tests
 * read to check every module.
 */
import type { Module } from './types';
import { basename } from './sims';

export { sims, getSim, simKeys } from './sims';

/* ---------------------------------- modules --------------------------------- */

const moduleFiles = import.meta.glob<{ default: Module }>('./modules/*.ts', {
  eager: true,
});

export const modules: Record<string, Module> = {};

for (const [path, mod] of Object.entries(moduleFiles)) {
  const key = basename(path);
  const data = mod.default;
  if (import.meta.env.DEV && data.id !== key) {
    // A mismatch silently breaks deep links, so shout during development.
    // eslint-disable-next-line no-console -- dev-only authoring diagnostic; the `import.meta.env.DEV` guard means Vite strips this from the production bundle
    console.error(
      `[registry] ${path} declares id "${data.id}" but its filename says "${key}". ` +
        `The filename is the URL; make them match.`,
    );
  }
  modules[data.id] = data;
}

/** Index order: published first, then alphabetical. Drafts sink to the bottom. */
export const moduleList: Module[] = Object.values(modules).sort((a, b) => {
  if (a.status !== b.status) return a.status === 'published' ? -1 : 1;
  return a.title.localeCompare(b.title);
});

export function getModule(id: string | undefined): Module | undefined {
  return id ? modules[id] : undefined;
}

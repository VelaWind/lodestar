/**
 * The registry — the only reason "add a module" is a one-file job.
 *
 * Both maps are built by `import.meta.glob` at build time rather than by a
 * hand-maintained list, so dropping `src/content/modules/foo.ts` and
 * `src/sims/foo.tsx` into the tree wires them up with zero edits anywhere in
 * the shell. Vite statically analyses these globs, so tree-shaking and code
 * splitting still work exactly as if the imports were written out.
 *
 * Module *data* is eager: it's small, and the index page needs every title and
 * tagline immediately. Sim *components* are lazy: they're the heavy part
 * (canvas, integrators, occasionally WebGL) and only one is ever on screen.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Module, SimProps } from './types';

/** `src/content/modules/escape-velocity.ts` → key `escape-velocity` */
function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(ts|tsx)$/, '');
}

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

/* ----------------------------------- sims ----------------------------------- */

const simFiles = import.meta.glob<{ default: ComponentType<SimProps> }>('../sims/*.tsx');

export const sims: Record<string, LazyExoticComponent<ComponentType<SimProps>>> =
  Object.fromEntries(
    Object.entries(simFiles).map(([path, loader]) => [basename(path), lazy(loader)]),
  );

export function getSim(
  simKey: string,
): LazyExoticComponent<ComponentType<SimProps>> | undefined {
  return sims[simKey];
}

/** Names of every registered sim — used by the "missing sim" error state. */
export const simKeys = Object.keys(sims);

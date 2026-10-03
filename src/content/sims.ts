/**
 * The sim components, lazily: dropping `src/sims/foo.tsx` into the tree
 * registers it with no edit anywhere. Each sim is its own chunk, fetched only
 * when its module page renders layer 3.
 *
 * Kept apart from `registry.ts`, which imports every module's data eagerly:
 * the app's shell imports this file, and importing the registry instead would
 * pull all twenty modules' prose into every page's entry chunk.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { SimProps } from './types';

/** `src/sims/escape-velocity.tsx` → key `escape-velocity` */
export function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(ts|tsx)$/, '');
}

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

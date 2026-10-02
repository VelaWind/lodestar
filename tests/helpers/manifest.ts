/**
 * `virtual:lodestar-manifest` for the test runner.
 *
 * Vitest does not run the build's `manifestPlugin`, so `vitest.config.ts`
 * aliases the virtual id to this file, which computes the manifest the same
 * way the plugin does: the real registry, through the same `summarise`.
 */
import { moduleList } from '@/content/registry';
import { summarise } from '@/content/summary';

export const moduleManifest = moduleList.map(summarise);

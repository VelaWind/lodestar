/** The build-time module manifest: see scripts/manifestPlugin.ts. */
declare module 'virtual:lodestar-manifest' {
  import type { ModuleSummary } from '@/content/summary';
  export const moduleManifest: ModuleSummary[];
}

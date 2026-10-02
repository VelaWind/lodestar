/**
 * The module manifest, generated from the registry, as a virtual module.
 *
 * `import { moduleManifest } from 'virtual:lodestar-manifest'` gives the app a
 * small array of `ModuleSummary` (id, title, tagline, status, teaser, slider
 * count, sim key), in the registry's order, so the front page and Connections
 * never have to load every module's full data. It is computed by running the
 * real registry through `summarise`, the same way `routeHeadsPlugin` reads it:
 * a regex over the data files would be a second, worse implementation of the
 * registry, and a committed JSON file would drift the first time someone forgot
 * to regenerate it.
 *
 * In development the dev server's own SSR loader reads the registry, and an
 * edit to any module file invalidates the manifest. In a build an inner server
 * does it, created with `configFile: false` so it does not load this plugin
 * again.
 */
import { fileURLToPath, URL } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';
import type { Module } from '../src/content/types';
import type { ModuleSummary } from '../src/content/summary';

const VIRTUAL_ID = 'virtual:lodestar-manifest';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const MODULES_DIR = fileURLToPath(new URL('../src/content/modules/', import.meta.url));

type Loader = (url: string) => Promise<Record<string, unknown>>;

async function summaries(load: Loader): Promise<ModuleSummary[]> {
  const registry = (await load('/src/content/registry.ts')) as { moduleList: Module[] };
  const summary = (await load('/src/content/summary.ts')) as {
    summarise: (module: Module) => ModuleSummary;
  };
  return registry.moduleList.map(summary.summarise);
}

/** Reads the registry with a throwaway server, for builds. */
async function summariesFromInnerServer(): Promise<ModuleSummary[]> {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  });
  try {
    return await summaries((url) => server.ssrLoadModule(url));
  } finally {
    await server.close();
  }
}

export function manifestPlugin(): Plugin {
  let devServer: ViteDevServer | null = null;

  return {
    name: 'lodestar:module-manifest',
    configureServer(server) {
      devServer = server;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const list = devServer
        ? await summaries((url) => devServer!.ssrLoadModule(url))
        : await summariesFromInnerServer();
      return `export const moduleManifest = ${JSON.stringify(list, null, 2)};\n`;
    },
    // A module file edited in development regenerates the manifest.
    handleHotUpdate({ file, server }) {
      if (!file.replace(/\\/g, '/').startsWith(MODULES_DIR.replace(/\\/g, '/'))) return;
      const manifest = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (manifest) server.moduleGraph.invalidateModule(manifest);
    },
  };
}

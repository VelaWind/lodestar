/**
 * One served HTML file per route, generated from the module registry.
 *
 * The problem it solves: this is a single-page app behind a catch-all rewrite,
 * so every URL used to serve the same `index.html`. A browser then set the
 * right title on hydration and nobody noticed — but a crawler does not hydrate.
 * Every module link shared anywhere unfurled as the site's front page: same
 * title, same description, same canonical-less shell. Seven modules, one card.
 *
 * The fix is nine real files. Each is a byte-for-byte copy of the built
 * `index.html` — same hashed script tags, same stylesheet, so the app it boots
 * is identical — with the head fields that describe *this* route rewritten. The
 * app hydrates over it exactly as it hydrated over the shared shell, which the
 * whole existing e2e suite continues to prove.
 *
 * Why `ssrLoadModule` rather than parsing the module files: the constraint is
 * that a title and a description come from the registry object, not from a list
 * someone maintains. The registry is built by `import.meta.glob`, which only
 * Vite understands, so the generator borrows Vite's own module loader to import
 * it for real — the same objects the app renders from. A regex over the data
 * files would be a second, worse implementation of the registry.
 *
 * The inner server is created with `configFile: false` so it does not load
 * `vite.config.ts` and, through it, this plugin again.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';
import type { Module } from '../src/content/types';
import { routeHeads, sitemapXml, type RouteHead } from './routes';

/** Attribute-safe text. Taglines are prose and prose contains ampersands. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Replaces a whole tag, tolerating the multi-line form `index.html` authors
 * some of these in. Throws rather than silently doing nothing: a head field
 * that stopped being rewritten would show up as seven pages sharing one
 * description, which is the exact bug this file exists to fix.
 */
function replaceTag(html: string, pattern: RegExp, replacement: string, what: string): string {
  if (!pattern.test(html)) throw new Error(`routeHeads: no ${what} to rewrite in index.html`);
  return html.replace(pattern, replacement);
}

/** The built shell, with this route's head written into it. */
export function headFor(shell: string, route: RouteHead): string {
  let html = shell;

  if (route.title) {
    html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${attr(route.title)}</title>`, 'title');
    html = replaceTag(
      html,
      /<meta\s+property="og:title"[\s\S]*?>/,
      `<meta property="og:title" content="${attr(route.title)}" />`,
      'og:title',
    );
  }

  // The root keeps its authored description; every other route states its own.
  if (route.description) {
    html = replaceTag(
      html,
      /<meta\s+name="description"[\s\S]*?>/,
      `<meta name="description" content="${attr(route.description)}" />`,
      'description',
    );
    html = replaceTag(
      html,
      /<meta\s+property="og:description"[\s\S]*?>/,
      `<meta property="og:description" content="${attr(route.description)}" />`,
      'og:description',
    );
  }

  html = replaceTag(
    html,
    /<meta\s+property="og:url"[\s\S]*?>/,
    `<meta property="og:url" content="${route.canonical}" />`,
    'og:url',
  );

  // Canonical is new, so it is inserted rather than replaced — every route,
  // the root included, so a crawler arriving at any of them knows which URL is
  // the address of record.
  if (/<link\s+rel="canonical"/.test(html)) {
    html = html.replace(
      /<link\s+rel="canonical"[\s\S]*?>/,
      `<link rel="canonical" href="${route.canonical}" />`,
    );
  } else {
    html = replaceTag(
      html,
      /<link rel="icon"/,
      `<link rel="canonical" href="${route.canonical}" />\n    <link rel="icon"`,
      'icon link to anchor the canonical to',
    );
  }

  return html;
}

/** The slice of Rollup's output bundle this plugin reads. */
interface OutputChunkLike {
  type: 'chunk';
  fileName: string;
  name: string;
  facadeModuleId: string | null;
  moduleIds: string[];
  imports: string[];
  isEntry: boolean;
  viteMetadata?: { importedCss: Set<string> };
}

/** Root-relative source path with forward slashes, for matching chunks to files. */
function sourcePath(id: string | null): string {
  if (!id) return '';
  const normal = id.replace(/\\/g, '/');
  const at = normal.lastIndexOf('/src/');
  return at === -1 ? normal : normal.slice(at + 1);
}

/**
 * `<link rel="modulepreload">` tags for one module page: the ModulePage and
 * RichText chunks, the module's own content chunk and its sim chunk, and
 * every chunk those import statically that the shell does not already load.
 *
 * Without them a direct visit to /m/<id> discovers its chunks one round trip
 * at a time: the entry, then ModulePage, then the module's data, then its sim.
 * With them the browser fetches all of them in parallel with the entry. The
 * module's stylesheets are preloaded too (`as="style"`, which does not block
 * rendering); Vite's loader attaches them as before.
 */
export function preloadTags(
  chunks: OutputChunkLike[],
  shell: string,
  moduleId: string,
  simKey: string,
): string {
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const wanted = (chunk: OutputChunkLike) => {
    const facade = sourcePath(chunk.facadeModuleId);
    return (
      facade === 'src/pages/ModulePage.tsx' ||
      facade === `src/content/modules/${moduleId}.ts` ||
      facade === `src/sims/${simKey}.tsx` ||
      chunk.moduleIds.some((id) => sourcePath(id) === 'src/components/RichText.tsx')
    );
  };

  const files = new Set<string>();
  const visit = (chunk: OutputChunkLike) => {
    if (chunk.isEntry || files.has(chunk.fileName)) return;
    files.add(chunk.fileName);
    for (const imported of chunk.imports) {
      const next = byFile.get(imported);
      if (next) visit(next);
    }
  };
  chunks.filter(wanted).forEach(visit);

  const css = new Set<string>();
  for (const file of files) {
    for (const sheet of byFile.get(file)?.viteMetadata?.importedCss ?? []) css.add(sheet);
  }

  // Anything the shell already links needs no second hint.
  const inShell = (file: string) => shell.includes(`/${file}"`);
  const scripts = [...files]
    .filter((file) => !inShell(file))
    .sort()
    .map((file) => `    <link rel="modulepreload" crossorigin href="/${file}">`);
  const sheets = [...css]
    .filter((file) => !inShell(file))
    .sort()
    .map((file) => `    <link rel="preload" as="style" crossorigin href="/${file}">`);
  return [...scripts, ...sheets].join('\n');
}

export function routeHeadsPlugin(): Plugin {
  let chunks: OutputChunkLike[] = [];

  return {
    name: 'lodestar:route-heads',
    apply: 'build',
    // Before closeBundle: the bundle's chunk graph, for the preload hints.
    writeBundle(_options, bundle) {
      chunks = Object.values(bundle).filter(
        (item): item is OutputChunkLike & (typeof bundle)[string] => item.type === 'chunk',
      ) as unknown as OutputChunkLike[];
    },
    // After the client bundle is on disk, so the shell being copied already
    // carries the hashed asset tags.
    async closeBundle() {
      const { createServer } = await import('vite');
      const server = await createServer({
        configFile: false,
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false },
        resolve: {
          alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
        },
      });

      let moduleList: Module[];
      try {
        const registry = (await server.ssrLoadModule('/src/content/registry.ts')) as {
          moduleList: Module[];
        };
        moduleList = registry.moduleList;
      } finally {
        await server.close();
      }

      const routes = routeHeads(moduleList);
      const outDir = 'dist';
      const shell = readFileSync(join(outDir, 'index.html'), 'utf8');

      const simKeyOf = new Map(moduleList.map((m) => [m.id, m.layers.play.simKey]));

      let written = 0;
      let preloaded = 0;
      for (const route of routes) {
        let html = headFor(shell, route);
        const moduleId = route.path.startsWith('/m/') ? route.path.slice(3) : null;
        if (moduleId) {
          const tags = preloadTags(chunks, shell, moduleId, simKeyOf.get(moduleId) ?? moduleId);
          if (!tags) throw new Error(`routeHeads: no preload hints for ${route.path}`);
          html = html.replace(/\n([ \t]*)<\/head>/, `\n${tags}\n$1</head>`);
          preloaded += 1;
        }
        for (const file of route.files) {
          const target = join(outDir, file);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, html);
          written += 1;
        }
      }

      writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml(routes));

      console.log(
        `\nroute heads: ${routes.length} routes, ${written} files + sitemap.xml ` +
          `(${routes.map((r) => r.path || '/').join(', ')}); preload hints on ${preloaded} module pages`,
      );
    },
  };
}

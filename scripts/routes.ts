/**
 * What every URL on the site should say about itself.
 *
 * Pure, and separate from the plugin that uses it, for one reason: the head a
 * route serves has to be derivable from the module registry alone, and a pure
 * function taking `moduleList` is the only shape that can be checked without
 * running a build. The plugin fetches the registry and calls this; the tests
 * assert the served HTML against the same field on the same object.
 *
 * There is no route table here and there must never be one. Seven of the nine
 * routes come out of `import.meta.glob`, so dropping a module file into the
 * tree gives it a title, a description, a canonical and a sitemap entry with no
 * edit anywhere — the same promise the registry makes to the shell, extended to
 * the parts of the page a crawler reads.
 */
import type { Module } from '../src/content/types';
import { absoluteUrl } from '../src/lib/site';

export interface RouteHead {
  /** Site-root-absolute path, no trailing slash. The root is `''`. */
  path: string;
  /**
   * Where the file goes under `dist/`. Both forms, and both are load-bearing.
   *
   * `about.html` is what `vite preview` resolves: sirv tries its
   * `extensions: ['html']` list for an extensionless request before falling
   * back to the SPA shell, but resolves a directory index only for a path that
   * already ends in a slash.
   *
   * `about/index.html` is what Vercel resolves, because serving a directory's
   * index is universal static behaviour while stripping `.html` is not — that
   * needs `cleanUrls`, and `cleanUrls` turned out to take the catch-all rewrite
   * out of the routing, so every address that matched no file stopped reaching
   * the app at all and returned a plain-text 404 instead of the not-found page.
   * The production curl matrix caught it; the fix is to need neither setting.
   *
   * Two copies of an 8 kB shell, and they carry the same canonical, so the
   * duplicate address resolves to one page of record either way.
   */
  files: string[];
  title: string;
  description: string;
  canonical: string;
}

/**
 * The About page's own description.
 *
 * Authored copy, and the one description on the site that cannot be read off a
 * module — /about is prose about the project rather than a topic, so it has no
 * tagline to borrow.
 */
export const ABOUT_DESCRIPTION =
  'How Lodestar is built: one text per topic in seven layers, simulations on real SI quantities, and an honesty rule for what every sim leaves out.';

/** The title the root keeps. Mirrors `index.html`, which stays as authored. */
export const ROOT_TITLE = 'Lodestar — space, explained in layers you choose to open';

/**
 * Every route that gets a served head, in sitemap order.
 *
 * Only published modules: a draft is invisible on the index and degrades to a
 * planned chip everywhere else, so giving it a canonical URL and a sitemap
 * entry would be the one place on the site that leaked it.
 */
export function routeHeads(moduleList: Module[]): RouteHead[] {
  const published = moduleList.filter((m) => m.status === 'published');

  return [
    {
      path: '',
      files: ['index.html'],
      // The root's title and description are authored in `index.html` and left
      // exactly as they are; it appears here so it gets a canonical like every
      // other route, and so the sitemap and the tests have one list to read.
      title: ROOT_TITLE,
      description: '',
      canonical: absoluteUrl('/'),
    },
    {
      path: '/about',
      files: ['about.html', 'about/index.html'],
      title: 'How Lodestar is built · Lodestar',
      description: ABOUT_DESCRIPTION,
      canonical: absoluteUrl('/about'),
    },
    ...published.map((module) => ({
      path: `/m/${module.id}`,
      files: [`m/${module.id}.html`, `m/${module.id}/index.html`],
      // Matches the convention `ModulePage` already sets at runtime, so the
      // served title and the hydrated one are the same string.
      title: `${module.title} · Lodestar`,
      // Read from the module, never retyped. The tagline is already the
      // one-line summary the index shows under the title.
      description: module.tagline,
      canonical: absoluteUrl(`/m/${module.id}`),
    })),
  ];
}

/** `<loc>` entries for the sitemap, in the same order. */
export function sitemapXml(routes: RouteHead[]): string {
  const urls = routes
    .map((route) => `  <url>\n    <loc>${route.canonical}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

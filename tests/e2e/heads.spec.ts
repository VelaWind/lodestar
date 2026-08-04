/**
 * What each URL says about itself before any JavaScript runs.
 *
 * This is a single-page app behind a catch-all rewrite, so until the build
 * started emitting per-route shells every address served the same head. A
 * browser fixed that on hydration and nobody noticed; a crawler does not
 * hydrate, so every module link shared anywhere unfurled as the site's front
 * page — seven modules, one card, one canonical-less shell.
 *
 * So this asks for the raw bytes. No browser, no `page.goto`, no hydration:
 * `request.get` returns exactly what a crawler is handed, and the assertions
 * read the markup rather than `document.title`. A regression here would be
 * invisible to every other test in the suite, all of which run a browser that
 * papers over it.
 *
 * The module descriptions are asserted *equal to the tagline on the module
 * object*, imported from the same files the app renders. That is the point of
 * the test rather than a nicety: the generator reads the registry at build
 * time, and this is what makes it impossible for the two to drift without
 * something going red.
 *
 * Chromium-only by omission — it carries no `@cross-engine` tag, and the other
 * engines are scoped to that tag. Nothing here touches a rendering engine.
 */
import { readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ABOUT_DESCRIPTION, ROOT_TITLE } from '../../scripts/routes';
import { SITE_ORIGIN } from '../../src/lib/site';
import blackHoles from '../../src/content/modules/black-holes';
import escapeVelocity from '../../src/content/modules/escape-velocity';
import exoplanets from '../../src/content/modules/exoplanets';
import gravitationalWaves from '../../src/content/modules/gravitational-waves';
import keplerOrbits from '../../src/content/modules/kepler-orbits';
import planetaryAtmospheres from '../../src/content/modules/planetary-atmospheres';
import scaleOfTheUniverse from '../../src/content/modules/scale-of-the-universe';

/**
 * The module objects, imported one by one.
 *
 * The registry itself is built with `import.meta.glob`, which only Vite
 * understands, so a Playwright spec cannot import it. Listing the seven here
 * would be the hand-maintained table this whole design exists to avoid — except
 * that the count is checked against the directory below, so a module added to
 * the tree and forgotten here fails rather than going unchecked.
 */
const MODULE_DATA = [
  blackHoles,
  escapeVelocity,
  exoplanets,
  gravitationalWaves,
  keplerOrbits,
  planetaryAtmospheres,
  scaleOfTheUniverse,
];

/** The first match's captured group, or null. */
function pick(html: string, pattern: RegExp): string | null {
  return pattern.exec(html)?.[1]?.trim() ?? null;
}

const title = (html: string) => pick(html, /<title>([\s\S]*?)<\/title>/);
const description = (html: string) =>
  pick(html, /<meta\s+name="description"\s+content="([^"]*)"/);
const ogTitle = (html: string) => pick(html, /<meta\s+property="og:title"\s+content="([^"]*)"/);
const ogDescription = (html: string) =>
  pick(html, /<meta\s+property="og:description"\s+content="([^"]*)"/);
const ogUrl = (html: string) => pick(html, /<meta\s+property="og:url"\s+content="([^"]*)"/);
const canonical = (html: string) => pick(html, /<link\s+rel="canonical"\s+href="([^"]*)"/);

test('every route serves its own head', async ({ request, baseURL }) => {
  const onDisk = readdirSync('src/content/modules').filter((f) => f.endsWith('.ts'));
  expect(
    MODULE_DATA.length,
    'a module file exists that this spec does not import — add it to MODULE_DATA',
  ).toBe(onDisk.length);

  const published = MODULE_DATA.filter((m) => m.status === 'published').sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  expect(published.length, 'expected seven published modules').toBe(7);

  /** The site card, which every route keeps regardless of its own head. */
  const CARD = `${SITE_ORIGIN}/og.png`;

  const checked: string[] = [];

  const fetchHtml = async (path: string): Promise<string> => {
    const response = await request.get(`${baseURL}${path}`);
    expect(response.status(), `${path || '/'}: not served`).toBe(200);
    expect(
      response.headers()['content-type'],
      `${path || '/'}: not served as HTML`,
    ).toContain('text/html');
    return response.text();
  };

  /* --- the root ----------------------------------------------------- */

  {
    const html = await fetchHtml('/');
    expect(title(html), 'root title').toBe(ROOT_TITLE);
    expect(canonical(html), 'root canonical').toBe(`${SITE_ORIGIN}/`);
    expect(ogUrl(html), 'root og:url').toBe(`${SITE_ORIGIN}/`);
    // The root's authored description stays as it is; it is about the site.
    expect((description(html) ?? '').length, 'root description').toBeGreaterThan(60);
    checked.push('/');
  }

  /* --- about -------------------------------------------------------- */

  {
    const html = await fetchHtml('/about');
    expect(title(html), 'about title').toBe('How Lodestar is built · Lodestar');
    expect(ogTitle(html), 'about og:title').toBe('How Lodestar is built · Lodestar');
    expect(description(html), 'about description').toBe(ABOUT_DESCRIPTION);
    expect(ogDescription(html), 'about og:description').toBe(ABOUT_DESCRIPTION);
    expect(canonical(html), 'about canonical').toBe(`${SITE_ORIGIN}/about`);
    expect(ogUrl(html), 'about og:url').toBe(`${SITE_ORIGIN}/about`);
    checked.push('/about');
  }

  /* --- every module ------------------------------------------------- */

  for (const module of published) {
    const path = `/m/${module.id}`;
    const html = await fetchHtml(path);

    expect(title(html), `${path}: title`).toBe(`${module.title} · Lodestar`);
    expect(ogTitle(html), `${path}: og:title`).toBe(`${module.title} · Lodestar`);
    // The assertion the generator is built around: what a crawler reads is the
    // module's own tagline, character for character.
    expect(description(html), `${path}: description should be the module's tagline`).toBe(
      module.tagline,
    );
    expect(ogDescription(html), `${path}: og:description should be the module's tagline`).toBe(
      module.tagline,
    );
    expect(canonical(html), `${path}: canonical`).toBe(`${SITE_ORIGIN}${path}`);
    expect(ogUrl(html), `${path}: og:url`).toBe(`${SITE_ORIGIN}${path}`);

    // The card is the site's on every route — only the words change.
    expect(html, `${path}: og:image should stay the site card`).toContain(
      `<meta property="og:image" content="${CARD}" />`,
    );
    expect(html, `${path}: twitter:image should stay the site card`).toContain(
      `<meta name="twitter:image" content="${CARD}" />`,
    );
    expect(html, `${path}: twitter:card`).toContain('content="summary_large_image"');

    checked.push(path);
  }

  /* --- no two routes claim the same address ------------------------- */

  expect(checked.length, 'nine routes checked').toBe(9);
  expect(new Set(checked).size, 'every route path is distinct').toBe(9);

  // eslint-disable-next-line no-console
  console.log(`  heads: ${checked.length} routes, each with its own title, description and canonical`);
});

test('the sitemap is a real file listing every route', async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/sitemap.xml`);
  expect(response.status(), 'sitemap not served').toBe(200);
  expect(
    response.headers()['content-type'],
    'sitemap should be XML, not the SPA shell',
  ).toMatch(/xml/);

  const xml = await response.text();
  expect(xml, 'sitemap should not be the app shell').not.toContain('<div id="root">');

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length, 'nine URLs').toBe(9);
  expect(locs, 'the root').toContain(`${SITE_ORIGIN}/`);
  expect(locs, 'about').toContain(`${SITE_ORIGIN}/about`);
  for (const module of MODULE_DATA.filter((m) => m.status === 'published')) {
    expect(locs, `${module.id} in the sitemap`).toContain(`${SITE_ORIGIN}/m/${module.id}`);
  }

  // eslint-disable-next-line no-console
  console.log(`  sitemap: ${locs.length} URLs`);
});

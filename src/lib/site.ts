/**
 * Where this site lives, written down once.
 *
 * Four things need the origin and used to hardcode it: the head in
 * `index.html`, the per-route shells the build generates, the sitemap, and the
 * tests that check both. A custom domain is now a one-line change here rather
 * than a search across the tree for a string that appears in HTML, in a
 * generator, in XML and in an assertion.
 *
 * Deliberately plain TypeScript with no Vite-only syntax, because the build's
 * own generator imports it from Node before Vite exists and Playwright imports
 * it from a spec.
 */
export const SITE_ORIGIN = 'https://lodestar-nu-six.vercel.app';

/** `/m/black-holes` → `https://…/m/black-holes`. Root stays a bare slash. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

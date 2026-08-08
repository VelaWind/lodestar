/**
 * KaTeX rendering.
 *
 * Using KaTeX directly rather than `react-katex`. react-katex is a ~40-line
 * wrapper whose last release predates React 18's stabilisation, so it installs
 * with peer-dependency warnings and its types lag; taking it on means a second
 * dependency that can go stale independently of the thing it wraps. KaTeX
 * itself is actively maintained and its API here is one function call.
 * Calling it directly also lets us own the options we actually care about
 * (throwOnError: false so a bad macro degrades to red text instead of blanking
 * the page, trust: false since content is authored but macros are still code)
 * and own the memoisation, which is the only real cost of renderToString.
 */
import { memo, useMemo } from 'react';
/*
 * KaTeX's full font set, deliberately not subsetted.
 *
 * Subsetting was considered and rejected. The risk it carries is silent: a
 * subset is built from the glyphs the modules use *today*, and the next module
 * to reach for a script capital, a vector arrow or an uncommon operator would
 * render a blank box with nothing failing anywhere — no build error, no test
 * failure, just a hole in an equation nobody was looking at. Modules are typed
 * data files written by hand, so the glyph set is not knowable in advance.
 *
 * What it would buy is small. The vendor sheet declares every face, but a
 * browser only fetches the ones the rendered glyphs actually reference: on the
 * most equation-dense page in the site that is one file, 79 kB, and it is not on
 * the critical path. Mobile Lighthouse on those pages measures 96–97.
 *
 * A page heavy enough to want this would be a page to reconsider, not to subset.
 */
// Vendor sheet first, then our overrides — see src/styles/katex.css.
import 'katex/dist/katex.min.css';
import '@/styles/katex.css';

/* ------------------------------------------------------------------ */
/* Loading KaTeX late, and only when there is math to render           */
/* ------------------------------------------------------------------ */

/**
 * The library is 78 kB of JavaScript and, on the page a first-time reader
 * lands on, renders nothing at all: at the Curious tier the open layers are the
 * hook, the intuition and the sim, and none of the seven published modules has
 * a single `math` or `mathBlock` node in any of them. It was still fetched in
 * the second wave of the module page's request chain, ahead of first paint,
 * because `Tex` imported it at module scope.
 *
 * So the import is dynamic and the module holds the result. Three states, and
 * the distinction matters to callers: loaded, loading, and not yet asked for.
 */
type KatexModule = typeof import('katex');

let katexModule: KatexModule | null = null;
let katexPending: Promise<void> | null = null;

/** True once `renderToString` can be called synchronously. */
export function katexLoaded(): boolean {
  return katexModule !== null;
}

/**
 * Start the fetch, or join the one already in flight.
 *
 * Idempotent and safe to call from anywhere — the page prefetches on idle, and
 * the accordion calls it again before opening a layer that has math in it.
 */
export function ensureKatex(): Promise<void> {
  if (katexModule) return Promise.resolve();
  katexPending ??= import('katex').then((m) => {
    katexModule = (m as unknown as { default?: KatexModule }).default ?? (m as KatexModule);
  });
  return katexPending;
}

/**
 * The module, or a thrown promise.
 *
 * Throwing a promise is the Suspense protocol, and it is the safety net rather
 * than the main path. Everything that opens a layer waits for `ensureKatex`
 * first, so by the time a `Tex` mounts the library is normally already here. If
 * something ever mounts one before that — a tier restored from storage on a
 * cold, slow load — React suspends instead of rendering, which is the one
 * behaviour that is acceptable: the reader waits a moment for the page, and
 * never sees raw TeX or watches an equation push the paragraph below it down.
 */
function readKatex(): KatexModule {
  if (katexModule) return katexModule;
  throw ensureKatex();
}

interface TexProps {
  tex: string;
  display?: boolean;
  className?: string;
}

function render(tex: string, display: boolean): string {
  return readKatex().renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    errorColor: '#e8737d',
    strict: 'ignore',
    trust: false,
    output: 'htmlAndMathml',
  });
}

export const Tex = memo(function Tex({ tex, display = false, className }: TexProps) {
  const html = useMemo(() => render(tex, display), [tex, display]);

  // KaTeX's output is HTML by design; the input is authored TypeScript in this
  // repo, never user input, and `trust: false` blocks \href/\url injection.
  return display ? (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
});

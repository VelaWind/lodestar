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
import katex from 'katex';
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

interface TexProps {
  tex: string;
  display?: boolean;
  className?: string;
}

function render(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
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

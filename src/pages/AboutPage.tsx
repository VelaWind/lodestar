/**
 * The About page: how the site is built, and the rules it holds itself to.
 *
 * Deliberately the plainest page here — no cards, no icons, no panels. It is
 * one column of prose set in the same measure as a module's, rendered through
 * the same `RichText` component, so the typography cannot drift from the pages
 * it describes. Everything it says lives in `content/about.ts`.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { aboutSections, aboutTitle } from '@/content/about';
import { RichText } from '@/components/RichText';

export function AboutPage() {
  useEffect(() => {
    document.title = `${aboutTitle} · Lodestar`;
  }, []);

  return (
    /* `xl:px-10` puts this page on the same axis as a module's prose, and — the
       reason it is here rather than only for tidiness — it caps the headings at
       the measure. `max-w-measure` is 68ch, and `ch` scales with the element:
       on a 48px display serif it is three times the reading measure, so the h1
       and the section headings used to run the full width of the page while the
       paragraphs under them stopped at 544px. The container settles all three. */
    <article className="xl:px-10">
      <header className="mb-12">
        {/* Same affordance as a module page: a way back that is not the logo. */}
        <Link
          to="/"
          className="-my-2 inline-block py-2 font-ui text-xs text-ink-faint underline-offset-4 transition-colors hover:text-star hover:underline"
        >
          ← All modules
        </Link>
        <h1 className="mt-5 max-w-measure font-prose text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
          {aboutTitle}
        </h1>
      </header>

      <div className="space-y-12">
        {aboutSections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-3 font-ui text-xs font-medium uppercase tracking-[0.16em] text-star/80">
              {section.heading}
            </h2>
            <RichText content={section.body} />
          </section>
        ))}
      </div>
    </article>
  );
}

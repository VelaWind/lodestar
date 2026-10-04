/**
 * "Start here": the learning path on the front page, above the topic grid.
 *
 * Four stages, each a native `<details>`: a heading and one sentence in the
 * summary, the topics as a numbered list inside, numbered 1 to 22 straight
 * through the stages. Native disclosure gives keyboard operation and the
 * expanded state to assistive technology for free, and has no animation to
 * honour or skip.
 *
 * Compact on a phone: there only the first stage starts open, so the whole
 * section stays within about a screen and the grid below is not pushed far
 * away. From the `sm` breakpoint every stage starts open, side by side. The
 * choice is made once, in the first render, so nothing shifts after it.
 *
 * Titles and taglines come from the manifest, never from a module's own data,
 * so the front page loads nothing more than it did.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getModuleSummary } from '@/content/catalog';
import { LEARNING_PATH, PATH_NOTE, PATH_STEPS } from '@/content/path';
import { prefetchOnIntent } from '@/lib/prefetch';

/** Tailwind's `sm`: the width from which every stage starts open. */
const WIDE = '(min-width: 640px)';

function startsWide(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches;
}

export function StartHere() {
  // Read once: the reader's own opening and closing is the `<details>`' business after that.
  const [wide] = useState(startsWide);
  const firstStep = new Map(PATH_STEPS.map((entry) => [entry.id, entry.step]));

  return (
    <section aria-labelledby="start-here" className="breakout mb-14 [--breakout:var(--cards)]">
      <h2 id="start-here" className="font-prose text-2xl text-ink">
        Start here
      </h2>
      <p className="mt-2 font-ui text-sm text-ink-faint">{PATH_NOTE}</p>

      {/* `grid-cols-1` is not a no-op: it is minmax(0, 1fr). Without it the one
          column sizes to its content, and a tagline held to one line is as
          wide as its whole sentence. */}
      <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4" role="list">
        {LEARNING_PATH.map((stage, s) => (
          <li key={stage.title} className="rounded-xl border border-edge-soft bg-void-800/40">
            <details open={wide || s === 0} className="group">
              {/* A heading may sit directly in a summary, beside phrasing content;
                  the chevron is placed absolutely so neither needs a wrapper. */}
              <summary className="relative cursor-pointer list-none rounded-xl py-2.5 pl-4 pr-10 [&::-webkit-details-marker]:hidden">
                <h3 className="font-prose text-base text-ink">
                  <span className="block font-ui text-[0.65rem] uppercase tracking-[0.14em] text-star">
                    Stage {s + 1}
                  </span>{' '}
                  {stage.title}
                </h3>
                <span className="mt-1 block font-prose text-sm leading-snug text-ink-dim">{stage.description}</span>
                <span
                  aria-hidden
                  className="absolute right-4 top-2.5 font-ui text-base text-ink-faint group-open:rotate-90"
                >
                  ›
                </span>
              </summary>

              <ol start={firstStep.get(stage.modules[0]!)} className="space-y-0.5 px-2 pb-2.5" role="list">
                {stage.modules.map((id) => {
                  const summary = getModuleSummary(id);
                  if (!summary) return null;
                  return (
                    <li key={id}>
                      <Link
                        to={`/m/${id}`}
                        {...prefetchOnIntent(id)}
                        className="group/step flex gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-void-700/60"
                      >
                        <span className="w-5 shrink-0 text-right font-ui text-xs leading-6 tabular-nums text-ink-faint">
                          {firstStep.get(id)}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-prose text-sm leading-6 text-ink transition-colors group-hover/step:text-star">
                            {summary.title}
                          </span>
                          {/* One line on a phone, two from `sm`; the whole sentence is still in the link's name. */}
                          <span className="block truncate font-prose text-xs leading-snug text-ink-faint sm:line-clamp-2 sm:whitespace-normal">
                            {summary.tagline}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

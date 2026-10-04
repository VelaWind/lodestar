/**
 * "On the learning path": a module page's place in the suggested order, below
 * the layers and references.
 *
 * Separate from Connections on purpose. Connections are the module's own
 * reasons to go somewhere next; this is one fixed route through every topic,
 * the same one the front page shows. Titles come from the manifest, so the
 * neighbouring modules are not loaded until a reader shows intent to follow.
 */
import { Link } from 'react-router-dom';
import { getModuleSummary } from '@/content/catalog';
import { PATH_NOTE, pathPlace } from '@/content/path';
import { prefetchOnIntent } from '@/lib/prefetch';

/**
 * One line under a module's title: what the page holds, and its step on the
 * path, linked to the footer that has the neighbours. Manifest data only.
 */
export function PageOrientation({ moduleId }: { moduleId: string }) {
  const place = pathPlace(moduleId);
  return (
    <p className="mt-3 max-w-measure font-ui text-xs leading-relaxed text-ink-faint">
      Seven layers, from plain words to the equations, with a live simulation in layer 3
      {place && (
        <>
          {' · '}
          <a href="#path-footer" className="text-star underline decoration-star/40 underline-offset-4 hover:decoration-star">
            Step {place.step} of {place.total}
          </a>{' '}
          on the suggested path for beginners
        </>
      )}
    </p>
  );
}

export function PathFooter({ moduleId }: { moduleId: string }) {
  const place = pathPlace(moduleId);
  if (!place) return null;
  const previous = place.previous ? getModuleSummary(place.previous) : undefined;
  const next = getModuleSummary(place.next);

  return (
    <nav aria-labelledby="path-footer" className="mt-16 border-t border-edge-soft pt-8 xl:px-10" data-path-footer>
      <h2 id="path-footer" className="font-ui text-xs uppercase tracking-[0.14em] text-ink-faint">
        On the learning path
      </h2>
      <p className="mt-2 font-prose text-ink-dim">
        <span data-path-step>
          Step {place.step} of {place.total}
        </span>
        {' · '}
        <span data-path-stage>{place.stage.title}</span>
      </p>
      <p className="mt-1 font-ui text-xs text-ink-faint">{PATH_NOTE}</p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2" role="list">
        {previous && (
          <li>
            <Link
              to={`/m/${previous.id}`}
              rel="prev"
              {...prefetchOnIntent(previous.id)}
              data-path-previous
              className="group block h-full rounded-lg border border-edge-soft bg-void-800/40 px-4 py-3 transition-colors hover:border-star-dim/60 hover:bg-void-700/60"
            >
              <span className="block font-ui text-xs text-ink-faint">← Previous</span>
              <span className="font-prose text-ink transition-colors group-hover:text-star">{previous.title}</span>
            </Link>
          </li>
        )}
        {next && (
          <li className={previous ? undefined : 'sm:col-start-2'}>
            <Link
              to={`/m/${next.id}`}
              rel={place.wraps ? undefined : 'next'}
              {...prefetchOnIntent(next.id)}
              data-path-next
              className="group block h-full rounded-lg border border-edge-soft bg-void-800/40 px-4 py-3 text-end transition-colors hover:border-star-dim/60 hover:bg-void-700/60"
            >
              <span className="block font-ui text-xs text-ink-faint">
                {place.wraps ? 'Back to the start of the path →' : 'Next →'}
              </span>
              <span className="font-prose text-ink transition-colors group-hover:text-star">{next.title}</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}

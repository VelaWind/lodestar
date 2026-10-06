/**
 * The address that matches nothing.
 *
 * This route used to `<Navigate to="/" replace />`, which is the worst of the
 * available answers: a reader who followed a stale link or mistyped a slug
 * landed on the front page with no indication that anything had gone wrong,
 * and the address they came for vanished from the history so they could not
 * even see what they had asked for. Silence is not a 404.
 *
 * `ModulePage` uses it too, for a slug that names no module, passing its own
 * heading: it knows the id that failed and says it — "No module called
 * “kepler-orbts”" — which is the more useful message when the route matched and
 * only the slug was wrong. Called with nothing, it cannot know anything, so it
 * says less.
 *
 * Quiet, like the rest of the site's empty states: the same centred column, the
 * prose serif for the words, the star-blue link in the UI sans. No illustration
 * and no apology.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNoindex } from '@/lib/useNoindex';

export function NotFoundPage({
  heading = 'Nothing here',
  message = 'No module lives at this address.',
}: {
  heading?: string;
  /** A sentence under the heading; none when the heading says it all. */
  message?: string | null;
} = {}) {
  useNoindex();

  useEffect(() => {
    document.title = 'Nothing here · Lodestar';
  }, []);

  return (
    <div className="py-24 text-center">
      <h1 className="font-prose text-2xl text-ink">{heading}</h1>
      {message && <p className="mt-3 font-prose text-[1.0625rem] text-ink-dim">{message}</p>}
      <Link
        to="/"
        className="mt-6 inline-block font-ui text-sm text-star underline-offset-4 hover:underline"
      >
        Back to all modules
      </Link>
    </div>
  );
}

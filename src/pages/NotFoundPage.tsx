/**
 * The address that matches nothing.
 *
 * This route used to `<Navigate to="/" replace />`, which is the worst of the
 * available answers: a reader who followed a stale link or mistyped a slug
 * landed on the front page with no indication that anything had gone wrong,
 * and the address they came for vanished from the history so they could not
 * even see what they had asked for. Silence is not a 404.
 *
 * Deliberately not the same component as `ModulePage`'s own not-found. That one
 * knows the id that failed and says it — "No module called “kepler-orbts”" —
 * which is the more useful message when the route matched and only the slug was
 * wrong. This one cannot know anything, so it says less.
 *
 * Quiet, like the rest of the site's empty states: the same centred column, the
 * prose serif for the words, the star-blue link in the UI sans. No illustration
 * and no apology.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Nothing here · Lodestar';
  }, []);

  return (
    <div className="py-24 text-center">
      <h1 className="font-prose text-2xl text-ink">Nothing here</h1>
      <p className="mt-3 font-prose text-[1.0625rem] text-ink-dim">
        No module lives at this address.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block font-ui text-sm text-star underline-offset-4 hover:underline"
      >
        Back to all modules
      </Link>
    </div>
  );
}

/**
 * Layer 7. Resolves each target id against the registry so a link to a module
 * that doesn't exist yet degrades to a legible "planned" chip rather than a
 * dead link — expected, since modules land one at a time.
 *
 * A module that exists but is still a draft takes the same chip in production.
 * The index already hides drafts; without this, a connection would be the one
 * route by which a reader reached a page of unfinished prose. In development the
 * link stays live, badged, so the draft can be worked on.
 */
import { Link } from 'react-router-dom';
import { getModule } from '@/content/registry';
import type { ConnectionsLayer } from '@/content/types';
import { isReaderVisible } from '@/lib/visibility';

export function Connections({ layer }: { layer: ConnectionsLayer }) {
  if (layer.links.length === 0) {
    return <p className="font-prose text-ink-faint">No connections mapped yet.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {layer.links.map(({ moduleId, reason }) => {
        const target = getModule(moduleId);

        if (!isReaderVisible(target)) {
          // No `opacity-60` here any more: dimming the whole chip composited its
          // text toward the background and put it at 2.44:1 and 3.38:1. The
          // quietness now comes from the tone and the dashed border, both of
          // which keep their contrast.
          return (
            <li
              key={moduleId}
              className="rounded-lg border border-dashed border-edge-soft px-4 py-3.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                {/* The id, not the title, when there is no module: a title would
                    be inventing one. A draft has a real title, but it is unwritten
                    work, so it reads the same as anything else not here yet. */}
                <span className="font-prose text-ink-muted-elevated">{moduleId}</span>
                <span className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted-elevated">
                  planned
                </span>
              </div>
              <p className="mt-1 font-prose text-sm text-ink-muted-elevated">{reason}</p>
            </li>
          );
        }

        return (
          <li key={moduleId}>
            <Link
              to={`/m/${target.id}`}
              className="group block h-full rounded-lg border border-edge-soft bg-void-800/40 px-4 py-3.5 transition-colors hover:border-star-dim/60 hover:bg-void-700/60"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-prose text-ink transition-colors group-hover:text-star">
                  {target.title}
                </span>
                {/* Only reachable in development — see `isReaderVisible`. */}
                {target.status === 'draft' && (
                  <span className="shrink-0 rounded-full border border-ember/40 px-2 py-0.5 font-ui text-[0.6rem] uppercase tracking-wider text-ember">
                    draft
                  </span>
                )}
              </span>
              <p className="mt-1 font-prose text-sm text-ink-faint">{reason}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Layer 7. Resolves each target id against the registry so a link to a module
 * that doesn't exist yet degrades to a legible "planned" chip rather than a
 * dead link — expected, since modules land one at a time.
 */
import { Link } from 'react-router-dom';
import { getModule } from '@/content/registry';
import type { ConnectionsLayer } from '@/content/types';

export function Connections({ layer }: { layer: ConnectionsLayer }) {
  if (layer.links.length === 0) {
    return <p className="font-prose text-ink-faint">No connections mapped yet.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {layer.links.map(({ moduleId, reason }) => {
        const target = getModule(moduleId);

        if (!target) {
          return (
            <li
              key={moduleId}
              className="rounded-lg border border-dashed border-edge-soft px-4 py-3.5 opacity-60"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-prose text-ink-dim">{moduleId}</span>
                <span className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-faint">
                  planned
                </span>
              </div>
              <p className="mt-1 font-prose text-sm text-ink-faint">{reason}</p>
            </li>
          );
        }

        return (
          <li key={moduleId}>
            <Link
              to={`/m/${target.id}`}
              className="group block h-full rounded-lg border border-edge-soft bg-void-800/40 px-4 py-3.5 transition-colors hover:border-star-dim/60 hover:bg-void-700/60"
            >
              <span className="font-prose text-ink transition-colors group-hover:text-star">
                {target.title}
              </span>
              <p className="mt-1 font-prose text-sm text-ink-faint">{reason}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

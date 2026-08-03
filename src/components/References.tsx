/**
 * Reference list at the bottom of a module. Outside the accordion on purpose:
 * sources are not a "depth level", they're always available.
 */
import type { Reference } from '@/content/types';

export function References({ items }: { items: Reference[] }) {
  if (items.length === 0) return null;

  return (
    /* `xl:px-10` keeps the list itself in the prose column — the rule above it
       still spans the full column, because it divides the page rather than
       belonging to the text. */
    <section className="mt-16 border-t border-edge-soft pt-8 xl:px-10">
      <h2 className="font-ui text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
        References
      </h2>
      <ol className="mt-5 space-y-4">
        {items.map((ref, i) => (
          <li key={ref.url} className="flex gap-4 font-prose text-sm leading-relaxed">
            <span className="w-5 shrink-0 pt-0.5 font-mono text-xs tabular-nums text-ink-faint">
              {i + 1}
            </span>
            <span className="text-ink-dim">
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ink underline decoration-edge underline-offset-[3px] transition-colors hover:decoration-star"
              >
                {ref.label}
              </a>
              {ref.note && <span className="text-ink-faint"> — {ref.note}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

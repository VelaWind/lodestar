/**
 * One accordion row. Purely presentational: it does not know which layer it is
 * or why it's open — the page owns expansion state so tier changes can reset it
 * atomically.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { LayerMeta } from '@/lib/layers';

interface Props {
  meta: LayerMeta;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function Layer({ meta, open, onToggle, children }: Props) {
  const reduced = useReducedMotion();
  const panelId = `layer-panel-${meta.id}`;
  const headerId = `layer-header-${meta.id}`;

  return (
    <section className="border-t border-edge-soft first:border-t-0">
      <h2>
        <button
          id={headerId}
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="group flex w-full items-baseline gap-4 py-5 text-left transition-colors"
        >
          <span
            className={`w-6 shrink-0 font-mono text-xs tabular-nums transition-colors ${
              open ? 'text-star' : 'text-ink-faint group-hover:text-ink-faint'
            }`}
          >
            {String(meta.index).padStart(2, '0')}
          </span>

          <span className="min-w-0 flex-1">
            <span
              className={`block font-prose text-xl transition-colors ${
                open ? 'text-ink' : 'text-ink-dim group-hover:text-ink'
              }`}
            >
              {meta.title}
            </span>
            <span className="mt-0.5 block font-ui text-xs text-ink-faint">{meta.hint}</span>
          </span>

          <motion.svg
            viewBox="0 0 14 14"
            aria-hidden
            className={`h-3 w-3 shrink-0 self-center stroke-current transition-colors ${
              open ? 'text-star' : 'text-ink-faint group-hover:text-ink-faint'
            }`}
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <path d="M2 5l5 5 5-5" fill="none" strokeWidth="1.5" strokeLinecap="round" />
          </motion.svg>
        </button>
      </h2>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : {
                    height: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.22, ease: 'linear' },
                  }
            }
            className="overflow-hidden"
          >
            {/* Inner wrapper: padding lives here so the animated height is
                measured on a box whose height is purely content. */}
            <div className="pb-9 pl-0 sm:pl-10">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

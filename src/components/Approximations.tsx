/**
 * The "what this sim is lying about" panel. Sits beside the sim, collapsed by
 * default but never hidden — the count is always visible in the header so the
 * reader knows simplifications exist before deciding whether to read them.
 *
 * Each item is rich text rather than a string, so a glossary term can be marked
 * here like anywhere else. The visual result is unchanged: one bulleted line per
 * item, at the same size and colour it always had — `RichText`'s own paragraph
 * styling is overridden by the list, because these are list items, not prose
 * blocks, and an item that grew into two paragraphs would want the bullet to
 * cover both.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { RichText as RichTextAst } from '@/content/types';
import { RichText } from './RichText';

export function Approximations({ items }: { items: RichTextAst[] }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-edge-soft bg-void-800/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-ui text-xs font-medium uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-ink-dim"
      >
        <motion.svg
          viewBox="0 0 12 12"
          className="h-2.5 w-2.5 shrink-0 fill-current"
          animate={{ rotate: open ? 90 : 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <path d="M3 1l6 5-6 5z" />
        </motion.svg>
        <span className="flex-1">Approximations</span>
        <span className="font-mono text-[0.7rem] text-ink-faint">{items.length}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-2.5 border-t border-edge-soft px-4 py-3 font-prose text-sm leading-relaxed text-ink-dim">
              {items.map((item, i) => (
                <li
                  key={i}
                  /* `[&_p]:…` restates the item's own type on the paragraph
                     RichText emits: the shared prose size (1.0625rem/1.75) is
                     set for a reading column, and this is an 18rem sidebar. The
                     rendered result is the string version's, to the pixel. */
                  className="relative pl-4 before:absolute before:left-0 before:top-[0.65em] before:h-1 before:w-1 before:rounded-full before:bg-ember/60 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink-dim [&>div]:max-w-none [&>div]:space-y-2"
                >
                  <RichText content={item} />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

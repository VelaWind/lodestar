/**
 * One accordion row. Purely presentational: it does not know which layer it is
 * or why it's open — the page owns expansion state so tier changes can reset it
 * atomically.
 */
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { DURATION, EASE } from '@/motion/tokens';
import { useReducedMotion } from '@/motion/useReducedMotion';
import type { LayerMeta } from '@/lib/layers';

const EASE_OUT = [...EASE.out];

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
    /* The rule between layers lives on the `Reveal` wrapper in `ModulePage`, not
       here. It has to: `first:border-t-0` is `:first-child`, and once every
       section sits inside its own wrapper every section is a first child, so the
       dividers all switch themselves off. The wrappers are siblings, so the
       selector means there what it used to mean here. */
    <section>
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
            transition={
              reduced
                ? { duration: 0 }
                : { duration: DURATION.fast / 1000, ease: EASE_OUT }
            }
          >
            <path d="M2 5l5 5 5-5" fill="none" strokeWidth="1.5" strokeLinecap="round" />
          </motion.svg>
        </button>
      </h2>

      {/*
        The drawer opens instantly. The indicator above is the only thing that
        animates, and that is a deliberate change from what this used to do.

        It used to animate `height: 0 → auto` over 360ms, which is the one shape
        of animation this codebase now rules out everywhere: height is a layout
        property, so every frame of that transition reflowed the document and
        dragged the footer — and every layer below — up and down behind it. It
        read well and it cost a full relayout per frame on the longest pages on
        the site. Opening a disclosure is a direct response to a click, where
        instant is not a compromise; nothing about the panel needs easing in for
        the reader to understand that their click did something, because the
        indicator already told them.

        `overflow-hidden` stays. It no longer has an animation to clip, but at
        `xl` this box is widened to the sim stage so layer 3's breakout is not
        cut off at the column edge, and the clip is what keeps the other six
        layers from painting into that extra width.
      */}
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="breakout overflow-hidden [--breakout:var(--stage)]"
        >
          {/* Inner wrapper: the padding lives here rather than on the box above.

              At `xl` the indent stops being padding and becomes position: the
              measure is centred inside the widened box, which lands it in
              exactly the same place — 40px in from the column's left edge,
              under the layer title — while leaving the containing block for
              anything inside it equal to the measure, so `.breakout` centres on
              the prose rather than 20px to the right of it. */}
          <div className="pb-9 pl-0 sm:pl-10 xl:mx-auto xl:w-[var(--measure)] xl:pl-0">
            {children}
          </div>
        </div>
      )}
    </section>
  );
}

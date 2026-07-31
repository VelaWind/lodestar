/**
 * The depth selector. Lives in the header on every page.
 *
 * Copy matters here: this control changes *where you land*, never what exists.
 * The helper line says so explicitly, because a reader who thinks "Curious" is
 * hiding the real content will never trust the app.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { TIERS } from '@/lib/layers';
import { useAppStore } from '@/store/useAppStore';

export function DepthControl() {
  const tier = useAppStore((s) => s.tier);
  const setTier = useAppStore((s) => s.setTier);
  const reduced = useReducedMotion();

  return (
    <div className="flex items-center gap-3">
      <span className="hidden font-ui text-[0.7rem] uppercase tracking-[0.16em] text-ink-faint sm:inline">
        Depth
      </span>
      <div
        role="radiogroup"
        aria-label="Reading depth"
        className="relative flex rounded-full border border-edge-soft bg-void-800/80 p-0.5"
      >
        {TIERS.map((t) => {
          const active = t.id === tier;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={t.blurb}
              onClick={() => setTier(t.id)}
              className={`relative rounded-full px-3.5 py-1.5 font-ui text-xs transition-colors sm:px-4 ${
                active ? 'text-void-900' : 'text-ink-faint hover:text-ink-dim'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="depth-pill"
                  className="absolute inset-0 rounded-full bg-star"
                  transition={
                    reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
                  }
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

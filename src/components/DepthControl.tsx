/**
 * The depth selector. Lives in the header on every page.
 *
 * Copy matters here: this control changes *where you land*, never what exists.
 * The helper line says so explicitly, because a reader who thinks "Curious" is
 * hiding the real content will never trust the app.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TIERS } from '@/lib/layers';
import { useAppStore } from '@/store/useAppStore';

/**
 * Asks the header's depth control for focus.
 *
 * A custom event rather than a store field or a ref passed down: the sender is a
 * word inside a paragraph on two different pages, the receiver is in the app
 * chrome, and nothing between them has any other reason to know about the other.
 * A store field would make "somebody asked for focus" part of the application
 * state, which it is not — it is a one-shot message.
 */
export const FOCUS_DEPTH_EVENT = 'lodestar:focus-depth';

export function requestDepthFocus(): void {
  window.dispatchEvent(new CustomEvent(FOCUS_DEPTH_EVENT));
}

export function DepthControl() {
  const tier = useAppStore((s) => s.tier);
  const setTier = useAppStore((s) => s.setTier);
  const reduced = useReducedMotion();
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [summoned, setSummoned] = useState(false);

  /* Focus lands on the selected tier, which is where a radio group's focus
     belongs, and the ring says so. The flash is for the pointer user who
     clicked the word and would otherwise see nothing move. */
  useEffect(() => {
    const onRequest = () => {
      const selected = groupRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      selected?.focus();
      setSummoned(true);
    };
    window.addEventListener(FOCUS_DEPTH_EVENT, onRequest);
    return () => window.removeEventListener(FOCUS_DEPTH_EVENT, onRequest);
  }, []);

  useEffect(() => {
    if (!summoned) return;
    const timer = window.setTimeout(() => setSummoned(false), 1_400);
    return () => window.clearTimeout(timer);
  }, [summoned]);

  return (
    /* One bordered group, label included. Apart, "Depth" sat in the header at
       the same size and tone as "About" next to it and read as a second nav
       link. The border is the sentence: this word names these buttons. */
    <div
      className={`flex items-center gap-2.5 rounded-full border bg-void-800/60 py-0.5 pl-0.5 pr-0.5 transition-colors sm:pl-3.5 ${
        summoned ? 'border-star/70' : 'border-edge-soft'
      }`}
    >
      <span
        id="depth-control-label"
        className="hidden font-ui text-[0.7rem] uppercase tracking-[0.16em] text-ink-faint sm:inline"
      >
        Depth
      </span>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="depth-control-label"
        aria-label="Reading depth"
        className="relative flex rounded-full"
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
              // px-3 at base buys the ~20px the header needs to fit a 375px
              // phone; py-2.5 takes the pill to 36px, the most a 64px header can
              // give a tap target without the chrome growing.
              className={`relative rounded-full px-3 py-2.5 font-ui text-xs transition-colors sm:px-4 sm:py-1.5 ${
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

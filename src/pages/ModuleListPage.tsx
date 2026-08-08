/**
 * The front door. Reads the registry, so a new data file appears here
 * automatically — the only thing this page hard-codes about any module is the
 * running order below.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Module } from '@/content/types';
import { requestDepthFocus } from '@/components/DepthControl';
import { Reveal } from '@/motion/Reveal';
import { moduleList } from '@/content/registry';
import { TIERS } from '@/lib/layers';
import { plainText } from '@/lib/plainText';
import { isReaderVisible } from '@/lib/visibility';
import { useAppStore } from '@/store/useAppStore';

/**
 * The running order of the front page, and the one place it is decided.
 *
 * Alphabetical would open on Black Holes, which is the wrong first impression:
 * escape velocity is the module that teaches the reader how the seven layers
 * work, and every other module's hook lands harder once they have seen one. Any
 * module not named here keeps its registry position, behind these — so adding a
 * module still takes no edit to this file, it just arrives at the end.
 */
const FEATURED: readonly string[] = [
  'escape-velocity',
  'kepler-orbits',
  'scale-of-the-universe',
  'black-holes',
];

function orderFor(id: string): number {
  const index = FEATURED.indexOf(id);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * How far apart the cards arrive, and the point past which they stop waiting.
 *
 * The cap is the part that matters. A flat 60ms step reads well for the first
 * handful and then turns into a queue — at the eleventh card it is a second of
 * waiting for something the reader is already looking at, and the registry is
 * meant to grow. Past `STAGGER_CAP_MS` every remaining card arrives together,
 * so the sequence stays a flourish at the top of the grid rather than becoming
 * a loading order.
 */
const STAGGER_STEP_MS = 60;
const STAGGER_CAP_MS = 300;

/** The delay for the card at `index`, in milliseconds. */
export function staggerFor(index: number): number {
  return Math.min(index * STAGGER_STEP_MS, STAGGER_CAP_MS);
}

export function ModuleListPage() {
  const tier = useAppStore((s) => s.tier);
  const tierLabel = TIERS.find((t) => t.id === tier)?.label ?? '';

  useEffect(() => {
    document.title = 'Lodestar — space, explained in layers you choose to open';
  }, []);

  /* Drafts are listed while developing and never in a production build. The
     rule itself lives in `lib/visibility`, shared with the Connections layer,
     so the index and the cross-links cannot disagree about what a reader may
     reach. */
  const listed = useMemo(
    () => moduleList.filter(isReaderVisible).sort((a, b) => orderFor(a.id) - orderFor(b.id)),
    [],
  );

  return (
    /* `xl:px-10` mirrors a module page's hanging indent, so the hero sits on
       the same axis as prose everywhere else on the site and the card grid
       below breaks out symmetrically around it. */
    <div className="xl:px-10">
      <header className="mb-14 max-w-measure">
        <p className="font-ui text-xs uppercase tracking-[0.22em] text-star/70">Lodestar</p>
        <h1 className="mt-4 font-prose text-4xl leading-[1.15] tracking-tight text-ink sm:text-5xl">
          Space, explained in layers you choose to open.
        </h1>
        <p className="mt-5 font-prose text-lg leading-relaxed text-ink-dim">
          Every topic is one page of seven layers, from a one-sentence hook down to the
          derivation and the open questions. The simulations run on real physical quantities in
          SI units (the same numbers the equations use).
        </p>
        <p className="mt-4 font-ui text-sm leading-relaxed text-ink-faint">
          The depth control in the header (you are reading at{' '}
          {/* This word was coloured like a link and did nothing. Either the
              styling was wrong or the behaviour was missing; the behaviour was
              missing. It now sends focus to the control it names. */}
          <button
            type="button"
            onClick={requestDepthFocus}
            aria-label={`You are reading at ${tierLabel}. Go to the reading depth control.`}
            className="rounded-sm text-star underline decoration-star/40 underline-offset-4 transition-colors hover:decoration-star"
          >
            {tierLabel}
          </button>
          ) decides which layers are open; it never changes a word of the
          text, and nothing is ever hidden.
        </p>
      </header>

      {listed.length === 0 ? (
        <p className="font-prose text-ink-faint">
          No modules yet. Drop a data file in{' '}
          <code className="font-mono">src/content/modules/</code>.
        </p>
      ) : (
        /* Its width at `xl` is the one it has always had — the old column, to
           the pixel — now reached by breaking out of the narrowed one rather
           than by filling it. */
        <ul className="breakout grid gap-4 [--breakout:var(--cards)] sm:grid-cols-2">
          {listed.map((m, i) => (
            /* The Reveal *is* the list item, rather than a div inside one. A
               wrapper between `<ul>` and `<li>` is invalid markup, it breaks the
               list semantics a screen reader announces, and it would have put a
               box between the grid and its items that neither the stretch nor
               `mt-auto` could see through. */
            <Reveal key={m.id} as="li" delay={staggerFor(i)}>
              <ModuleCard module={m} />
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Width and height of the highlight, in px. Set here because JS centres it. */
const GLOW_PX = 320;

function ModuleCard({ module }: { module: Module }) {
  const teaser = plainText(module.layers.hook.body);
  const params = module.layers.play.params.length;

  const glowRef = useRef<HTMLSpanElement>(null);
  /* The card's box, read once when the pointer arrives rather than on every
     move: `getBoundingClientRect` is a layout read, and doing it per
     `pointermove` is how a decorative highlight turns into jank. */
  const boxRef = useRef<DOMRect | null>(null);

  const placeGlow = useCallback((x: number, y: number) => {
    const glow = glowRef.current;
    if (!glow) return;
    // Transform only. Animating `left`/`top` here would be a layout write on
    // every pointer sample, and this is the one thing on the card that moves.
    glow.style.transform = `translate(${x - GLOW_PX / 2}px, ${y - GLOW_PX / 2}px)`;
  }, []);

  const trackPointer = useCallback(
    (event: React.PointerEvent<HTMLAnchorElement>) => {
      const box = boxRef.current ?? event.currentTarget.getBoundingClientRect();
      boxRef.current = box;
      placeGlow(event.clientX - box.left, event.clientY - box.top);
    },
    [placeGlow],
  );

  /* Keyboard focus has no pointer to follow, so the highlight sits in the
     middle of the card. Without this it would still be at wherever the mouse
     last left it, which reads as arbitrary. */
  const centreGlow = useCallback(
    (event: React.FocusEvent<HTMLAnchorElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      placeGlow(box.width / 2, box.height / 2);
    },
    [placeGlow],
  );

  return (
    <Link
      to={`/m/${module.id}`}
      onPointerEnter={trackPointer}
      onPointerMove={trackPointer}
      onPointerLeave={() => {
        boxRef.current = null;
      }}
      onFocus={centreGlow}
      /*
       * `isolate` is load-bearing. It makes the card a stacking context, which
       * is what lets the highlight sit at `-z-10`: negative-z children paint
       * above their stacking context's own background and below its in-flow
       * content, so the glow lands between the card's surface and its text
       * instead of over the words. Without `isolate` the `-z-10` would escape
       * and put the glow behind the page.
       *
       * `overflow-hidden` clips it to the rounded corners. It does not clip the
       * focus ring, which is a box-shadow on this element rather than a child.
       *
       * The transition list is explicit rather than `transition-colors` plus
       * `transition-transform`, which would be two declarations of the same
       * property with the last one silently winning. Nothing here that animates
       * affects layout: colour and opacity are paint, `scale` is composited.
       */
      className="group relative isolate flex h-full flex-col overflow-hidden rounded-xl border border-edge-soft bg-void-800/40 p-6 transition-[transform,border-color,background-color] duration-200 ease-out hover:border-star-dim/60 hover:bg-void-700/50 hover:scale-[1.02] focus-visible:border-star focus-visible:scale-[1.02]"
    >
      {/*
        The highlight. Driven by `group-hover` *and* `group-focus-visible`
        independently, so a keyboard reader gets the same treatment as a mouse
        without either standing in for the other.

        Alpha is capped at 0.12 for the same reason the starfield's is capped:
        the meta row below is `ink-faint`, the most muted tone on the site, and
        a brighter wash behind it would take it under 4.5:1. `tests/cards.test.ts`
        recomputes that rather than trusting this comment.
      */}
      <span
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -z-10 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(157,180,255,0.12),transparent_70%)] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-prose text-xl text-ink transition-colors group-hover:text-star">
          {module.title}
        </h2>
        {module.status === 'draft' && (
          <span className="mt-1 shrink-0 rounded-full border border-ember/40 px-2 py-0.5 font-ui text-[0.6rem] uppercase tracking-wider text-ember">
            draft
          </span>
        )}
      </div>

      <p className="mt-2 font-prose text-sm leading-relaxed text-ink-dim">{module.tagline}</p>

      {/* The hook, verbatim from layer 1 — the module's own first sentence is a
          better teaser than anything written twice. */}
      {/* The module's own first sentence, at the same weight as the tagline
          above it. It used to be a step dimmer than the meta row beneath, which
          put the most persuasive line on the card in the quietest tone on it. */}
      {teaser && (
        <p className="mt-3.5 border-l border-edge-soft pl-3.5 font-prose text-sm leading-relaxed text-ink-dim">
          {teaser}
        </p>
      )}

      {/* mt-auto, not mt-5: hooks and taglines differ in length by a couple of
          lines, and without this the meta rows sit at whatever height their own
          card's prose ended at, so a two-column grid reads as ragged. */}
      <div className="mt-auto flex items-center gap-2 pt-5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
        <span
          aria-hidden
          className="h-1 w-1 rounded-full bg-star/70 transition-colors group-hover:bg-star"
        />
        interactive
        <span aria-hidden>·</span>
        {params} {params === 1 ? 'parameter' : 'parameters'}
        {/* The card is a link and nothing at rest said so — the whole surface is
            the target, which is exactly what makes it invisible. An arrow at the
            end of the meta row is the smallest mark that reads as "this goes
            somewhere", and it moves on hover so the affordance is confirmed
            rather than only implied. */}
        <span
          aria-hidden
          /* An explicit property list, not `transition-all`. `all` would ease
             any property that ever changes on this element, layout ones
             included — the exact thing that turns a hover into a reflow. It
             moves and it changes colour, so it declares both, at
             `DURATION.fast`. */
          className="ml-auto text-sm leading-none text-ink-faint transition-[transform,color] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-star"
        >
          →
        </span>
      </div>
    </Link>
  );
}

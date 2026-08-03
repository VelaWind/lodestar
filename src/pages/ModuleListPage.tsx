/**
 * The front door. Reads the registry, so a new data file appears here
 * automatically — the only thing this page hard-codes about any module is the
 * running order below.
 */
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Module } from '@/content/types';
import { requestDepthFocus } from '@/components/DepthControl';
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
          SI units — the same numbers the equations use.
        </p>
        <p className="mt-4 font-ui text-sm leading-relaxed text-ink-faint">
          The depth control in the header — you are reading at{' '}
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
          </button>{' '}
          — decides which layers are open when a page loads; it never changes a word of the
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
          {listed.map((m) => (
            <li key={m.id}>
              <ModuleCard module={m} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModuleCard({ module }: { module: Module }) {
  const teaser = plainText(module.layers.hook.body);
  const params = module.layers.play.params.length;

  return (
    <Link
      to={`/m/${module.id}`}
      className="group flex h-full flex-col rounded-xl border border-edge-soft bg-void-800/40 p-6 transition-colors hover:border-star-dim/60 hover:bg-void-700/50"
    >
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
          className="ml-auto text-sm leading-none text-ink-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-star"
        >
          →
        </span>
      </div>
    </Link>
  );
}

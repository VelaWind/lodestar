/**
 * The module page — the entire reading surface of the app.
 *
 * It is written against `Module` and `LAYER_ORDER` only. It never mentions a
 * specific module, sim, or param, which is what makes "add a module" a
 * data-file-plus-sim job with no shell edits.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LayerId, Module, Param, ParamUpdate, ParamValues } from '@/content/types';
import { getModuleSummary, readModule } from '@/content/catalog';
import { DISTANCE } from '@/motion/tokens';
import { Reveal } from '@/motion/Reveal';
import { useNoindex } from '@/lib/useNoindex';
import { LAYER_META, LAYER_ORDER, defaultOpenFor, layerHasMath } from '@/lib/layers';
import { defaultsOf, useAppStore } from '@/store/useAppStore';
import { Layer } from '@/components/Layer';
import { RichText } from '@/components/RichText';
import { SimStage } from '@/components/SimStage';
import { EquationBlock } from '@/components/EquationBlock';
import { ensureKatex, katexLoaded } from '@/components/Tex';
import { Connections } from '@/components/Connections';
import { References } from '@/components/References';

/** How far below the viewport a math layer's header starts the KaTeX fetch. */
const KATEX_LOOKAHEAD = '0px 0px 50% 0px';

export function ModulePage() {
  const { id } = useParams<{ id: string }>();
  // The manifest says whether the module exists without loading it, so an
  // unknown address shows the not-found page at once.
  if (!id || !getModuleSummary(id)) return <NotFound id={id} />;
  // Keyed so that navigating between modules resets all per-module state
  // (open layers, equation mode) instead of leaking it across topics.
  return <LoadedModule key={id} id={id} />;
}

/** Suspends until the module's data has arrived; see `readModule`. */
function LoadedModule({ id }: { id: string }) {
  const module = readModule(id);
  return <ModuleView module={module} />;
}

/**
 * The live slider values for a module: the stored ones, or the defaults until
 * the store has been seeded.
 *
 * Read only by the two layers that use them, never by the page. A slider tick
 * updates the store dozens of times a second; subscribed here at the top, every
 * tick re-rendered the whole article, every layer and every paragraph, to
 * change one number in the sim and its readouts.
 */
function useModuleValues(module: Module): ParamValues {
  const params = module.layers.play.params;
  const stored = useAppStore((s) => s.params[module.id]);
  const fallback = useMemo(() => defaultsOf(params), [params]);
  return stored ?? fallback;
}

/** Layer 3: the sim and its sliders, the one subscriber to slider ticks besides layer 5. */
function PlayLayer({ module }: { module: Module }) {
  const values = useModuleValues(module);
  const setParam = useAppStore((s) => s.setParam);
  const resetParams = useAppStore((s) => s.resetModuleParams);
  const onChange = useCallback(
    (param: Param, value: ParamUpdate) => setParam(module.id, param, value),
    [setParam, module.id],
  );
  const onReset = useCallback(
    () => resetParams(module.id, module.layers.play.params),
    [resetParams, module.id, module.layers.play.params],
  );
  return (
    <SimStage
      moduleId={module.id}
      layer={module.layers.play}
      values={values}
      onChange={onChange}
      onReset={onReset}
    />
  );
}

/** Layer 5: the equations, bound to the same values as layer 3. */
function MathLayer({ module }: { module: Module }) {
  const values = useModuleValues(module);
  return (
    <EquationBlock
      layer={module.layers.math}
      params={module.layers.play.params}
      values={values}
    />
  );
}

function ModuleView({ module }: { module: Module }) {
  const tier = useAppStore((s) => s.tier);
  const ensure = useAppStore((s) => s.ensureModuleParams);

  // Layer 3 owns the params; layer 5 binds the very same objects.
  const params: Param[] = module.layers.play.params;

  useEffect(() => {
    ensure(module.id, params);
  }, [ensure, module.id, params]);

  useEffect(() => {
    document.title = `${module.title} · Lodestar`;
  }, [module.title]);

  /* Expansion state. Derived from the tier, but manually overridable at every
     tier — so we reset to the tier's defaults exactly when the tier changes,
     and otherwise leave the reader's own choices alone. Adjusting state during
     render (rather than in an effect) avoids a frame of stale expansion. */
  const [prevTier, setPrevTier] = useState(tier);
  const [open, setOpen] = useState<Set<LayerId>>(() => defaultOpenFor(tier));
  if (prevTier !== tier) {
    setPrevTier(tier);
    setOpen(defaultOpenFor(tier));
  }

  /*
   * KaTeX is fetched only where math is coming, never at idle on every page.
   *
   * If an open layer has math in it (the Student and Deep tiers open some), the
   * fetch starts now; `Tex` would suspend on it anyway. Otherwise the headers of
   * the closed layers that have math are watched, and the fetch starts when one
   * comes within half a viewport of the screen: early enough that the library
   * is normally in memory before the reader can open it, and never for a reader
   * at the Curious tier who does not scroll that far. Opening a math layer
   * still waits for the library (`openLayers` below), so the first open
   * renders equations in the same commit as the panel, with no flash and no
   * shift.
   */
  useEffect(() => {
    if (katexLoaded()) return;
    if (LAYER_ORDER.some((id) => open.has(id) && layerHasMath(module, id, tier))) {
      void ensureKatex();
      return;
    }
    if (typeof IntersectionObserver === 'undefined') return;
    const headers = LAYER_ORDER.filter((id) => layerHasMath(module, id, tier))
      .map((id) => document.getElementById(`layer-header-${id}`))
      .filter((element): element is HTMLElement => element !== null);
    if (headers.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void ensureKatex();
      },
      { rootMargin: KATEX_LOOKAHEAD },
    );
    headers.forEach((header) => observer.observe(header));
    return () => observer.disconnect();
  }, [module, tier, open]);

  /*
   * Opening a layer waits for KaTeX if that layer has math in it and the
   * library has not arrived yet.
   *
   * This is what keeps the deferral invisible. The alternative — open now,
   * render the equations when they load — is a layout shift on every module
   * page, because an equation appearing pushes everything below it down, and
   * after the 500ms grace period that follows a click it is a shift that counts.
   * Waiting instead means the panel and its equations appear in the same commit,
   * fully rendered. In practice the prefetch above has already finished and this
   * resolves on the spot.
   */
  const openLayers = (next: Set<LayerId>) => {
    const needsMath = LAYER_ORDER.some(
      (id) => next.has(id) && !open.has(id) && layerHasMath(module, id, tier),
    );
    if (needsMath && !katexLoaded()) {
      void ensureKatex().then(() => setOpen(next));
      return;
    }
    setOpen(next);
  };

  const toggle = (layerId: LayerId) => {
    const next = new Set(open);
    if (next.has(layerId)) next.delete(layerId);
    else next.add(layerId);
    openLayers(next);
  };

  /*
   * Stable per-layer handlers and stable layer bodies, so the memoised `Layer`s
   * and the `RichText` inside them skip re-rendering when only one layer's
   * state changes. The handlers call the latest `toggle` through a ref: its
   * closure has to see the current open set and tier, but its identity must
   * not change with them.
   */
  const toggleRef = useRef(toggle);
  useLayoutEffect(() => {
    toggleRef.current = toggle;
  });
  const toggles = useMemo(
    () =>
      Object.fromEntries(LAYER_ORDER.map((id) => [id, () => toggleRef.current(id)])) as Record<
        LayerId,
        () => void
      >,
    [],
  );
  const bodies = useMemo(
    () =>
      Object.fromEntries(LAYER_ORDER.map((id) => [id, renderLayer(id, module)])) as Record<
        LayerId,
        ReactNode
      >,
    [module],
  );

  const allOpen = open.size === LAYER_ORDER.length;
  const toggleAll = () => openLayers(allOpen ? new Set() : new Set(LAYER_ORDER));

  return (
    <article>
      {/* `xl:px-10`: the title block reads as prose, so it sits on the prose
          axis. Only the layer numbers stay out at the column's left edge — that
          is what the hanging indent is for. */}
      <header className="mb-10 xl:px-10">
        {/* -my-2/py-2 here and below: the padding is the tap target, the
            negative margin keeps the layout identical. */}
        <Link
          to="/"
          /* `active:opacity-70` is the press affordance: opacity only, because a
             scale on an inline link nudges the text around it. `DURATION.fast`
             is spelled out rather than left to Tailwind's default so it stays
             right if that default ever moves. */
          className="-my-2 inline-block py-2 font-ui text-xs text-ink-faint underline-offset-4 transition-[color,opacity] duration-150 ease-out hover:text-star hover:underline active:opacity-70"
        >
          ← All modules
        </Link>

        <div className="mt-5 flex items-start gap-3">
          <h1 className="font-prose text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
            {module.title}
          </h1>
          {module.status === 'draft' && (
            <span className="mt-2 shrink-0 rounded-full border border-ember/40 px-2.5 py-0.5 font-ui text-[0.65rem] uppercase tracking-wider text-ember">
              draft
            </span>
          )}
        </div>
        <p className="mt-3 max-w-measure font-prose text-lg leading-relaxed text-ink-dim">
          {module.tagline}
        </p>
      </header>

      <div className="mb-2 flex justify-end">
        {/* A bordered pill rather than a bare word. It was styled as body text
            and only became a control on hover, which is no affordance at all for
            a pointer that never rests and none whatsoever for touch. The height
            matches the depth pills so the site has one control size. */}
        <button
          type="button"
          onClick={toggleAll}
          aria-expanded={allOpen}
          /* The one control on the page shaped like a button, so it gets the
             one press affordance that is shaped like a button being pressed.
             `scale` is composited and cannot move the layer list below it. */
          className="inline-flex h-9 items-center rounded-full border border-edge-soft bg-void-800/60 px-3.5 font-ui text-xs text-ink-faint transition-[transform,color,border-color,background-color] duration-150 ease-out hover:border-star-dim/60 hover:bg-void-700/60 hover:text-star active:scale-[0.98] sm:h-7"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* No bottom rule: References opens with its own, and the two of them
          four rem apart read as a divider with an empty band inside it. The
          layer list ends where its last panel ends. */}
      <div>
        {LAYER_ORDER.map((layerId) => (
          /*
           * Each layer rises into place as it comes into view. No `delay` is
           * passed and none should be: seven layers down a page this long are
           * never on screen together, so scroll position already spaces them
           * out, and a stagger on top of that would be a queue for content the
           * reader has already scrolled to.
           *
           * All seven `<section>`s are in the document from the first render —
           * that is `Reveal`'s contract, not a side effect of it — so the
           * headers are readable, linkable and clickable before any observer
           * has fired. Only `opacity` and `transform` move.
           *
           * The divider rides on this wrapper rather than on the section inside
           * it. `first:border-t-0` is `:first-child`, and a section that is the
           * only child of its own wrapper is always a first child; left on the
           * section, every rule between layers would switch itself off.
           */
          <Reveal
            key={layerId}
            distance={DISTANCE.rise}
            className="border-t border-edge-soft first:border-t-0"
          >
            <Layer meta={LAYER_META[layerId]} open={open.has(layerId)} onToggle={toggles[layerId]}>
              {bodies[layerId]}
            </Layer>
          </Reveal>
        ))}
      </div>

      <References items={module.references} />
    </article>
  );
}

/**
 * The one place layer ids become components. The switch is exhaustive over
 * `LayerId`, so adding an eighth layer is a compile error here — intentional.
 */
function renderLayer(layerId: LayerId, module: Module): ReactNode {
  const { layers } = module;

  switch (layerId) {
    case 'hook':
      return <RichText content={layers.hook.body} />;
    case 'intuition':
      return <RichText content={layers.intuition.body} />;
    case 'play':
      return <PlayLayer module={module} />;
    case 'real':
      return <RichText content={layers.real.body} />;
    case 'math':
      return <MathLayer module={module} />;
    case 'deeper':
      return <RichText content={layers.deeper.body} />;
    case 'connections':
      return <Connections layer={layers.connections} />;
  }
}

function NotFound({ id }: { id: string | undefined }) {
  useNoindex();

  return (
    <div className="py-24 text-center">
      <p className="font-prose text-2xl text-ink">No module called “{id}”.</p>
      <Link
        to="/"
        className="mt-4 inline-block font-ui text-sm text-star underline-offset-4 hover:underline"
      >
        Back to all modules
      </Link>
    </div>
  );
}

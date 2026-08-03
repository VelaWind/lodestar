/**
 * The module page — the entire reading surface of the app.
 *
 * It is written against `Module` and `LAYER_ORDER` only. It never mentions a
 * specific module, sim, or param, which is what makes "add a module" a
 * data-file-plus-sim job with no shell edits.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LayerId, Module, Param, ParamUpdate } from '@/content/types';
import { getModule } from '@/content/registry';
import { LAYER_META, LAYER_ORDER, defaultOpenFor } from '@/lib/layers';
import { defaultsOf, useAppStore } from '@/store/useAppStore';
import { Layer } from '@/components/Layer';
import { RichText } from '@/components/RichText';
import { SimStage } from '@/components/SimStage';
import { EquationBlock } from '@/components/EquationBlock';
import { Connections } from '@/components/Connections';
import { References } from '@/components/References';

export function ModulePage() {
  const { id } = useParams<{ id: string }>();
  const module = getModule(id);

  if (!module) return <NotFound id={id} />;
  // Keyed so that navigating between modules resets all per-module state
  // (open layers, equation mode) instead of leaking it across topics.
  return <ModuleView key={module.id} module={module} />;
}

function ModuleView({ module }: { module: Module }) {
  const tier = useAppStore((s) => s.tier);
  const ensure = useAppStore((s) => s.ensureModuleParams);
  const setParam = useAppStore((s) => s.setParam);
  const resetParams = useAppStore((s) => s.resetModuleParams);
  const stored = useAppStore((s) => s.params[module.id]);

  // Layer 3 owns the params; layer 5 binds the very same objects.
  const params: Param[] = module.layers.play.params;
  const fallback = useMemo(() => defaultsOf(params), [params]);
  const values = stored ?? fallback;

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

  const toggle = (layerId: LayerId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });

  const allOpen = open.size === LAYER_ORDER.length;
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(LAYER_ORDER));

  return (
    <article>
      <header className="mb-10">
        {/* -my-2/py-2 here and below: the padding is the tap target, the
            negative margin keeps the layout identical. */}
        <Link
          to="/"
          className="-my-2 inline-block py-2 font-ui text-xs text-ink-faint underline-offset-4 transition-colors hover:text-star hover:underline"
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
        <button
          type="button"
          onClick={toggleAll}
          className="-my-2 py-2 font-ui text-xs text-ink-faint underline-offset-4 transition-colors hover:text-star hover:underline"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* No bottom rule: References opens with its own, and the two of them
          four rem apart read as a divider with an empty band inside it. The
          layer list ends where its last panel ends. */}
      <div>
        {LAYER_ORDER.map((layerId) => (
          <Layer
            key={layerId}
            meta={LAYER_META[layerId]}
            open={open.has(layerId)}
            onToggle={() => toggle(layerId)}
          >
            {renderLayer(layerId, module, values, setParam, resetParams)}
          </Layer>
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
function renderLayer(
  layerId: LayerId,
  module: Module,
  values: Record<string, number>,
  setParam: (moduleId: string, param: Param, value: ParamUpdate) => void,
  resetParams: (moduleId: string, params: Param[]) => void,
): ReactNode {
  const { layers } = module;

  switch (layerId) {
    case 'hook':
      return <RichText content={layers.hook.body} />;
    case 'intuition':
      return <RichText content={layers.intuition.body} />;
    case 'play':
      return (
        <SimStage
          moduleId={module.id}
          layer={layers.play}
          values={values}
          onChange={(param, value) => setParam(module.id, param, value)}
          onReset={() => resetParams(module.id, layers.play.params)}
        />
      );
    case 'real':
      return <RichText content={layers.real.body} />;
    case 'math':
      return (
        <EquationBlock layer={layers.math} params={layers.play.params} values={values} />
      );
    case 'deeper':
      return <RichText content={layers.deeper.body} />;
    case 'connections':
      return <Connections layer={layers.connections} />;
  }
}

function NotFound({ id }: { id: string | undefined }) {
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

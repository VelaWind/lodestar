/**
 * Layer 3's frame: lazy-loaded sim on the left, controls and the approximations
 * disclosure on the right. The sim component itself is resolved from the
 * registry by string key, so this file never learns any module's name.
 */
import { Suspense } from 'react';
import type { Param, ParamUpdate, ParamValues, SimLayer } from '@/content/types';
import { getSim, simKeys } from '@/content/registry';
import { ParamControls } from './ParamControls';
import { Approximations } from './Approximations';
import { RichText } from './RichText';

interface Props {
  moduleId: string;
  layer: SimLayer;
  values: ParamValues;
  onChange: (param: Param, value: ParamUpdate) => void;
  onReset: () => void;
}

function SimFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-[20rem] place-items-center rounded-lg border border-edge-soft bg-void-800/40">
      <span className="font-ui text-xs uppercase tracking-[0.14em] text-ink-faint">{label}</span>
    </div>
  );
}

export function SimStage({ moduleId, layer, values, onChange, onReset }: Props) {
  /*
   * `react-hooks/static-components` reads this as a component being created
   * during render, and it is not: `sims` is a module-scope `Record` built once
   * by `import.meta.glob` + `lazy()`, so `getSim` is a lookup that returns the
   * same reference for the same key on every render. The rule cannot see
   * through the indirection, and the indirection is the point — it is what
   * makes "add a module" a data-file-plus-sim job with no shell edits.
   *
   * Checked rather than assumed: if this really did mint a component per
   * render, every slider drag would remount the canvas and lose the running
   * animation, which the behaviour suite drives on all seven sims.
   */
  const Sim = getSim(layer.simKey);

  return (
    <div className="space-y-5">
      {layer.caption && <RichText content={layer.caption} />}

      {/* The stage breaks out of the reading column at `xl`; the caption above
          it does not. They are siblings and only the stage carries `.breakout`,
          so the caption stays in the measure — it is prose, and it introduces
          the sim rather than labelling the box. The width is the one the stage
          has always had, so the canvas panel and its 18rem control column are
          unchanged to the pixel. */}
      <div className="breakout grid gap-5 [--breakout:var(--stage)] lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 rounded-lg border border-edge-soft bg-void-800/40 p-4">
          {Sim ? (
            <Suspense fallback={<SimFallback label="Loading simulation…" />}>
              {/* eslint-disable-next-line react-hooks/static-components -- registry lookup, not a component factory; `sims` is built once at module scope */}
              <Sim
                moduleId={moduleId}
                params={layer.params}
                values={values}
                setValue={(id, v) => {
                  const param = layer.params.find((p) => p.id === id);
                  if (param) onChange(param, v);
                }}
              />
            </Suspense>
          ) : (
            <div className="grid min-h-[20rem] place-items-center rounded-lg border border-dashed border-ember/30 p-6 text-center">
              <div className="space-y-2">
                <p className="font-ui text-sm text-ember">
                  No sim registered for key “{layer.simKey}”.
                </p>
                <p className="font-ui text-xs text-ink-faint">
                  Add <code className="font-mono">src/sims/{layer.simKey}.tsx</code> with a default
                  export.
                  {simKeys.length > 0 && <> Registered: {simKeys.join(', ')}.</>}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-edge-soft bg-void-800/60 px-4 py-4">
            <ParamControls
              params={layer.params}
              values={values}
              onChange={onChange}
              onReset={onReset}
            />
          </div>
          <Approximations items={layer.approximations} />
        </div>
      </div>
    </div>
  );
}

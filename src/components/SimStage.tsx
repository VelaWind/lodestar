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
  const Sim = getSim(layer.simKey);

  return (
    <div className="space-y-5">
      {layer.caption && <RichText content={layer.caption} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 rounded-lg border border-edge-soft bg-void-800/40 p-4">
          {Sim ? (
            <Suspense fallback={<SimFallback label="Loading simulation…" />}>
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

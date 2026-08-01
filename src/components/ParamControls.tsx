/**
 * Sliders for a module's params. Owned by the shell, not by sims — so every
 * module gets identical, correct, log-aware controls with LaTeX symbols and SI
 * units for free, and a sim never has to think about UI.
 */
import type { Param, ParamValues } from '@/content/types';
import {
  formatWithUnit,
  paramLabel,
  positionToValue,
  sliderBounds,
  valueToPosition,
} from '@/lib/format';
import { useTier } from '@/store/useAppStore';
import { Tex } from './Tex';

interface Props {
  params: Param[];
  values: ParamValues;
  onChange: (param: Param, value: number) => void;
  onReset: () => void;
}

export function ParamControls({ params, values, onChange, onReset }: Props) {
  // Read the tier here rather than threading it through SimStage: the label a
  // knob shows is a presentation choice local to this control.
  const tier = useTier();

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h4 className="font-ui text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
          Parameters
        </h4>
        {/* -my-3 keeps the row's visual rhythm while the padding grows the tap
            target to 44px — a 16px-tall text link is not a mobile control. */}
        <button
          type="button"
          onClick={onReset}
          className="-my-3 py-3 font-ui text-xs text-ink-faint underline-offset-4 transition-colors hover:text-star hover:underline"
        >
          Reset
        </button>
      </div>

      {params.map((param) => {
        const value = values[param.id] ?? param.default;
        const bounds = sliderBounds(param);
        const label = paramLabel(param, tier);
        return (
          <div key={param.id}>
            <label htmlFor={`p-${param.id}`} className="flex items-baseline justify-between gap-3">
              <span className="flex items-baseline gap-2 truncate">
                {/* The symbol is the Deep reader's handle on the quantity. At the
                    other tiers it is noise in front of a plain-language phrase. */}
                {tier === 'deep' && <Tex tex={param.symbol} className="text-ink" />}
                <span className="truncate font-ui text-xs text-ink-faint">{label}</span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-ember">
                {formatWithUnit(param, value)}
              </span>
            </label>
            <input
              id={`p-${param.id}`}
              type="range"
              // The control is a 44px touch target with a 4px track drawn down
              // its middle; the negative margins pull the empty space back out
              // so the visual spacing matches what a 4px input would give.
              className="lodestar-slider -mb-4 -mt-3 w-full"
              min={bounds.min}
              max={bounds.max}
              step={bounds.step}
              value={valueToPosition(param, value)}
              onChange={(e) => onChange(param, positionToValue(param, Number(e.target.value)))}
              aria-label={`${label} (${param.unit})`}
              aria-valuetext={formatWithUnit(param, value)}
            />
            {param.scale === 'log' && (
              <div className="mt-1 text-right font-ui text-[0.65rem] uppercase tracking-wider text-ink-faint/70">
                log scale
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

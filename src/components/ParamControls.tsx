/**
 * Sliders for a module's params. Owned by the shell, not by sims — so every
 * module gets identical, correct, log-aware controls with LaTeX symbols and SI
 * units for free, and a sim never has to think about UI.
 */
import type { Param, ParamUpdate, ParamValues } from '@/content/types';
import {
  LOG_ARROW_STEP,
  LOG_PAGE_STEP,
  formatWithUnit,
  paramLabel,
  positionToValue,
  sliderAriaLabel,
  sliderBounds,
  valueToPosition,
} from '@/lib/format';
import { useTier } from '@/store/useAppStore';
import { Tex } from './Tex';

interface Props {
  params: Param[];
  values: ParamValues;
  onChange: (param: Param, value: ParamUpdate) => void;
  onReset: () => void;
}

export function ParamControls({ params, values, onChange, onReset }: Props) {
  // Read the tier here rather than threading it through SimStage: the label a
  // knob shows is a presentation choice local to this control.
  const tier = useTier();

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        {/* h3, not h4: this sits inside a layer whose header is an h2, and
            skipping a level breaks the document outline a screen reader reads. */}
        <h3 className="font-ui text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
          Parameters
        </h3>
        {/* -my-3 keeps the row's visual rhythm while the padding grows the tap
            target to 44px — a 16px-tall text link is not a mobile control. */}
        <button
          type="button"
          onClick={onReset}
          /* Opacity, not scale: this sits on a baseline with the "Parameters"
             heading, and a scaling word next to a static one reads as a wobble
             rather than a press. */
          className="-my-3 py-3 font-ui text-xs text-ink-faint underline-offset-4 transition-[color,opacity] duration-150 ease-out hover:text-star hover:underline active:opacity-70"
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
              onKeyDown={(e) => {
                // Log sliders take their keys from here rather than from the
                // element's `step`, so that the keyboard contract is the same on
                // a 0.6-decade slider and a 15-decade one without dictating how
                // finely either can be dragged. Arrow moves a twentieth of a
                // decade, Shift+arrow and PageUp/PageDown a whole one; Home and
                // End already reach the stops, so they are left to the browser.
                if (param.scale !== 'log') return;
                const back = e.key === 'ArrowLeft' || e.key === 'ArrowDown';
                const forward = e.key === 'ArrowRight' || e.key === 'ArrowUp';
                const page = e.key === 'PageUp' || e.key === 'PageDown';
                if (!back && !forward && !page) return;

                const size =
                  page || e.shiftKey || e.metaKey ? LOG_PAGE_STEP : LOG_ARROW_STEP;
                const delta = back || e.key === 'PageDown' ? -size : size;

                e.preventDefault();
                // From the current value rather than the rendered one: a held
                // key outruns the re-render, and reading the prop would apply
                // the same move over and over from the same starting point.
                onChange(param, (current) =>
                  positionToValue(
                    param,
                    Math.min(
                      bounds.max,
                      Math.max(bounds.min, valueToPosition(param, current) + delta),
                    ),
                  ),
                );
              }}
              aria-label={sliderAriaLabel(label, param)}
              aria-valuetext={formatWithUnit(param, value)}
            />
            {param.scale === 'log' && (
              <div className="mt-1 text-right font-ui text-[0.65rem] uppercase tracking-wider text-ink-faint">
                log scale
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

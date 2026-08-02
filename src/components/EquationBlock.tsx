/**
 * Layer 5. The equations bind to the *same* Param objects the sim in layer 3
 * drives, which is the whole conceit: flip to "numbers" and the algebra fills
 * itself in with whatever the sliders are currently set to. Move a slider, the
 * equation updates. There is no second copy of the physical constants.
 */
import { useMemo, useState } from 'react';
import type { EquationLayer, Param, ParamValues } from '@/content/types';
import { formatWithUnit, siValueToTex } from '@/lib/format';
import { Tex } from './Tex';
import { RichText } from './RichText';

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

type Mode = 'symbols' | 'numbers';

/** True when what follows the placeholder in the template is a superscript. */
function raisedToAPower(tex: string, after: number): boolean {
  return /^\s*\^/.test(tex.slice(after));
}

function substitute(
  tex: string,
  byId: Map<string, Param>,
  values: ParamValues,
  mode: Mode,
): string {
  return tex.replace(PLACEHOLDER, (match: string, id: string, offset: number) => {
    const param = byId.get(id);
    // An unresolved placeholder renders loudly rather than vanishing, so a
    // typo in a data file is obvious on the page instead of quietly wrong.
    if (!param) return `\\textcolor{#e8737d}{\\texttt{${id}?}}`;
    if (mode === 'symbols') return param.symbol;

    const value = siValueToTex(param, values[param.id] ?? param.default);
    // A substituted value under an exponent has to carry its own brackets:
    // `{8.00 \times 10^{3}\,\mathrm{m/s}}^{2}` renders with the 2 tucked against
    // the unit, reading as m/s² — squaring the seconds instead of the quantity.
    // Symbols mode needs none of this: `v_0^{2}` is already unambiguous.
    return raisedToAPower(tex, offset + match.length)
      ? `{\\left(${value}\\right)}`
      : `{${value}}`;
  });
}

interface Props {
  layer: EquationLayer;
  /** The module's params — shared with layer 3, not a copy. */
  params: Param[];
  values: ParamValues;
}

export function EquationBlock({ layer, params, values }: Props) {
  const [mode, setMode] = useState<Mode>('symbols');
  const byId = useMemo(() => new Map(params.map((p) => [p.id, p])), [params]);

  return (
    <div className="space-y-6">
      {layer.intro && <RichText content={layer.intro} />}

      <div className="flex items-center gap-1 rounded-md border border-edge-soft bg-void-800/60 p-0.5 font-ui text-xs w-fit">
        {(['symbols', 'numbers'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded px-3 py-1.5 capitalize transition-colors ${
              mode === m ? 'bg-void-500 text-ink' : 'text-ink-faint hover:text-ink-dim'
            }`}
          >
            {m}
          </button>
        ))}
        <span className="px-2 text-ink-faint/60">
          {mode === 'numbers' ? 'live from the sliders above' : ''}
        </span>
      </div>

      {layer.equations.map((eq) => (
        <figure key={eq.id} className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-edge-soft bg-void-800/40 px-5 py-6">
            <Tex tex={substitute(eq.tex, byId, values, mode)} display className="text-ink" />
          </div>

          {eq.binds.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {eq.binds.map((id) => {
                const param = byId.get(id);
                if (!param) {
                  return (
                    <span key={id} className="font-mono text-xs text-ember">
                      unknown param “{id}”
                    </span>
                  );
                }
                return (
                  <span key={id} className="flex items-baseline gap-1.5 font-ui text-xs">
                    <Tex tex={param.symbol} className="text-ink-dim" />
                    {/* Always technical here: the chip already leads with the
                        symbol, and layer 5 is the math regardless of tier. */}
                    <span className="text-ink-faint">{param.technicalLabel}</span>
                    <span className="font-mono tabular-nums text-ember/80">
                      {formatWithUnit(param, values[id] ?? param.default)}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

          {eq.note && (
            <figcaption>
              <RichText content={eq.note} />
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/**
 * Internals exposed for `tests/equations.test.ts`, and for nothing else.
 *
 * `substitute` is what turns an authored template into the LaTeX a reader sees,
 * so it is the thing a committed snapshot has to be taken of: an accidental
 * change to number formatting shows up there as a diff on every shipped
 * equation rather than as a surprise on the page.
 */
export const __internals = { substitute };

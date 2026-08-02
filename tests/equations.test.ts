/**
 * What the reader actually sees, in LaTeX and in slider readouts.
 *
 * Two failure modes this guards against, both of which have happened during
 * development and neither of which a typecheck can see:
 *
 *   1. A change to number formatting silently rewrites every shipped equation.
 *      The plain-decimal band, the mantissa renormalisation and the bracketing
 *      of a substituted value under an exponent all live in `lib/format.ts`, and
 *      all of them reach published pages. The snapshot below is committed, so
 *      any change to a rendered equation has to be reviewed as a diff.
 *   2. A parameter's bounds produce an unreadable readout — "NaN kg", an empty
 *      string, "Infinity Mpc" — at an end stop nobody dragged to.
 *
 * Published modules only for the snapshot: a draft's equations are expected to
 * churn, and pinning them would make drafting noisy for no protection.
 */
import { describe, expect, it } from 'vitest';
import { __internals } from '@/components/EquationBlock';
import { moduleList } from '@/content/registry';
import type { ParamValues } from '@/content/types';
import { formatWithUnit, siValueToTex } from '@/lib/format';

const { substitute } = __internals;
const published = moduleList.filter((m) => m.status === 'published');

describe('published equations', () => {
  it('renders every equation in both modes, unchanged', () => {
    const rendered: Record<string, string> = {};

    for (const module of published) {
      const params = module.layers.play.params;
      const byId = new Map(params.map((p) => [p.id, p]));
      const values: ParamValues = Object.fromEntries(params.map((p) => [p.id, p.default]));

      for (const equation of module.layers.math.equations) {
        for (const mode of ['symbols', 'numbers'] as const) {
          rendered[`${module.id}/${equation.id}/${mode}`] = substitute(
            equation.tex,
            byId,
            values,
            mode,
          );
        }
      }
    }

    expect(rendered).toMatchSnapshot();
  });

  it('leaves no unresolved placeholder', () => {
    for (const module of published) {
      const ids = new Set(module.layers.play.params.map((p) => p.id));
      for (const equation of module.layers.math.equations) {
        for (const [, id] of equation.tex.matchAll(/\{\{(\w+)\}\}/g)) {
          expect(ids, `${module.id}/${equation.id} references {{${id}}}`).toContain(id);
        }
        // A bind that names nothing renders as a loud "unknown param" chip.
        for (const id of equation.binds) {
          expect(ids, `${module.id}/${equation.id} binds ${id}`).toContain(id);
        }
      }
    }
  });
});

describe('parameter readouts', () => {
  /** Every param of every module, at each end of its range and at its default. */
  const cases = moduleList.flatMap((module) =>
    module.layers.play.params.flatMap((param) =>
      (['min', 'default', 'max'] as const).map((stop) => ({
        label: `${module.id}/${param.id} at ${stop}`,
        param,
        value: param[stop],
      })),
    ),
  );

  it('sweeps every param at min, default and max', () => {
    expect(cases.length).toBeGreaterThanOrEqual(3 * 3);
  });

  for (const { label, param, value } of cases) {
    it(label, () => {
      expect(Number.isFinite(value), `${label}: bound is not finite`).toBe(true);

      const readout = formatWithUnit(param, value);
      expect(readout.length, `${label}: empty readout`).toBeGreaterThan(0);
      expect(readout).not.toMatch(/NaN|Infinity|undefined/);

      const tex = siValueToTex(param, value);
      expect(tex.length, `${label}: empty LaTeX`).toBeGreaterThan(0);
      expect(tex).not.toMatch(/NaN|Infinity|undefined/);
    });
  }
});

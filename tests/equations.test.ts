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
import { damageReason, mathNodesOf } from './helpers/mathNodes';

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

/**
 * The gap that let a live defect ship for five passes.
 *
 * The block above pins layer 5's display equations, which are authored as plain
 * strings. Inline math in prose goes through the `m` tag instead, and nothing
 * ever looked at what came out of it — so when that tag handed String.raw the
 * cooked template strings, twenty-eight LaTeX fragments across four published
 * modules turned into italic garbage on the site and every test stayed green.
 *
 * Two checks now, deliberately different in kind: a snapshot, so any change to
 * rendered math has to be read by a human; and a structural assertion, so this
 * particular failure class fails on its own without anyone reading anything.
 */
describe('inline math in prose', () => {
  const nodes = published.flatMap(mathNodesOf);

  it('finds math in every published module', () => {
    for (const module of published) {
      expect(mathNodesOf(module).length, `${module.id} has no inline math`).toBeGreaterThan(0);
    }
    // A walker that silently returned nothing would make both checks below pass.
    expect(nodes.length).toBeGreaterThan(50);
  });

  it('carries every inline-math and mathBlock tex, unchanged', () => {
    const byPath: Record<string, string> = {};
    for (const node of nodes) byPath[node.path] = node.tex;
    expect(byPath).toMatchSnapshot();
  });

  it('has no escape eaten by the template-literal cooker', () => {
    const damaged = nodes
      .map((node) => ({ node, why: damageReason(node.tex) }))
      .filter((entry) => entry.why !== null)
      .map((entry) => `${entry.node.path}: ${entry.why} — ${JSON.stringify(entry.node.tex)}`);

    expect(damaged, `${damaged.length}/${nodes.length} math nodes damaged`).toEqual([]);
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

/**
 * Every piece of LaTeX a module's *prose* carries, found by walking the AST.
 *
 * Layer 5's display equations were already snapshotted; the inline math inside
 * rich text was not, and that gap let a live rendering defect ship through five
 * passes. `rich.ts` built its `m` tag on `String.raw({ raw: strings })`, which
 * hands String.raw the *cooked* template strings — so JavaScript ate every
 * escape before KaTeX ever saw it: `\text` became a tab followed by "ext",
 * `\varepsilon` a vertical tab followed by "arepsilon", and every unrecognised
 * escape simply lost its backslash, turning `\sqrt` into the literal word
 * "sqrt". Twenty-seven of ninety-five nodes rendered as garbage on the live
 * site, and nothing in the suite could see it.
 *
 * So: one walker, used by both the snapshot and the structural check below.
 */
import type { Block, Inline, Module, RichText } from '@/content/types';

export interface MathNode {
  /** `module/layer#index`, stable enough to read in a snapshot diff. */
  path: string;
  tex: string;
}

function fromInline(node: Inline, out: string[]): void {
  if (typeof node === 'string') return;
  switch (node.k) {
    case 'math':
      out.push(node.tex);
      return;
    case 'em':
    case 'strong':
    case 'link':
      node.children.forEach((child) => fromInline(child, out));
      return;
    case 'code':
      return;
    // A leaf, and carrying no LaTeX by construction: there is nothing to
    // descend into and nothing to collect.
    case 'term':
      return;
    default: {
      // A new inline kind must not slip past this walker the way `term` could
      // have. Without the guard a kind carrying math would simply be skipped,
      // and the snapshot would go quiet rather than red — which is the exact
      // shape of the defect this file was written for.
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function fromBlock(node: Block, out: string[]): void {
  switch (node.k) {
    case 'p':
    case 'h':
    case 'quote':
      node.children.forEach((child) => fromInline(child, out));
      return;
    case 'ul':
    case 'ol':
      node.items.forEach((item) => item.forEach((child) => fromInline(child, out)));
      return;
    case 'aside':
      node.children.forEach((child) => fromBlock(child, out));
      return;
    case 'mathBlock':
      // Display math authored as prose rather than as a bound equation. Same
      // authoring path, same exposure to the bug above.
      out.push(node.tex);
      return;
    // A leaf whose strings are plain by type: no `Inline[]` anywhere in it, so
    // no LaTeX can reach it and there is nothing to descend into.
    case 'figure':
      return;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function collect(rich: RichText | undefined, label: string, into: MathNode[]): void {
  if (!rich) return;
  const found: string[] = [];
  rich.forEach((block) => fromBlock(block, found));
  found.forEach((tex, i) => into.push({ path: `${label}#${i}`, tex }));
}

/** Every inline-math and mathBlock tex string in one module's rich text. */
export function mathNodesOf(module: Module): MathNode[] {
  const out: MathNode[] = [];
  const { layers } = module;

  collect(layers.hook.body, `${module.id}/hook`, out);
  collect(layers.intuition.body, `${module.id}/intuition`, out);
  collect(layers.play.caption, `${module.id}/play.caption`, out);
  // The approximations became rich text when glossary terms needed to reach
  // them. Nothing there carries LaTeX today, so this adds no snapshot entries —
  // it is here so that the day one does, it is covered like every other layer
  // rather than being the one authoring path nothing looks at.
  layers.play.approximations.forEach((item, i) => {
    collect(item, `${module.id}/play.approximations[${i}]`, out);
  });
  collect(layers.real.body, `${module.id}/real`, out);
  collect(layers.math.intro, `${module.id}/math.intro`, out);
  for (const equation of layers.math.equations) {
    collect(equation.note, `${module.id}/math.${equation.id}.note`, out);
  }
  collect(layers.deeper.body, `${module.id}/deeper`, out);

  return out;
}

/* ------------------------------------------------------------------ */
/* Damage detection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Control characters that cannot occur in authored LaTeX, and that are exactly
 * what a cooked `\t`, `\n`, `\v`, `\f`, `\r` or `\0` leaves behind.
 *
 * Newline is included, and that is deliberate: leaving it out cost this check a
 * real defect on its first run. `\dot{\nu}` cooks to `dot{<LF>u}`, where
 * neither a visible control character nor a bare macro name survives — the only
 * trace is the line break itself. Nothing here authors LaTeX across lines, and a
 * `mathBlock` that wanted to would carry `\\` in a plain string, not a raw one.
 */
// eslint-disable-next-line no-control-regex -- the control characters are the subject: this pattern exists to detect them in tex that a template-literal cooker damaged
const CONTROL = /[\t\n\v\f\r\0\x08]/;

/**
 * Macros common enough in this repo's prose that seeing the bare word is proof
 * a backslash was eaten. Deliberately not exhaustive — it only has to catch the
 * failure class, and a name here that a module legitimately spells as a word
 * would be a false alarm, so the list stays to things nobody writes as prose
 * inside math.
 */
const MACROS = [
  'text', 'mathrm', 'mathcal', 'sqrt', 'frac', 'dfrac', 'varepsilon', 'infty',
  'Delta', 'Omega', 'propto', 'approx', 'times', 'cdot', 'pi', 'nu', 'mu',
  'geq', 'leq', 'neq', 'int', 'sum', 'max', 'min', 'log', 'ln', 'left',
  'right', 'sim', 'partial', 'rightarrow', 'to', 'quad', 'qquad', 'hbar',
  'dot', 'vec', 'hat', 'nabla',
];

/**
 * Everything that is legitimately an escape, removed: `\text{...}` and
 * `\mathrm{...}` first, because they hold prose that may contain a word which is
 * also a macro name, then every remaining `\macro` and `\{`-style escape.
 *
 * What is left is only the characters an author typed outside a macro, so any
 * macro name still standing had its backslash eaten. Stripping first rather
 * than matching on a boundary is what catches `a\sqrt{...}` — cooked to
 * `asqrt{...}`, where the bare name is glued to the variable in front of it and
 * a word-boundary test looks straight past it. That one slipped through the
 * first version of this check.
 */
function withoutLegitimateEscapes(tex: string): string {
  return tex
    .replace(/\\(?:text|mathrm|operatorname)\s*\{[^}]*\}/g, '')
    .replace(/\\[A-Za-z]+/g, '')
    .replace(/\\./g, '');
}

/** Why this tex looks damaged, or null if it looks fine. */
export function damageReason(tex: string): string | null {
  if (CONTROL.test(tex)) {
    const codes = [...tex]
      .filter((ch) => CONTROL.test(ch))
      .map((ch) => `U+${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
    return `control character(s) ${codes.join(', ')} — a cooked escape`;
  }

  const bare = withoutLegitimateEscapes(tex);
  const found = MACROS.filter((macro) => new RegExp(`${macro}(?![A-Za-z])`).test(bare));
  return found.length > 0
    ? `bare macro name(s) with the backslash eaten: ${found.join(', ')}`
    : null;
}

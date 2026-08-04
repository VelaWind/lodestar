/**
 * Every glossary mark a module carries, found by walking the same AST the
 * renderer walks.
 *
 * A third walker rather than a flag on `mathNodes`: that one collects strings
 * and is snapshotted, and widening it to return two kinds of thing would make
 * the snapshot's shape depend on a parameter. Two small walkers that each do one
 * thing are cheaper to read than one that does both.
 *
 * The reach matters more than the mechanism. A mark that lands somewhere this
 * walker does not visit is invisible to every check in `content.test.ts` — the
 * ref would go unvalidated, the duplicate undetected — so the layer list below
 * is exactly the one `ModulePage` renders, approximations and equation notes
 * included.
 */
import type { Block, Inline, Module, RichText } from '@/content/types';

/** A `term` node, and where in the module it was found. */
export interface TermMark {
  /** `module/layer#index`, in reading order within that layer. */
  path: string;
  text: string;
  ref: string;
  /** The node as authored, for the leaf-shape assertion. */
  node: Extract<Inline, { k: 'term' }>;
}

type RawTerm = Extract<Inline, { k: 'term' }>;

function fromInline(node: Inline, out: RawTerm[]): void {
  if (typeof node === 'string') return;
  switch (node.k) {
    case 'term':
      out.push(node);
      return;
    case 'em':
    case 'strong':
    case 'link':
      node.children.forEach((child) => fromInline(child, out));
      return;
    case 'code':
    case 'math':
      return;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function fromBlock(node: Block, out: RawTerm[]): void {
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
      node.caption?.forEach((child) => fromInline(child, out));
      return;
    // A leaf, and one that cannot hold a mark: a figure's caption and credit
    // are plain strings, so there is no `Inline` here to walk.
    case 'figure':
      return;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function collect(rich: RichText | undefined, label: string, into: TermMark[]): void {
  if (!rich) return;
  const found: RawTerm[] = [];
  rich.forEach((block) => fromBlock(block, found));
  found.forEach((node, i) =>
    into.push({ path: `${label}#${i}`, text: node.text, ref: node.ref, node }),
  );
}

/** Every glossary mark in one module, in the order a reader meets it. */
export function termMarksOf(module: Module): TermMark[] {
  const out: TermMark[] = [];
  const { layers } = module;

  collect(layers.hook.body, `${module.id}/hook`, out);
  collect(layers.intuition.body, `${module.id}/intuition`, out);
  // Layer 3 in the order `SimStage` renders it: the caption introduces the sim,
  // the approximations panel sits beneath it.
  collect(layers.play.caption, `${module.id}/play.caption`, out);
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

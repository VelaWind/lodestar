/**
 * Renders the rich-text AST. Pure structural mapping — one case per node kind,
 * no parsing, no side effects. If a node kind is added to `types.ts`, tsc will
 * fail here until it's handled, which is the point of the AST.
 */
import { Fragment, type ReactNode } from 'react';
import type { Block, Inline, RichText as RichTextAst } from '@/content/types';
import { GlossaryTerm } from './GlossaryTerm';
import { Tex } from './Tex';

function inline(node: Inline, key: number): ReactNode {
  if (typeof node === 'string') return <Fragment key={key}>{node}</Fragment>;

  switch (node.k) {
    case 'em':
      return <em key={key}>{node.children.map(inline)}</em>;
    case 'strong':
      return (
        <strong key={key} className="font-semibold text-ink">
          {node.children.map(inline)}
        </strong>
      );
    case 'code':
      return (
        <code
          key={key}
          className="rounded bg-void-600 px-1.5 py-0.5 font-mono text-[0.85em] text-star"
        >
          {node.text}
        </code>
      );
    case 'link':
      return (
        <a
          key={key}
          href={node.href}
          target={node.href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer noopener"
          className="text-star underline decoration-star/30 underline-offset-2 transition-colors hover:decoration-star"
        >
          {node.children.map(inline)}
        </a>
      );
    case 'math':
      return <Tex key={key} tex={node.tex} />;
    case 'term':
      return <GlossaryTerm key={key} text={node.text} termRef={node.ref} />;
    default: {
      // Not decoration. The `term` node was added to `Inline` before this
      // switch handled it, and without a guard the only symptom would have been
      // a word silently missing from a paragraph — the renderer returning
      // `undefined` for a case it had never heard of. tsc now refuses the
      // commit instead.
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function block(node: Block, key: number): ReactNode {
  switch (node.k) {
    case 'p':
      return (
        <p key={key} className="text-[1.0625rem] leading-[1.75] text-ink-dim">
          {node.children.map(inline)}
        </p>
      );
    case 'h':
      return (
        <h3 key={key} className="pt-2 font-ui text-sm font-medium uppercase tracking-[0.14em] text-ink-faint">
          {node.children.map(inline)}
        </h3>
      );
    case 'ul':
      return (
        <ul key={key} className="ml-1 space-y-2 text-[1.0625rem] leading-[1.7] text-ink-dim">
          {node.items.map((item, i) => (
            <li key={i} className="relative pl-5 before:absolute before:left-0 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-star-dim">
              {item.map(inline)}
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="ml-5 list-decimal space-y-2 text-[1.0625rem] leading-[1.7] text-ink-dim marker:font-mono marker:text-ink-faint">
          {node.items.map((item, i) => (
            <li key={i} className="pl-1">
              {item.map(inline)}
            </li>
          ))}
        </ol>
      );
    case 'quote':
      return (
        <blockquote key={key} className="border-l-2 border-star-dim/50 pl-5 text-[1.0625rem] italic leading-[1.7] text-ink-dim">
          {node.children.map(inline)}
          {node.cite && (
            <cite className="mt-2 block font-ui text-xs not-italic tracking-wide text-ink-faint">
              — {node.cite}
            </cite>
          )}
        </blockquote>
      );
    case 'aside':
      return (
        <aside key={key} className="rounded-lg border border-edge-soft bg-void-800/60 px-5 py-4">
          {node.title && (
            <div className="mb-2 font-ui text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
              {node.title}
            </div>
          )}
          <div className="space-y-3 text-[0.9375rem]">{node.children.map(block)}</div>
        </aside>
      );
    case 'mathBlock':
      return (
        <figure key={key} className="my-1 overflow-x-auto py-2">
          <Tex tex={node.tex} display className="text-ink" />
          {node.caption && (
            <figcaption className="mt-2 text-center font-ui text-xs text-ink-faint">
              {node.caption.map(inline)}
            </figcaption>
          )}
        </figure>
      );
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function RichText({ content }: { content: RichTextAst }) {
  return <div className="max-w-measure space-y-4 font-prose">{content.map(block)}</div>;
}

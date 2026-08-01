/**
 * Rich-text AST → a plain string. Display only, like everything else in `lib/`.
 *
 * The landing page shows each module's layer-1 hook as a teaser, and a card is
 * not a place for emphasis, links or KaTeX — it needs the sentence. This is the
 * one flattener; if a card ever needs formatting, it should render `RichText`
 * rather than this growing a second mode.
 */
import type { Block, Inline, RichText } from '@/content/types';

function fromInline(node: Inline): string {
  if (typeof node === 'string') return node;
  switch (node.k) {
    case 'em':
    case 'strong':
    case 'link':
      return node.children.map(fromInline).join('');
    case 'code':
      return node.text;
    // A hook has no math in it today. If one ever does, the raw TeX is the
    // honest fallback: it is what the author wrote, unrendered, not a guess.
    case 'math':
      return node.tex;
  }
}

function fromBlock(node: Block): string {
  switch (node.k) {
    case 'p':
    case 'h':
    case 'quote':
      return node.children.map(fromInline).join('');
    case 'ul':
    case 'ol':
      return node.items.map((item) => item.map(fromInline).join('')).join(' ');
    case 'aside':
      return node.children.map(fromBlock).join(' ');
    case 'mathBlock':
      return node.tex;
  }
}

/** Every block joined with a space, collapsed to single spaces. */
export function plainText(content: RichText): string {
  return content
    .map(fromBlock)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

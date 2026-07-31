/**
 * Authoring helpers for the rich-text AST.
 *
 * The AST is verbose to write by hand; these make a module data file read
 * roughly like prose while keeping the compile-time guarantees. They are pure
 * constructors — no logic, no parsing.
 */
import type { Block, Inline, RichText } from './types';

export const p = (...children: Inline[]): Block => ({ k: 'p', children });
export const h = (...children: Inline[]): Block => ({ k: 'h', children });
export const ul = (...items: (Inline | Inline[])[]): Block => ({
  k: 'ul',
  items: items.map((i) => (Array.isArray(i) ? i : [i])),
});
export const ol = (...items: (Inline | Inline[])[]): Block => ({
  k: 'ol',
  items: items.map((i) => (Array.isArray(i) ? i : [i])),
});
export const quote = (cite: string | undefined, ...children: Inline[]): Block => ({
  k: 'quote',
  children,
  ...(cite ? { cite } : {}),
});
export const aside = (title: string | undefined, ...children: Block[]): Block => ({
  k: 'aside',
  children,
  ...(title ? { title } : {}),
});
export const mathBlock = (tex: string, caption?: Inline[]): Block => ({
  k: 'mathBlock',
  tex,
  ...(caption ? { caption } : {}),
});

export const em = (...children: Inline[]): Inline => ({ k: 'em', children });
export const strong = (...children: Inline[]): Inline => ({ k: 'strong', children });
export const code = (text: string): Inline => ({ k: 'code', text });
export const link = (href: string, ...children: Inline[]): Inline => ({
  k: 'link',
  href,
  children,
});
/** Inline math. Tagged template so backslashes survive: m`\sqrt{2GM/R}` */
export const m = (strings: TemplateStringsArray, ...subs: unknown[]): Inline => ({
  k: 'math',
  tex: String.raw({ raw: strings }, ...subs),
});

/** Convenience for the common single-paragraph body. */
export const prose = (...blocks: Block[]): RichText => blocks;

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
/**
 * Inline math. Tagged template so backslashes survive: m`\sqrt{2GM/R}`
 *
 * `String.raw(strings, ...)`, not `String.raw({ raw: strings }, ...)`. The
 * second form looks equivalent and is the reason this file shipped broken for
 * five module passes: a TemplateStringsArray holds the *cooked* strings, with
 * `.raw` alongside them, so wrapping it as `{ raw: strings }` hands String.raw
 * the cooked ones. JavaScript had already eaten every escape by then — `\text`
 * arrived as a tab followed by "ext", `\sqrt` as the bare word "sqrt" — and
 * KaTeX rendered the wreckage as italic prose on every published page.
 *
 * `tests/equations.test.ts` now snapshots every one of these strings and fails
 * on a control character or a bare macro name, which is the check that was
 * missing rather than the knowledge.
 */
export const m = (strings: TemplateStringsArray, ...subs: unknown[]): Inline => ({
  k: 'math',
  tex: String.raw(strings, ...subs),
});

/**
 * A glossary term: the words as the page says them, and the entry they point at.
 *
 * `text` is authored verbatim — "solar masses", "Mpc", "N-body problem" — so
 * marking a term never rewrites the sentence around it. `ref` defaults to a
 * kebab-cased `text`, which is right for the plain cases (`term('ringdown')`)
 * and wrong the moment the surface form is a plural, an abbreviation or a
 * variant spelling, which is most of them: pass the id explicitly there.
 *
 * The id is checked against `content/glossary.ts` by `tests/content.test.ts`
 * rather than by tsc — a `Record<string, …>` keyed by a union would make adding
 * a glossary entry a two-file edit, and the test failure is as loud.
 */
export const term = (text: string, ref?: string): Inline => ({
  k: 'term',
  text,
  ref: ref ?? kebab(text),
});

/** "Innermost Stable Orbit" → "innermost-stable-orbit". Diacritics survive. */
function kebab(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Convenience for the common single-paragraph body. */
export const prose = (...blocks: Block[]): RichText => blocks;

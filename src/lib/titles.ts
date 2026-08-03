/**
 * A readable title for a module that has no module file yet.
 *
 * Connections may point at a module nobody has written — the authoring skill
 * calls a link to an unwritten module "a useful backlog" — and those render as a
 * planned chip. The chip used to print the raw id, so a reader met
 * `cosmic-distance-ladder` in a list beside "Gravitational Waves" and "Black
 * Holes". A slug is a filename; nothing a reader sees should be one.
 *
 * Titles here have to match how the modules themselves are titled, which is
 * headline case with the short joining words left alone — "Scale of the
 * Universe", not "Scale Of The Universe". The first word is always capitalised
 * however short it is.
 */

/** Words that stay lowercase inside a title. */
const MINOR = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

export function titleFromSlug(slug: string): string {
  const words = slug
    .split('-')
    .map((word) => word.trim())
    .filter((word) => word.length > 0);

  if (words.length === 0) return slug;

  return words
    .map((word, i) => {
      if (i > 0 && MINOR.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * WCAG 2.1 contrast arithmetic, so the accessibility claims in this repo are
 * recomputed by the suite rather than asserted by a comment.
 *
 * Two passes now depend on a brightness cap holding: the ambient starfield
 * behind the prose, and the highlight that follows the pointer across a module
 * card. Both are decorative washes drawn *under live text*, both are safe only
 * because their peak alpha is bounded, and both would fail silently and
 * invisibly if someone nudged that alpha up for looks. Keeping the maths in one
 * place is what stops the two checks drifting into disagreeing about what AA
 * means.
 */

/** Relative luminance of an `#rrggbb` string. */
export function luminance(hex: string): number {
  const channels = parse(hex);
  const weights = [0.2126, 0.7152, 0.0722];
  let total = 0;
  for (let i = 0; i < 3; i += 1) {
    const c = (channels[i] ?? 0) / 255;
    const linear = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    total += (weights[i] ?? 0) * linear;
  }
  return total;
}

/** Contrast ratio between two opaque colours, 1…21. */
export function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/** Source-over compositing of `over` at `alpha` onto `under`, as canvas and CSS do it. */
export function composite(over: string, under: string, alpha: number): string {
  const o = parse(over);
  const u = parse(under);
  let out = '#';
  for (let i = 0; i < 3; i += 1) {
    const value = Math.round((o[i] ?? 0) * alpha + (u[i] ?? 0) * (1 - alpha));
    out += value.toString(16).padStart(2, '0');
  }
  return out;
}

function parse(hex: string): number[] {
  const int = Number.parseInt(hex.slice(1), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/* The palette, straight from tailwind.config.js. */
export const VOID_900 = '#06080d';
export const VOID_800 = '#0a0d14';
export const VOID_700 = '#0f131c';
export const INK = '#d5dcea';
/** Body prose. */
export const INK_DIM = '#98a2b8';
/** The most muted tone on the site — whichever cap binds, it binds here first. */
export const INK_FAINT = '#858ea2';
export const STAR = '#9db4ff';
export const EDGE_SOFT = '#1a2130';

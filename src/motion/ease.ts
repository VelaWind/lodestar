/**
 * Evaluating the motion tokens' easing curves outside CSS.
 *
 * CSS and Framer take an `EASE` token's four control points directly. A canvas
 * sim tweening its own drawing does not have that luxury, so every sim that
 * slides a value on a token curve solves the curve here, from one copy.
 */
import type { Bezier } from './tokens';

/**
 * A motion token's cubic Bézier, evaluated: progress in, eased progress out.
 *
 * The tokens are control points, which CSS and Framer can use directly; a
 * canvas tween has to solve the curve itself. Bisection on x(t) = p, then y(t).
 */
export function eased(curve: Bezier, p: number): number {
  const [x1, y1, x2, y2] = curve;
  const at = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < p) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}

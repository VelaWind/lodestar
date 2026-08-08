/**
 * Focus indicators, measured against everything they can land on.
 *
 * WCAG 1.4.11 asks for 3:1 between a non-text indicator and what is adjacent to
 * it. On this site "what is adjacent" stopped being one colour the day the
 * ambient starfield mounted behind the whole page: the ring around a focused
 * control now sits over a background that varies from `void-900` to `void-900
 * plus a star`, and the interesting question is whether the *worst* of that is
 * still legible.
 *
 * The answer turns on a detail that is easy to miss — the global
 * `:focus-visible` rule carries `ring-offset-2 ring-offset-void-900`, which
 * paints two opaque pixels of page colour between the control and the ring. So
 * the ring always has one guaranteed neighbour regardless of what is behind the
 * page, and the starfield can only ever affect its outer edge. Both edges are
 * checked here.
 */
import { describe, expect, it } from 'vitest';

import { MAX_ALPHA, STAR_COLOR } from '@/visual/stars';
import {
  EDGE_SOFT,
  STAR,
  VOID_700,
  VOID_800,
  VOID_900,
  composite,
  contrast,
} from './helpers/contrast';

/** `ring-star/60` — the ring colour the base layer paints, over the page. */
const RING = composite(STAR, VOID_900, 0.6);

/**
 * The brightest background the starfield can produce: two of its brightest
 * stars overlapping. Same worst case `tests/starfield.test.ts` pins.
 */
const LIT_PAGE = composite(STAR_COLOR, VOID_900, 1 - (1 - MAX_ALPHA) ** 2);

/** Surfaces a focusable control actually sits on across a module page. */
const SURFACES: [string, string][] = [
  ['page', VOID_900],
  ['page lit by the starfield', LIT_PAGE],
  ['sim panel (void-800/40)', composite(VOID_800, VOID_900, 0.4)],
  ['approximations panel (void-800/60)', composite(VOID_800, VOID_900, 0.6)],
  ['tooltip panel (void-700)', VOID_700],
  ['hovered card (void-700/50)', composite(VOID_700, VOID_900, 0.5)],
];

describe('focus ring', () => {
  it('clears 3:1 against its own offset, whatever is behind the page', () => {
    // The inner neighbour is always the offset ring, which is opaque page
    // colour. This is the guarantee that does not depend on the starfield.
    expect(contrast(RING, VOID_900)).toBeGreaterThanOrEqual(3);
  });

  it('clears 3:1 against every surface it can be seen against', () => {
    for (const [name, surface] of SURFACES) {
      expect(contrast(RING, surface), `focus ring against ${name}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('survives the brightest the starfield can get', () => {
    const ratio = contrast(RING, LIT_PAGE);
    console.log('focus ring vs starfield-lit page', {
      ring: RING,
      'lit page': LIT_PAGE,
      ratio: Number(ratio.toFixed(2)),
      'vs plain page': Number(contrast(RING, VOID_900).toFixed(2)),
    });
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
});

describe('slider thumb', () => {
  /*
   * The thumb is its own indicator. It is opaque `star` with a 3px halo of
   * `rgb(6 8 13 / 0.9)` — near-opaque `void-900` — so like the focus ring it
   * carries its own backdrop and the starfield never touches the boundary that
   * matters. On focus it also scales to 1.15, which is a size cue rather than a
   * contrast one and so is not what carries the requirement.
   */
  const HALO = composite(VOID_900, LIT_PAGE, 0.9);

  it('clears 3:1 against its halo, and the halo against the page', () => {
    expect(contrast(STAR, HALO), 'thumb against its own halo').toBeGreaterThanOrEqual(3);
    expect(contrast(STAR, VOID_900), 'thumb against the page').toBeGreaterThanOrEqual(3);
  });

  it('clears 3:1 against the track it sits on', () => {
    // `bg-void-500` is the track; the thumb has to be findable along it.
    expect(contrast(STAR, '#1d2331')).toBeGreaterThanOrEqual(3);
  });

  it('reports the numbers', () => {
    console.log('slider thumb contrast', {
      'thumb vs halo': Number(contrast(STAR, HALO).toFixed(2)),
      'thumb vs track': Number(contrast(STAR, '#1d2331').toFixed(2)),
      'thumb vs lit page': Number(contrast(STAR, LIT_PAGE).toFixed(2)),
    });
    expect(contrast(STAR, LIT_PAGE)).toBeGreaterThanOrEqual(3);
  });
});

describe('disclosure indicator', () => {
  /*
   * The chevron and the layer number turn `star` when their layer is open and
   * `ink-faint` when it is closed. That colour *is* the state, so both ends of
   * it have to be visible — this is the one place where a decorative rotation
   * would otherwise be carrying meaning on its own.
   */
  it('is legible in both states, over the page and over a starlit page', () => {
    for (const [name, surface] of [
      ['page', VOID_900],
      ['starlit page', LIT_PAGE],
    ] as [string, string][]) {
      expect(contrast(STAR, surface), `open indicator over ${name}`).toBeGreaterThanOrEqual(3);
      expect(contrast('#858ea2', surface), `closed indicator over ${name}`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it('keeps the rule between layers visible', () => {
    // Not a WCAG requirement — a 1px divider is decoration — but if the
    // starfield ever washed it out the layer list would read as one block.
    expect(contrast(EDGE_SOFT, VOID_900)).toBeGreaterThan(1.1);
  });
});

/**
 * The module index cards: how they arrive, and what the highlight behind them
 * does to the text on top of it.
 *
 * Neither of these is checkable by looking. The stagger is arithmetic that has
 * to keep behaving as the registry grows — the cap only starts mattering at the
 * sixth card, and there are seven — and the highlight is a wash drawn *under*
 * the most muted tone on the site, where "it still looks fine" and "it still
 * clears AA" are not the same statement.
 */
import { describe, expect, it } from 'vitest';

import { staggerFor } from '@/pages/ModuleListPage';
import { moduleList } from '@/content/registry';
import {
  INK,
  INK_DIM,
  INK_FAINT,
  STAR,
  VOID_700,
  VOID_800,
  VOID_900,
  composite,
  contrast,
} from './helpers/contrast';

describe('card stagger', () => {
  it('steps by 60ms per card', () => {
    expect(staggerFor(0)).toBe(0);
    expect(staggerFor(1)).toBe(60);
    expect(staggerFor(2)).toBe(120);
    expect(staggerFor(3)).toBe(180);
    expect(staggerFor(4)).toBe(240);
  });

  it('caps at 300ms, so the last card never waits longer', () => {
    expect(staggerFor(5)).toBe(300);
    expect(staggerFor(6)).toBe(300);
    // The registry is meant to grow; the cap is what keeps that from turning
    // the grid into a queue.
    expect(staggerFor(40)).toBe(300);
    for (let i = 0; i < 200; i += 1) expect(staggerFor(i)).toBeLessThanOrEqual(300);
  });

  it('never waits longer than 300ms for any card actually on the page', () => {
    const last = staggerFor(moduleList.length - 1);
    expect(last).toBeLessThanOrEqual(300);
  });

  it('is monotonic — no card arrives before one above it', () => {
    for (let i = 1; i < 50; i += 1) {
      expect(staggerFor(i)).toBeGreaterThanOrEqual(staggerFor(i - 1));
    }
  });
});

describe('card highlight contrast', () => {
  /** The peak alpha of the radial highlight, from the class on the card. */
  const GLOW_ALPHA = 0.12;

  /**
   * The surface the highlight is drawn onto. The card is `bg-void-800/40` at
   * rest and `bg-void-700/50` under the pointer — and since the highlight only
   * ever shows on hover or focus, the hover surface is the one that matters.
   */
  const REST_SURFACE = composite(VOID_800, VOID_900, 0.4);
  const HOVER_SURFACE = composite(VOID_700, VOID_900, 0.5);

  it('keeps every text tone on the card at AA under the brightest point of the glow', () => {
    for (const surface of [REST_SURFACE, HOVER_SURFACE]) {
      const lit = composite(STAR, surface, GLOW_ALPHA);
      for (const tone of [INK, INK_DIM, INK_FAINT]) {
        expect(
          contrast(tone, lit),
          `${tone} over the glow at its centre (${lit})`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('reports the worst case so a regression is readable in the diff', () => {
    const lit = composite(STAR, HOVER_SURFACE, GLOW_ALPHA);
    const table = {
      surface: HOVER_SURFACE,
      'glow centre': lit,
      'ink-faint over card': Number(contrast(INK_FAINT, HOVER_SURFACE).toFixed(2)),
      'ink-faint over glow': Number(contrast(INK_FAINT, lit).toFixed(2)),
      'ink-dim over glow': Number(contrast(INK_DIM, lit).toFixed(2)),
    };
    console.log('card highlight worst-case contrast', table);
    expect(table['ink-faint over glow']).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * The task this came from asked after cards with a `'planned'` status. There
   * is no such status — `Module.status` is `'draft' | 'published'`, and
   * "planned" is the Connections layer's chip for a module that does not exist
   * yet, which never appears on this page. The index's own distinct treatment is
   * the amber `draft` badge, so that is what gets checked here: the highlight
   * must not wash it out, or an unfinished module stops announcing itself.
   */
  it('leaves a draft card still telling itself apart from a published one', () => {
    const EMBER = '#e8bd7d';
    const lit = composite(STAR, HOVER_SURFACE, GLOW_ALPHA);

    // The badge is amber on a blue-white wash; it has to stay legible on both
    // the plain card and the lit one.
    expect(contrast(EMBER, HOVER_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(EMBER, lit)).toBeGreaterThanOrEqual(4.5);

    /*
     * And it has to stay *different* from the blue the rest of the card uses.
     * Contrast ratio is the wrong instrument for that — it is a luminance
     * comparison, and amber and star-blue are deliberately close in luminance,
     * so a ratio near 1 is what a well-matched pair of accents looks like
     * rather than a failure. What separates them is hue, so that is what gets
     * asserted: the badge is warm (red above blue), everything else on the card
     * is cool (blue above red).
     */
    const channels = (hex: string) => {
      const int = Number.parseInt(hex.slice(1), 16);
      return { r: (int >> 16) & 255, b: int & 255 };
    };
    const badge = channels(EMBER);
    const accent = channels(STAR);
    expect(badge.r - badge.b, 'the draft badge should read warm').toBeGreaterThan(40);
    expect(accent.b - accent.r, 'the card accent should read cool').toBeGreaterThan(40);

    console.log('draft badge', {
      'ember over lit card': Number(contrast(EMBER, lit).toFixed(2)),
      'ember warmth (r-b)': badge.r - badge.b,
      'star coolness (b-r)': accent.b - accent.r,
    });
  });

  it('gives the focus ring AA non-text contrast against what surrounds it', () => {
    /*
     * The focus indicator is two things, and both have to be seen. The global
     * `:focus-visible` rule paints `ring-star/60` against a `void-900` offset,
     * and the card additionally swaps its border to full `star`. WCAG 1.4.11
     * wants 3:1 for a non-text indicator.
     */
    const ring = composite(STAR, VOID_900, 0.6);
    expect(contrast(ring, VOID_900), 'ring against the page').toBeGreaterThanOrEqual(3);
    expect(contrast(ring, REST_SURFACE), 'ring against the card').toBeGreaterThanOrEqual(3);
    expect(contrast(STAR, REST_SURFACE), 'focused border against the card').toBeGreaterThanOrEqual(
      3,
    );
    console.log('focus indicator contrast', {
      ring,
      'ring vs page': Number(contrast(ring, VOID_900).toFixed(2)),
      'ring vs card': Number(contrast(ring, REST_SURFACE).toFixed(2)),
      'border vs card': Number(contrast(STAR, REST_SURFACE).toFixed(2)),
    });
  });
});

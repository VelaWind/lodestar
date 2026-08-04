/**
 * Where the glossary panel lands.
 *
 * The interesting cases are all geometry and none of them need a browser: a term
 * in the last line of a tall page, a term in the first word of a narrow one, a
 * definition taller than the space under it. The e2e suite proves the panel
 * opens and reads correctly on a real page; this proves the arithmetic that
 * decides where, at the edges where it is easiest to get wrong and hardest to
 * notice — a panel clipped off the bottom of a phone still passes "is visible"
 * if half of it is on screen.
 */
import { describe, expect, it } from 'vitest';
import { place } from '@/components/GlossaryTerm';

/** A phone, and a laptop. */
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
/** Roughly what a two-sentence definition measures at 20rem wide. */
const PANEL = { width: 320, height: 120 };

/** A word `width` wide whose top sits `top` down the viewport. */
const word = (top: number, left: number, width = 90) => ({
  top,
  bottom: top + 22,
  left,
  width,
});

describe('glossary panel placement', () => {
  it('sits below the term when there is room', () => {
    const at = place(word(200, 500), PANEL, DESKTOP);
    expect(at.flipped).toBe(false);
    expect(at.top).toBe(200 + 22 + 8);
  });

  it('centres on the term horizontally', () => {
    const trigger = word(200, 500);
    const at = place(trigger, PANEL, DESKTOP);
    const panelCentre = at.left + PANEL.width / 2;
    expect(panelCentre).toBeCloseTo(trigger.left + trigger.width / 2, 5);
  });

  it('flips above a term near the bottom of the viewport', () => {
    // 60px of room below, 700 above: below cannot hold a 120px panel.
    const trigger = word(740, 500);
    const at = place(trigger, PANEL, DESKTOP);
    expect(at.flipped).toBe(true);
    expect(at.top).toBe(740 - 8 - PANEL.height);
    expect(at.top + PANEL.height).toBeLessThan(trigger.top);
  });

  it('stays below when below is tight but still the roomier side', () => {
    // Near the top: 30px above, 700 below. Flipping would be worse.
    const at = place(word(38, 500), PANEL, DESKTOP);
    expect(at.flipped).toBe(false);
  });

  it('clamps to the left edge for a term at the start of a line', () => {
    const at = place(word(300, 4), PANEL, PHONE);
    expect(at.left).toBeGreaterThanOrEqual(8);
  });

  it('clamps to the right edge for a term at the end of a line', () => {
    const at = place(word(300, 330, 56), PANEL, PHONE);
    expect(at.left + PANEL.width).toBeLessThanOrEqual(PHONE.width - 8);
  });

  it('never places the panel off the top of the viewport', () => {
    // A tall panel and a term with nothing above it: clamped, not negative.
    const at = place(word(10, 100), { width: 320, height: 700 }, PHONE);
    expect(at.top).toBeGreaterThanOrEqual(8);
  });

  it('keeps a panel wider than the viewport at the margin rather than off-screen', () => {
    const at = place(word(300, 100), { width: 500, height: 120 }, PHONE);
    expect(at.left).toBe(8);
  });
});

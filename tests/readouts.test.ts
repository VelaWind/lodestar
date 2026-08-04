/**
 * Two small strings a reader meets, and the corners where they went wrong.
 *
 * Neither is visible in a screenshot. The slider's accessible name is only ever
 * read aloud, and the collapse warning appears at one corner of two sliders
 * that nothing else drives — so both are the kind of defect that ships, and
 * both are cheap to pin here.
 */
import { describe, expect, it } from 'vitest';
import { __internals } from '@/sims/escape-velocity';
import escapeVelocity from '@/content/modules/escape-velocity';
import keplerOrbits from '@/content/modules/kepler-orbits';
import { moduleList } from '@/content/registry';
import { sliderAriaLabel } from '@/lib/format';
import { schwarzschildRadius } from '@/physics/blackhole';
import type { Param } from '@/content/types';

const { collapseNote } = __internals;

const paramOf = (params: Param[], id: string): Param => {
  const found = params.find((p) => p.id === id);
  if (!found) throw new Error(`no param "${id}"`);
  return found;
};

describe('a slider’s accessible name', () => {
  it('names the unit when there is one', () => {
    const R = paramOf(escapeVelocity.layers.play.params, 'R');
    expect(sliderAriaLabel('Surface radius', R)).toBe('Surface radius (m)');
  });

  it('omits the parenthetical entirely for a unitless param', () => {
    // Eccentricity is a genuine ratio and carries `unit: ''`. The old template
    // interpolated it anyway and produced "Eccentricity ()", which a screen
    // reader announces as a stray bracket pair.
    const e = paramOf(keplerOrbits.layers.play.params, 'e');
    expect(e.unit, 'eccentricity should still be the unitless one').toBe('');

    const label = sliderAriaLabel('Eccentricity', e);
    expect(label).toBe('Eccentricity');
    expect(label, 'no empty parentheses').not.toContain('()');
  });

  it('leaves no empty parentheses on any published param', () => {
    for (const module of moduleList.filter((m) => m.status === 'published')) {
      for (const param of module.layers.play.params) {
        const label = sliderAriaLabel(param.technicalLabel, param);
        expect(label, `${module.id}/${param.id}`).not.toContain('()');
        expect(label.trim(), `${module.id}/${param.id}: empty name`).not.toBe('');
      }
    }
  });

  it('prefers the display unit a reader actually sees', () => {
    // Several params store SI and show something friendlier — solar masses,
    // Earth radii. The spoken name should match the printed one.
    const m1 = paramOf(escapeVelocity.layers.play.params, 'v0');
    expect(sliderAriaLabel('Launch speed', m1)).toBe('Launch speed (km/s)');
  });
});

describe('the collapse warning', () => {
  const params = escapeVelocity.layers.play.params;
  const M = paramOf(params, 'M');
  const R = paramOf(params, 'R');

  it('appears when the body is inside its own horizon', () => {
    const note = collapseNote(M.max, R.min);
    expect(note, 'the heaviest body at the smallest radius is a black hole').not.toBeNull();
    expect(note).toContain('Smaller than its own Schwarzschild radius');
    expect(note).toContain('has stopped meaning anything');
    // The radius is quoted, formatted the way the sim formats every distance.
    expect(note).toMatch(/\(\d[\d.,]* km\)/);
  });

  it('does not appear at the horizon exactly, nor above it', () => {
    // R = r_s is the coincidence the going-deeper layer is about: the Newtonian
    // escape speed equals c there. Interesting, not broken.
    const rs = schwarzschildRadius(M.max);
    expect(collapseNote(M.max, rs), 'exactly at r_s').toBeNull();
    expect(collapseNote(M.max, rs * 1.000001), 'just above r_s').toBeNull();
    expect(collapseNote(M.max, R.max), 'the largest radius').toBeNull();
  });

  it('stays silent across the whole default and light-body range', () => {
    // Nothing a reader reaches by dragging one slider from the defaults should
    // trip it; it takes both extremes together.
    expect(collapseNote(M.default, R.default), 'Earth').toBeNull();
    expect(collapseNote(M.min, R.min), 'lightest body, smallest radius').toBeNull();
    expect(collapseNote(M.max, R.default), 'heaviest body at Earth’s radius').toBeNull();
  });

  it('turns on exactly at the crossing, not before it', () => {
    // Walk the mass slider at the smallest radius and find where it flips; the
    // flip must be where R = r_s, not a decade either side.
    const flipped = [];
    for (let e = Math.log10(M.min); e <= Math.log10(M.max); e += 0.01) {
      const mass = 10 ** e;
      if (collapseNote(mass, R.min) !== null) {
        flipped.push(mass);
        break;
      }
    }
    const first = flipped[0];
    expect(first, 'the warning never appeared while sweeping the mass').toBeDefined();
    // r_s at that mass has just passed R.min.
    expect(schwarzschildRadius(first!)).toBeGreaterThan(R.min);
    expect(schwarzschildRadius(first! / 1.05)).toBeLessThan(R.min);
  });
});

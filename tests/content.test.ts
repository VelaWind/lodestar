/**
 * Structural checks on published modules, against the module-authoring skill.
 *
 * Not a proofreader: nothing here can tell whether the prose is any good. What
 * it can do is catch the mistakes that are invisible in review and obvious to a
 * reader — a placeholder that shipped, a reference without a link, a connection
 * pointing at a module id that will never exist because it was mistyped, a sim
 * key that resolves to nothing.
 *
 * The bounds are the skill's own length targets. They are guides for a human and
 * limits here: a module outside them usually has a structural problem, and the
 * test failing is the prompt to think about it rather than a verdict.
 */
import { describe, expect, it } from 'vitest';
import { moduleList, modules, simKeys } from '@/content/registry';
import type { Module } from '@/content/types';
import { LOG_ARROW_STEP, LOG_PAGE_STEP, sliderBounds } from '@/lib/format';
import { plainText } from '@/lib/plainText';

const published = moduleList.filter((m) => m.status === 'published');

/**
 * Connection targets that do not exist yet, and are meant not to.
 *
 * The skill calls a link to an unwritten module "a useful backlog", so a missing
 * target is not a failure — but a *mistyped* one is, and the two are
 * indistinguishable without a list. Adding a name here is the deliberate act of
 * saying "this module is planned"; removing one is what happens when it lands.
 */
const KNOWN_BACKLOG = ['cosmic-distance-ladder', 'expansion-of-the-universe'];

/** Every string a reader could see, flattened. */
function readableText(module: Module): string {
  const { layers } = module;
  return [
    module.title,
    module.tagline,
    plainText(layers.hook.body),
    plainText(layers.intuition.body),
    plainText(layers.real.body),
    plainText(layers.deeper.body),
    layers.play.caption ? plainText(layers.play.caption) : '',
    ...layers.play.approximations,
    ...(layers.math.intro ? [plainText(layers.math.intro)] : []),
    ...layers.math.equations.map((e) => (e.note ? plainText(e.note) : '')),
    ...layers.connections.links.map((l) => l.reason),
    ...module.references.map((r) => `${r.label} ${r.note ?? ''}`),
  ].join('\n');
}

describe('the registry', () => {
  it('has published modules', () => {
    expect(published.length).toBeGreaterThan(0);
  });

  it('keys every module by its own id', () => {
    for (const [key, module] of Object.entries(modules)) {
      expect(module.id, 'a module is filed under an id that is not its own').toBe(key);
    }
  });

  it('lists no backlog id that already exists', () => {
    for (const id of KNOWN_BACKLOG) {
      expect(modules[id], `"${id}" exists now — take it out of KNOWN_BACKLOG`).toBeUndefined();
    }
  });
});

for (const module of published) {
  describe(module.id, () => {
    it('has a title and a one-line tagline', () => {
      expect(module.title.trim().length).toBeGreaterThan(0);
      expect(module.tagline.trim().length).toBeGreaterThan(0);
    });

    it('has 1 to 5 params, each with a label and a symbol', () => {
      const params = module.layers.play.params;
      expect(params.length).toBeGreaterThanOrEqual(1);
      expect(params.length).toBeLessThanOrEqual(5);

      for (const param of params) {
        expect(param.friendlyLabel.trim().length, `${param.id}: no friendly label`).toBeGreaterThan(0);
        expect(param.technicalLabel.trim().length, `${param.id}: no technical label`).toBeGreaterThan(0);
        expect(param.symbol.trim().length, `${param.id}: no symbol`).toBeGreaterThan(0);
        expect(param.min, `${param.id}: min is not below max`).toBeLessThan(param.max);
        expect(param.default, `${param.id}: default below min`).toBeGreaterThanOrEqual(param.min);
        expect(param.default, `${param.id}: default above max`).toBeLessThanOrEqual(param.max);
        // A log slider cannot include zero; the shell warns in dev and clamps.
        if (param.scale === 'log') expect(param.min, `${param.id}: log scale from ${param.min}`).toBeGreaterThan(0);
      }
    });

    it('leaves every log slider draggable more finely than the keyboard steps', () => {
      // The keyboard's step is uniform across modules and lives in
      // ParamControls; the element's step is the authored one and governs
      // dragging. If a module ever authors a step coarser than an arrow press,
      // the pointer becomes the blunter instrument and the slider starts
      // snapping past values the keyboard can reach.
      for (const param of module.layers.play.params) {
        if (param.scale !== 'log') continue;
        const { min, max, step } = sliderBounds(param);
        expect(step, `${param.id}: authored step is coarser than an arrow press`).toBeLessThanOrEqual(
          LOG_ARROW_STEP,
        );
        expect(
          max - min,
          `${param.id}: range is under one decade, so the coarse key is the whole slider`,
        ).toBeGreaterThan(LOG_PAGE_STEP / 2);
      }
    });

    it('registers a sim that exists', () => {
      expect(simKeys, `simKey "${module.layers.play.simKey}" resolves to nothing`).toContain(
        module.layers.play.simKey,
      );
    });

    it('discloses at least one approximation', () => {
      const items = module.layers.play.approximations;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item.trim().length).toBeGreaterThan(0);
    });

    it('has 1 to 3 equations', () => {
      const equations = module.layers.math.equations;
      expect(equations.length).toBeGreaterThanOrEqual(1);
      expect(equations.length).toBeLessThanOrEqual(3);
      for (const equation of equations) {
        expect(equation.tex.trim().length, `${equation.id}: empty tex`).toBeGreaterThan(0);
        expect(equation.binds.length, `${equation.id}: binds nothing`).toBeGreaterThan(0);
      }
    });

    it('has 2 to 4 connections, each with a reason and a real target', () => {
      const links = module.layers.connections.links;
      expect(links.length).toBeGreaterThanOrEqual(2);
      expect(links.length).toBeLessThanOrEqual(4);

      for (const link of links) {
        expect(link.reason.trim().length, `${link.moduleId}: no reason given`).toBeGreaterThan(0);
        const known = modules[link.moduleId] !== undefined || KNOWN_BACKLOG.includes(link.moduleId);
        expect(
          known,
          `"${link.moduleId}" is neither a module nor in KNOWN_BACKLOG — typo, or add it`,
        ).toBe(true);
        expect(link.moduleId, 'a module links to itself').not.toBe(module.id);
      }
    });

    it('has 2 to 5 references, each with a URL', () => {
      expect(module.references.length).toBeGreaterThanOrEqual(2);
      expect(module.references.length).toBeLessThanOrEqual(5);
      for (const reference of module.references) {
        expect(reference.label.trim().length, 'a reference has no label').toBeGreaterThan(0);
        expect(reference.url, `"${reference.label}" has no usable URL`).toMatch(/^https?:\/\/\S+$/);
      }
    });

    it('ships no placeholder text', () => {
      const text = readableText(module);
      for (const marker of ['TODO', 'FIXME', 'Lorem ipsum', 'placeholder copy']) {
        expect(text, `published prose still contains "${marker}"`).not.toContain(marker);
      }
    });
  });
}

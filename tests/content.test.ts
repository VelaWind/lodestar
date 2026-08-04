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
import { readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { glossary } from '@/content/glossary';
import { moduleList, modules, simKeys } from '@/content/registry';
import type { Module } from '@/content/types';
import { LOG_ARROW_STEP, LOG_PAGE_STEP, sliderBounds } from '@/lib/format';
import { titleFromSlug } from '@/lib/titles';
import { plainText } from '@/lib/plainText';
import { termMarksOf } from './helpers/termNodes';

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
    ...layers.play.approximations.map(plainText),
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

/**
 * Modules deliberately withheld from readers.
 *
 * Empty is the normal state. A module sitting at `status: 'draft'` is invisible
 * on the index *and* degrades to a planned chip wherever another module links to
 * it — which is how a finished, registered, routable module went missing from a
 * seven-module site and turned up in escape-velocity's Connections as a grey
 * chip. Nothing else in the suite could see it, because every other content test
 * iterates the published set and a draft is simply absent from what they check.
 *
 * So the withheld set is written down. Holding a module back stays a one-line
 * change; forgetting to publish one again does not stay silent.
 */
const INTENTIONAL_DRAFTS: readonly string[] = [];

describe('what readers can reach', () => {
  it('publishes every module that is not deliberately held back', () => {
    const withheld = moduleList
      .filter((m) => m.status !== 'published')
      .map((m) => m.id)
      .sort();
    expect(withheld, 'a module is a draft without being listed as one').toEqual(
      [...INTENTIONAL_DRAFTS].sort(),
    );
  });

  it('lists every published module on the index', () => {
    // The index renders `moduleList` filtered by `isReaderVisible`, which in a
    // production build is exactly the published set. Asserted against the same
    // list the page maps over, so a module missing from the registry glob fails
    // here too.
    const onIndex = moduleList.filter((m) => m.status === 'published').map((m) => m.id);
    for (const module of published) {
      expect(onIndex, `${module.id} is published but not on the index`).toContain(module.id);
    }
    expect(onIndex.length, 'the index should show every published module').toBe(published.length);
  });

  it('never renders a published module as a planned chip', () => {
    // A connection degrades to a planned chip whenever its target is not
    // reader-visible. A target that exists and is published must therefore
    // resolve to a live link on every page that mentions it.
    for (const module of published) {
      for (const { moduleId } of module.layers.connections.links) {
        const target = modules[moduleId];
        if (!target) continue;
        expect(
          target.status,
          `${module.id} links to ${moduleId}, which exists but would render as a planned chip`,
        ).toBe('published');
      }
    }
  });

  it('gives every planned chip a readable title rather than a slug', () => {
    // The chip shows the target's own title when the module exists, and a title
    // built from the id when it does not. Either way it must not be the id.
    for (const module of published) {
      for (const { moduleId } of module.layers.connections.links) {
        const shown = modules[moduleId]?.title ?? titleFromSlug(moduleId);
        expect(shown, `${module.id} -> ${moduleId}: chip would show the raw slug`).not.toBe(
          moduleId,
        );
        expect(shown, `${module.id} -> ${moduleId}: chip title contains a hyphen-slug`).not.toMatch(
          /^[a-z0-9]+(-[a-z0-9]+)+$/,
        );
        expect(shown.trim().length, `${module.id} -> ${moduleId}: empty chip title`).toBeGreaterThan(
          0,
        );
      }
    }
  });
});

/**
 * The glossary and the marks that reach it.
 *
 * Two failure modes, both silent on the page and both cheap to catch here. A
 * `ref` that resolves to nothing renders as bare text — the reader never learns
 * the tooltip was meant to be there, and neither does anyone reviewing the diff.
 * An entry nobody marks is a definition written and then orphaned by a later
 * rewrite of the prose it belonged to; it costs nothing at runtime, which is
 * exactly why it would sit there forever.
 *
 * The duplicate check is the third: a term marked twice in one module gives a
 * reader the same tooltip twice in one page, and the second is noise. The rule
 * is one mark per id per module, and the *first* occurrence in reading order —
 * which is why `termMarksOf` walks the layers in the order they render.
 */
describe('the glossary', () => {
  const marks = published.flatMap((module) => termMarksOf(module).map((mark) => ({ module, mark })));

  it('marks terms at all', () => {
    // A walker that returned nothing would make every check below vacuous.
    expect(marks.length, 'no glossary terms are marked anywhere').toBeGreaterThan(40);
  });

  it('resolves every marked ref to a glossary entry', () => {
    for (const { module, mark } of marks) {
      expect(
        glossary[mark.ref],
        `${mark.path}: "${mark.text}" points at "${mark.ref}", which is not in the glossary` +
          ` (module ${module.id})`,
      ).toBeDefined();
    }
  });

  it('leaves no glossary entry unmarked', () => {
    const used = new Set(marks.map(({ mark }) => mark.ref));
    const orphans = Object.keys(glossary).filter((id) => !used.has(id));
    expect(orphans, 'glossary entries nothing links to — mark them or delete them').toEqual([]);
  });

  it('marks each ref at most once per module', () => {
    for (const module of published) {
      const seen = new Map<string, string>();
      for (const mark of termMarksOf(module)) {
        const first = seen.get(mark.ref);
        expect(
          first,
          `${module.id}: "${mark.ref}" is marked twice — at ${first} and again at ${mark.path}`,
        ).toBeUndefined();
        seen.set(mark.ref, mark.path);
      }
    }
  });

  it('keeps every term node a leaf', () => {
    for (const { mark } of marks) {
      // The type says so; this says so at runtime, because a term that grew
      // children would put a link or an equation inside a <button>.
      expect(Object.keys(mark.node).sort(), `${mark.path}: term node has extra keys`).toEqual([
        'k',
        'ref',
        'text',
      ]);
      expect(mark.node, `${mark.path}: term node has children`).not.toHaveProperty('children');
      expect(typeof mark.node.text, `${mark.path}: term text is not a string`).toBe('string');
      expect(mark.node.text.trim().length, `${mark.path}: term with no visible text`).toBeGreaterThan(
        0,
      );
    }
  });

  it('gives every entry a title and a definition', () => {
    for (const [id, entry] of Object.entries(glossary)) {
      expect(id, `"${id}" is not a kebab-case id`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(entry.title.trim().length, `${id}: no title`).toBeGreaterThan(0);
      expect(entry.body.trim().length, `${id}: no body`).toBeGreaterThan(0);
      // A tooltip is a small panel, and one that needs scrolling has stopped
      // being a tooltip. Two sentences is the brief.
      expect(entry.body.length, `${id}: definition is too long for a tooltip`).toBeLessThan(220);
      // "Post-Newtonian" and "N-body" are hyphenated words, not slugs — what
      // must never head the panel is the id itself, unchanged.
      expect(entry.title, `${id}: title is the raw slug, not a display form`).not.toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)+$/,
      );
    }
  });
});

/**
 * The photograph at the end of layer 4.
 *
 * Every published module carries one, and the two things that can be wrong with
 * it are both invisible in review. The `width` and `height` in the module file
 * are what the browser reserves before the bytes arrive, so a number that does
 * not match the file is a layout shift nobody sees on a fast connection — they
 * are read back off the file here rather than trusted. And a `src` pointing at
 * a file that was never committed renders as a broken image on the live site
 * and as nothing at all in a unit suite that only looks at the AST.
 */
const FIGURE_MAX_BYTES = 500 * 1024;

/**
 * Modules deliberately without a figure.
 *
 * `kepler-orbits` wants a measured astrometry plot of S2's orbit around
 * Sagittarius A*. ESO's release for that result carries only artist's
 * impressions; the Max Planck page hosting the real plot is © Max-Planck-
 * Gesellschaft with the figures taken from a Nature paper; and the A&A papers
 * are marked "© ESO" and "Free Access" with no Creative Commons wording — free
 * to read is not free to reuse. Nothing else may be substituted, so the module
 * ships without one until a properly licensed plot exists.
 *
 * Listing it here rather than skipping silently is the point: a module losing
 * its figure has to show up in a diff.
 */
const WITHOUT_FIGURE: readonly string[] = ['kepler-orbits'];

describe('the layer-4 photograph', () => {
  it('lists no module that in fact has a figure', () => {
    for (const id of WITHOUT_FIGURE) {
      const module = modules[id];
      expect(module, `"${id}" is in WITHOUT_FIGURE but is not a module`).toBeDefined();
      const blocks = module!.layers.real.body;
      expect(
        blocks.some((b) => b.k === 'figure'),
        `"${id}" has a figure now — take it out of WITHOUT_FIGURE`,
      ).toBe(false);
    }
  });

  for (const module of published.filter((m) => !WITHOUT_FIGURE.includes(m.id))) {
    it(`${module.id}: ends layer 4 with exactly one well-formed figure`, async () => {
      const blocks = module.layers.real.body;
      const figures = blocks.filter((b) => b.k === 'figure');
      expect(figures.length, `${module.id}: expected exactly one figure in layer 4`).toBe(1);

      const last = blocks[blocks.length - 1];
      expect(last?.k, `${module.id}: the figure should be the last block of layer 4`).toBe('figure');
      const fig = last as Extract<(typeof blocks)[number], { k: 'figure' }>;

      expect(fig.alt.trim().length, `${module.id}: empty alt`).toBeGreaterThan(0);
      expect(fig.caption.trim().length, `${module.id}: empty caption`).toBeGreaterThan(0);
      expect(fig.credit.trim().length, `${module.id}: empty credit`).toBeGreaterThan(0);
      // Alt text substitutes for the image; a caption says why it is here. A
      // figure whose alt is its caption has one of the two jobs undone.
      expect(fig.alt.trim(), `${module.id}: alt and caption are the same text`).not.toBe(
        fig.caption.trim(),
      );

      expect(fig.src, `${module.id}: src should be a site-absolute path`).toBe(
        `/figures/${module.id}.webp`,
      );

      const path = `public${fig.src}`;
      expect(() => readFileSync(path), `${module.id}: ${path} is missing`).not.toThrow();

      const bytes = statSync(path).size;
      expect(
        bytes,
        `${module.id}: ${(bytes / 1024).toFixed(1)} kB exceeds the 500 kB cap`,
      ).toBeLessThanOrEqual(FIGURE_MAX_BYTES);

      // The authored dimensions against the file's own, so a re-encode that
      // changes the size cannot ship without the module file following it.
      const meta = await sharp(path).metadata();
      expect(meta.width, `${module.id}: authored width does not match the file`).toBe(fig.width);
      expect(meta.height, `${module.id}: authored height does not match the file`).toBe(fig.height);
      expect(meta.format, `${module.id}: not a webp`).toBe('webp');
    });
  }
});

describe('titleFromSlug', () => {
  it('title-cases a slug and leaves the joining words alone', () => {
    expect(titleFromSlug('cosmic-distance-ladder')).toBe('Cosmic Distance Ladder');
    expect(titleFromSlug('expansion-of-the-universe')).toBe('Expansion of the Universe');
    expect(titleFromSlug('scale-of-the-universe')).toBe('Scale of the Universe');
    expect(titleFromSlug('black-holes')).toBe('Black Holes');
  });

  it('capitalises the first word even when it is a joining word', () => {
    expect(titleFromSlug('the-cosmic-web')).toBe('The Cosmic Web');
  });

  it('survives a degenerate id rather than returning nothing', () => {
    expect(titleFromSlug('')).toBe('');
    expect(titleFromSlug('proton')).toBe('Proton');
    expect(titleFromSlug('a--b')).toBe('A B');
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
      for (const [i, item] of items.entries()) {
        // Rich text now, so "not empty" means blocks that flatten to words —
        // an item authored as `prose()` would satisfy a length check on the
        // array and render as an empty bullet.
        expect(item.length, `approximation ${i} has no blocks`).toBeGreaterThan(0);
        expect(plainText(item).trim().length, `approximation ${i} is empty`).toBeGreaterThan(0);
      }
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

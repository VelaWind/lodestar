/**
 * Every word a reader can see, pinned.
 *
 * This file replaces a habit. Four sessions of structural work — moving
 * `approximations` from `string[]` to rich text, threading `term` nodes through
 * seven modules, relocating fifteen of them, appending a figure to every layer
 * 4 — each carried a promise that not one character of prose changed, and each
 * time that promise was checked by a throwaway script that materialised the
 * modules at an old commit and diffed the flattened text. The scripts worked.
 * They were also deleted every time, so the guarantee lasted exactly as long as
 * the session did, and the next refactor started from nothing.
 *
 * A committed snapshot is the same check made permanent, and better in the way
 * that matters: it does not need a reference commit to compare against, it
 * covers copy the ad-hoc scripts never reached (the glossary, the About page,
 * figure alt text), and when it fails it prints the words that moved rather
 * than a count that did not match.
 *
 * What this does and does not assert. It is not a proofreader and cannot tell
 * whether a sentence is any good — `content.test.ts` holds the structural rules
 * and the authoring standards live in the skill. This says only: the text that
 * reaches a reader today is the text that reached them at the last commit, and
 * if it is not, the diff shows exactly which words changed.
 *
 * Updating it is meant to be deliberate. `vitest -u` after an intentional copy
 * edit, and the snapshot diff becomes part of the review — which is the point,
 * because a prose change that nobody reads in a diff is how a stale claim
 * ships.
 */
import { describe, expect, it } from 'vitest';
import { aboutSections, aboutTitle } from '@/content/about';
import { glossary } from '@/content/glossary';
import { moduleList } from '@/content/registry';
import type { Block, Module, RichText } from '@/content/types';
import { plainText } from '@/lib/plainText';

const published = moduleList.filter((m) => m.status === 'published').sort((a, b) => a.id.localeCompare(b.id));

/**
 * The figure's alt text, which `plainText` deliberately omits.
 *
 * Alt substitutes for the image rather than being prose the page says twice, so
 * it is right that flattening a layer leaves it out — and equally right that it
 * is pinned here, because it is read aloud to anyone who cannot see the figure
 * and nothing else in the suite would notice it being reworded.
 */
function figureAlt(body: RichText): string | undefined {
  const fig = body.find((b: Block) => b.k === 'figure');
  return fig && fig.k === 'figure' ? fig.alt : undefined;
}

/** Everything one module puts in front of a reader, keyed by where it appears. */
function copyOf(module: Module): Record<string, unknown> {
  const { layers } = module;
  const out: Record<string, unknown> = {
    title: module.title,
    tagline: module.tagline,
    'L1 hook': plainText(layers.hook.body),
    'L2 intuition': plainText(layers.intuition.body),
    'L3 caption': layers.play.caption ? plainText(layers.play.caption) : null,
    // Layer 4 flattens with its figure's caption and credit included, which is
    // what a reader sees; the alt is pinned separately just below.
    'L4 real': plainText(layers.real.body),
    'L4 figure alt': figureAlt(layers.real.body) ?? null,
    'L5 intro': layers.math.intro ? plainText(layers.math.intro) : null,
    'L6 deeper': plainText(layers.deeper.body),
  };

  layers.play.approximations.forEach((item, i) => {
    out[`L3 approximation ${i}`] = plainText(item);
  });
  for (const equation of layers.math.equations) {
    out[`L5 note (${equation.id})`] = equation.note ? plainText(equation.note) : null;
  }
  layers.connections.links.forEach((link) => {
    out[`L7 reason -> ${link.moduleId}`] = link.reason;
  });
  module.references.forEach((reference, i) => {
    out[`reference ${i}`] = {
      label: reference.label,
      url: reference.url,
      note: reference.note ?? null,
    };
  });

  return out;
}

describe('reader-visible copy', () => {
  it('has modules to pin', () => {
    // A snapshot of nothing passes forever. This is the tripwire under it.
    expect(published.length, 'no published modules to snapshot').toBe(7);
  });

  it('every published module, word for word', () => {
    const all: Record<string, Record<string, unknown>> = {};
    for (const module of published) all[module.id] = copyOf(module);
    expect(all).toMatchSnapshot();
  });

  it('the glossary, word for word', () => {
    // Sorted, so that reordering the file — which changes nothing a reader
    // sees — does not read as a copy change in the diff.
    const sorted = Object.fromEntries(
      Object.entries(glossary).sort(([a], [b]) => a.localeCompare(b)),
    );
    expect(sorted).toMatchSnapshot();
  });

  it('the About page, word for word', () => {
    expect({
      title: aboutTitle,
      sections: aboutSections.map((section) => ({
        heading: section.heading,
        body: plainText(section.body),
      })),
    }).toMatchSnapshot();
  });
});

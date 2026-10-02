/**
 * What the shell needs to know about a module without loading it.
 *
 * The front page lists every module with its title, tagline, hook teaser and
 * slider count; Connections links by title and status; route heads and preload
 * hints need the id and the sim. None of that needs the module's prose, its
 * equations or its references, so the app ships a manifest of these summaries
 * in its entry chunk and loads each module's full data only on its own page.
 *
 * The manifest is generated at build time (scripts/manifestPlugin.ts) by
 * running `summarise` over the real registry, so it cannot drift from the data.
 */
import { plainText } from '@/lib/plainText';
import type { Module } from './types';

export interface ModuleSummary {
  id: string;
  title: string;
  tagline: string;
  status: Module['status'];
  /** Layer 1's hook as plain text: the front-page card's teaser. */
  teaser: string;
  /** How many sliders layer 3 has: shown on the card. */
  paramCount: number;
  /** The sim component's key: used for preload hints. */
  simKey: string;
}

export function summarise(module: Module): ModuleSummary {
  return {
    id: module.id,
    title: module.title,
    tagline: module.tagline,
    status: module.status,
    teaser: plainText(module.layers.hook.body),
    paramCount: module.layers.play.params.length,
    simKey: module.layers.play.simKey,
  };
}

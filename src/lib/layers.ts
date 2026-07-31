/**
 * Layer order, presentation metadata, and the depth-tier → default-expansion
 * policy. The shell reads this and nothing else when deciding what to open, so
 * changing the reading experience is a one-file change.
 */
import type { LayerId } from '@/content/types';

export type DepthTier = 'curious' | 'student' | 'deep';

export const LAYER_ORDER: readonly LayerId[] = [
  'hook',
  'intuition',
  'play',
  'real',
  'math',
  'deeper',
  'connections',
] as const;

export interface LayerMeta {
  id: LayerId;
  /** 1-based, shown in the gutter. */
  index: number;
  title: string;
  /** Sub-label in the accordion header — sets expectations before opening. */
  hint: string;
}

export const LAYER_META: Record<LayerId, LayerMeta> = {
  hook: { id: 'hook', index: 1, title: 'Hook', hint: 'Why this is worth your attention' },
  intuition: { id: 'intuition', index: 2, title: 'Intuition', hint: 'The idea, no machinery' },
  play: { id: 'play', index: 3, title: 'Play with it', hint: 'Interactive · real units' },
  real: { id: 'real', index: 4, title: 'Real picture', hint: 'What actually happens out there' },
  math: { id: 'math', index: 5, title: 'The math', hint: 'Equations, bound to the sim' },
  deeper: { id: 'deeper', index: 6, title: 'Going deeper', hint: 'What the intuition papered over' },
  connections: { id: 'connections', index: 7, title: 'Connections', hint: 'Where this leads' },
};

/**
 * Which layers start open at each tier.
 *
 * Depth never hides or rewrites content — every layer is present and manually
 * expandable at every tier. It only decides where you land.
 *
 * Deep is the interesting one: it opens layers 4-7 and collapses 1-3. A deep
 * reader doesn't need the hook, the hand-waving intuition, or to be walked into
 * the sim — but they do want the real picture, the math, the caveats, and where
 * this leads, all open and readable in one pass. The first three stay one click
 * away rather than being removed.
 */
export const DEFAULT_OPEN: Record<DepthTier, readonly LayerId[]> = {
  curious: ['hook', 'intuition', 'play'],
  student: ['hook', 'intuition', 'play', 'real', 'math'],
  deep: ['real', 'math', 'deeper', 'connections'],
};

export const TIERS: { id: DepthTier; label: string; blurb: string }[] = [
  { id: 'curious', label: 'Curious', blurb: 'Story and the sim. Math is there if you want it.' },
  { id: 'student', label: 'Student', blurb: 'Adds the real picture and the equations.' },
  { id: 'deep', label: 'Deep', blurb: 'Opens the real picture through connections. The lead-in is one click away.' },
];

export function defaultOpenFor(tier: DepthTier): Set<LayerId> {
  return new Set(DEFAULT_OPEN[tier]);
}

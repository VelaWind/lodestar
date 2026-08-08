/**
 * KaTeX must stay out of the module page's first paint.
 *
 * The library is 78 kB and, in the state a first-time reader lands in, renders
 * nothing at all — so it was 78 kB fetched ahead of first paint to draw zero
 * glyphs. Deferring it moved mobile Lighthouse on module pages from 94 to 97-98
 * and LCP from 2752ms to 2206ms.
 *
 * Two things have to stay true for that to hold, and both regress silently:
 *
 *   1. No default-open layer may contain math. The deferral is only invisible
 *      because there is nothing to render at first paint; the day a module puts
 *      an equation in its hook, deferring KaTeX starts costing either a flash of
 *      raw TeX or a layout shift, and this suite is where that is found rather
 *      than in a Lighthouse run three months later.
 *   2. `Tex` must not import KaTeX at module scope. A static import puts it back
 *      in the initial chunk graph, and nothing else in the suite would notice —
 *      every test would still pass and the page would just be slower again.
 *
 * The runtime half of this — that the browser genuinely does not request the
 * chunk before first paint, and does once a math layer opens — is asserted in
 * `tests/e2e/qa.spec.ts`, which can watch the network.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import blackHoles from '@/content/modules/black-holes';
import exoplanets from '@/content/modules/exoplanets';
import escapeVelocity from '@/content/modules/escape-velocity';
import gravitationalWaves from '@/content/modules/gravitational-waves';
import keplerOrbits from '@/content/modules/kepler-orbits';
import planetaryAtmospheres from '@/content/modules/planetary-atmospheres';
import scaleOfTheUniverse from '@/content/modules/scale-of-the-universe';
import { DEFAULT_OPEN, LAYER_ORDER, layerHasMath } from '@/lib/layers';
import type { DepthTier } from '@/lib/layers';
import type { Module } from '@/content/types';

const MODULES: Module[] = [
  escapeVelocity,
  keplerOrbits,
  scaleOfTheUniverse,
  blackHoles,
  gravitationalWaves,
  exoplanets,
  planetaryAtmospheres,
];

/** The tier a reader lands on with nothing persisted — see `useAppStore`. */
const DEFAULT_TIER: DepthTier = 'curious';

describe('KaTeX stays out of the first paint', () => {
  it('has no math in any layer that is open by default, in any published module', () => {
    const open = DEFAULT_OPEN[DEFAULT_TIER];
    const offenders: string[] = [];

    for (const module of MODULES) {
      if (module.status !== 'published') continue;
      for (const layerId of open) {
        if (layerHasMath(module, layerId, DEFAULT_TIER)) {
          offenders.push(`${module.id}/${layerId}`);
        }
      }
    }

    expect(
      offenders,
      'a default-open layer gained math — deferring KaTeX now costs a flash of raw TeX or a layout shift on first paint',
    ).toEqual([]);
  });

  it('still finds the math it is supposed to find', () => {
    // A guard on the guard: if `layerHasMath` ever answered "no" to everything,
    // the assertion above would pass for the wrong reason.
    for (const module of MODULES) {
      expect(layerHasMath(module, 'math', DEFAULT_TIER), `${module.id}/math`).toBe(true);
    }
    // Parameter symbols are rendered only at the Deep tier.
    expect(layerHasMath(keplerOrbits, 'play', 'deep')).toBe(true);
    expect(layerHasMath(keplerOrbits, 'play', 'curious')).toBe(false);
    // And prose math is found where it lives.
    const proseLayers = LAYER_ORDER.filter((l) => l !== 'math' && l !== 'play');
    expect(proseLayers.some((l) => layerHasMath(keplerOrbits, l, DEFAULT_TIER))).toBe(true);
  });

  it('loads KaTeX dynamically, so it is not in the initial chunk graph', () => {
    const source = readFileSync('src/components/Tex.tsx', 'utf8');

    // A static import is what puts the library back on the critical path.
    expect(
      /^\s*import\s+[^'"\n]*\bfrom\s+['"]katex['"]/m.test(source),
      'Tex.tsx imports katex at module scope again — that returns 78 kB to the first paint of every module page',
    ).toBe(false);

    // And the dynamic one has to actually be there.
    expect(/import\(\s*['"]katex['"]\s*\)/.test(source)).toBe(true);

    /* The stylesheet stays eager on purpose. It is in the RichText CSS chunk,
       which a module page already loads, and deferring it too would mean math
       arriving unstyled for a frame — the exact flash the JS deferral is
       carefully avoiding. */
    expect(source).toContain("import 'katex/dist/katex.min.css'");
  });
});

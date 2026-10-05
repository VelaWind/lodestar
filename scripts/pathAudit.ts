/**
 * `npm run path:audit`: glossary terms a module uses in layers 1–3 before the
 * path reaches the topic that teaches them. A report for a person to read,
 * never a test: it always exits 0.
 *
 * Why it cannot be a test. A forward term is often fine: a tooltip defines it
 * in place, or it is a passing aside ("near a black hole"). And the glossary
 * cannot say where an idea is *taught*, only where its entry was first written.
 * So this lists candidates, and a person decides. What is enforced is the
 * declared prerequisites in `src/content/path.ts`, which `tests/path.test.ts`
 * checks.
 *
 * Where a term is taught, its "home", is found in this order:
 *   1. TAUGHT_IN below, a short hand-written map for terms whose home is not
 *      obvious from a title;
 *   2. the module whose title names the term ("Neutron star" → Neutron Stars
 *      and Pulsars);
 *   3. otherwise, the earliest module on the path that marks the term in its
 *      layer 4, where the house rules say every term is defined.
 * A term is reported when its home comes later on the path than the module
 * using it in layers 1–3.
 *
 * Runs on Node's built-in TypeScript stripping and loads the real registry
 * through Vite's own module loader, as the route-heads plugin does, so it reads
 * exactly the objects the site renders. No dependency beyond Vite.
 */
import { fileURLToPath, URL } from 'node:url';
import { createServer } from 'vite';

/** Terms whose home is not the module named like them. glossary id → module id. */
const TAUGHT_IN: Record<string, string> = {
  'tidal-force': 'tides',
  'tidal-locking': 'tides',
  'event-horizon': 'black-holes',
  'schwarzschild-radius': 'black-holes',
  redshift: 'expansion-of-the-universe',
  'hubble-constant': 'expansion-of-the-universe',
  'hubble-flow': 'expansion-of-the-universe',
  'standard-candle': 'cosmic-distance-ladder',
  'cepheid-variable': 'cosmic-distance-ladder',
  parallax: 'cosmic-distance-ladder',
  'type-ia-supernova': 'supernovae',
  'white-dwarf': 'supernovae',
  'main-sequence': 'supernovae',
  'escape-velocity': 'escape-velocity',
  'escape-parameter': 'planetary-atmospheres',
  'cosmic-microwave-background': 'cosmic-microwave-background',
  'big-bang': 'early-universe',
  'dark-energy': 'expansion-of-the-universe',
  'rotation-curve': 'dark-matter',
  'gravitational-wave': 'gravitational-waves',
  'proper-time': 'time-dilation',
};

interface TermNode {
  k: 'term';
  text: string;
  ref: string;
}

/** Every term node in a rich-text AST, however deeply nested. */
function termsIn(value: unknown, out: TermNode[] = []): TermNode[] {
  if (Array.isArray(value)) {
    for (const item of value) termsIn(item, out);
  } else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    if (node.k === 'term' && typeof node.ref === 'string') out.push(node as unknown as TermNode);
    for (const child of Object.values(node)) termsIn(child, out);
  }
  return out;
}

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
});

try {
  const { modules } = (await server.ssrLoadModule('/src/content/registry.ts')) as {
    modules: Record<string, { id: string; title: string; layers: Record<string, unknown> & { play: Record<string, unknown> } }>;
  };
  const { PATH_STEPS } = (await server.ssrLoadModule('/src/content/path.ts')) as {
    PATH_STEPS: { id: string; step: number }[];
  };
  const { glossary } = (await server.ssrLoadModule('/src/content/glossary.ts')) as {
    glossary: Record<string, { title: string }>;
  };

  const stepOf = new Map(PATH_STEPS.map((s) => [s.id, s.step]));
  const byStep = [...PATH_STEPS].sort((a, b) => a.step - b.step);
  const singular = (s: string) => s.toLowerCase().replace(/\b(\w+?)(es|s)\b/g, '$1');

  const homeOf = (ref: string): { id: string; how: string } | undefined => {
    if (TAUGHT_IN[ref]) return { id: TAUGHT_IN[ref], how: 'map' };
    const title = singular(glossary[ref]?.title ?? ref.replace(/-/g, ' '));
    const named = byStep.find((s) => singular(modules[s.id]!.title).includes(title));
    if (named) return { id: named.id, how: 'title' };
    const defined = byStep.find((s) => termsIn(modules[s.id]!.layers.real).some((t) => t.ref === ref));
    return defined ? { id: defined.id, how: 'layer 4' } : undefined;
  };

  /** One section of the report: the forward terms in the given layers of every module. */
  const section = (heading: string, pick: (layers: (typeof modules)[string]['layers']) => unknown): number => {
    let reported = 0;
    console.log(`${heading}\n`);
    for (const { id, step } of byStep) {
      const seen = new Set<string>();
      const lines: string[] = [];
      for (const term of termsIn(pick(modules[id]!.layers))) {
        if (seen.has(term.ref)) continue;
        seen.add(term.ref);
        const home = homeOf(term.ref);
        if (!home || home.id === id) continue;
        const homeStep = stepOf.get(home.id)!;
        if (homeStep > step) {
          lines.push(`    "${term.text}" (${term.ref}) is taught in ${home.id}, step ${homeStep} [found by ${home.how}]`);
        }
      }
      console.log(`${String(step).padStart(2)} ${id} (${seen.size} terms): ${lines.length === 0 ? 'none' : ''}`);
      for (const line of lines) console.log(line);
      reported += lines.length;
    }
    console.log(`\n${reported} forward reference${reported === 1 ? '' : 's'} to review.\n`);
    return reported;
  };

  section('Forward term references in layers 1–3 (for a person to review; not a failure)', (l) => [
    l.hook,
    l.intuition,
    l.play.caption,
    l.play.approximations,
  ]);
  // Layer 4 is where the house rules put every term, so it is where forward
  // references actually collect. Informational: a term marked here opens its
  // definition in place, which is often all a reader needs.
  section('Also, layer 4 (informational: each marked term is defined in its tooltip)', (l) => l.real);
} finally {
  await server.close();
}

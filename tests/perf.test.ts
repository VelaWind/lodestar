/**
 * The performance pass's pure pieces, held to "same output, less work".
 *
 * Each of these replaced something slower with something that must give
 * exactly the same result: a storage that skips redundant writes, and cached
 * number formatters. The early-universe table has its own accuracy test in
 * earlyuniverse.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { dedupedStorage } from '@/store/dedupedStorage';
import { ariaNumber } from '@/lib/format';
import { getModuleSummary, loadModule, moduleCatalog } from '@/content/catalog';
import { moduleList } from '@/content/registry';
import { plainText } from '@/lib/plainText';

describe('module catalog', () => {
  it('lists every registry module in the same order, with the fields the shell shows', () => {
    expect(moduleCatalog.map((m) => m.id)).toEqual(moduleList.map((m) => m.id));
    for (const module of moduleList) {
      const summary = getModuleSummary(module.id)!;
      expect(summary.title).toBe(module.title);
      expect(summary.tagline).toBe(module.tagline);
      expect(summary.status).toBe(module.status);
      expect(summary.teaser).toBe(plainText(module.layers.hook.body));
      expect(summary.paramCount).toBe(module.layers.play.params.length);
      expect(summary.simKey).toBe(module.layers.play.simKey);
    }
  });

  it('loads each module lazily as the same data the registry holds', async () => {
    for (const module of moduleList) {
      expect(await loadModule(module.id)).toEqual(module);
    }
  });
});

describe('deduped storage', () => {
  it('writes only when the value changes, and reads through', () => {
    const backing = new Map<string, string>();
    let writes = 0;
    const storage = dedupedStorage({
      getItem: (name) => backing.get(name) ?? null,
      setItem: (name, value) => {
        writes += 1;
        backing.set(name, value);
      },
      removeItem: (name) => {
        backing.delete(name);
      },
    });

    backing.set('prefs', '{"tier":"curious"}');
    expect(storage.getItem('prefs')).toBe('{"tier":"curious"}');
    storage.setItem('prefs', '{"tier":"curious"}');
    expect(writes, 'an unchanged value after a read is not rewritten').toBe(0);

    storage.setItem('prefs', '{"tier":"deep"}');
    for (let i = 0; i < 100; i += 1) storage.setItem('prefs', '{"tier":"deep"}');
    expect(writes, 'a hundred identical writes cost one').toBe(1);
    expect(backing.get('prefs')).toBe('{"tier":"deep"}');

    storage.removeItem('prefs');
    storage.setItem('prefs', '{"tier":"deep"}');
    expect(writes, 'after a remove, the value is written again').toBe(2);
  });
});

describe('cached aria number formatter', () => {
  it('gives the same strings as a fresh toLocaleString', () => {
    for (const n of [0, 1, -3.5, 1.9446e-18, 1e31, 12345.678, 0.1 + 0.2, 6.02214076e23]) {
      expect(ariaNumber(n)).toBe(
        n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 17 }),
      );
    }
  });
});

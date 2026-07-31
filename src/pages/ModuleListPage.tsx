/**
 * The index. Reads the registry, so a new data file appears here automatically.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { moduleList } from '@/content/registry';
import { TIERS } from '@/lib/layers';
import { useAppStore } from '@/store/useAppStore';

export function ModuleListPage() {
  const tier = useAppStore((s) => s.tier);
  const blurb = TIERS.find((t) => t.id === tier)?.blurb;

  useEffect(() => {
    document.title = 'Lodestar';
  }, []);

  return (
    <div>
      <header className="mb-12 max-w-measure">
        <h1 className="font-prose text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
          Space, in layers you choose to open.
        </h1>
        <p className="mt-4 font-prose text-lg leading-relaxed text-ink-dim">
          Every topic is one page with seven layers, from a hook to the full derivation. The
          simulations run on real physical quantities in SI units — the same numbers the equations
          use.
        </p>
        <p className="mt-4 font-ui text-sm text-ink-faint">
          Reading at <span className="text-star">{TIERS.find((t) => t.id === tier)?.label}</span>{' '}
          depth — {blurb} Nothing is ever hidden; depth only decides where you land.
        </p>
      </header>

      {moduleList.length === 0 ? (
        <p className="font-prose text-ink-faint">
          No modules yet. Drop a data file in <code className="font-mono">src/content/modules/</code>.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {moduleList.map((m) => (
            <li key={m.id}>
              <Link
                to={`/m/${m.id}`}
                className="group block h-full rounded-xl border border-edge-soft bg-void-800/40 p-6 transition-all hover:border-star-dim/60 hover:bg-void-700/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-prose text-xl text-ink transition-colors group-hover:text-star">
                    {m.title}
                  </h2>
                  {m.status === 'draft' && (
                    <span className="mt-1 shrink-0 rounded-full border border-ember/40 px-2 py-0.5 font-ui text-[0.6rem] uppercase tracking-wider text-ember">
                      draft
                    </span>
                  )}
                </div>
                <p className="mt-2 font-prose text-sm leading-relaxed text-ink-faint">
                  {m.tagline}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

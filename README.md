# Lodestar

Space, in layers you choose to open.

Every topic is a **module**: one typed data file that renders as seven
progressive-disclosure layers — Hook, Intuition, Play with it, Real picture, The
math, Going deeper, Connections. A global depth setting (Curious / Student /
Deep) controls which layers are *expanded by default*. It never hides, removes,
or rewrites content — every layer is present and manually expandable at every
tier.

Simulations run on real physical parameters in SI units. The math layer and the
simulation read the same `Param` objects, so there is never a second copy of a
constant that can drift.

## Running it

```bash
npm install
npm run dev
```

`npm run build` typechecks then builds to `dist/`. Deploys to Vercel as a static
site (`vercel.json` handles the SPA rewrite).

## Adding a module

Two files, no shell edits. The registry is built with `import.meta.glob`, so
nothing needs registering by hand.

1. **`src/content/modules/<id>.ts`** — default-exports a `Module`. The filename
   must match the `id` field; that id is the URL (`/m/<id>`).
2. **`src/sims/<simKey>.tsx`** — default-exports a component taking `SimProps`.
   The filename is the `simKey` referenced from the module's `play` layer.

Copy `src/content/modules/escape-velocity.ts` as a starting point. Authoring
helpers for the rich-text AST live in `src/content/rich.ts`.

A sim never renders its own sliders — the shell owns parameter controls, so
every module gets log-aware, LaTeX-labelled, SI-correct inputs for free. A sim
receives already-clamped values and draws.

## Layout

```
src/
  content/     types, authoring helpers, registry, module data files
  sims/        one lazy-loaded component per simulation
  components/  shell + layer renderers
  pages/       / and /m/:id
  store/       zustand (depth tier persisted; param values are not)
  lib/         layer order + tier policy, SI formatting
```

Key decisions are documented as comments at the top of the file they affect —
`content/types.ts` for the content model, `content/registry.ts` for the
zero-edit wiring, `components/Tex.tsx` for the KaTeX choice, `lib/layers.ts` for
the depth policy.

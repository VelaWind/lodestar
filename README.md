# Lodestar

**Space, explained in layers you choose to open.**

Live: https://lodestar-nu-six.vercel.app

Lodestar is an interactive astrophysics education site. Every topic is a *module* that unfolds one concept in seven layers — from a one-sentence hook, through an everyday analogy and a live simulation, down to the derivation and the open research questions. A persistent depth setting (Curious / Student / Deep) controls which layers open by default. It never changes the text: there is one module per topic, written once, serving readers from "never studied physics" to "works in the field."

## The rule that governs everything

Every simulation runs on real physical values in SI units. Slider labels are friendly at lower depth tiers, but the parameter underneath is always a real quantity with a unit and a symbol — and the math layer reads **the same parameter objects** the visualization does. Drag the mass slider and the equation updates with your value; the number in the formula is the number in the physics loop. Nothing is faked for the sake of a visual.

Every approximation a simulation makes is disclosed beside the sim, not buried in prose. Every module cites primary sources. A dev-time sanity suite recomputes known quantities (Earth's orbital period, escape velocity, the Schwarzschild radius of the Sun, light travel times) through the same code paths the sims use — if a check fails, the sim is wrong, not the constants.

## Architecture

- **A module is data, not code.** Each topic is one typed data file (prose as a serializable AST, params, equations, references) plus one sim component. The registry discovers both via glob — adding a module requires zero shell changes, which is verified on every module added.
- **One source of truth per quantity.** Physics lives in `src/physics/`, shared by the animation loop, the readouts, and the equation renderer. Constants are defined once, cited to CODATA/IAU, and never inlined.
- **Sims are canvas-first.** rAF loops draw from refs without per-frame React renders; `prefers-reduced-motion` gets static renderings with the same information.

## Stack

Vite · React 18 · React Router · TypeScript (strict) · Tailwind · Zustand · Framer Motion · KaTeX · Canvas 2D

## Modules

| Module | The one idea |
|---|---|
| Black holes | The bigger the hole, the gentler its doorstep |
| Escape velocity | The speed at which a thrown stone never comes back |
| Exoplanets | Six thousand worlds, found by watching stars blink |
| Gravitational waves | A billion light-years away, two black holes rang space itself |
| Kepler orbits | Speed and distance trade exactly; the period fits on one line |
| Planetary atmospheres | Why Titan keeps a thick atmosphere while the Moon, nearly its match in gravity, is bare |
| Scale of the universe | Forty-two factors of ten, from a proton to the horizon |

More are planned; each module's Connections layer links onward, including to modules that don't exist yet — that's the backlog, in public.

## Development

```bash
npm install
npm run dev        # sanity suite runs in the browser console
npm test           # physics checks, equation snapshots, canvas replay, content structure
npm run build      # typecheck + production build
```

Module pages carry KaTeX's full, unsubsetted font set: the glyphs a future module will need are not knowable in advance, and a subset would fail by silently rendering a blank box rather than by failing a build. Only the faces a page actually uses are fetched — one 79 kB file on the most equation-dense page — and mobile Lighthouse performance there measures 96–97, so the ceiling this imposes is accepted rather than engineered around.

`npm test` runs the same physics sanity blocks the browser logs, asserts every published equation against a committed snapshot so a formatting change cannot quietly rewrite the math, replays each sim's drawing at phone-to-desktop widths against a recording canvas to catch labels drawn outside the frame, and checks every published module against the authoring standards. Typecheck, test and build run on every push and pull request to `main`.

The `.claude/skills/` directory contains the project's authoring standards — the seven-layer module format and the physics-accuracy rules — written as [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code) so they are enforced during AI-assisted development. This project is built solo with Claude Code; the skills are how editorial and physical consistency survive that.

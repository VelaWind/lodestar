# Lodestar

**Space, explained in layers you choose to open.**

Live: https://lodestar-nu-six.vercel.app

**Status:** Lodestar is complete. What remains named but unwritten — two links in the Connections layers — is a map rather than a commitment, and the site says so where it names them. Maintenance from here is passive: dependencies and defects, not new modules.

Lodestar is an interactive astrophysics education site. Every topic is a *module* that unfolds one concept in seven layers — from a one-sentence hook, through an everyday analogy and a live simulation, down to the derivation and the open research questions. A persistent depth setting (Curious / Student / Deep) controls which layers open by default. It never changes the text: there is one module per topic, written once, serving readers from "never studied physics" to "works in the field."

## The rule that governs everything

Every simulation runs on real physical values in SI units. Slider labels are friendly at lower depth tiers, but the parameter underneath is always a real quantity with a unit and a symbol — and the math layer reads **the same parameter objects** the visualization does. Drag the mass slider and the equation updates with your value; the number in the formula is the number in the physics loop. Nothing is faked for the sake of a visual.

Every approximation a simulation makes is disclosed beside the sim, not buried in prose. Every module cites primary sources. A dev-time sanity suite recomputes known quantities (Earth's orbital period, escape velocity, the Schwarzschild radius of the Sun, light travel times) through the same code paths the sims use — if a check fails, the sim is wrong, not the constants.

## Architecture

- **A module is data, not code.** Each topic is one typed data file (prose as a serializable AST, params, equations, references) plus one sim component. The registry discovers both via glob — adding a module requires zero shell changes, which is verified on every module added.
- **One source of truth per quantity.** Physics lives in `src/physics/`, shared by the animation loop, the readouts, and the equation renderer. Constants are defined once, cited to CODATA/IAU, and never inlined.
- **Sims are canvas-first.** rAF loops draw from refs without per-frame React renders; `prefers-reduced-motion` gets static renderings with the same information.
- **Terms are marked, not re-explained.** A `term` node in the prose AST is a leaf — visible words plus a glossary id, never a container — so a definition can never come to hold a link or an equation. One central glossary of 46 entries backs them, and each id is marked once per module, on the first occurrence a reader actually reaches. The panel is portalled to `document.body` and positioned `fixed`, because every layer body sits inside the accordion's `overflow-hidden` and anything in the tree would be clipped; it tracks the scroll that reveals it and dismisses only once the page is still. Hover opens after an intent delay, a click pins against the pointer leaving, focus opens it for the keyboard, tap toggles it, and one persistent live region speaks the definition for a screen reader — the panel lands at the end of `<body>`, where nobody is reading.
- **Every module ends layer 4 with the evidence itself — a licensed photograph or a published measurement.** One each: Earthrise, the Hubble Ultra Deep Field, M87\*, the GW150914 strain traces, Kepler's HAT-P-7 light curve, Cassini's view of Titan's limb, and S2's measured orbit around Sagittarius A\*. Each licence was read off the source's own page before anything was downloaded, and where a source mandates its credit wording that line is used verbatim in place of the authored one. One image is an adaptation rather than a straight resize — the S2 plot is the upper panel of a two-panel figure — and the crop is declared in the visible credit line, not only in a comment.
- **Every route serves its own head.** The build emits a real HTML file per route from the module registry, so a shared link unfurls as the module rather than as the front page: title, description and canonical come off the module object at build time, and the description *is* the tagline. A `sitemap.xml` is generated the same way. Adding a module still requires no edit — it gets a head and a sitemap entry from the same glob that gives it a page.

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

Each module's Connections layer links onward, including to two modules that were never written — `cosmic-distance-ladder` and `expansion-of-the-universe`. Those links render as "planned" chips rather than dead links, and they are a map of where the subject goes next rather than a commitment to write it.

An address that matches nothing says so. `/m/<unknown>` names the slug it could not find; anything else reaches a quiet not-found page. Neither redirects, because bouncing a stale link to the index hides both that it was wrong and what it asked for. One tradeoff, disclosed: a static single-page host serves unknown addresses with a 200, so both not-found states mark themselves noindex and drop the canonical while mounted — as close to a real 404 as the platform allows.

## Development

```bash
npm install
npm run dev        # sanity suite runs in the browser console
npm run lint       # correctness rules only — no formatting opinions
npm test           # physics checks, equation and copy snapshots, canvas replay, rendered audio, content structure
npm run e2e        # five browser projects against the live site (E2E_BASE_URL to retarget)
npm run build      # typecheck + production build + one HTML shell per route + sitemap
```

Module pages carry KaTeX's full, unsubsetted font set: the glyphs a future module will need are not knowable in advance, and a subset would fail by silently rendering a blank box rather than by failing a build. Only the faces a page actually uses are fetched — two or three woff2 files, 42–69 kB in total depending on which faces the page's equations need — and the ceiling this imposes is accepted rather than engineered around. Lighthouse 13.4.1 against production on 2026-08-05 scored 95–100 for performance across the landing page and the heaviest module at both the mobile and desktop presets — 99 and 100 for the landing page, 95 and 100 for gravitational-waves — with 100 for accessibility, best practices and SEO on all four runs and cumulative layout shift at zero on all four.

`npm test` runs the same physics sanity blocks the browser logs, asserts every published equation against a committed snapshot so a formatting change cannot quietly rewrite the math, replays each sim's drawing at phone-to-desktop widths against a recording canvas to catch labels drawn outside the frame, synthesises the gravitational-wave sonification into a buffer and measures the frequencies back out of it, and checks every published module against the authoring standards. Typecheck, lint, test and build run on every push and pull request to `main`, in that order.

It also pins every word a reader can see — each layer flattened, the glossary, the About page, figure captions, credits and alt text — in a committed snapshot. Four rounds of structural work each promised that no prose changed and each proved it with a script that was deleted afterwards; the snapshot is that check made permanent, and a copy edit now fails the suite until the diff has been read and the snapshot deliberately updated.

The browser suite is `npm run e2e`, and it runs against a real deployment rather than a dev server — set `E2E_BASE_URL` to point it at a local `npm run preview` instead. Chromium takes everything at two viewports; WebKit, Firefox and mobile WebKit take a tagged subset — the tooltip journeys, the figures, every axe pass, keyboard operability, the disclosure behaviour and the not-found route — which is the surface where engines actually differ. Two accommodations are written down rather than papered over: Firefox logs a MathML validation error against KaTeX's own markup, excused by name so that every other console error there still fails the run; and Safari's Tab reaches form controls but not links, so the four lines asserting the skip link are scoped out of WebKit while the rest of that test still runs there. Cross-engine coverage has so far found one bug, and it was in a test.

The `.claude/skills/` directory contains the project's authoring standards — the seven-layer module format and the physics-accuracy rules — written as [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code) so they are enforced during AI-assisted development. This project is built solo with Claude Code; the skills are how editorial and physical consistency survive that.

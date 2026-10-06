# Changelog

## 1.0.0 (2026-10-07)

The first release. Lodestar explains astrophysics one topic at a time, each topic a single page that opens from a plain-language hook down to the derivation, with a live simulation in the middle that runs on the same physical quantities the equations use.

- 22 modules, each in seven layers: hook, intuition, a live simulation, the real picture, the maths, going deeper, and connections to other topics.
- Three depth tiers (Curious, Student, Deep) that decide which layers start open, never which words are shown.
- A "Start here" learning path through all 22 topics in four stages, with each module's prerequisites declared and checked.
- Simulations on real SI quantities, with every approximation stated beside the simulation it applies to.
- A glossary of 150 terms, defined in place wherever a term first appears.
- A physics sanity suite of 205 checks that recomputes known values through the code the simulations use.
- Accessibility: keyboard operation throughout, every simulation still under reduced motion, labelled canvases, and axe checks on every route.
- One served HTML head per route, with its own title, description, canonical address and structured data.
- Performance work for slow phones: content loaded per page, deferred maths typesetting, responsive figures, cached assets.
- Recovery from a part of a page that fails to load, and continuous integration that runs the unit tests and the browser tests on every change to main.

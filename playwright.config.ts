import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end QA against the *live* deployment.
 *
 * Deliberately not wired into CI, and deliberately not pointed at a dev server:
 * every other check in this repo is a unit-level harness running against source,
 * and the one thing none of them can tell us is whether the thing on the
 * internet works. That means this suite is subject to the network, to whatever
 * Vercel last built, and to real browser behaviour — which is the point.
 *
 * Run with: npx playwright test
 *
 * `E2E_BASE_URL` points it somewhere else — in practice `npm run build` followed
 * by `npx vite preview`, so a change to the suite itself can be checked before
 * it is pushed. The default stays the live site: a suite whose normal target is
 * localhost would stop being the thing that tells us the deployment works.
 */
export default defineConfig({
  testDir: './tests/e2e',

  // One worker, no parallelism: the assertions read console output and canvas
  // pixels, both of which are easier to attribute when one page runs at a time,
  // and it is politer to a live site.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],

  // Generous: this is a network round trip to a real host, not localhost.
  timeout: 120_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://lodestar-nu-six.vercel.app',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },

  projects: [
    {
      name: 'mobile-390x844',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-1280x800',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },

    /*
     * The other two engines, on a deliberately narrower scope.
     *
     * Everything above runs on Chromium, and until these three projects landed
     * in 64f4855 that was the whole of the coverage — which is a gap in exactly
     * the place the site is most engine-dependent. The glossary tooltip is
     * built on `:focus-visible`, on the order of `pointerdown` against `blur`,
     * and on a portalled `position: fixed` panel measured against the trigger's
     * viewport rect. Those are three of the most divergent corners of the DOM,
     * and Chromium alone cannot see any of it.
     *
     * `grep` rather than a copy of the full suite. Running everything three
     * more times would triple a six-minute pass to buy very little: the sim
     * behaviour tests read canvas pixels and assert physics that has nothing to
     * do with the renderer, and the audio and reduced-motion passes are about
     * platform APIs whose headless implementations differ for reasons that are
     * not defects. What the extra engines are here for is the interaction and
     * accessibility surface — tooltips, keyboard operability, axe, the figures,
     * the disclosure behaviour, the not-found route — so that is what they run,
     * marked `@cross-engine` at the declaration so the scope is visible in the
     * test name rather than only in this file.
     */
    {
      name: 'webkit-1280x800',
      grep: /@cross-engine/,
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'firefox-1280x800',
      grep: /@cross-engine/,
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'mobile-webkit-390x844',
      grep: /@cross-engine/,
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});

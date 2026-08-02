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
  ],
});

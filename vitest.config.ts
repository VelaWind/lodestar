import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Test config, deliberately separate from `vite.config.ts`.
 *
 * It was split off when Vitest brought its own, newer Vite along, whose Rollup
 * types disagreed about the shape of `build.rollupOptions.output.manualChunks`,
 * so declaring `test` inside the production config made the production config
 * stop typechecking. Since the project moved to Vite 6, Vitest uses the
 * project's own Vite and that clash is gone. The split stays because the
 * shipped build config is then untouched by the test runner, which is the
 * right way round anyway.
 *
 * The only thing duplicated is the `@` alias, and `tests/paths.test.ts` would be
 * the wrong cure for a three-line repeat: if the alias here were wrong, every
 * test would fail to resolve on the first import.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The build generates this module (scripts/manifestPlugin.ts); the tests
      // compute the same manifest from the registry.
      'virtual:lodestar-manifest': fileURLToPath(
        new URL('./tests/helpers/manifest.ts', import.meta.url),
      ),
    },
  },
  test: {
    // No DOM by default. Every sim's drawing is a pure function of a scene and
    // a canvas size, so the canvas tests hand it a recording stub rather than a
    // real context, and the rest of the `.test.ts` files never touch a document,
    // which keeps them fast. The component tests (`.test.tsx`) render React and
    // opt into jsdom one file at a time with an `@vitest-environment jsdom`
    // comment; `tests/helpers/dom.ts` stubs the browser APIs jsdom lacks.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});

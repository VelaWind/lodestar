import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Test config, deliberately separate from `vite.config.ts`.
 *
 * Vitest brings its own, newer Vite along, and the two versions' Rollup types
 * disagree about the shape of `build.rollupOptions.output.manualChunks` — so
 * declaring `test` inside the production config makes the production config stop
 * typechecking. Keeping them apart means the shipped build config is untouched
 * by the test runner, which is the right way round anyway.
 *
 * The only thing duplicated is the `@` alias, and `tests/paths.test.ts` would be
 * the wrong cure for a three-line repeat: if the alias here were wrong, every
 * test would fail to resolve on the first import.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // No DOM. Every sim's drawing is a pure function of a scene and a canvas
    // size, so the canvas tests hand it a recording stub rather than a real
    // context, and nothing else in the suite touches a document — which keeps
    // the run fast and jsdom out of the dependency tree entirely.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

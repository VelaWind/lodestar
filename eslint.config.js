/**
 * The linter this repo has been pretending to have.
 *
 * Twenty-six `// eslint-disable-next-line` comments were committed across the
 * tree before any ESLint existed — inherited habit, silencing a tool that was
 * never going to speak. This config is the tool, and the scope is deliberately
 * narrow: type-aware correctness rules and the hooks rules, nothing about how
 * code is spaced. Formatting churn would bury real findings in a diff nobody
 * reads, and the repo has no formatter to arbitrate it.
 *
 * The one editorial rule is `no-console`, and it is set per-area rather than
 * globally, because "never log" is false here in three different ways:
 *
 *   - `src/` ships to a reader's browser, so a stray log is a defect.
 *   - `tests/` and `scripts/` print on purpose — the QA suite's whole design
 *     is to report what a page said before asserting it said nothing broken,
 *     and the build plugin announces the files it wrote.
 *   - `src/physics/sanity.ts` logs by design in the shipped bundle: it is the
 *     dev-time sanity suite whose entire output is console blocks, which the
 *     README documents as the thing `npm run dev` shows you.
 *
 * The two remaining logs in `src/` are guarded by `import.meta.env.DEV` and
 * carry a per-line disable naming that guard, so the exemption is visible at
 * the call site rather than granted wholesale to their files.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    // Build output, QA artefacts and the editor's own directory. Linting
    // `dist/` would lint a bundler's output, which is nobody's code.
    ignores: [
      'dist/**',
      'node_modules/**',
      'qa-screenshots/**',
      'qa-audio/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `configs.flat[...]`, not `configs[...]`: the plugin still ships both, and
  // the top-level entries are the eslintrc shape whose `plugins` is an array
  // of strings. Flat config wants the plugin object, and says so at length.
  reactHooks.configs.flat['recommended-latest'],

  {
    rules: {
      /*
       * On by default in `js.configs.recommended` and wrong for TypeScript:
       * the compiler already rejects an undefined identifier, and the rule
       * does not know about types, so it reports every global this project
       * legitimately uses (`HTMLCanvasElement`, `AudioContext`, `process`).
       * `tsc --noEmit` runs immediately before lint in CI and locally.
       */
      'no-undef': 'off',

      /*
       * Unused *arguments* are how a callback documents the signature it is
       * given, and unused caught errors are how a `catch` says "any failure
       * here is fine". Both are legitimate; an unused local variable is not.
       * `noUnusedLocals`/`noUnusedParameters` in tsconfig cover the rest.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Shipped code. A log that reaches a reader's console is a defect.
      'no-console': 'error',
    },
  },

  {
    /*
     * The dev-time sanity suite. Its output *is* the feature: eight blocks of
     * recomputed physics printed on load, which is what `npm run dev` is
     * documented to show. Excepted here rather than with two inline comments
     * because the exemption belongs to the file's purpose, not to two lines
     * that happen to call `console`.
     */
    files: ['src/physics/sanity.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    /*
     * Tests and build tooling report as they go, by design. The QA suite
     * prints every page's console tally before asserting it is clean, the
     * canvas replay prints what it drew, and the route-head plugin announces
     * the files it wrote. Silencing those would make a failing run harder to
     * read for no gain.
     */
    files: ['tests/**/*.{ts,tsx,mjs}', 'scripts/**/*.{ts,mjs}', '*.config.{ts,js,mjs}'],
    rules: { 'no-console': 'off' },
  },
);

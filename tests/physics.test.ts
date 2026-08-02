/**
 * The physics sanity suite, as assertions.
 *
 * `src/physics/sanity.ts` has run on every dev boot since the first module and
 * has caught real errors, but a check that only writes to a console is a check
 * nobody sees fail in CI. It now returns its results as well as logging them,
 * and this file turns each one into a test — the same functions, the same
 * numbers, the same tolerances, asserted instead of printed.
 *
 * Each block is run once at collection time so that every individual check
 * becomes its own named test: a failure names the physics that broke rather than
 * "the physics suite".
 */
import { describe, expect, it } from 'vitest';
import {
  runSanityChecks,
  verifyBlackHoleModel,
  verifyEscapeIntegrator,
  verifyGravitationalWaveModel,
  verifyKeplerModel,
  verifyScaleLadder,
  verifyTransitModel,
  type CheckBlock,
} from '@/physics/sanity';

/**
 * The blocks, with the number of checks each is expected to contain.
 *
 * The counts are asserted so a check cannot be quietly deleted: dropping one
 * would otherwise turn into a green run with less coverage, which is the failure
 * mode a test suite exists to prevent. Adding a check means updating the number
 * here, deliberately.
 */
const BLOCKS: { run: () => CheckBlock; checks: number }[] = [
  { run: runSanityChecks, checks: 5 },
  { run: verifyEscapeIntegrator, checks: 1 },
  { run: verifyKeplerModel, checks: 3 },
  { run: verifyScaleLadder, checks: 3 },
  { run: verifyBlackHoleModel, checks: 5 },
  { run: verifyGravitationalWaveModel, checks: 5 },
  { run: verifyTransitModel, checks: 6 },
];

/** Runs a block without its console output, which CI does not need to read. */
function quietly(run: () => CheckBlock): CheckBlock {
  const { info, warn } = console;
  console.info = () => {};
  console.warn = () => {};
  try {
    return run();
  } finally {
    console.info = info;
    console.warn = warn;
  }
}

for (const { run, checks } of BLOCKS) {
  const block = quietly(run);

  describe(block.title, () => {
    it(`runs ${checks} checks`, () => {
      expect(block.results).toHaveLength(checks);
    });

    for (const result of block.results) {
      // The console line is the assertion message: a failure in CI prints the
      // same computed-vs-expected detail a developer sees in the browser.
      it(result.name, () => {
        expect(result.passed, `\n${result.line}\n`).toBe(true);
      });
    }
  });
}

describe('suite integrity', () => {
  it('has 28 checks across seven blocks', () => {
    const total = BLOCKS.reduce((n, b) => n + b.checks, 0);
    expect(total).toBe(28);
    expect(BLOCKS).toHaveLength(7);
  });

  it('still logs one console message per block', () => {
    // The dev-console behaviour is the reason these functions exist at all, and
    // returning results was not allowed to cost it. This asserts the message is
    // still emitted, and still starts the way the browser console shows it.
    const messages: unknown[] = [];
    const { info, warn } = console;
    console.info = (...args: unknown[]) => messages.push(args[0]);
    console.warn = (...args: unknown[]) => messages.push(args[0]);
    try {
      for (const { run } of BLOCKS) run();
    } finally {
      console.info = info;
      console.warn = warn;
    }

    expect(messages).toHaveLength(BLOCKS.length);
    for (const message of messages) {
      expect(String(message).startsWith('[lodestar] ')).toBe(true);
    }
  });
});

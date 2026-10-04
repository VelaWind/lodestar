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
  verifyAtmosphereModel,
  verifyBlackHoleModel,
  verifyCmbModel,
  verifyEarlyUniverseModel,
  verifyCosmologyModel,
  verifyEscapeIntegrator,
  verifyFusionModel,
  verifyGravitationalWaveModel,
  verifyHabitableModel,
  verifyKeplerModel,
  verifyLadderModel,
  verifyNebulaModel,
  verifyRelativityModel,
  verifyHawkingModel,
  verifyWormholeModel,
  verifyNeutronStarModel,
  verifyDarkMatterModel,
  verifyGalaxyModel,
  verifyScaleLadder,
  verifySupernovaModel,
  verifyTransitModel,
  type CheckBlock,
} from '@/physics/sanity';
import { besselI0, besselI1, besselK0, besselK1, discSpeed, discSpeedTabulated } from '@/physics/darkmatter';
import { KILOPARSEC, M_SUN } from '@/physics/constants';

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
  { run: verifyAtmosphereModel, checks: 5 },
  { run: verifyCosmologyModel, checks: 7 },
  { run: verifyCmbModel, checks: 9 },
  { run: verifyEarlyUniverseModel, checks: 9 },
  { run: verifyFusionModel, checks: 8 },
  { run: verifySupernovaModel, checks: 9 },
  { run: verifyHabitableModel, checks: 11 },
  { run: verifyNebulaModel, checks: 7 },
  { run: verifyLadderModel, checks: 12 },
  { run: verifyRelativityModel, checks: 12 },
  { run: verifyHawkingModel, checks: 10 },
  { run: verifyWormholeModel, checks: 11 },
  { run: verifyNeutronStarModel, checks: 15 },
  { run: verifyDarkMatterModel, checks: 17 },
  { run: verifyGalaxyModel, checks: 12 },
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
  it('has 182 checks across twenty-two blocks', () => {
    const total = BLOCKS.reduce((n, b) => n + b.checks, 0);
    expect(total).toBe(182);
    expect(BLOCKS).toHaveLength(22);
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

/**
 * The modified Bessel functions under the dark-matter disc, against a table.
 *
 * The sanity block checks one value of each; this checks all four across the
 * range the disc reaches, both sides of K's switch from series to integral at
 * x = 2, and near zero, where K₀ and K₁ diverge. Reference values are mpmath's
 * (mp.besseli, mp.besselk, computed at 30 digits, written to 15), which agree
 * with Abramowitz & Stegun, Table 9.8, wherever that table prints them. The
 * bound is 10⁻⁹ relative; the functions in fact agree to about 10⁻¹⁵.
 */
describe('modified Bessel functions', () => {
  // x: [I₀, I₁, K₀, K₁]
  const TABLE: [number, [number, number, number, number]][] = [
    [0.01, [1.00002500015625, 0.00500006250026042, 4.72124473016109, 99.9738941182962]],
    [0.1, [1.0025015629341, 0.0500625260470927, 2.42706902470202, 9.85384478087061]],
    [0.5, [1.06348337074132, 0.257894305390896, 0.924419071227666, 1.6564411200033]],
    [1, [1.26606587775201, 0.565159103992485, 0.421024438240708, 0.601907230197235]],
    [1.08, [1.31355908756434, 0.622652725048132, 0.375965672884565, 0.526683482859245]],
    [2, [2.27958530233607, 1.59063685463733, 0.113893872749533, 0.139865881816522]],
    [2.5, [3.28983914405012, 2.5167162452887, 0.0623475532003662, 0.0738908163477471]],
    [5, [27.2398718236044, 24.3356421424505, 0.00369109833404259, 0.00404461344545216]],
    [10, [2815.71662846625, 2670.98830370125, 1.77800623161677e-5, 1.86487734538256e-5]],
    [20, [43558282.5595535, 42454973.3851278, 5.74123781533652e-10, 5.88305796955704e-10]],
  ];
  const functions = [besselI0, besselI1, besselK0, besselK1];
  const names = ['I₀', 'I₁', 'K₀', 'K₁'];

  for (const [x, expected] of TABLE) {
    it(`matches the table at x = ${x}`, () => {
      functions.forEach((f, i) => {
        const relative = Math.abs(f(x) / expected[i]! - 1);
        expect(relative, `${names[i]}(${x}) = ${f(x)}, table ${expected[i]}`).toBeLessThan(1e-9);
      });
    });
  }

  /*
   * The drawing's disc speeds come from a cached table of the disc's shape,
   * the readouts' from the functions above. Across every radius the sim can
   * draw (0.15 to 30 kpc) at every scale length its slider reaches (1 to 8 kpc),
   * and past both ends of the table, they agree to a part in a million.
   */
  it('tabulates the disc speed to a part in a million', () => {
    let worst = 0;
    for (let rd = 1; rd <= 8; rd += 0.35) {
      for (let r = 0.01; r <= 60; r *= 1.013) {
        const exact = discSpeed(r * KILOPARSEC, 6.3e10 * M_SUN, rd * KILOPARSEC);
        const table = discSpeedTabulated(r * KILOPARSEC, 6.3e10 * M_SUN, rd * KILOPARSEC);
        worst = Math.max(worst, Math.abs(table / exact - 1));
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });
});

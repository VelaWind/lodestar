/**
 * What every sanity block shares: the two tolerances, the result types, and
 * the helpers that build a result and log a block. Moved here unchanged from
 * the single `sanity.ts` when it was split by topic; see `./index.ts`.
 */

/**
 * Default tolerance. The skill states ±0.1% for the orbital period, and the
 * same precision is achievable for escape velocity.
 */
export const TIGHT = 0.001;

/**
 * Relaxed tolerance for the three checks whose expected value the skill states
 * as "about" — 0.53°, 2.95 km, 8 minutes 20 seconds. Those are quoted to two or
 * three significant figures, so demanding 0.1% would be testing the rounding of
 * the target rather than the correctness of the computation.
 */
export const LOOSE = 0.01;

/** Fractional difference between computed and expected. */
export function relativeError(computed: number, expected: number): number {
  return (computed - expected) / expected;
}

export function significant(value: number): string {
  return Number(value.toPrecision(6)).toString();
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/**
 * One check's outcome.
 *
 * `line` is the exact string the dev console prints, carried on the result
 * rather than rebuilt by the caller. The browser output and the committed test
 * suite therefore read the same characters, and a check cannot pass in one place
 * while reporting something else in the other.
 */
export interface CheckResult {
  name: string;
  passed: boolean;
  /** Computed against expected, without the PASS/FAIL prefix. */
  detail: string;
  /** The console line, verbatim. */
  line: string;
}

/** A group of checks that logs as a single console message. */
export interface CheckBlock {
  title: string;
  results: CheckResult[];
  failures: number;
}

export function head(name: string, formula: string, detail: string, passed: boolean): string {
  return `${passed ? 'PASS' : 'FAIL'}  ${name}\n      ${formula}\n      ${detail}`;
}

/** A check stated as a tolerance on a relative error. */
export function toleranced(
  name: string,
  formula: string,
  detail: string,
  error: number,
  tolerance: number,
): CheckResult {
  const passed = Math.abs(error) <= tolerance;
  return {
    name,
    passed,
    detail,
    line:
      `${head(name, formula, detail, passed)}` +
      `  ·  Δ ${(error * 100).toFixed(4)}%` +
      `  ·  tolerance ±${(tolerance * 100).toFixed(1)}%`,
  };
}

/** A check stated as a plain predicate: an order of magnitude, a range, an ordering. */
export function asserted(name: string, formula: string, detail: string, passed: boolean): CheckResult {
  return { name, passed, detail, line: head(name, formula, detail, passed) };
}

/** Logs a block exactly as it has always been logged, and returns it. */
export function emit(title: string, results: CheckResult[]): CheckBlock {
  const failures = results.reduce((n, r) => n + (r.passed ? 0 : 1), 0);
  const summary = `${title} — ${results.length - failures}/${results.length} passed`;

  console[failures > 0 ? 'warn' : 'info'](
    `[lodestar] ${summary}\n${results.map((r) => r.line).join('\n')}`,
  );

  return { title, results, failures };
}

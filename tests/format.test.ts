/**
 * The slider value a reader sees and hears: `formatWithUnit`.
 *
 * Every band of the 'auto' notation, both signs, the edges between bands, and
 * the rounding that carries a value across an edge; 'fixed' at its exact
 * decimals; 'scientific' outside its plain band. The one rule over all of it:
 * no JavaScript e-notation and no hyphen-minus ever reach the page.
 */
import { describe, expect, it } from 'vitest';
import type { Param, ParamFormat } from '@/content/types';
import { formatWithUnit, siValueToTex } from '@/lib/format';

/** A minimal param with the given format and unit, display = SI unless a displayUnit is given. */
function param(format: ParamFormat, unit = 'u'): Param {
  return {
    id: 'x',
    friendlyLabel: 'x',
    technicalLabel: 'x',
    symbol: 'x',
    unit,
    min: -1e30,
    max: 1e30,
    default: 0,
    step: 1,
    scale: 'linear',
    format,
  };
}

const auto3 = param({ notation: 'auto', digits: 3 });
const show = (p: Param, v: number) => formatWithUnit(p, v);

describe('formatWithUnit, auto notation', () => {
  it('leaves the plain band as it was', () => {
    expect(show(auto3, 548.2)).toBe('548 u');
    expect(show(auto3, 1)).toBe('1 u');
    expect(show(auto3, 0.0123)).toBe('0.0123 u');
    expect(show(auto3, 9990)).toBe('9990 u');
    expect(show(auto3, -548.2)).toBe('−548 u');
    expect(show(auto3, 0)).toBe('0 u');
  });

  it('writes 10⁴ to 10⁶ in plain digits with separators', () => {
    expect(show(auto3, 162_345)).toBe('162,000 u');
    expect(show(auto3, 1e4)).toBe('10,000 u');
    expect(show(auto3, 26_512)).toBe('26,500 u');
    expect(show(auto3, -162_345)).toBe('−162,000 u');
  });

  it('writes 10⁶ to 10¹⁵ with a number word', () => {
    expect(show(auto3, 1.623e6)).toBe('1.62 million u');
    expect(show(auto3, 15.7e6)).toBe('15.7 million u');
    expect(show(auto3, 3.17e9)).toBe('3.17 billion u');
    expect(show(auto3, 4.2e12)).toBe('4.2 trillion u');
    expect(show(auto3, 999e12)).toBe('999 trillion u');
    expect(show(auto3, -1.623e6)).toBe('−1.62 million u');
  });

  it('writes the far ends as a mantissa times a superscript power of ten', () => {
    expect(show(auto3, 1e49)).toBe('1.00 × 10⁴⁹ u');
    expect(show(auto3, 1e15)).toBe('1.00 × 10¹⁵ u');
    expect(show(auto3, 0.006)).toBe('6.00 × 10⁻³ u');
    expect(show(auto3, -0.006)).toBe('−6.00 × 10⁻³ u');
    expect(show(auto3, -2.5e20)).toBe('−2.50 × 10²⁰ u');
  });

  it('puts a value in the band its rounding carries it into', () => {
    const auto4 = param({ notation: 'auto', digits: 4 });
    expect(show(auto4, 9999.6)).toBe('10,000 u');
    expect(show(auto4, 9999.4)).toBe('9999 u');
    expect(show(auto3, 999_999)).toBe('1 million u');
    expect(show(auto3, 999_499)).toBe('999,000 u');
    expect(show(auto3, 999_999_999)).toBe('1 billion u');
    expect(show(auto3, 0.009999)).toBe('0.01 u');
    expect(show(auto3, 9.996e14)).toBe('1.00 × 10¹⁵ u');
  });

  it('scales by the display unit before choosing a band', () => {
    const ly = param({ notation: 'auto', digits: 3, displayUnit: { unit: 'light-years', factor: 1e-3 } }, 'm');
    expect(show(ly, 1.62e8)).toBe('162,000 light-years');
  });
});

describe('formatWithUnit, fixed notation', () => {
  const fixed3 = param({ notation: 'fixed', digits: 3, displayUnit: { unit: 'mag', factor: 1 } }, '');
  it('always shows exactly the requested decimals', () => {
    expect(show(fixed3, 0)).toBe('0.000 mag');
    expect(show(fixed3, 0.175)).toBe('0.175 mag');
    expect(show(fixed3, -0.3)).toBe('−0.300 mag');
    expect(show(fixed3, -0.00001)).toBe('0.000 mag');
  });
});

describe('formatWithUnit, scientific notation', () => {
  const sci3 = param({ notation: 'scientific', digits: 3 }, 'kg');
  it('keeps the plain band and uses superscripts outside it', () => {
    expect(show(sci3, 1.7)).toBe('1.70 kg');
    expect(show(sci3, 5.972e24)).toBe('5.97 × 10²⁴ kg');
    expect(show(sci3, 3e-5)).toBe('3.00 × 10⁻⁵ kg');
  });
});

describe('formatWithUnit, the rule over all of it', () => {
  it('never prints an e-exponent or a hyphen-minus', () => {
    const formats: ParamFormat[] = [
      { notation: 'auto', digits: 3 },
      { notation: 'auto', digits: 1 },
      { notation: 'fixed', digits: 2 },
      { notation: 'scientific', digits: 3 },
    ];
    for (const format of formats) {
      for (let e = -30; e <= 60; e += 0.37) {
        for (const sign of [1, -1]) {
          const text = show(param(format), sign * 10 ** e);
          expect(text, `${JSON.stringify(format)} at ${sign}e${e.toFixed(2)}`).not.toMatch(/\de[+-]?\d|-/);
        }
      }
    }
  });

  it('leaves the equation path alone', () => {
    // The math layer formats through `siValueToTex`, which still builds LaTeX powers.
    expect(siValueToTex(param({ notation: 'auto', digits: 3 }, 'kg'), 1.9884e30)).toBe(
      '1.99 \\times 10^{30}\\,\\mathrm{kg}',
    );
  });
});

/**
 * Number and unit formatting. Display concerns only — every function here takes
 * SI in and returns a string. Nothing in this file may be used to compute.
 */
import type { Param, ParamFormat } from '@/content/types';
import type { DepthTier } from '@/lib/layers';

const DEFAULT_DIGITS = 3;

/**
 * The skill's plain-decimal display band, in one place: "below 10 000 and above
 * 0.01: plain decimal, sensible significant figures." Returns the plain
 * rendering, or `null` when the value is outside the band and the exponent is
 * the only thing keeping it legible.
 *
 * The band is tested against the value *after* significant-figure rounding,
 * because that is the only number the reader ever sees. At three figures 9999
 * displays as 10000, so it falls outside and renders as 1.00 × 10⁴ alongside its
 * neighbours, rather than being the one plain 10000 on a page where every other
 * one is an exponent. The lower edge works the same way: 0.009999 rounds to
 * 0.0100 and prints plainly.
 *
 * Rounding first and fixing the decimal places second keeps the precision
 * identical to the scientific branch, and stops `toPrecision` escalating to
 * exponential form on its own (it does, at 1000 with 3 digits).
 */
function plainDecimalInBand(value: number, digits: number): string | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toPrecision(digits));
  const abs = Math.abs(rounded);
  if (!(abs >= 0.01 && abs < 1e4)) return null;
  const decimals = Math.min(20, Math.max(0, digits - 1 - Math.floor(Math.log10(abs))));
  return rounded.toFixed(decimals);
}

/**
 * The label a slider shows at a given tier. Curious and Student readers get the
 * plain-language phrasing; Deep readers get the textbook term, rendered next to
 * the symbol by the caller.
 */
export function paramLabel(param: Param, tier: DepthTier): string {
  return tier === 'deep' ? param.technicalLabel : param.friendlyLabel;
}

/** Apply a param's optional displayUnit conversion. Returns SI if there is none. */
export function toDisplay(param: Param, si: number): { value: number; unit: string } {
  const du = param.format?.displayUnit;
  return du ? { value: si * du.factor, unit: du.unit } : { value: si, unit: param.unit };
}

function formatNumber(value: number, fmt: ParamFormat | undefined): string {
  const digits = fmt?.digits ?? DEFAULT_DIGITS;
  const notation = fmt?.notation ?? 'auto';

  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  const useScientific =
    notation === 'scientific' || (notation === 'auto' && (abs >= 1e5 || abs < 1e-3));

  if (useScientific) {
    // Inside the band, an exponent is pure cost: a scale slider parked on a
    // human reads 1.70 m, not 1.70e0 m. This is the same rule `siValueToTex`
    // applies to a substituted equation value, so a slider readout, a bind chip
    // and the number in the formula can no longer disagree about whether a
    // metre-sized quantity needs an exponent. Outside the band nothing changes.
    const plain = plainDecimalInBand(value, digits);
    if (plain !== null) return plain;

    let exp = Math.floor(Math.log10(abs));
    const places = Math.max(0, digits - 1);
    // Rounding the mantissa can carry it up to 10 — 9999 at three figures — and
    // "10.00e3" is not scientific notation. Renormalize when that happens.
    if (Math.abs(Number((value / 10 ** exp).toFixed(places))) >= 10) exp += 1;
    return `${(value / 10 ** exp).toFixed(places)}e${exp}`;
  }
  if (notation === 'fixed') return value.toFixed(digits);
  // 'auto' in the human range: significant digits, trailing zeros trimmed.
  return Number(value.toPrecision(digits)).toString();
}

/** "6.37e6" — value only, no unit. */
export function formatValue(param: Param, si: number): string {
  const { value } = toDisplay(param, si);
  return formatNumber(value, param.format);
}

/** "6.37e6 m" — value and unit, for sliders and readouts. */
export function formatWithUnit(param: Param, si: number): string {
  const { value, unit } = toDisplay(param, si);
  const n = formatNumber(value, param.format);
  return unit ? `${n} ${unit}` : n;
}

/* ------------------------------- LaTeX output ------------------------------- */

/** `1.23e5` → `1.23 \times 10^{5}` so KaTeX renders it as real scientific notation. */
export function numberToTex(text: string): string {
  const match = /^(-?[\d.]+)e([+-]?\d+)$/.exec(text);
  if (!match) return text;
  const [, mantissa, exp] = match;
  const m = mantissa === '1' ? '' : `${mantissa} \\times `;
  return `${m}10^{${Number(exp)}}`;
}

/** Wrap a plain unit string as upright LaTeX: `m/s` → `\mathrm{m/s}` */
export function unitToTex(unit: string): string {
  if (!unit) return '';
  return `\\,\\mathrm{${unit.replace(/\s+/g, '\\,')}}`;
}

/**
 * Full LaTeX for a param's current value as substituted into an equation, e.g.
 * `5.97 \times 10^{24}\,\mathrm{kg}`.
 *
 * SI base units always, ignoring `displayUnit`: an equation with its values
 * filled in has to stay dimensionally consistent, and a friendlier readout unit
 * (v₀ as 8 km/s beside G in m³kg⁻¹s⁻²) would make the arithmetic on the page
 * wrong by a factor of a thousand. Notation is scientific outside the skill's
 * plain-decimal band and plain inside it; the two exemptions are below.
 */
export function siValueToTex(param: Param, si: number): string {
  // A dimensionless param — eccentricity, an albedo, any pure ratio — is exempt
  // from both halves of that rule, because neither half applies to it: there is
  // no unit to keep consistent and no \mathrm to set upright. Forcing scientific
  // notation on it only makes an ordinary number harder to read; an eccentricity
  // is 0.0167 in every textbook, on the slider the reader just dragged, and here.
  if (!param.unit) {
    const digits = param.format?.digits ?? DEFAULT_DIGITS;
    if (!Number.isFinite(si)) return formatNumber(si, param.format);
    // toPrecision rather than formatNumber's 'auto', which escalates to
    // scientific below 1e-3 — exactly what this branch exists to avoid.
    return param.format?.notation === 'fixed'
      ? si.toFixed(digits)
      : Number(si.toPrecision(digits)).toString();
  }

  // Inside the skill's own display band — "below 10 000 and above 0.01: plain
  // decimal, sensible significant figures" — scientific notation is pure cost.
  // A scale slider parked on a human reads 1.70 m, not 1.70 × 10⁰ m. Outside the
  // band the exponent is the only thing keeping the number legible, so it stays.
  // `plainDecimalInBand` owns that rule for the whole file; `formatNumber`
  // applies the identical test, so the equation and its slider agree.
  const digits = param.format?.digits ?? DEFAULT_DIGITS;
  const plain = plainDecimalInBand(si, digits);
  if (plain !== null) return `${plain}${unitToTex(param.unit)}`;

  const text = formatNumber(si, { ...param.format, notation: 'scientific' });
  return `${numberToTex(text)}${unitToTex(param.unit)}`;
}

/* -------------------------------- log sliders ------------------------------- */

/**
 * Log-scaled params drive the slider in log10 space so a mass range spanning
 * ten decades has usable resolution at both ends. `valueToPosition` and
 * `positionToValue` are exact inverses across the domain; the slider element
 * only ever sees the "position" domain.
 *
 * log10 is undefined at and below zero, so the domain has to be strictly
 * positive. A log param whose `min` is <= 0 is an authoring error — it would
 * otherwise hand the range input `min={-Infinity}` (or NaN), which silently
 * disables the slider rather than failing loudly.
 */
const LOG_FALLBACK_FLOOR = 1e-12;

function logDomain(param: Param): { lo: number; hi: number } {
  if (param.min > 0) {
    return { lo: param.min, hi: param.max > param.min ? param.max : param.min * 10 };
  }
  if (import.meta.env.DEV) {
    console.warn(
      `[lodestar] Param "${param.id}" is scale:'log' but min=${param.min}. ` +
        `A log axis cannot include zero or negative values; clamping the domain ` +
        `to [${LOG_FALLBACK_FLOOR}, …]. Give it a positive min, or use scale:'linear'.`,
    );
  }
  const lo = LOG_FALLBACK_FLOOR;
  return { lo, hi: param.max > lo ? param.max : lo * 10 };
}

export function valueToPosition(param: Param, si: number): number {
  if (param.scale !== 'log') return si;
  const { lo, hi } = logDomain(param);
  // Clamp into the domain *before* the log, so a non-positive, non-finite or
  // out-of-range value lands at an end stop instead of at -Infinity/NaN. A NaN
  // here would otherwise reach the range input and blank the thumb.
  const safe = Number.isFinite(si) ? si : lo;
  return Math.log10(Math.min(hi, Math.max(safe, lo)));
}

export function positionToValue(param: Param, pos: number): number {
  return param.scale === 'log' ? 10 ** pos : pos;
}

/**
 * The most keyboard steps a slider may take to cross its whole range.
 *
 * An arrow key moves a range input by exactly one `step`. The scale ladder spans
 * 41.9 decades and authors its step as 0.01 decades, which is 4,194 presses from
 * one end to the other — reachable in principle and unusable in practice, which
 * is the same thing as not being operable. Two hundred steps is the granularity
 * a native `0..100` slider has, and at any realistic track width it is still
 * finer than one pixel of travel, so pointer users lose nothing: 200 steps over
 * a 254px track is 1.3px per step.
 */
const MAX_KEYBOARD_STEPS = 200;

export function sliderBounds(param: Param): { min: number; max: number; step: number } {
  if (param.scale === 'log') {
    const { lo, hi } = logDomain(param);
    const min = Math.log10(lo);
    const max = Math.log10(hi);
    return {
      min,
      max,
      // Authored in decades, floored at a step a keyboard can actually walk.
      step: Math.max(param.step, (max - min) / MAX_KEYBOARD_STEPS),
    };
  }
  return { min: param.min, max: param.max, step: param.step };
}

export function clampToParam(param: Param, si: number): number {
  return Math.min(param.max, Math.max(param.min, si));
}

/**
 * Every slider's default is a stop.
 *
 * A range input stops only at `min + k·step`, counted from the element's own
 * min. `sliderInputAttrs` anchors that grid on the default by pushing the
 * element's min and max outward by less than one step; `valueFromSliderPosition`
 * clamps the overshoot back to the real range. These checks run over every
 * param of every module, so a new module or a retuned range cannot quietly put
 * a default back between stops.
 */
import { describe, expect, it } from 'vitest';
import { moduleList } from '@/content/registry';
import {
  reachesTop,
  sliderBounds,
  sliderInputAttrs,
  sliderInputPosition,
  valueFromSliderPosition,
  valueToPosition,
} from '@/lib/format';

const cases = moduleList.flatMap((module) =>
  module.layers.play.params.map((param) => ({ label: `${module.id}/${param.id}`, param })),
);

describe('default-anchored slider stops', () => {
  it('covers every param of all eighteen modules', () => {
    expect(moduleList).toHaveLength(18);
    expect(cases.length).toBeGreaterThan(40);
  });

  it.each(cases)('$label', ({ param }) => {
    const { min, max, step: s, pMin, pMax } = sliderInputAttrs(param);
    const pDef = valueToPosition(param, param.default);

    // The default is a whole number of steps from the element's min.
    const k = (pDef - min) / s;
    expect(Math.abs(k - Math.round(k)), 'default off the stops').toBeLessThan(1e-6);

    // Each end overshoots by less than one step, never undershoots.
    expect(min).toBeLessThanOrEqual(pMin);
    expect(pMin).toBeLessThan(min + s);
    expect(pMax).toBeLessThanOrEqual(max);
    expect(max).toBeLessThan(pMax + s);

    // The overshoot clamps back to the authored bounds exactly.
    expect(valueFromSliderPosition(param, min)).toBe(param.min);
    expect(valueFromSliderPosition(param, max)).toBe(param.max);
    // And the default's own stop gives the authored default exactly.
    expect(valueFromSliderPosition(param, pDef)).toBe(param.default);

    // The step is the authored one, shrunk by at most a part in 10¹², and with
    // it the browser can count all the way to the element's max.
    const authored = sliderBounds(param).step;
    expect(Math.abs(s - authored)).toBeLessThanOrEqual(authored * 1.0001e-12);
    expect(reachesTop(min, max, s, Math.round((max - min) / s)), 'top stop unreachable').toBe(true);

    // At either real end the element is handed its own end stop, never a
    // position the browser would round inward.
    expect(sliderInputPosition(param, param.min)).toBe(min);
    expect(sliderInputPosition(param, param.max)).toBe(max);
  });
});

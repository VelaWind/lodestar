/**
 * The learning path against the registry.
 *
 * Every module has exactly one place on the path, and the path names nothing
 * the registry lacks: so a new module fails here until it is given a place in
 * `src/content/path.ts`, and a renamed one fails until the path follows.
 */
import { describe, expect, it } from 'vitest';
import { LEARNING_PATH, PATH_STEPS, pathPlace } from '@/content/path';
import { modules } from '@/content/registry';

const pathIds = LEARNING_PATH.flatMap((stage) => stage.modules);
const registryIds = Object.keys(modules);

describe('learning path', () => {
  it('places every module in the registry exactly once', () => {
    const missing = registryIds.filter((id) => !pathIds.includes(id));
    const repeated = pathIds.filter((id, i) => pathIds.indexOf(id) !== i);
    expect(missing).toEqual([]);
    expect(repeated).toEqual([]);
  });

  it('names only modules that exist', () => {
    expect(pathIds.filter((id) => !(id in modules))).toEqual([]);
  });

  it('numbers its steps 1 to N with no gaps, N the number of modules', () => {
    expect(PATH_STEPS.map((s) => s.step)).toEqual(registryIds.map((_, i) => i + 1));
    expect(PATH_STEPS.map((s) => s.id)).toEqual(pathIds);
  });

  it('has short stage titles, one-sentence descriptions, and no empty stage', () => {
    for (const stage of LEARNING_PATH) {
      expect(stage.modules.length).toBeGreaterThan(0);
      expect(stage.title.split(/\s+/).length).toBeLessThanOrEqual(6);
      expect(stage.description).toMatch(/^[A-Z][^.]*\.$/);
    }
  });

  it('links each step to its neighbours, and the last back to the start', () => {
    const first = PATH_STEPS[0]!;
    const last = PATH_STEPS[PATH_STEPS.length - 1]!;
    expect(pathPlace(first.id)).toMatchObject({ step: 1, previous: undefined, next: PATH_STEPS[1]!.id, wraps: false });
    expect(pathPlace(last.id)).toMatchObject({
      step: PATH_STEPS.length,
      previous: PATH_STEPS[PATH_STEPS.length - 2]!.id,
      next: first.id,
      wraps: true,
    });
    for (const { id, step, stageIndex } of PATH_STEPS) {
      const place = pathPlace(id)!;
      expect(place.step).toBe(step);
      expect(place.total).toBe(registryIds.length);
      expect(place.stage).toBe(LEARNING_PATH[stageIndex]);
    }
    expect(pathPlace('no-such-module')).toBeUndefined();
  });
});

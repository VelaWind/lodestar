/**
 * The learning path against the registry.
 *
 * Every module has exactly one place on the path, and the path names nothing
 * the registry lacks: so a new module fails here until it is given a place in
 * `src/content/path.ts`, and a renamed one fails until the path follows.
 */
import { describe, expect, it } from 'vitest';
import { LEARNING_PATH, PATH_STEPS, PREREQUISITES, pathPlace } from '@/content/path';
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

  it('declares prerequisites for every module, all existing and all earlier on the path', () => {
    const at = new Map(PATH_STEPS.map((s) => [s.id, s.step]));
    expect(Object.keys(PREREQUISITES).sort(), 'one entry per module, no strays').toEqual([...registryIds].sort());
    const problems: string[] = [];
    for (const [id, needs] of Object.entries(PREREQUISITES)) {
      for (const need of needs) {
        if (!(need in modules)) problems.push(`${id} needs "${need}", which is not a module`);
        else if (need === id) problems.push(`${id} lists itself`);
        else if (at.get(need)! >= at.get(id)!) problems.push(`${id} (step ${at.get(id)}) needs ${need} (step ${at.get(need)}), which comes later`);
      }
      if (new Set(needs).size !== needs.length) problems.push(`${id} lists a prerequisite twice`);
    }
    expect(problems).toEqual([]);
  });

  it('has no cycle among the prerequisites', () => {
    // Implied by "every prerequisite is earlier", but checked on its own so a
    // future change to the ordering rule cannot let one in unnoticed.
    const state = new Map<string, 'visiting' | 'done'>();
    const cycle: string[] = [];
    const visit = (id: string, trail: string[]): void => {
      if (state.get(id) === 'done' || cycle.length) return;
      if (state.get(id) === 'visiting') {
        cycle.push(...trail.slice(trail.indexOf(id)), id);
        return;
      }
      state.set(id, 'visiting');
      for (const need of PREREQUISITES[id] ?? []) visit(need, [...trail, id]);
      state.set(id, 'done');
    };
    for (const id of Object.keys(PREREQUISITES)) visit(id, []);
    expect(cycle).toEqual([]);
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

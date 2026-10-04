/**
 * The learning path: a suggested order through every topic for a reader new to
 * physics, in four stages.
 *
 * Kept apart from the modules and their manifest on purpose. It is not a
 * property of any one module, so the module schema stays as it is, and it is
 * only ids: the front page and each module page's footer look up titles and
 * taglines in the manifest, so neither has to load a module to show the path.
 *
 * The order was checked against the modules themselves: no topic leans on an
 * idea that only a later topic explains, unless it explains that idea in place.
 * `tests/path.test.ts` holds it to the registry: every module appears exactly
 * once, so a new module fails the suite until it is given a place here.
 */

export interface PathStage {
  /** A short title, shown as the stage's heading. */
  title: string;
  /** One plain sentence on what the stage covers. */
  description: string;
  /** Module ids, in reading order. */
  modules: readonly string[];
}

/** What the path says about itself, on the front page and under every module. */
export const PATH_NOTE = 'A suggested order for beginners; every topic stands on its own.';

export const LEARNING_PATH: readonly PathStage[] = [
  {
    title: 'How big, how heavy, how fast',
    description: 'The sizes of things in space, and how gravity throws, holds and stretches them.',
    modules: ['scale-of-the-universe', 'escape-velocity', 'kepler-orbits', 'tides'],
  },
  {
    title: 'Stars and their worlds',
    description: 'How stars are born, shine and die, and the planets that circle them.',
    modules: [
      'nebulae',
      'stellar-fusion',
      'exoplanets',
      'planetary-atmospheres',
      'habitable-zone',
      'supernovae',
      'neutron-stars',
    ],
  },
  {
    title: 'Gravity at the extremes',
    description: 'What happens to time and space where gravity is strongest.',
    // Black holes before time dilation: the clock in Time Dilation's second panel is lowered toward one.
    modules: ['black-holes', 'time-dilation', 'gravitational-waves', 'hawking-radiation', 'wormholes'],
  },
  {
    title: 'Galaxies and the whole universe',
    description: 'Galaxies, the matter we cannot see, and the history of the universe itself.',
    modules: [
      'galaxies',
      'dark-matter',
      // Expansion before the ladder: the ladder exists to measure the expansion rate its top rung reaches.
      'expansion-of-the-universe',
      'cosmic-distance-ladder',
      'cosmic-microwave-background',
      'early-universe',
    ],
  },
];

/** One topic's place on the path. */
export interface PathStep {
  id: string;
  /** 1-based, across all stages. */
  step: number;
  /** 0-based index into `LEARNING_PATH`. */
  stageIndex: number;
}

/** Every topic in path order, numbered from 1. */
export const PATH_STEPS: readonly PathStep[] = LEARNING_PATH.flatMap((stage, stageIndex) =>
  stage.modules.map((id) => ({ id, stageIndex })),
).map((entry, i) => ({ ...entry, step: i + 1 }));

const stepById = new Map(PATH_STEPS.map((entry) => [entry.id, entry]));

/**
 * Where a topic sits on the path, with its neighbours: `previous` is absent for
 * the first topic, and the last topic's `next` is the first, back to the start.
 */
export function pathPlace(id: string):
  | { step: number; total: number; stage: PathStage; previous?: string; next: string; wraps: boolean }
  | undefined {
  const entry = stepById.get(id);
  if (!entry) return undefined;
  const total = PATH_STEPS.length;
  const last = entry.step === total;
  return {
    step: entry.step,
    total,
    stage: LEARNING_PATH[entry.stageIndex]!,
    previous: entry.step > 1 ? PATH_STEPS[entry.step - 2]!.id : undefined,
    next: last ? PATH_STEPS[0]!.id : PATH_STEPS[entry.step]!.id,
    wraps: last,
  };
}

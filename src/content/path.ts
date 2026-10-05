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
 *
 * A new module must also declare its prerequisites in `PREREQUISITES` below:
 * the topics a reader is assumed to have met before it, read off its layers
 * 1–4 and its connections ("none" is an empty list). The test fails if a
 * module has no entry, if a prerequisite does not exist, or if one comes later
 * on the path than the module that needs it. What a test cannot judge, a
 * glossary term used before the topic that teaches it, `npm run path:audit`
 * lists for a person to read.
 */

/** A module's id: its file name in `src/content/modules/`, and its URL slug. */
export type ModuleId = string;

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

/**
 * The topics each module assumes a reader has met, read off its layers 1–4 and
 * its connections. Only what the module builds on, not every mention: a
 * passing aside, or an idea the module explains in place, is not a
 * prerequisite. Every one must come earlier on the path (tested).
 */
export const PREREQUISITES: Readonly<Record<ModuleId, readonly ModuleId[]>> = {
  'scale-of-the-universe': [],
  'escape-velocity': [],
  'kepler-orbits': [],
  tides: [],
  nebulae: [],
  'stellar-fusion': [],
  // The transit period comes from Kepler's third law.
  exoplanets: ['kepler-orbits'],
  // A gas leaks away when its fast molecules beat the world's escape speed.
  'planetary-atmospheres': ['escape-velocity'],
  // Planets around other stars, and whether their air can warm them.
  'habitable-zone': ['exoplanets', 'planetary-atmospheres'],
  // A massive star dies when its core fusion runs out at iron.
  supernovae: ['stellar-fusion'],
  // A neutron star is the core a core-collapse supernova leaves behind.
  'neutron-stars': ['supernovae'],
  // A black hole is where the escape speed passes the speed of light.
  'black-holes': ['escape-velocity'],
  // The gravity half lowers a clock toward a black hole.
  'time-dilation': ['black-holes'],
  // The sources are merging black holes.
  'gravitational-waves': ['black-holes'],
  'hawking-radiation': ['black-holes'],
  // Throats are compared with black-hole horizons throughout.
  wormholes: ['black-holes'],
  // Tidal tails are the tidal force at the scale of galaxies.
  galaxies: ['tides'],
  // Rotation curves: galaxies' stars on near-Keplerian orbits that are too fast.
  'dark-matter': ['kepler-orbits', 'galaxies'],
  // The galaxies that recede.
  'expansion-of-the-universe': ['galaxies'],
  // The ladder measures the expansion rate; its top rung is Type Ia supernovae.
  'cosmic-distance-ladder': ['expansion-of-the-universe', 'supernovae'],
  // The glow is light stretched by the expansion.
  'cosmic-microwave-background': ['expansion-of-the-universe'],
  // Runs the expansion backward to before the microwave background was released.
  'early-universe': ['expansion-of-the-universe', 'cosmic-microwave-background'],
};

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

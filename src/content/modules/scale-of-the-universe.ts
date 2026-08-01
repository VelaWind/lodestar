/**
 * Scale of the universe — the third published Lodestar module.
 *
 * Prose is the project author's, encoded here into the rich-text AST verbatim.
 * Emphasis and inline math in the source copy map to `em(...)` and m`...`
 * nodes; nothing is paraphrased. If the copy needs to change, change the copy.
 *
 * Every anchor size that can be derived from `physics/constants.ts` is derived
 * here rather than pasted in, per the physics-accuracy skill's rule against
 * hardcoding a derived number; the four that cannot be derived carry their
 * citation in a comment beside the literal.
 *
 * Adding a module is exactly two files and no shell edits:
 *   1. src/content/modules/<id>.ts   (this file; basename must equal `id`)
 *   2. src/sims/<simKey>.tsx         (default-exports a component taking SimProps)
 */
import type { Module } from '../types';
import {
  AU,
  LIGHT_YEAR,
  OBSERVABLE_UNIVERSE_RADIUS,
  R_EARTH,
  R_SUN,
} from '@/physics/constants';
import { em, m, p, prose } from '../rich';

/* ------------------------------------------------------------------ */
/* Cited inputs                                                        */
/* ------------------------------------------------------------------ */

/*
 * Four sizes on the ladder cannot be built from `constants.ts`, so their inputs
 * sit here with their sources rather than being inlined at the point of use.
 * They are deliberately *not* added to `constants.ts`: that file is for
 * quantities the physics layer computes with, and these are content — figures
 * this module quotes, each with a citation the reader can follow.
 */

/** CODATA 2018 recommended value: proton rms charge radius, 0.8414(19) fm. */
const PROTON_CHARGE_RADIUS = 0.8414e-15; // m
/** CODATA 2018 recommended value: Bohr radius a₀ = 5.291 772 109 03 × 10⁻¹¹ m. */
const BOHR_RADIUS = 5.291_772_109_03e-11; // m
/** OpenStax Anatomy & Physiology 2e §18.3: erythrocytes are about 7.5 µm across. */
const RED_BLOOD_CELL_DIAMETER = 7.5e-6; // m
/** NCD-RisC 2016: global mean adult height, ≈1.70 m (men) / 1.59 m (women). */
const HUMAN_HEIGHT = 1.7; // m
/** NASA Planetary Fact Sheet: Neptune's semi-major axis, 30.07 AU. */
const NEPTUNE_SEMI_MAJOR_AXIS = 30.07 * AU; // m
/** Gaia DR3 parallax 768.07 mas → 1.3020 pc = 4.2465 ly. */
const PROXIMA_DISTANCE = 4.2465 * LIGHT_YEAR; // m
/** Stellar disc, ~100 000 ly across — a convention, see the sizeNote. */
const MILKY_WAY_DIAMETER = 1.0e5 * LIGHT_YEAR; // m

/* ------------------------------------------------------------------ */
/* The ladder                                                          */
/* ------------------------------------------------------------------ */

/**
 * One rung of the scale ladder.
 *
 * This type lives here rather than in `content/types.ts` because the anchors are
 * this module's content, not a shell concept: adding the module must not require
 * editing the shared types. The sim imports both the type and the data from this
 * file.
 */
export interface ScaleAnchor {
  /** Stable key; also selects the sim's vector shape. */
  id: string;
  name: string;
  /** Size in metres. SI, always — the slider and the sim read this directly. */
  size: number;
  /** What the number measures, and what it does not. */
  sizeNote: string;
  /** One sentence against the previous anchor. Empty on the first rung. */
  comparison: string;
  /** Where the figure comes from. */
  source: string;
}

export const scaleAnchors: ScaleAnchor[] = [
  {
    id: 'proton',
    name: 'Proton',
    size: 2 * PROTON_CHARGE_RADIUS,
    sizeNote:
      'Twice the root-mean-square charge radius. A proton has no surface — only a distribution of charge that thins out — so this is a width, not an edge. The radius was contested for a decade: measurements on muonic hydrogen disagreed with electron-based ones by about 4%, the smaller value won, and CODATA 2018 adopted 0.8414 fm.',
    comparison: '',
    source: 'CODATA 2018 recommended values',
  },
  {
    id: 'hydrogen-atom',
    name: 'Hydrogen atom',
    size: 2 * BOHR_RADIUS,
    sizeNote:
      'Twice the Bohr radius — the most probable electron–proton distance in the ground state. The atom has no edge either: the electron cloud falls off exponentially, so any diameter is a convention about where to stop counting.',
    comparison: 'About 63,000 protons would fit across one hydrogen atom.',
    source: 'CODATA 2018 recommended values',
  },
  {
    id: 'red-blood-cell',
    name: 'Red blood cell',
    size: RED_BLOOD_CELL_DIAMETER,
    sizeNote:
      'Diameter of the disc, seen face on. Human erythrocytes run about 6–8 µm and are biconcave rather than spherical, so the thickness is a third of the width.',
    comparison: 'About 71,000 hydrogen atoms across one red blood cell.',
    source: 'OpenStax Anatomy & Physiology 2e, §18.3',
  },
  {
    id: 'human',
    name: 'Human',
    size: HUMAN_HEIGHT,
    sizeNote:
      'Typical adult height. Global mean adult height is close to 1.70 m for men and 1.59 m for women, and has risen over the last century.',
    comparison: 'About 230,000 red blood cells laid end to end.',
    source: 'NCD Risk Factor Collaboration 2016',
  },
  {
    id: 'earth',
    name: 'Earth',
    size: 2 * R_EARTH,
    sizeNote:
      'Mean diameter, twice the mean radius. Earth is an oblate spheroid: the equatorial diameter runs about 43 km larger than the polar one.',
    comparison: 'About 7.5 million people head to toe.',
    source: 'IAU 2015 Resolution B3 nominal terrestrial radius',
  },
  {
    id: 'sun',
    name: 'Sun',
    size: 2 * R_SUN,
    sizeNote:
      'Diameter of the photosphere, twice the nominal solar radius. The Sun has no solid surface; the photosphere is simply where it stops being opaque.',
    comparison: '109 Earths across the Sun.',
    source: 'IAU 2015 Resolution B3 nominal solar radius',
  },
  {
    id: 'neptune-orbit',
    name: 'Neptune’s orbit',
    size: 2 * NEPTUNE_SEMI_MAJOR_AXIS,
    sizeNote:
      'Diameter of the orbit — twice the 30.07 AU semi-major axis. A span of empty space, not an object: the planet at the edge of it is four thousand times smaller than the Sun at the centre.',
    comparison: 'About 6,500 Suns across the orbit.',
    source: 'NASA Planetary Fact Sheet',
  },
  {
    id: 'proxima-centauri',
    name: 'Distance to Proxima Centauri',
    size: PROXIMA_DISTANCE,
    sizeNote:
      'A distance, not a size — the nearest star system, standing in for interstellar scale. Nothing on this rung is an object 4 × 10¹⁶ m across; the ladder switches from measuring things to measuring the gaps between them, and never switches back.',
    comparison: 'About 4,500 Neptune orbits to the nearest star.',
    source: 'Gaia DR3 parallax, 768.07 mas',
  },
  {
    id: 'milky-way',
    name: 'Milky Way disc',
    size: MILKY_WAY_DIAMETER,
    sizeNote:
      'Diameter of the stellar disc, about 100,000 light-years. The edge is a convention: the disc thins out gradually rather than ending, and the stellar halo reaches much further, so published diameters run from roughly 100,000 to 200,000 light-years depending on where the count stops.',
    comparison: 'About 23,500 trips to Proxima Centauri across the galaxy.',
    source:
      'Bland-Hawthorn & Gerhard 2016 (ARA&A 54); the disk edge is convention-dependent and estimates vary.',
  },
  {
    id: 'observable-universe',
    name: 'Observable universe',
    size: 2 * OBSERVABLE_UNIVERSE_RADIUS,
    sizeNote:
      'Comoving diameter — the present-day distance to the edge of what could in principle be seen, about 93 billion light-years. Not a light travel distance: the universe expanded while the light was in transit, which is why a 13.8-billion-year-old universe is far wider than 13.8 billion light-years.',
    comparison: 'About 930,000 Milky Ways across the observable universe.',
    source: 'Planck 2018 results VI, cosmological parameters',
  },
];

const scaleOfTheUniverse: Module = {
  id: 'scale-of-the-universe',
  title: 'Scale of the Universe',
  tagline: 'Ten rungs from a proton to the observable universe, and the ratios between them.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'From a proton to the edge of the visible universe is about forty-two steps — if ',
          'each step means “ten times bigger.” You are standing fifteen steps from the proton.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'You already know how to move through scales: it’s the pinch-zoom on a map. Your ',
          'street, your city, the country, the continent, the whole planet — each gesture ',
          'multiplies, and a dozen of them carry you from your rooftop to all of Earth.',
        ),
        p(
          'This module is that gesture, continued in both directions until it runs out of ',
          'universe. Zoom in past your skin, past cells, past atoms, until you reach the ',
          'smallest things that can still be called things. Zoom out past the planet, past the ',
          'Sun’s neighbourhood, past the galaxy, until you reach the largest thing that can be ',
          'seen at all.',
        ),
        p(
          'The analogy breaks in one place: on the map, every zoom level is crowded with detail. ',
          'In nature, almost every step of the ladder lands in emptiness — the interesting ',
          'objects cluster on a few rungs, with vast stretches of nearly nothing between them.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'scale-of-the-universe',
      caption: prose(
        p(
          'Drag from a proton to everything there is. Each stop offers one honest comparison to ',
          'the stop before, and the readout keeps a running answer to the only question that ',
          'spans the whole ladder: how long would light take to cross this?',
        ),
      ),
      params: [
        {
          id: 's',
          friendlyLabel: 'How big?',
          technicalLabel: 'Scale',
          symbol: 's',
          unit: 'm',
          // A femtometre is below the smallest rung, so the ladder opens with
          // room beneath the proton rather than starting hard against it.
          min: 1e-15,
          max: 2 * OBSERVABLE_UNIVERSE_RADIUS,
          // Start at the human rung: the one size on the ladder the reader
          // already has an intuition for.
          default: HUMAN_HEIGHT,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
      ],
      approximations: [
        'The illustrations are icons, not scale drawings. A proton is a filled circle and a galaxy is an ellipse because the point of each rung is its size, not its appearance; nothing about the shapes carries information.',
        'Two anchors are never shown to relative scale. They cannot be — at 63,000 to one, drawing a proton beside a hydrogen atom at the same magnification would put the proton below a single pixel. The ratio lives in the zoom transition between rungs, not in any one picture.',
        'Quantum objects have no sharp edge. The proton figure is twice a charge radius and the atom figure is twice an orbital expectation value; both are conventions about where a distribution has thinned out enough to stop counting, not measurements of a boundary.',
        'The observable-universe figure is a comoving diameter, not a light travel distance. It is the present-day separation of the most distant matter we could in principle observe — larger than 2 × 13.8 billion light-years because space expanded while that light was in flight.',
        'The galaxy’s edge is a convention. A disc that thins out gradually has no diameter until someone picks a surface-brightness cut, and published values for the Milky Way range over roughly a factor of two.',
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'Each factor of ten in size is an ',
          em('order of magnitude'),
          ' — one rung of the ladder you have been dragging. The ladder here runs about ',
          'forty-two of them, and the sizes on it deserve their fine print.',
        ),
        p(
          'At the bottom, “size” itself goes soft. A proton has no edge; the 1.7 femtometre ',
          'figure is twice its ',
          em('charge radius'),
          ', the statistical spread of its electric charge. An atom is even fuzzier — quoted ',
          'diameters are twice the ',
          em('Bohr radius'),
          ', the most probable distance of the electron in hydrogen. These are definitions as ',
          'much as measurements, and they are the best that can be done for objects without ',
          'surfaces.',
        ),
        p(
          'In the middle, sizes are ordinary facts: a red blood cell near 7.5 micrometres, a ',
          'human at 1.7 metres, Earth at 12,742 kilometres across.',
        ),
        p(
          'At the top, the natural ruler changes from metres to time. A ',
          em('light-year'),
          ' is the distance light covers in a year — about nine and a half trillion kilometres ',
          '— and it carries a built-in reminder: light from Proxima Centauri, 4.2 light-years ',
          'out, shows you that star as it was 4.2 years ago. Every look outward is a look ',
          'backward.',
        ),
        p(
          'The last rung needs the most care. The ',
          em('observable universe'),
          ' is about 93 billion light-years across — yet the universe is 13.8 billion years ',
          'old. The two numbers coexist because space itself has been expanding while the light ',
          'travelled: the galaxies whose ancient light reaches us today have been carried, by ',
          'that expansion, to some 46 billion light-years away by now. And the common ',
          'misconception is in the name: the observable universe is not the universe. It is the ',
          'part from which light has had time to reach us — a horizon, not a wall. What lies ',
          'beyond is larger, possibly without limit, and genuinely unknown.',
        ),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'light-crossing',
          tex: 't \\;=\\; \\dfrac{{{s}}}{c}',
          binds: ['s'],
          note: prose(
            p(
              m`t`,
              ' — time for light to cross the current scale; ',
              m`s`,
              ' — the size you have dialled in (your slider); ',
              m`c`,
              ' — the speed of light. This single relation is the readout beside the sim: it ',
              'turns any size into a time.',
            ),
          ),
        },
        {
          id: 'rungs',
          tex: 'n \\;=\\; \\log_{10}\\!\\left(\\dfrac{{{s}}}{s_p}\\right)',
          binds: ['s'],
          note: prose(
            p(
              m`n`,
              ' — how many factors of ten separate the current scale from the bottom of the ',
              'ladder; ',
              m`s_p`,
              ' — the proton’s 1.68 × 10⁻¹⁵ m, fixed as the reference rung.',
            ),
            p(
              'Worked example (default, the human rung): ',
              m`s`,
              ' = 1.70 m gives ',
              m`t`,
              ' = 5.7 nanoseconds — light crosses you about 176 million times a second — and ',
              m`n`,
              ' = 15.0: you stand fifteen rungs above the proton, with about twenty-seven more ',
              'rising overhead.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The 93-billion-light-year figure is a ',
          em('comoving'),
          ' diameter, and the distinction it rests on is the working vocabulary of cosmology. ',
          'The ',
          em('proper distance'),
          ' to a galaxy — where it is “now” — stretches as space expands; the comoving distance ',
          'factors that expansion out and stays fixed for objects riding the general flow. The ',
          'observable universe’s radius is the comoving distance light could have travelled ',
          'since the beginning: the ',
          em('particle horizon'),
          ', about 46.5 billion light-years by the Planck satellite’s 2018 parameters. The ',
          'naive answer, 13.8 billion light-years, fails because it treats the photon’s journey ',
          'as motion through static space; integrating the travel along an expanding metric is ',
          'what yields the factor of roughly 3.4.',
        ),
        p(
          'Note what the horizon is not. It is not an edge of anything physical, and nothing ',
          'special sits there — an observer on a galaxy at our horizon sees their own ',
          '93-billion-light-year sphere, with us near its rim. Whether the whole universe ',
          'extends far beyond, or infinitely, is open. Planck’s measurements find spatial ',
          'curvature indistinguishable from zero; if the universe does curve back on itself, ',
          'that flatness forces its full extent to be enormously larger than the patch we see, ',
          'and if it is exactly flat and simply connected, it is infinite. No current ',
          'measurement decides this.',
        ),
        p(
          'The bottom of the ladder has its own recent story. The proton’s charge radius was, ',
          'for a decade, the subject of a genuine crisis: measurements using muonic hydrogen in ',
          '2010 came in four percent smaller than the accepted value — a gap of over five ',
          'standard deviations, spawning speculation about new physics. It resolved ',
          'undramatically: re-measurements of ordinary hydrogen converged on the smaller figure, ',
          'and CODATA adopted 0.841 femtometres in 2018. The episode is a working lesson in what ',
          '“the size of the proton” means: not a property read off an object, but the output of ',
          'a measurement scheme — and schemes can disagree.',
        ),
        p(
          'That the ladder’s rungs cluster where they do is not accident either. Atomic sizes ',
          'are set by the balance of electromagnetic attraction against quantum mechanics; ',
          'stellar sizes by gravity against pressure. The structure of the ladder is a map of ',
          'which force wins at which scale — a question this module leaves open and its ',
          'connections pick up.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'kepler-orbits',
          reason:
            'The Neptune rung is not an object but an orbit — this is the clockwork inside that dot.',
        },
        {
          moduleId: 'expansion-of-the-universe',
          reason:
            'Why the visible universe is seven times wider than its age suggests — the expansion that stretches the top rungs of the ladder.',
        },
        {
          moduleId: 'cosmic-distance-ladder',
          reason:
            'These distances are claims. How astronomers actually measure them, rung by rung, is its own story.',
        },
      ],
    },
  },

  references: [
    {
      label: 'CODATA 2018 recommended values of the fundamental constants',
      url: 'https://physics.nist.gov/cuu/Constants/',
      note: 'Proton charge radius and Bohr radius',
    },
    {
      label:
        'Planck Collaboration 2020, “Planck 2018 results. VI. Cosmological parameters”, A&A 641, A6',
      url: 'https://doi.org/10.1051/0004-6361/201833910',
      note: 'Age, horizon size, and curvature in layers 4 and 6',
    },
    {
      label: 'Pohl et al. 2010, “The size of the proton”, Nature 466',
      url: 'https://doi.org/10.1038/nature09250',
      note: 'The muonic-hydrogen measurement in layer 6',
    },
    {
      label: 'Bland-Hawthorn & Gerhard 2016, “The Galaxy in Context”, ARA&A 54',
      url: 'https://doi.org/10.1146/annurev-astro-081915-023441',
      note: 'Milky Way dimensions',
    },
    {
      label:
        'Lineweaver & Davis 2005, “Misconceptions about the Big Bang”, Scientific American 292',
      url: 'https://www.scientificamerican.com/article/misconceptions-about-the-2005-03/',
      note: 'The expansion/horizon confusions layer 6 addresses',
    },
  ],
};

export default scaleOfTheUniverse;

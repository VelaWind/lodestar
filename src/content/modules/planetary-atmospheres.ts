/**
 * Planetary atmospheres — the seventh published Lodestar module.
 *
 * The two figures flagged during authoring are resolved.
 *
 * The H2/CO2 thermal-speed ratio is 4.672, computed through `mostProbableSpeed`
 * for both gases; it depends only on sqrt(44.009/2.016) and so is the same at
 * every temperature the slider reaches. The copy reads "about four and a half
 * times".
 *
 * The Moon's verdict was checked against the sim's own `retentionVerdict` at the
 * module's assigned exosphere temperature, the T slider's 1000 K default: escape
 * speed 2376 m/s against 6·v_th of 3688 m/s for CO2, a ratio of 3.87, which is
 * below the 4.5 floor. All six gases lose there, so "the Moon fails the test for
 * every gas" is what the sim says and the sentence stands as written. The margin
 * is temperature-dependent — the same body reads marginal below about 738 K and
 * retained below about 415 K — which is the point the following paragraph about
 * Mars goes on to make.
 *
 * Prose is the project author's, encoded here into the rich-text AST verbatim.
 * Emphasis and inline math in the source copy map to `em(...)` and m`...`
 * nodes; nothing is paraphrased. If the copy needs to change, change the copy.
 *
 * Adding a module is exactly two files and no shell edits:
 *   1. src/content/modules/<id>.ts   (this file; basename must equal `id`)
 *   2. src/sims/<simKey>.tsx         (default-exports a component taking SimProps)
 */
import type { Module } from '../types';
import { M_EARTH, R_EARTH } from '@/physics/constants';
import { em, m, p, prose } from '../rich';

const planetaryAtmospheres: Module = {
  id: 'planetary-atmospheres',
  title: 'Planetary Atmospheres',
  tagline: 'Whether a world keeps its air is a race between gravity and heat.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Every world is leaking. Earth loses about three kilograms of hydrogen to space each ',
          'second — it is happening now, quietly, over your head.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Put a handful of ping-pong balls in an open box and shake it. The balls bounce at all ',
          'different heights — most stay low, a few leap surprisingly high — and if the shaking ',
          'is vigorous enough, every so often one clears the rim and is gone.',
        ),
        p(
          'An atmosphere is that box. The shaking is heat: the warmer the gas, the faster its ',
          'molecules dart about, and at any moment a few in the swarm are moving far faster than ',
          'the rest. The rim is gravity — a world’s escape threshold. Molecules that happen to be ',
          'in the fast few, headed upward, clear it and never return. Lighter balls bounce higher ',
          'for the same shake, which is the crucial part: light gases ride the shaking faster than ',
          'heavy ones, so a world can hold its heavy gases for eternity while its lightest ones ',
          'drain away.',
        ),
        p(
          'The analogy breaks in one place: the box empties in minutes, because every ball takes ',
          'its turn near the rim. A planet’s air leaks only from its thin uppermost fringe, and ',
          'only from the fastest sliver of molecules there — so the draining takes millions to ',
          'billions of years, a leak measured in geologic time.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'planetary-atmospheres',
      caption: prose(
        p(
          'Build a world — its heft, its size, the temperature where its air meets space — then ',
          'pick a gas and see the race: the spread of molecular speeds against the escape ',
          'threshold. The shaded tail is what leaves.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How heavy is the world?',
          technicalLabel: 'Planet mass',
          symbol: 'M',
          unit: 'kg',
          // 1e22 kg is a shade lighter than the Moon; 1e28 is about five
          // Jupiters, past which a body is a brown dwarf rather than a planet.
          min: 1e22,
          max: 1e28,
          default: M_EARTH,
          step: 0.01, // decades
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'M⊕', factor: 1 / M_EARTH },
          },
        },
        {
          id: 'R',
          friendlyLabel: 'How big is the world?',
          technicalLabel: 'Planet radius',
          symbol: 'R',
          unit: 'm',
          // 1e6 m is smaller than any round body in the Solar System; 1e8 m is
          // larger than Jupiter. Mass and radius are independent sliders on
          // purpose — density is the thing they disagree about, and a reader
          // should be able to build an impossible planet and see what it costs.
          min: 1e6,
          max: 1e8,
          default: R_EARTH,
          step: 0.01,
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'R⊕', factor: 1 / R_EARTH },
          },
        },
        {
          id: 'T',
          // Deliberately not "how hot is it?": this is the temperature of the
          // thin outermost air where escape happens, which on Earth runs some
          // 500–1500 K depending on where the Sun is in its cycle, while the
          // ground sits at 288 K. A label implying the surface would make the
          // slider read as nonsense to anyone who knows the number.
          friendlyLabel: 'How hot is the top of the atmosphere?',
          technicalLabel: 'Exosphere temperature',
          symbol: 'T',
          unit: 'K',
          // 50 K is the outer Solar System; 2500 K is the dayside of a hot
          // Jupiter. 1000 K is a representative value for Earth's thermosphere,
          // not its surface.
          min: 50,
          max: 2500,
          default: 1000,
          step: 0.01,
          scale: 'log',
          format: { notation: 'auto', digits: 3 },
        },
      ],
      approximations: [
        'The verdict is a rule of thumb, not a flux. Real Jeans escape is a rate computed at the exobase — the altitude where a molecule stops colliding on its way out — and it depends *exponentially* on the escape parameter, so a planet does not flip from keeping a gas to losing it at a threshold; it loses it a thousand times faster per unit of λ. The factor-of-six criterion here is the standard pedagogical stand-in for that exponential, and the band between the two thresholds is exactly where it stops answering.',
        'One temperature stands for the whole exosphere. A real one varies with latitude, with local time, and by a factor of three over the solar cycle: Earth’s thermosphere runs about 500 K at solar minimum and 1500 K at maximum, so the same planet sits at different places on this chart depending on the decade.',
        'Only thermal escape is modelled. The mechanisms that actually stripped Mars are missing: hydrodynamic outflow, in which an escaping light gas drags heavier ones with it; solar-wind stripping of an unmagnetised upper atmosphere; sputtering; and impact erosion. That is why a body can fail this criterion and still be airless, and why Mars lost an atmosphere this model says it should have kept — see Going deeper.',
        'Each gas is judged on its own. In a real atmosphere the species interact: hydrogen escaping from a hydrogen-rich upper atmosphere carries heavier molecules along with it, and photochemistry converts one species into another — water is not lost as water, it is split, and the hydrogen leaves.',
        'The planet’s radius is treated as the escape radius. The exobase sits above the surface — several hundred kilometres up on Earth — where gravity is slightly weaker, so a real escape velocity at the escape altitude is a few percent lower than the surface figure used here.',
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'Gas molecules at temperature ',
          m`T`,
          ' move with a spread of speeds — the ',
          em('Maxwell–Boltzmann distribution'),
          ', the curve in the simulation — and the spread’s location depends on two things: ',
          'temperature and the molecule’s mass. Hotter means faster; lighter means faster. A ',
          'hydrogen molecule at a given temperature typically moves about four and a half times as fast as a ',
          'carbon-dioxide molecule, because it weighs a twenty-second as much.',
        ),
        p(
          'Escape happens from the atmosphere’s top — the ',
          em('exosphere'),
          ', the altitude where the air is so thin that a molecule flying upward will likely never ',
          'hit another. From there, any molecule in the distribution’s fast tail that exceeds the ',
          'escape velocity simply leaves. This slow molecular evaporation is ',
          em('Jeans escape'),
          ', and because the tail thins so steeply, a serviceable rule of thumb emerges: a gas ',
          'survives over geologic time when the world’s escape velocity is at least about ',
          em('six times'),
          ' the gas’s typical thermal speed. Below that, the tail is fat enough to drain the ',
          'reservoir.',
        ),
        p(
          'One number in this story is routinely misjudged: the temperature. What matters is not ',
          'the weather at the surface but the temperature at the fringe where escape happens — and ',
          'there, absorbed sunlight makes the thin gas ',
          em('hot'),
          '. Earth’s upper atmosphere runs near a thousand kelvin, hotter than a pizza oven, even ',
          'while you need a coat below.',
        ),
        p(
          'The rule of thumb sorts the Solar System cleanly. Earth holds its nitrogen, oxygen, and ',
          'carbon dioxide with room to spare — but hydrogen and helium sit below the line, which is ',
          'why our air has essentially none of the universe’s two most common gases. The helium in ',
          'a party balloon, once popped, is beginning a one-way trip off the planet. The Moon fails ',
          'the test for every gas and is bare. Titan, barely stronger than the Moon gravitationally ',
          'but brutally cold, keeps a nitrogen atmosphere denser than ours — the pairing this ',
          'site’s escape-velocity module promised. And Jupiter clears the bar even for hydrogen ',
          'itself, which is how it stayed a gas giant.',
        ),
        p(
          'Then there is Mars — which the rule of thumb gets ',
          em('wrong'),
          ', and instructively. Run the sliders at Mars values and carbon dioxide reads as ',
          'marginal-to-retained; the real Mars is nearly airless. The gap is the fingerprint of ',
          'escape routes this simple picture omits, and the going-deeper layer is about them.',
        ),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'thermal-speed',
          tex: 'v_{\\text{th}} \\;=\\; \\sqrt{\\dfrac{2k_B\\,{{T}}}{m}}',
          binds: ['T'],
          note: prose(
            p(
              m`v_{\text{th}}`,
              ' — the most probable molecular speed, the peak of the distribution; ',
              m`T`,
              ' — the exosphere temperature (your slider); ',
              m`k_B`,
              ' — Boltzmann’s constant, the exchange rate between temperature and energy; ',
              m`m`,
              ' — the mass of one molecule of the selected gas (the chips above the chart).',
            ),
          ),
        },
        {
          id: 'retention-criterion',
          tex: 'v_{\\text{esc}} \\;=\\; \\sqrt{\\dfrac{2G\\,{{M}}}{{{R}}}} \\;\\gtrsim\\; 6\\,v_{\\text{th}}',
          binds: ['M', 'R'],
          note: prose(
            p(
              m`v_{\text{esc}}`,
              ' — the escape velocity, computed by the same function the escape-velocity module ',
              'runs on; ',
              m`M`,
              ', ',
              m`R`,
              ' — the world’s mass and radius (your sliders). The factor of six is empirical ',
              'shorthand for “the fast tail is too thin to matter” — the math layer’s honest ',
              'confession is that this inequality compresses an exponential, and the next layer ',
              'unpacks it.',
            ),
            p(
              'Worked example (Earth defaults, ',
              m`T`,
              ' = 1000 K): nitrogen’s ',
              m`v_{\text{th}}`,
              ' = 0.77 km/s against ',
              m`v_{\text{esc}}`,
              ' = 11.19 km/s — a ratio of 14.5, comfortably kept. Hydrogen’s ',
              m`v_{\text{th}}`,
              ' = 2.87 km/s gives a ratio of 3.9 — below six, and Earth duly leaks it. Same planet, ',
              'same temperature: the molecule’s mass alone decides.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The factor-six rule compresses an exponential, and the compression hides orders of ',
          'magnitude. The Jeans escape flux scales as ',
          m`e^{-\lambda}`,
          ' in the escape parameter ',
          m`\lambda = (v_{esc}/v_{th})^2`,
          ', so the difference between ',
          m`\lambda = 15`,
          ' and ',
          m`\lambda = 40`,
          ' is not “somewhat slower” but the difference between an atmosphere with a ',
          'deadline and one that outlives its star. This is why the verdicts in the simulation ',
          'switch so sharply as the sliders move: the underlying physics really is that steep, and ',
          'the three-way verdict is a coarse-grained reading of a cliff.',
        ),
        p(
          'Jeans escape is also the ',
          em('gentlest'),
          ' of the escape routes, and worlds are shaped by the harsher ones. When a light gas is ',
          'abundant and strongly heated, the upper atmosphere stops leaking molecule-by-molecule ',
          'and starts flowing outward as a wind — ',
          em('hydrodynamic escape'),
          ' — dragging heavier gases with it; early Venus, Earth, and Mars all likely shed ',
          'primordial hydrogen this way, and it is happening in real time on close-in exoplanets: ',
          'the hot giant HD 209458 b trails an escaping hydrogen cloud detected in transit, an ',
          'atmosphere observably boiling off. Worlds without a protective magnetic field face ',
          em('solar-wind stripping'),
          ', the mechanism MAVEN measured at Mars. And large impacts can blast off atmosphere ',
          'wholesale. Mars is the compound case: too small to hold interior heat, it lost its ',
          'magnetic dynamo, and the wind plus its weak gravity did the rest — the evidence written ',
          'in isotopes, where the heavy hydrogen left behind outnumbers its expected share several ',
          'times over, the residue of oceans’ worth of departed water.',
        ),
        p(
          'The synthesis is the ',
          em('cosmic shoreline'),
          ': plot worlds by escape velocity against the stellar radiation they endure, and the ',
          'airless ones separate from the air-bearing ones along a rough empirical line. This ',
          'module’s sliders move a world across that plane. The live question is which side of ',
          'the line the galaxy’s most common temperate rocky worlds — those around red dwarfs, ',
          'whose flaring youth batters young atmospheres — actually fall on; the early JWST ',
          'verdicts on the TRAPPIST-1 planets lean airless, and the census has just begun.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'escape-velocity',
          reason:
            'The threshold in this module’s inequality is that module’s entire subject — same function, same number, now with a gas to test against it.',
        },
        {
          moduleId: 'exoplanets',
          reason:
            'The worlds being sorted by the shoreline are found by transits — and an escaping atmosphere was itself first seen as a deeper transit.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'Catling & Kasting 2017, “Atmospheric Evolution on Inhabited and Lifeless Worlds”, Cambridge UP',
      url: 'https://doi.org/10.1017/9781139020558',
      note: 'Escape mechanisms, the factor-six criterion, and the Earth loss rates in layers 1 and 4',
    },
    {
      label: 'Zahnle & Catling 2017, “The Cosmic Shoreline”, ApJ 843:122',
      url: 'https://iopscience.iop.org/article/10.3847/1538-4357/aa7846',
      note: 'The escape-velocity–irradiation plane in layer 6',
    },
    {
      label: 'Jakosky et al. 2018, “Loss of the Martian atmosphere to space”, Icarus 315',
      url: 'https://www.sciencedirect.com/science/article/abs/pii/S0019103517306917',
      note: 'MAVEN stripping measurements',
    },
    {
      label:
        'Vidal-Madjar et al. 2003, “An extended upper atmosphere around the extrasolar planet HD209458b”, Nature 422, 143',
      url: 'https://doi.org/10.1038/nature01448',
      note: 'The evaporating hot Jupiter in layer 6',
    },
  ],
};

export default planetaryAtmospheres;

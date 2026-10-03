/**
 * Black holes — the fourth published Lodestar module.
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
import { M_SUN } from '@/physics/constants';
import { em, figure, m, p, prose, term } from '../rich';
import { logMinThrough, logStep } from '../grid';

/** The mass slider's top, kg, and a bottom that puts 10 M☉ on the grid. */
const BH_MAX = 1.3e41;
const BH_MIN = logMinThrough(10 * M_SUN, BH_MAX, 1111, 130);

const blackHoles: Module = {
  id: 'black-holes',
  title: 'Black Holes',
  tagline: 'One number, how heavy, decides everything else about it.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Pack enough matter into a small enough space, and the speed needed to leave exceeds ',
          'the speed of light. Past that line, falling inward is the only direction there is.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture a river sliding toward a waterfall, and fish that can swim, flat out, one ',
          'metre per second. Far upstream the current is lazy, and the fish go wherever they ',
          'please. Nearer the falls, the water quickens. Somewhere in the river is a line where ',
          'the current itself reaches one metre per second. Past it, no fish returns. A fish ',
          'there can swim as hard as it likes, in any direction it likes: the water carrying it ',
          'moves faster than swimming can undo, and every stroke still ends closer to the falls.',
        ),
        p(
          'A black hole works like the river, with space in the role of the water and light in ',
          'the role of the fastest swimmer. The horizon is the line where the inward flow passes ',
          'light’s speed.',
        ),
        p(
          'The analogy breaks in one telling place: the fish feels the current, but nothing marks ',
          'the line itself. For a big enough hole you would cross it without noticing, and that ',
          'strange fact is genuine relativity, not a defect of the picture.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'black-holes',
      caption: prose(
        p(
          'One slider: mass. Sweep it from collapsed stars to the giants in galactic centres and ',
          'watch the anatomy rescale: the horizon, the ring where light itself can orbit, the ',
          term('innermost stable orbit', 'isco'),
          '. Then check the readout that says whether arriving would kill ',
          'you.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How heavy?',
          technicalLabel: 'Mass',
          symbol: 'M',
          unit: 'kg',
          // About 1e30 kg ≈ 0.5 M_☉, below the Tolman–Oppenheimer–Volkoff limit
          // of about 2.2–2.3 M_☉ (Rezzolla et al. 2018: 2.16 +0.17/−0.15) but a
          // legitimate horizon for the geometry; 1.3e41 kg ≈ 65
          // billion M_☉, covering TON 618 at the top of the quasar mass range.
          // The minimum is nudged 0.5% below 1e30 so the default is step 130 of
          // 1111 exactly (src/content/grid.ts), and the maximum is reachable.
          min: BH_MIN,
          max: BH_MAX,
          // 10 M_☉ — a typical stellar-mass hole, and the mass at which the
          // tidal readout is at its most vivid.
          default: 10 * M_SUN,
          step: logStep(BH_MIN, BH_MAX, 1111), // decades, about 0.01
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
      ],
      approximations: [
        prose(
          p(
            'The hole does not spin. Real ones usually do, and spin pulls the innermost orbits much closer in.',
          ),
        ),
        prose(
          p(
            'The hole carries no electric charge. Real ones lose any charge quickly, so this costs almost nothing.',
          ),
        ),
        prose(
          p(
            'Nothing is near the hole: no glowing disc of gas, no jet. Those are what make real ones visible.',
          ),
        ),
        prose(
          p(
            'The drawing is a map, not a photograph. Space near the hole is curved, and a camera would see a dark shadow about 2.6 times the horizon’s width.',
          ),
        ),
        prose(
          p(
            'The stretching figure is for a 1.7 m person falling feet first, measured right at the horizon.',
          ),
        ),
        prose(
          p(
            'The evaporation time counts light only, so it is nearly twice too long. And no hole this heavy is shrinking yet: each is colder than the 2.7 K glow left over from the Big Bang, so it takes in more than it gives off.',
          ),
        ),
        prose(
          p(
            'The two panels use two different scales, each labelled on the canvas.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A ',
          em('black hole'),
          ' is a region where gravity has won outright, wrapped in an ',
          em('event horizon'),
          ': the surface of no return, with radius named the ',
          em(term('Schwarzschild radius', 'schwarzschild-radius')),
          ' after the physicist who found it within weeks of Einstein publishing general ',
          'relativity. There is no material surface there, and it is startlingly small: the ',
          'Sun’s works out to three kilometres, and the ten-',
          term('solar-mass', 'solar-mass'),
          ' hole the slider starts on ',
          'spans a city, 29.5 kilometres in radius. Outside it sit two more landmarks. ',
          'At one and a half horizon radii lies the ',
          em('photon sphere'),
          ', where light can orbit in circles. At three, the ',
          em('innermost stable circular orbit'),
          ': closer in than that, no steady orbit exists and matter spirals through.',
        ),
        p(
          'Black holes come in two well-stocked sizes. ',
          em('Stellar-mass'),
          ' holes, a few to a few tens of Suns, are collapsed cores of massive stars; ',
          'gravitational-wave detectors now catch pairs of them merging routinely. ',
          em('Supermassive'),
          ' holes sit in galactic centres: our own galaxy’s, Sagittarius A*, weighs 4.15 million ',
          'Suns (its horizon would sit nine Suns deep) and M87’s giant reaches 6.5 billion, a ',
          'horizon whose radius is four times Neptune’s distance from our Sun. Both have been ',
          'photographed by the ',
          term('Event Horizon Telescope', 'eht'),
          ': the images show a bright ring of hot ',
          'orbiting gas around a central shadow roughly two and a half times the horizon’s width.',
        ),
        p(
          'The misconception to retire is the cosmic vacuum cleaner. A black hole does not reach ',
          'out and suck; at any distance, its pull equals that of any other object of the same ',
          'mass. Swap the Sun for a one-solar-mass hole and every planet keeps its orbit exactly:',
          ' the Solar System would go dark, not off the rails.',
        ),
        p(
          'What would kill you is more particular: ',
          em(term('tidal force', 'tidal-force')),
          ', the difference between the pull on your head and the pull on your feet. Near a ',
          'stellar-mass hole that difference reaches millions of g far outside the horizon: ',
          'lethal long before arrival. At Sagittarius A*’s horizon it is a ten-thousandth of a g: ',
          'you would cross the point of no return and feel nothing at all. Counterintuitively, ',
          'the bigger the black hole, the gentler its doorstep.',
        ),
        /*
         * Source: https://www.eso.org/public/images/eso1907a/ (ESO release eso1907)
         * Licence, from https://www.eso.org/public/copyright/: ESO images "are
         * licensed under a Creative Commons Attribution 4.0 International
         * License, and may on a non-exclusive basis be reproduced without fee
         * provided the credit is clear and visible" — and "the full image or
         * footage credit must be presented in a clear and readable manner to
         * all users, with the wording unaltered". The credit below is the
         * wording the release itself carries.
         */
        figure({
          src: '/figures/black-holes.webp',
          width: 1280,
          height: 746,
          alt: 'A bright orange ring, brighter along its lower edge, surrounding a dark central circle.',
          caption:
            'The first image of a black hole: M87*, six and a half billion times as heavy as the Sun, photographed by the Event Horizon Telescope. The glow is hot gas orbiting just outside the horizon; the dark centre is a shadow wide enough to swallow the Solar System.',
          credit: 'EHT Collaboration',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'schwarzschild-radius',
          tex: 'r_s \\;=\\; \\dfrac{2G\\,{{M}}}{c^{2}}',
          binds: ['M'],
          note: prose(
            p(
              m`r_s`,
              ' — radius of the event horizon; ',
              m`M`,
              ' — the mass (your slider); ',
              m`G`,
              ' — gravitational constant; ',
              m`c`,
              ' — the speed of light. Linear in mass: ten times the mass, ten times the radius, ',
              'which is why the anatomy only rescales as you drag.',
            ),
          ),
        },
        {
          id: 'tidal-at-horizon',
          tex: '\\Delta a \\;=\\; \\dfrac{2G\\,{{M}}\\,h}{r_s^{3}}',
          binds: ['M'],
          note: prose(
            p(
              m`\Delta a`,
              ' — difference in pull between head and feet; ',
              m`h`,
              ' — the height of the body, fixed here at 1.7 m (the human rung of the scale ',
              'ladder). Substituting ',
              m`r_s`,
              ' turns this into ',
              m`\Delta a = c^{6}h/(4G^{2}M^{2})`,
              ': tides at the horizon fall as the ',
              em('square'),
              ' of the mass, which is the whole story of survivable versus lethal.',
            ),
            p(
              'Worked example (default, 10 solar masses): ',
              m`r_s`,
              ' = 29.5 km, and ',
              m`\Delta a`,
              ' at the horizon is about 1.8 × 10⁷ g — eighteen million times Earth’s gravity, ',
              'across your height alone. Drag the slider to Sagittarius A* and the same formula ',
              'gives one ten-thousandth of a g.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The horizon carries no local physics. Spacetime there is smooth, curvature is modest ',
          'for large holes, and an infalling observer crosses in finite ',
          term('proper time', 'proper-time'),
          ' having ',
          'measured nothing special: the horizon is a globally defined surface (the boundary of ',
          'what can ever send light to infinity), not a place with properties. The ',
          'escape-velocity framing from this module’s sibling gets the radius right while ',
          'misdescribing the physics: light does not launch and fall back at ',
          m`r_s`,
          '; rather, inside, every future-directed path points inward. Once through, the centre ',
          'is no longer a place ahead of you but a moment ahead of you: inside the horizon it ',
          'lies in your future, and the future is not a direction you can steer around. For ',
          'Sagittarius A*, that is at most about a minute of proper time.',
        ),
        p(
          'The diagram above is Schwarzschild: non-rotating, the one-parameter idealization. ',
          'Astrophysical holes rotate, some rapidly, and rotation reshapes the anatomy: for a ',
          'maximally spinning ',
          term('Kerr', 'kerr'),
          ' hole the prograde ISCO descends from ',
          m`3 r_s`,
          ' to ',
          m`0.5 r_s`,
          ', photon orbits split by direction, and an ',
          em(term('ergosphere', 'ergosphere')),
          ' appears from which the hole’s rotational energy can be extracted. ',
          term('Accretion-disc', 'accretion-disc'),
          ' spectra and the ',
          'EHT ring shapes are read against Kerr, not Schwarzschild, templates.',
        ),
        p(
          'Hawking’s 1974 result gives the horizon a temperature, ',
          m`T_H \propto 1/M`,
          ', and with it black hole thermodynamics’ strangest feature: negative heat capacity. ',
          'Absorbing mass makes a hole ',
          em('colder'),
          '; radiating makes it hotter, so an evaporating hole runs away, ending in a flash. But ',
          'the temperatures are absurdly low (sixty billionths of a kelvin for one solar mass) ',
          'and every known black hole is colder than the 2.7 K microwave background around it. ',
          'They are all, for now, net absorbers: no known black hole is evaporating. ',
          'Only after the cosmos cools below a hole’s temperature does the ',
          m`10^{67}`,
          '-year countdown genuinely begin, and the crossover mass (a hole as warm as today’s ',
          'CMB) is about three-fifths of the Moon’s mass, far below anything astrophysics knows how ',
          'to make.',
        ),
        p(
          'Evaporation sharpened the field’s central open problem. Thermal radiation carries no ',
          'imprint of what fell in, so a hole that evaporates completely seems to erase ',
          'information. Quantum mechanics forbids that. Hawking held for decades that the ',
          'information is lost; the 1997 Maldacena duality argued it cannot be; and ',
          'replica-wormhole calculations since 2019 have recovered, from gravity itself and in ',
          'simplified models of quantum gravity, the Page curve that unitarity demands. The ',
          'emerging consensus is that information escapes, ',
          'with no consensus mechanism for ',
          em('how'),
          ', which keeps the paradox productive fifty years on.',
        ),
        p(
          'Meanwhile the objects themselves became laboratory subjects: LIGO’s first detection ',
          'was two ~30-solar-mass holes merging, radiating three Suns of mass in a fifth of a ',
          'second, a peak power briefly exceeding the light of every star in the observable ',
          'universe combined.',
        ),
        p(
          'The simulation’s shortcuts, in full. Real holes rotate, often near the maximum ',
          'allowed, and spin is not a small correction: for a maximally rotating Kerr hole the ',
          'prograde innermost stable orbit falls from 3 r_s to 0.5 r_s and the prograde photon ',
          'orbit with it, the horizon becomes oblate, and the energy released by infalling ',
          'matter rises from 5.7% of its rest mass to 42%. Net charge attracts the opposite sign ',
          'out of the surrounding plasma and neutralises quickly, so astrophysical holes are ',
          'uncharged to excellent accuracy. Each hole is drawn as an isolated vacuum solution, ',
          'with no disc, lensed ring or outflow. The radii r_s, 1.5 r_s and 3 r_s are ',
          'Schwarzschild radial coordinates plotted as if space were flat, so their drawn ',
          'separations are labels rather than distances a ruler would measure; the hole’s own ',
          'lensing swells the dark patch to a shadow of radius ',
          m`\sqrt{27}\,GM/c^2 \approx 2.6\,r_s`,
          '. The tidal figure is static and radial: the head-to-foot stretch on a rigid body ',
          'short compared with r_s, evaluated at the horizon, with a coefficient that is exact ',
          'for Schwarzschild. The evaporation time counts photons only; for holes this heavy, ',
          'too cold for any neutrino unless the lightest (mass unknown) is light enough, ',
          'gravitons and the exact emission factors shorten it about 1.8 times, and its clock ',
          'cannot start until the universe has cooled below the hole’s temperature. A single ',
          'scale across both panels would collapse one or the other into a dot.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'escape-velocity',
          reason:
            'Setting escape velocity to the speed of light predicts this radius exactly; that module’s going-deeper explains why the agreement is the right answer reached by the wrong physics.',
        },
        {
          moduleId: 'kepler-orbits',
          reason:
            'Sagittarius A* was weighed by the stars orbiting it: Kepler’s third law applied at four million solar masses.',
        },
        {
          moduleId: 'gravitational-waves',
          reason:
            'When two of these spiral together, spacetime itself carries the announcement.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'EHT Collaboration 2019, “First M87 Event Horizon Telescope Results. I”, ApJL 875, L1',
      url: 'https://doi.org/10.3847/2041-8213/ab0ec7',
      note: 'M87* mass and image in layer 4',
    },
    {
      label:
        'EHT Collaboration 2022, “First Sagittarius A* Event Horizon Telescope Results. I”, ApJL 930, L12',
      url: 'https://doi.org/10.3847/2041-8213/ac6674',
      note: 'Sgr A* image in layer 4',
    },
    {
      label:
        'GRAVITY Collaboration 2019, “A geometric distance measurement to the Galactic center black hole”, A&A 625, L10',
      url: 'https://doi.org/10.1051/0004-6361/201935656',
      note: 'Sgr A* mass',
    },
    {
      label: 'Hawking 1974, “Black hole explosions?”, Nature 248, 30',
      url: 'https://doi.org/10.1038/248030a0',
      note: 'Hawking temperature in layer 6',
    },
    {
      label:
        'Abbott et al. 2016, “Observation of Gravitational Waves from a Binary Black Hole Merger”, PRL 116, 061102',
      url: 'https://doi.org/10.1103/PhysRevLett.116.061102',
      note: 'GW150914 figures in layer 6',
    },
  ],
};

export default blackHoles;

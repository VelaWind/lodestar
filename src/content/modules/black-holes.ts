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
import { em, m, p, prose } from '../rich';

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
          'Pack enough mass into a small enough space, and the speed needed to leave exceeds ',
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
          'The analogy breaks in one telling place: the fish feels the current, but you would ',
          'feel nothing at the line. No jolt, no marker, no change in your own physics: the ',
          'crossing is invisible to the one who crosses it, and that strange fact is genuine ',
          'relativity, not a defect of the picture.',
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
          'innermost stable orbit. Then check the readout that says whether arriving would kill ',
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
          // 1e30 kg ≈ 0.5 M_☉, below the ~2.2 M_☉ Tolman–Oppenheimer–Volkoff
          // limit but a legitimate horizon for the geometry; 1.3e41 kg ≈ 65
          // billion M_☉, covering TON 618 at the top of the quasar mass range.
          min: 1e30,
          max: 1.3e41,
          // 10 M_☉ — a typical stellar-mass hole, and the mass at which the
          // tidal readout is at its most vivid.
          default: 10 * M_SUN,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
      ],
      approximations: [
        'The hole does not rotate. Real ones do, often near the maximum allowed, and spin is not a small correction: for a maximally rotating Kerr hole the prograde innermost stable orbit falls from 3 r_s to 0.5 r_s and the prograde photon orbit with it, the horizon itself becomes oblate, and the energy released by matter falling in rises from 5.7% of its rest mass to 42%. Everything drawn here is the non-rotating limit.',
        'The hole carries no charge. This one costs almost nothing: any net charge attracts the opposite sign out of the surrounding plasma and neutralises quickly, so astrophysical holes are uncharged to excellent accuracy.',
        'There is no accretion disc, no jet, and nothing else nearby. A real hole of any of these masses is drawn as an isolated vacuum solution here, and everything that makes one visible — the disc, the ring of lensed light, the outflow — is absent.',
        'The picture is a plan view of coordinate radii, not a photograph. r_s, 1.5 r_s and 3 r_s are Schwarzschild radial coordinates plotted as if space were flat; the geometry they describe is curved, so the drawn separations are labels rather than distances a ruler would measure. Nor is this what a camera would see: the hole’s own lensing would wrap the far side of the disc into view and swell the dark patch from the horizon’s r_s to a shadow of radius √27 GM/c² ≈ 2.6 r_s, about 5.2 r_s across.',
        'The tidal number is a static, radial estimate. It is the head-to-foot stretch on a rigid 1.7 m person falling feet-first, evaluated exactly at the horizon, with the person short compared with r_s. The coefficient is exact for Schwarzschild (the relativistic answer for radial separations is the Newtonian one) but the body is not rigid, does not stay radial, and the figure says nothing about what happens on the way down.',
        'The evaporation time counts photons only, and assumes the hole is left completely alone. It is an order-of-magnitude estimate: including other massless species and the particles a shrinking hole becomes hot enough to emit shortens it by a factor of a few. More importantly, no hole this size is evaporating at all. Every mass on this slider is colder than the 2.725 K microwave background, so it absorbs more than it radiates and grows: the clock quoted does not start until the universe has cooled below its temperature.',
        'The two panels carry two different scales, each labelled on the canvas. The three radii are drawn to one scale within the geometry panel; the horizon and the comparison object share a separate scale in the size panel. A single scale across both would collapse one panel or the other into a dot.',
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
          em('Schwarzschild radius'),
          ' after the physicist who found it within weeks of Einstein publishing general ',
          'relativity. There is no material surface there, and it is startlingly small: the ',
          'Sun’s works out to three kilometres, and the ten-solar-mass hole the slider starts on ',
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
          'horizon four times wider than Neptune’s whole distance from our Sun. Both have been ',
          'photographed by the Event Horizon Telescope: the images show a bright ring of hot ',
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
          em('tidal force'),
          ', the difference between the pull on your head and the pull on your feet. Near a ',
          'stellar-mass hole that difference reaches millions of g far outside the horizon: ',
          'lethal long before arrival. At Sagittarius A*’s horizon it is a ten-thousandth of a g: ',
          'you would cross the point of no return and feel nothing at all. Counterintuitively, ',
          'the bigger the black hole, the gentler its doorstep.',
        ),
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
          'for large holes, and an infalling observer crosses in finite proper time having ',
          'measured nothing special: the horizon is a globally defined surface (the boundary of ',
          'what can ever send light to infinity), not a place with properties. The ',
          'escape-velocity framing from this module’s sibling gets the radius right while ',
          'misdescribing the physics: light does not launch and fall back at ',
          m`r_s`,
          '; rather, inside, every future-directed path points inward. Once through, reaching the ',
          'centre is as unavoidable as reaching next Tuesday. For Sagittarius A*, that is at ',
          'most about a minute of proper time.',
        ),
        p(
          'The diagram above is Schwarzschild: non-rotating, the one-parameter idealization. ',
          'Astrophysical holes rotate, some rapidly, and rotation reshapes the anatomy: for a ',
          'maximally spinning Kerr hole the prograde ISCO descends from ',
          m`3 r_s`,
          ' to ',
          m`0.5 r_s`,
          ', photon orbits split by direction, and an ',
          em('ergosphere'),
          ' appears from which orbital energy can be extracted. Accretion-disc spectra and the ',
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
          'They are all, for now, net absorbers: nothing in the present universe is evaporating. ',
          'Only after the cosmos cools below a hole’s temperature does the ',
          m`10^{67}`,
          '-year countdown genuinely begin, and the crossover mass (a hole as warm as today’s ',
          'CMB) is about the mass of the Moon, far below anything astrophysics knows how to make.',
        ),
        p(
          'Evaporation sharpened the field’s central open problem. Thermal radiation carries no ',
          'imprint of what fell in, so a hole that evaporates completely seems to erase ',
          'information. Quantum mechanics forbids that. Hawking held for decades that the ',
          'information is lost; the 1997 Maldacena duality argued it cannot be; and ',
          'replica-wormhole calculations since 2019 have recovered, from gravity itself, the Page ',
          'curve that unitarity demands. The emerging consensus is that information escapes, ',
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
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'escape-velocity',
          reason:
            'Setting escape velocity to the speed of light predicts this radius exactly; that module’s going-deeper explains why the agreement is a famous coincidence.',
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

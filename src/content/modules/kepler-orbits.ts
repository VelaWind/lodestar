/**
 * Kepler orbits — the second published Lodestar module.
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
import { AU, M_SUN } from '@/physics/constants';
import { em, m, p, prose, term } from '../rich';

const keplerOrbits: Module = {
  id: 'kepler-orbits',
  title: 'Kepler Orbits',
  tagline: 'Why orbits are ellipses, why the star sits off-centre, and why speed changes.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'A planet close to its star races; far away, it crawls. The rule tying the two ',
          'together took humanity two thousand years of sky-watching to find — and it fits on ',
          'one line.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Watch a child on a swing. Fastest at the very bottom of the arc, slowest at the top ',
          'of each rise: speed and height trading into each other, back and forth, in a rhythm ',
          'that repeats exactly.',
        ),
        p(
          'A planet on a stretched orbit runs the same trade with its star. Falling inward, it ',
          'gains speed, moving fastest at its closest approach. Climbing away, it spends that ',
          'speed again, drifting slowest at the far end of its path. Then the cycle repeats, and ',
          'the time it takes (the orbit’s period) comes out the same every single lap.',
        ),
        p(
          'The analogy breaks in one place: a swing needs pushing, because its bearings and the ',
          'air steal a little energy every pass. An orbit has nothing to rub against. The trade ',
          'repeats exactly, for millions of years, with nothing driving it.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'kepler-orbits',
      caption: prose(
        p(
          'Choose a star, choose how far out the planet rides and how stretched its path is, ',
          'then watch it trade speed for distance. Turn on the sweep to see the trade measured.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How heavy is the star?',
          technicalLabel: 'Central mass',
          symbol: 'M',
          unit: 'kg',
          // 1.5e29 kg ≈ 0.075 M_sun, the hydrogen-burning limit at the bottom of
          // the red dwarfs; 1e32 kg ≈ 50 M_sun, into the massive O stars.
          min: 1.5e29,
          max: 1e32,
          default: M_SUN,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
        {
          id: 'a',
          friendlyLabel: 'How wide is the orbit?',
          technicalLabel: 'Semi-major axis',
          symbol: 'a',
          unit: 'm',
          // 1e9 m ≈ 0.0067 AU — inside the hot-Jupiter regime, close enough to
          // graze a real star; 1e13 m ≈ 67 AU, out past the Kuiper belt.
          min: 1e9,
          max: 1e13,
          default: AU,
          step: 0.01,
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
        {
          id: 'e',
          friendlyLabel: 'How stretched is the orbit?',
          technicalLabel: 'Eccentricity',
          symbol: 'e',
          // Dimensionless, and the one legitimate exception to "every slider
          // maps to a real SI quantity": eccentricity is a genuine orbital
          // element with a definition (c/a, the focus offset over the semi-major
          // axis), not an invented unitless "amount" standing in for a physical
          // quantity someone declined to name. It is what a textbook and an
          // ephemeris both call e, so the slider carries it unitless.
          unit: '',
          min: 0,
          // Stops short of 1: a parabolic orbit is unbound and has no period,
          // and the solver here is for closed orbits only. 0.97 reaches Halley’s
          // 0.967, quoted in layer 4, so the reader can put the slider on the
          // figure they just read.
          max: 0.97,
          default: 0.0167, // Earth's — nearly circular, and a useful starting point
          step: 0.001,
          scale: 'linear',
          format: { notation: 'auto', digits: 3 },
        },
      ],
      approximations: [
        prose(
          p(
            'Two bodies and nothing else. No other planet pulls on this one, so the orbit closes exactly and repeats forever. Real multi-planet systems perturb each other continuously: it is those perturbations that turned up Neptune, and that make the Solar System’s long-term evolution a numerical question rather than a formula.',
          ),
        ),
        prose(
          p(
            'The planet is a test particle: it has no mass of its own. A real pair orbits their common ',
            term('barycentre', 'barycentre'),
            ', and both move. The error is of order m/M: negligible for a planet around a star, not negligible for Jupiter and the Sun (the Sun’s wobble about the barycentre is what most exoplanet detections actually measure), and outright wrong for a binary star.',
          ),
        ),
        prose(
          p(
            'Both bodies are point masses. Nothing here has a radius, so the smallest orbits the sliders allow would lie inside a real star, and no tidal distortion or oblateness is modelled.',
          ),
        ),
        prose(
          p(
            'Newtonian gravity only. General relativity adds a slow rotation of the ellipse itself: 43 arcseconds per century for Mercury, the discrepancy that made GR famous. The orbit drawn here never precesses.',
          ),
        ),
        prose(
          p(
            'The ellipse is fixed in space and traced repeatedly. With no perturbations and no relativity, periapsis stays put; the animation loops the same closed path indefinitely.',
          ),
        ),
        prose(
          p(
            'Playback is time-accelerated, and by a different factor for every orbit: one full period is compressed to a fixed number of seconds of wall time, so the acceleration factor is shown on the readout and changes as you drag. Relative timing within an orbit is exact: the planet genuinely dawdles near apoapsis, which is the second law and not a rendering artifact.',
          ),
        ),
        prose(
          p(
            'The orbit is scaled to fit the frame and drawn face-on, looking straight down on the orbital plane. Distances within one orbit are therefore comparable to each other but not across slider settings: the ellipse is redrawn to the same size whether it is 0.007 AU or 67 AU across. Real orbits are also inclined to the line of sight, which is why an observed orbit is a projection of the one shown here.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'The path is an ',
          em('ellipse'),
          ' (a stretched circle with two special interior points called ',
          em('foci'),
          ') and the star sits at one focus, not at the centre. ',
          em('How far out'),
          ' is the ',
          em('semi-major axis'),
          ' ',
          m`a`,
          ', half the ellipse’s long dimension. ',
          em('How stretched'),
          ' is the ',
          em('eccentricity'),
          ' ',
          m`e`,
          ': zero is a perfect circle, and values approaching one are ever-thinner ovals. The ',
          'closest point of the orbit is ',
          em('periapsis'),
          ' (',
          em('perihelion'),
          ', around the Sun), the farthest ',
          em('apoapsis'),
          ' (',
          em('aphelion'),
          '), and one full lap takes the ',
          em('orbital period'),
          ' ',
          m`T`,
          '.',
        ),
        p(
          'Johannes Kepler extracted three laws from this geometry, working from Tycho Brahe’s ',
          'naked-eye measurements of Mars: no telescope, a decade of arithmetic. First: orbits ',
          'are ellipses with the Sun at a focus. Second: a planet sweeps out equal areas in equal ',
          'times, which is the speed-for-distance trade made precise. Third: the square of the ',
          'period grows as the cube of the semi-major axis. Press the sweep toggle above and ',
          'drag ',
          m`a`,
          ' to watch both at work.',
        ),
        p(
          'Real orbits are barely stretched. Earth’s eccentricity is 0.0167: drawn to scale, you ',
          'could not tell it from a circle by eye. Mercury, the most eccentric planet, reaches ',
          '0.206. Halley’s comet runs at 0.967, which is what a ',
          em('very'),
          ' thin ellipse looks like in practice: seventy-five years out, months back around the ',
          'Sun.',
        ),
        p(
          'The common misconception is that seasons come from this stretch. Earth actually passes ',
          'closest to the Sun in early January, the depth of northern winter. Seasons come from ',
          'the tilt of Earth’s axis, not from distance.',
        ),
        p(
          'Newton later showed all three laws fall out of one law of gravity, and that the third ',
          'law hides a scale: the period depends on the central body’s ',
          em('mass'),
          '. Modern astronomy runs this backward constantly. Watch anything orbit, time it, and ',
          'you have weighed what it orbits: the Sun, other stars, and the four-million-solar-mass ',
          'black hole at the centre of our galaxy, weighed by the stars whipping around it.',
        ),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'third-law',
          tex: 'T \\;=\\; 2\\pi\\sqrt{\\dfrac{{{a}}^{3}}{G\\,{{M}}}}',
          binds: ['M', 'a'],
          note: prose(
            p(
              m`T`,
              ' — orbital period; ',
              m`a`,
              ' — semi-major axis (your slider); ',
              m`M`,
              ' — mass of the central body (your slider); ',
              m`G`,
              ' — gravitational constant. Note what is absent: ',
              m`e`,
              '. The period does not care how stretched the orbit is — only how big and around ',
              'what.',
            ),
          ),
        },
        {
          id: 'apsides',
          tex: 'r_p \\;=\\; {{a}}\\left(1 - {{e}}\\right), \\qquad r_a \\;=\\; {{a}}\\left(1 + {{e}}\\right)',
          binds: ['a', 'e'],
          note: prose(
            p(
              m`r_p`,
              ' — periapsis distance, the closest approach; ',
              m`r_a`,
              ' — apoapsis distance, the farthest reach; ',
              m`e`,
              ' — eccentricity (your slider).',
            ),
            p(
              'Worked example (defaults): ',
              m`M`,
              ' = 1.988 × 10³⁰ kg and ',
              m`a`,
              ' = 1.496 × 10¹¹ m give ',
              m`T`,
              ' = 365.3 days. Earth’s ',
              m`e`,
              ' = 0.0167 puts periapsis at 0.983 AU and apoapsis at 1.017 AU — a swing of about ',
              'five million kilometres that you would never notice from the shape alone.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'All three laws follow from ',
          m`F = -GMm/r^2`,
          ' in a few moves. A central force exerts no torque, so specific ',
          term('angular momentum', 'angular-momentum'),
          ' ',
          m`h = r^2\dot{\nu}`,
          ' is conserved, and since the areal rate is ',
          m`dA/dt = h/2`,
          ', the second law is immediate. Energy and angular momentum together force the ',
          'trajectory into a conic section with the mass at a focus: the first law. The third ',
          'takes one non-obvious cancellation: ',
          m`T = \pi a b/(h/2)`,
          ' with ',
          m`b = a\sqrt{1 - e^2}`,
          ' and ',
          m`h = \sqrt{GMa(1 - e^2)}`,
          ': the eccentricity terms annihilate, leaving ',
          m`T^2 = 4\pi^2 a^3/GM`,
          '. A comet spending decades in the cold and weeks at perihelion has exactly the period ',
          'of a circular orbit with the same ',
          m`a`,
          '.',
        ),
        p(
          'The assumptions, stated as assumptions. The planet is a ',
          term('test particle', 'test-particle'),
          ': the honest form ',
          'is ',
          m`T^2 = 4\pi^2 a^3 / G(M + m)`,
          ', and for Jupiter the difference shifts the period by about 0.05%, below this sim’s ',
          'display precision, far above modern measurement precision. The system is two bodies: ',
          'real systems are not, and the deviations are the signal; perturbations of Uranus’s ',
          'orbit located Neptune on paper before any telescope found it. Over long spans the ',
          term('N-body problem', 'n-body'),
          ' turns chaotic: Laskar’s integrations put the inner solar system’s ',
          'predictability horizon near five million years, after which trajectories — not the ',
          'planets themselves — dissolve into uncertainty. The bodies are points: real oblateness ',
          'makes satellite orbits precess, which sun-synchronous spacecraft exploit deliberately. ',
          'And gravity is Newtonian: Mercury’s perihelion creeps forward 43 ',
          term('arcseconds', 'arcsecond'),
          ' per ',
          'century beyond what Newton can book-keep, the first confirmed prediction of general ',
          'relativity. In 2020 the GRAVITY collaboration watched the star S2 trace the same ',
          'relativistic ',
          term('precession', 'precession'),
          ' around the galaxy’s central black hole, at four million solar ',
          'masses instead of one.',
        ),
        p(
          'The third law is also the working tool of exoplanet science. A star’s radial-velocity ',
          'wobble plus the law yields planet masses; in packed systems like TRAPPIST-1, planets ',
          'tug each other’s transit times off schedule, and those deviations weigh worlds too ',
          'small and dim for any other scale.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'escape-velocity',
          reason:
            'Stretch e toward 1 and add speed: past a threshold the ellipse tears open and never closes. That threshold is escape velocity.',
        },
        {
          moduleId: 'black-holes',
          reason:
            'The mass in Kepler’s third law is how Sagittarius A* was weighed: by the orbits of the stars around it.',
        },
        {
          moduleId: 'exoplanets',
          reason:
            'Timing orbits is how we count and weigh planets around other stars.',
        },
      ],
    },
  },

  references: [
    {
      label: 'NASA Planetary Fact Sheet (D. R. Williams, NASA GSFC)',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
      note: 'Orbital elements quoted in layer 4',
    },
    {
      label: 'Murray & Dermott, “Solar System Dynamics”, Cambridge UP',
      url: 'https://doi.org/10.1017/CBO9781139174817',
      note: 'Derivations and the two-body correction',
    },
    {
      label:
        'GRAVITY Collaboration 2020, “Detection of the Schwarzschild precession in the orbit of the star S2”, A&A 636, L5',
      url: 'https://doi.org/10.1051/0004-6361/202037813',
      note: 'S2 precession in layer 6',
    },
    {
      label:
        'Laskar 1989, “A numerical experiment on the chaotic behaviour of the Solar System”, Nature 338',
      url: 'https://doi.org/10.1038/338237a0',
      note: 'Chaos horizon figure',
    },
    {
      label: 'Grimm et al. 2018, “The nature of the TRAPPIST-1 exoplanets”, A&A 613, A68',
      url: 'https://doi.org/10.1051/0004-6361/201732233',
      note: 'Transit-timing masses in layer 6',
    },
  ],
};

export default keplerOrbits;

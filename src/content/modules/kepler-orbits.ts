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
import { em, figure, m, p, prose, term } from '../rich';
import { logMinThrough, logStep } from '../grid';

/** The star-mass slider's top, kg, and a bottom that puts the Sun on the grid. */
const M_STAR_MAX = 1e32;
const M_STAR_MIN = logMinThrough(M_SUN, M_STAR_MAX, 282, 112);

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
          'The same pull sets the pace from one planet to the next. A planet close to its star ',
          'has to move fast to stay in orbit, and has a short way round, so its year is short; a ',
          'distant one crawls a much longer path. How the year grows with distance is the ',
          'one-line rule, and the sim lets you test it.',
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
          // About 1.5e29 kg ≈ 0.075 M_sun, the hydrogen-burning limit at the bottom
          // of the red dwarfs; 1e32 kg ≈ 50 M_sun, into the massive O stars. The
          // minimum is nudged 0.3% above 1.5e29 so the Sun is step 112 of 282.
          min: M_STAR_MIN,
          max: M_STAR_MAX,
          default: M_SUN,
          step: logStep(M_STAR_MIN, M_STAR_MAX, 282), // decades, about 0.01
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
        {
          id: 'a',
          friendlyLabel: 'How far is the planet from its star, on average? (midway between nearest and farthest)',
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
            'Only two bodies: no other planet pulls on this one, so the orbit repeats exactly, forever.',
          ),
        ),
        prose(
          p(
            'The planet weighs nothing here. Really, both bodies circle their shared ',
            term('barycentre', 'barycentre'),
            ', so the star wobbles too.',
          ),
        ),
        prose(
          p(
            'Both bodies are points, so the smallest orbits the sliders allow would really lie inside the star.',
          ),
        ),
        prose(
          p(
            'Gravity here is Newton’s, not Einstein’s, so the oval never slowly turns the way Mercury’s does; it stays fixed in space, lap after lap.',
          ),
        ),
        prose(
          p(
            'The motion is sped up, by a factor the readout shows. Within each lap the timing is true: the planet really does dawdle at the far end.',
          ),
        ),
        prose(
          p(
            'The orbit is scaled to fit the frame and seen from straight above, so its drawn size stays the same as you drag.',
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
        /*
         * Source: https://www.aanda.org/articles/aa/full_html/2024/12/aa52274-24/aa52274-24.html
         *         (GRAVITY Collaboration, A&A 692, A242, 17 December 2024)
         * Licence, from the article page itself: "© The Authors 2024. Open
         * Access article, published by EDP Sciences, under the terms of the
         * Creative Commons Attribution License
         * (https://creativecommons.org/licenses/by/4.0), which permits
         * unrestricted use, distribution, and reproduction in any medium,
         * provided the original work is properly cited." No figure in the paper
         * is credited to a third party, so the article's own licence covers it.
         *
         * Cropped to the upper panel of Fig. 2; the published figure carries a
         * residuals panel beneath it. CC BY permits adaptation provided the
         * change is indicated, which is why the credit line says so as well as
         * this comment. The cut is vertical only, at the midpoint of the 42px
         * band of white between the panels: it keeps the whole "RA [mas]" axis
         * label and takes none of the residuals frame.
         *
         * The other six figures are resize-and-re-encode only. This one is the
         * exception, authored deliberately, and the reason it is worth stating
         * twice: a reader should be able to tell from the page that what they
         * are looking at is part of a published figure rather than all of it.
         */
        figure({
          src: '/figures/kepler-orbits.webp',
          width: 1200,
          height: 962,
          alt: 'Measured positions of the star S2 tracing a long ellipse around the position of Sagittarius A*, with an inset comparing its track in 2005 and in 2021–2022, the two offset by the precession of the orbit.',
          caption:
            'The star S2, tracked for three decades as it loops around Sagittarius A*, the black hole at the centre of the Galaxy, four million times as heavy as the Sun. Its sixteen-year orbit is an ellipse with the black hole at one focus, Kepler’s first law drawn by a real star; at closest approach it moves at about two and a half percent of the speed of light, and its ellipse slowly turns, lap by lap, just as general relativity predicts.',
          credit: 'GRAVITY Collaboration, A&A 692, A242 (2024), CC BY 4.0 (Fig. 2, upper panel)',
        }),
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
          ' turns chaotic: Laskar’s integrations give the inner solar system a Lyapunov time, the ',
          'time for a small error to grow by a factor of e, near five million years. Errors grow ',
          'tenfold every ~12 Myr, and positions become unpredictable within about 100 million ',
          'years, after which trajectories — not the planets themselves — dissolve into ',
          'uncertainty. The bodies are points: real oblateness ',
          'makes satellite orbits precess, which sun-synchronous spacecraft exploit deliberately. ',
          'And gravity is Newtonian: Mercury’s perihelion creeps forward 43 ',
          term('arcseconds', 'arcsecond'),
          ' per ',
          'century beyond what Newton can book-keep, the first observational success of general ',
          'relativity, explaining an anomaly known since 1859. In 2020 the GRAVITY collaboration watched the star S2 trace the same ',
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
        p(
          'The simulation’s shortcuts, in full. Real multi-planet systems perturb each other ',
          'continuously; those perturbations turned up Neptune, and they make the Solar System’s ',
          'long-term evolution a numerical question rather than a formula. The planet is a test ',
          'particle, an error of order ',
          m`m/M`,
          ': negligible for most planets, not for Jupiter and the Sun (the Sun’s wobble about ',
          'the barycentre is what radial-velocity surveys measure), and outright wrong for a ',
          'binary star. Point masses carry no tides or oblateness. With no perturbations and no ',
          'relativity, periapsis never moves; general relativity alone would turn Mercury’s ',
          'ellipse 43 arcseconds a century. Playback compresses one full period to a fixed number ',
          'of seconds, so the acceleration factor changes as you drag, while the timing within an ',
          'orbit stays exact: the dawdle near apoapsis is the second law, not a rendering ',
          'artifact. The ellipse is drawn face-on and redrawn to one size whether its semi-major ',
          'axis is 0.007 AU or 67 AU, so distances compare within an orbit but not across slider ',
          'settings; real orbits are inclined to the line of sight, and an observed one is a ',
          'projection of the one drawn here.',
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

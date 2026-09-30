/**
 * Time dilation — the sixteenth published Lodestar module, and the first of
 * the relativity batch.
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
import { C, M_DEMO_BH } from '@/physics/constants';
import { schwarzschildRadius } from '@/physics/blackhole';
import { figure, m, p, prose, term } from '../rich';

const R_S_DEMO = schwarzschildRadius(M_DEMO_BH);

const timeDilation: Module = {
  id: 'time-dilation',
  title: 'Time Dilation',
  tagline:
    'Moving clocks run slow, and so do clocks deep in gravity. It is the one kind of time travel physics is sure of.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'An astronaut who spends a year on the Space Station comes home about nine thousandths ',
          'of a second younger than if they had stayed on the ground. That is time travel, and it ',
          'is the only kind physics is sure of.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture a car that can only ever drive at exactly 100 kilometres an hour. Point it due ',
          'north and all of that speed goes into getting north. Turn it a little east and it still ',
          'does 100, but now some of the speed goes east, so it makes less progress north. Turn it ',
          'fully east and it makes no northward progress at all.',
        ),
        p(
          'Everything in the universe is like that car, except that one of the directions is time. ',
          'Sitting still, all your “speed” goes into moving through time, and your clock ticks at ',
          'its fullest rate. Start moving through space and some of it is taken from your motion ',
          'through time, so your clock ticks more slowly than the clock of someone who stayed put. ',
          'At everyday speeds the share taken is too tiny to notice. Near the speed of light it is ',
          'most of it.',
        ),
        p(
          'Gravity slows clocks too, for a different reason: time itself runs more slowly deep down ',
          'in gravity than high up. A clock on the floor runs slower than one on the ceiling, by an ',
          'amount only the best atomic clocks can see. Near a black hole the difference becomes ',
          'enormous.',
        ),
        p(
          'Where the analogy breaks: the car’s directions are ordinary directions on a map, but ',
          'time is not quite like the others, and the rule for sharing the speed between them has a ',
          'minus sign in it where a map has a plus. That is why no traveller can ever reach the ',
          'speed of light, and why the slowing grows without limit as they approach it rather than ',
          'simply topping out.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'time-dilation',
      caption: prose(
        p(
          'Send a traveller to the nearest star and back at different speeds and compare the two ',
          'clocks when they meet again. Then lower a clock toward a black hole and watch how slowly ',
          'it ticks, seen from far away.',
        ),
      ),
      params: [
        {
          id: 'v',
          friendlyLabel: 'How fast is the traveller going?',
          technicalLabel: 'Speed',
          symbol: 'v',
          unit: 'm/s',
          // Walking pace to 0.99999 of light speed. Default 0.8 c, the twin example.
          min: 1,
          max: 0.99999 * C,
          default: 0.8 * C,
          // decades; 848 equal steps, shrunk by one part in 10⁹ so (max − min) / step
          // rounds up to 848 and the input can reach its maximum. Without the
          // shrink, floating point leaves it one step short.
          step: ((Math.log10(0.99999 * C) - Math.log10(1)) / 848) * (1 - 1e-9),
          scale: 'log',
          format: { notation: 'auto', digits: 4, displayUnit: { unit: 'km/s', factor: 1e-3 } },
        },
        {
          id: 'r',
          friendlyLabel: 'How close to the black hole?',
          technicalLabel: 'Distance from a 10 M☉ black hole',
          symbol: 'r',
          unit: 'm',
          // Just outside the horizon, 29.8 km, to two-thirds of an AU. Default: the
          // photon sphere, 1.5 r_s.
          min: 1.01 * R_S_DEMO,
          max: 1e11,
          default: 1.5 * R_S_DEMO,
          // decades; 653 equal steps, shrunk by one part in 10⁹ so (max − min) / step
          // rounds up to 653 and the input can reach its maximum. Without the
          // shrink, floating point leaves it one step short.
          step: ((Math.log10(1e11) - Math.log10(1.01 * R_S_DEMO)) / 653) * (1 - 1e-9),
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'km', factor: 1e-3 } },
        },
      ],
      approximations: [
        prose(
          p(
            'The trip is flown at one steady speed, with the turnaround at Proxima taken as instant. A real ship would spend part of the trip speeding up and slowing down, and the gap between the clocks would be a little smaller.',
          ),
        ),
        prose(
          p(
            'The black hole is a single non-spinning one of ten solar masses, and the clock hovers in place. A spinning black hole, or a clock falling or orbiting, runs at a different rate.',
          ),
        ),
        prose(
          p(
            'The combined rate multiplies the two effects, which holds when the speed is measured by someone hovering at the same spot.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'What the sim shows is ',
          term('time dilation'),
          ': clocks running at different rates for different observers. Albert Einstein derived the ',
          'first kind in 1905 from two starting points, that the laws of physics are the same for ',
          'everyone moving steadily and that everyone measures the same speed of light. A clock ',
          'moving at speed ',
          m`v`,
          ' runs slow by the ',
          term('Lorentz factor'),
          ', ',
          m`\gamma`,
          ', which is 1 at rest, 1.25 at 60 percent of the speed of light, 1.67 at 80 percent, and ',
          'grows without limit as ',
          m`v`,
          ' approaches ',
          m`c`,
          '. Each clock measures its own ',
          term('proper time'),
          ', the time that has actually passed along its own path, and two clocks that separate and ',
          'meet again can disagree about it.',
        ),
        p(
          'That is the ',
          term('twin paradox'),
          '. A traveller who flies to Proxima Centauri, 4.25 light-years away, at 80 percent of the ',
          'speed of light and comes straight back finds that 10.6 years have passed on Earth and 6.4 ',
          'on board. It is not a contradiction, although each twin sees the other’s clock run slow ',
          'while they are moving apart: only the traveller turns around, so only the traveller’s path ',
          'through space and time is bent, and a bent path between the same two meetings records ',
          'less time than the straight one.',
        ),
        p(
          'The second kind, ',
          term('gravitational time dilation'),
          ', came with general relativity, Einstein’s theory of gravity, in 1915. A clock deeper in ',
          'gravity runs slower than one higher up. At Earth’s surface the effect is about seven parts ',
          'in ten billion against a clock far away in space. Near a black hole it grows: at one and a ',
          'half times the radius of its event horizon, the surface from which nothing returns, a ',
          'hovering clock runs at 58 percent of the rate of a distant one, and a clock at the horizon ',
          'would appear from far away to stop.',
        ),
        p(
          'Both effects are measured. Muons, unstable particles made when cosmic rays strike the ',
          'upper atmosphere, live 2.2 microseconds at rest, long enough to travel about 660 metres; ',
          'yet they reach the ground from fifteen kilometres up, because at their speeds their clocks ',
          'run ten to thirty times slow. In 1971 Joseph Hafele and Richard Keating flew caesium ',
          'clocks around the world on airliners and found them out of step with clocks at the US ',
          'Naval Observatory by the predicted tens of nanoseconds. In 1959 Robert Pound and Glen ',
          'Rebka measured the gravitational shift over the 22.5-metre height of a Harvard tower, and ',
          'in 2010 optical clocks at NIST detected it between two clocks 33 centimetres apart in ',
          'height.',
        ),
        p(
          'The effect you use daily is in your phone. GPS satellites orbit 20 000 kilometres up at ',
          '3.9 kilometres per second. Their speed makes their clocks lose 7 microseconds a day; their ',
          'height, higher in Earth’s gravity, makes them gain 46. Net, they run 38 microseconds a day ',
          'fast, and since a position is worked out from light-travel times, an error of 38 ',
          'microseconds a day would grow into about ten kilometres of position error per day. The ',
          'satellites’ clocks are set to tick slow before launch to compensate.',
        ),
        p(
          'Two misconceptions. Time dilation is not a clock malfunctioning: every process runs ',
          'slower together, the traveller’s heartbeat included, so the traveller feels nothing ',
          'unusual. And it is not an illusion caused by the time light takes to arrive; that delay ',
          'is corrected for in every one of these measurements, and what remains is real, as the ',
          'returning twin’s birthday shows.',
        ),
        /*
         * Source: https://www.nasa.gov/image-article/international-space-station-33/
         * ("International Space Station", NASA image article). The page describes
         * S134-E-010137 (29 May 2011): "The International Space Station is
         * featured in this image photographed by an STS-134 crew member on the
         * space shuttle Endeavour after the station and shuttle began their
         * post-undocking relative separation", and credits it "Photo credit:
         * NASA". Taken from the NASA Image and Video Library original,
         * s134e010137~orig.jpg, 4288 × 2848, converted to 1280 px wide webp.
         *
         * The brief's suggested Crew-2 fly-around frames (iss066e080193 and
         * siblings, 8 November 2021) carry no credit line on their NASA page and
         * were taken by ESA astronaut Thomas Pesquet, whose photographs ESA
         * credits "ESA/NASA–T. Pesquet" under its own licence; this frame has
         * an explicit NASA credit instead.
         *
         * Licence, from NASA's media usage guidelines,
         * https://www.nasa.gov/nasa-brand-center/images-and-media/: "NASA
         * content – images, audio, video, and media files used in the rendition
         * of 3-dimensional models, such as texture maps and polygon data in any
         * format – generally are not subject to copyright in the United States.
         * You may use this material for educational or informational purposes,
         * including photo collections, textbooks, public exhibits, computer
         * graphical simulations and Internet Web pages." — and "NASA should be
         * acknowledged as the source of the material." The credit below is the
         * image page's own.
         */
        figure({
          src: '/figures/time-dilation.webp',
          width: 1280,
          height: 850,
          alt: 'The International Space Station seen from a departing spacecraft, set against the blue curve of Earth with white clouds below and black space above: a long central truss carrying four pairs of copper-coloured solar wings, white radiators, and the pressurised modules running down the middle.',
          caption:
            'The International Space Station, 420 km up and moving at 7.7 km/s. Its speed slows its clocks by about 28 microseconds a day and its height speeds them up by 4, so its crew age about 24 microseconds a day less than people on the ground.',
          credit: 'NASA',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'lorentz',
          tex: '\\gamma \\;=\\; \\dfrac{1}{\\sqrt{1 - {{v}}^{2} / c^{2}}}',
          binds: ['v'],
          note: prose(
            p(
              m`\gamma`,
              ' — the Lorentz factor; ',
              m`v`,
              ' — the traveller’s speed (your slider); ',
              m`c`,
              ' — the speed of light. A moving clock ticks once for every ',
              m`\gamma`,
              ' ticks of a clock at rest.',
            ),
          ),
        },
        {
          id: 'twin',
          tex: '\\tau \\;=\\; \\dfrac{2d}{\\gamma\\,{{v}}}',
          binds: ['v'],
          note: prose(
            p(
              m`\tau`,
              ' — the time that passes for the traveller on the round trip; ',
              m`d`,
              ' — the distance to Proxima Centauri, 4.25 light-years. At home the trip takes ',
              m`2d/v`,
              '; on board it takes ',
              m`\gamma`,
              ' times less.',
            ),
          ),
        },
        {
          id: 'gravity',
          tex: '\\dfrac{d\\tau}{dt} \\;=\\; \\sqrt{1 - r_s / {{r}}}',
          binds: ['r'],
          note: prose(
            p(
              m`d\tau/dt`,
              ' — how fast a clock hovering at distance ',
              m`r`,
              ' runs compared with one far away; ',
              m`r_s`,
              ' — the ',
              term('Schwarzschild radius', 'schwarzschild-radius'),
              ', the size of the event horizon, ',
              m`2GM/c^2`,
              ', 29.5 km for a black hole of ten solar masses; ',
              m`r`,
              ' — the clock’s distance from the centre (your slider).',
            ),
            p(
              'Worked example, a GPS satellite. Orbit radius ',
              m`r = 2.656 \times 10^{7}\,\text{m}`,
              '; Earth’s radius ',
              m`R = 6.371 \times 10^{6}\,\text{m}`,
              '; ',
              m`GM = 3.986 \times 10^{14}\,\text{m}^3/\text{s}^2`,
              '.',
            ),
            p(
              'Speed: ',
              m`v = \sqrt{GM / r} = \sqrt{3.986 \times 10^{14} / 2.656 \times 10^{7}} = 3\,874\,\text{m/s}`,
              '.',
            ),
            p(
              'Loss from speed per day: ',
              m`v^2 / (2c^2) \times 86\,400\,\text{s} = (3\,874)^2 / (2 \times (2.998 \times 10^{8})^2) \times 86\,400 = 8.35 \times 10^{-11} \times 86\,400 = 7.2\,\mu\text{s}`,
              '.',
            ),
            p(
              'Gain from height per day: ',
              m`GM/c^2 \times (1/R - 1/r) \times 86\,400\,\text{s} = 4.435 \times 10^{-3} \times (1.570 \times 10^{-7} - 3.765 \times 10^{-8}) \times 86\,400 = 45.7\,\mu\text{s}`,
              '.',
            ),
            p(
              'Net: ',
              m`45.7 - 7.2 = 38.5\,\mu\text{s}`,
              ' a day fast. Light covers 11.5 km in that time.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'In special relativity the proper time along a worldline is ',
          m`\tau = \int \sqrt{1 - v(t)^2/c^2}\,dt`,
          ', the Minkowski length of the path divided by ',
          m`c`,
          '. Between two fixed events the inertial path maximises it; every other path, with any ',
          'acceleration, records less. The twin paradox is this statement about path length, and the ',
          'acceleration matters only in that it is what makes the traveller’s path not straight: the ',
          'time difference is set by the speeds along the whole path, not by the turnaround itself, ',
          'which could be made arbitrarily brief without changing the result. Each twin’s ',
          'observations are symmetric while both move inertially; the asymmetry is the traveller’s ',
          'change of inertial frame, across which the traveller’s notion of “now” at Earth jumps ',
          'forward by years.',
        ),
        p(
          'Gravitational time dilation follows from the equivalence principle before any field ',
          'equation: a clock at the top of an accelerating rocket runs fast relative to one at the ',
          'bottom by the fractional amount ',
          m`gh/c^2`,
          ', and an observer at rest in a gravitational field is such an accelerating observer. For ',
          'a static clock outside a non-rotating mass, the Schwarzschild metric gives ',
          m`d\tau/dt = \sqrt{1 - r_s/r}`,
          ', which reduces to ',
          m`1 - GM/(rc^2)`,
          ' in weak fields. The GPS system corrects for both effects at the design level: the ',
          'satellites’ 10.23 MHz reference is offset before launch by −4.465 parts in ',
          m`10^{10}`,
          ' to 10.22999999543 MHz, and the receivers apply a further correction for the orbits’ ',
          'small eccentricity, up to about 46 ns, and for the Sagnac effect of Earth’s rotation ',
          'during signal travel (Ashby 2003). Today’s optical lattice clocks, stable to parts in ',
          m`10^{18}`,
          ', see the gravitational shift across a single centimetre of height, which makes them ',
          'instruments for measuring the shape of Earth’s gravity field.',
        ),
        p(
          'Backward time travel is a different matter. General relativity permits spacetimes ',
          'containing a ',
          term('closed timelike curve'),
          ', a path that returns to its own past: Kurt Gödel’s rotating universe of 1949, the ',
          'interior of a spinning Kerr black hole beyond its inner horizon, and traversable wormholes ',
          'of the kind Michael Morris and Kip Thorne described in 1988, which could be turned into ',
          'time machines by moving one mouth relative to the other. Each requires something not ',
          'known to exist: a whole universe rotating, a region inside a black hole that is likely ',
          'unstable, or matter with negative energy density in amounts no known physics supplies. ',
          'Stephen Hawking’s chronology protection conjecture of 1992 proposes that quantum effects ',
          'always prevent such curves from forming, since the quantum fields near an incipient time ',
          'machine appear to grow without bound; it is not proven. Paradoxes of the grandfather kind ',
          'are usually handled by requiring self-consistency, the Novikov principle that the only ',
          'histories that occur are those in which nothing changes the past. None of this has an ',
          'observation behind it. The dilation of the first five layers has been measured every day ',
          'for decades; the time machines of this paragraph are solutions to equations, and whether ',
          'nature allows them is open.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'black-holes',
          reason:
            'The bottom panel here is the clock near the horizon that module describes; its Schwarzschild radius is the r_s in equation 3.',
        },
        {
          moduleId: 'escape-velocity',
          reason:
            'The depth of gravity that slows clocks is the same quantity: r_s/r is v_esc²/c², so the clock rate is √(1 − v_esc²/c²).',
        },
        {
          moduleId: 'gravitational-waves',
          reason: 'Time dilation is one effect of curved spacetime; that module is the curvature rippling outward.',
        },
        {
          moduleId: 'kepler-orbits',
          reason: 'The GPS orbit in the worked example is a Kepler orbit, and its speed follows from that module’s law.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Einstein 1905, “Zur Elektrodynamik bewegter Körper”, Annalen der Physik 322, 891',
      url: 'https://doi.org/10.1002/andp.19053221004',
      note: 'Special relativity and the slowing of moving clocks',
    },
    {
      label: 'Hafele & Keating 1972, “Around-the-World Atomic Clocks: Observed Relativistic Time Gains”, Science 177, 168',
      url: 'https://doi.org/10.1126/science.177.4044.168',
      note: 'Clocks flown on airliners',
    },
    {
      label: 'Pound & Rebka 1960, “Apparent Weight of Photons”, Phys. Rev. Lett. 4, 337',
      url: 'https://doi.org/10.1103/PhysRevLett.4.337',
      note: 'Gravitational shift over 22.5 m',
    },
    {
      label: 'Chou et al. 2010, “Optical Clocks and Relativity”, Science 329, 1630',
      url: 'https://doi.org/10.1126/science.1192720',
      note: 'Both effects measured at everyday speeds and a 33 cm height difference',
    },
    {
      label: 'Ashby 2003, “Relativity in the Global Positioning System”, Living Rev. Relativ. 6, 1',
      url: 'https://doi.org/10.12942/lrr-2003-1',
      note: 'GPS clock corrections: the 38 μs/day and the frequency offset',
    },
  ],
};

export default timeDilation;

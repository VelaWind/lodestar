/**
 * Escape velocity — the first published Lodestar module.
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
import { em, figure, m, p, prose, term } from '../rich';

const escapeVelocity: Module = {
  id: 'escape-velocity',
  title: 'Escape Velocity',
  tagline: 'How fast you have to throw something so gravity never gets it back.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Throw a stone upward and gravity always wins. But every world has a speed — ',
          'reach it, and nothing ever comes back.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture coasting on a bicycle toward a hill, no pedalling allowed. Whether you crest ',
          'it is decided entirely at the bottom: arrive too slow and you roll back; arrive fast ',
          'enough and you make it over with speed to spare.',
        ),
        p(
          'Gravity works like a hill stretching away from every planet: steepest at the surface, ',
          'gentler the farther out you go, and never quite ending. Here is the strange part: ',
          'although the hill goes on forever, the total climb adds up to a finite amount. So there ',
          'is a single starting speed that beats it. Below that speed you coast up, slow, stop, and ',
          'fall back. At or above it, you never stop at all.',
        ),
        p('That threshold is what you are testing when you drag the launch slider below.'),
        p(
          'The analogy breaks in one place: a bicycle loses speed to friction and air resistance, ',
          'and this hill has neither. Nothing in empty space slows the climb except gravity itself.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'escape-velocity',
      caption: prose(
        p(
          'Pick a world (how heavy, how big) then choose a launch speed and fire straight up. ',
          'Watch what falls back and what doesn’t.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How heavy is the body?',
          technicalLabel: 'Gravitating mass',
          symbol: 'M',
          unit: 'kg',
          min: 1e18,
          max: 1e32,
          default: M_EARTH,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
        {
          id: 'R',
          friendlyLabel: 'How big is its radius?',
          technicalLabel: 'Surface radius',
          symbol: 'R',
          unit: 'm',
          min: 1e3,
          max: 1e10,
          default: R_EARTH,
          step: 0.01,
          scale: 'log',
          format: { notation: 'scientific', digits: 3 },
        },
        {
          id: 'v0',
          friendlyLabel: 'How fast do you throw it?',
          technicalLabel: 'Launch speed',
          symbol: 'v_0',
          unit: 'm/s',
          min: 0,
          max: 25_000,
          // 8 km/s: fast enough to arc most of the way out, slow enough to fall
          // back — the reader arrives just below Earth's threshold.
          default: 8000,
          step: 100,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'km/s', factor: 1e-3 } },
        },
      ],
      approximations: [
        prose(
          p(
            'There is no air. A real ',
            term('ballistic', 'ballistic'),
            ' throw at 11 kilometres per second from the ground would burn up like a meteor in reverse.',
          ),
        ),
        prose(
          p(
            'The planet is a perfect ball that does not spin. Spin would help: launching east from Earth’s equator gets about 0.47 kilometres per second for free.',
          ),
        ),
        prose(
          p(
            'The throw is straight up. Escape speed is the same in any direction that clears the ground; only the path changes.',
          ),
        ),
        prose(
          p(
            'Gravity here is Newton’s, not Einstein’s. The difference only matters near a black hole (see Going deeper).',
          ),
        ),
        prose(
          p(
            'Nothing else pulls on the projectile. Escaping Earth is not escaping the Sun: thrown from the ground in the right direction, that takes about 16.6 kilometres per second in all.',
          ),
        ),
        prose(
          p(
            'The flight is sped up. The default of 8 kilometres per second really takes about 36 minutes up and the same back down.',
          ),
        ),
        prose(
          p(
            'The height scale is stretched above the marked switchover, so a 100-kilometre hop and a million-kilometre climb fit in one frame. Every height read off it is still exact.',
          ),
        ),
        prose(
          p(
            'The path is worked out in small time steps. Its drawn peak matches the true highest point, which the readout gives, to within about a hundredth of a percent.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'What the sliders call ',
          em('how heavy'),
          ' and ',
          em('how big'),
          ' are the body’s ',
          em('mass'),
          ' ',
          m`M`,
          ' and ',
          em('radius'),
          ' ',
          m`R`,
          '. The launch threshold you have been probing is its ',
          em('escape velocity'),
          ': the minimum speed an unpowered projectile needs at the surface to climb away and ',
          'never fall back. Despite the name it is a speed, not a velocity: the direction barely ',
          'matters, so long as you do not aim into the ground.',
        ),
        p(
          'For Earth it is 11.2 km/s, about thirty-three times the speed of sound, or the length ',
          'of Manhattan every two seconds. The Moon’s is 2.4 km/s, Mars sits at 5.0, Jupiter ',
          'demands 59.5, and the Sun 618. None of these were measured by launching anything. A ',
          'body’s mass comes from watching how things orbit it, its radius from imaging and ',
          term('occultations', 'occultation'),
          ', and escape velocity follows from the two.',
        ),
        p(
          'The most common misconception about it: that rockets must reach escape velocity. They ',
          'do not. Escape velocity applies to a projectile given all its speed at the surface, ',
          'coasting ever after. A rocket that keeps thrusting could leave Earth at walking pace, ',
          'given absurd amounts of fuel. That is hopelessly inefficient, which is why real ',
          'launches burn hard and early, but nothing in physics forbids it. A related confusion: ',
          'satellites have ',
          'not escaped anything. Low Earth orbit needs about 7.8 km/s ',
          em('sideways'),
          ', and the International Space Station is permanently falling.',
        ),
        p(
          'Escape velocity also draws the line between worlds that keep an atmosphere and worlds ',
          'that lose one. Gas molecules move at thermal speeds set by temperature; when the ',
          'fastest of them exceed escape velocity, the atmosphere leaks into space, molecule by ',
          'molecule. That is part of why Titan, with an escape velocity of 2.6 km/s, close to the ',
          'Moon’s 2.4, holds a nitrogen atmosphere denser than Earth’s while the Moon is bare. Titan is cold, ',
          'so its molecules are slow. Temperature and escape velocity set the boundary together; ',
          'gravity alone does not decide.',
        ),
        /*
         * Source: https://www.nasa.gov/image-article/apollo-8-earthrise/
         * Asset:  https://images-assets.nasa.gov/image/as08-14-2383/as08-14-2383~orig.jpg
         * Licence, from NASA's media usage guidelines
         * (https://www.nasa.gov/nasa-brand-center/images-and-media/): "NASA
         * content – images, audio, video, and media files … generally are not
         * subject to copyright in the United States", usable for educational
         * purposes provided NASA is acknowledged as the source. No specific
         * credit line is mandated beyond that acknowledgement.
         */
        figure({
          src: '/figures/escape-velocity.webp',
          width: 1280,
          height: 1280,
          alt: 'The Earth, half in shadow, rising above the grey cratered horizon of the Moon.',
          caption:
            'Earthrise, photographed by Bill Anders from Apollo 8 lunar orbit on 24 December 1968. Getting there took nearly the whole escape budget: the engine burn that sent the crew toward the Moon left Earth at about 10.8 kilometres per second, within four percent of the escape speed this module computes.',
          credit: 'NASA / Bill Anders, Apollo 8 (AS8-14-2383)',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'escape-velocity',
          tex: 'v_{\\text{esc}} \\;=\\; \\sqrt{\\dfrac{2G\\,{{M}}}{{{R}}}}',
          binds: ['M', 'R'],
          note: prose(
            p(
              m`v_{\text{esc}}`,
              ' — escape velocity at the surface; ',
              m`G`,
              ' — gravitational constant; ',
              m`M`,
              ' — mass of the body (your slider); ',
              m`R`,
              ' — its radius (your slider).',
            ),
          ),
        },
        {
          id: 'apex',
          tex: 'r_{\\max} \\;=\\; \\dfrac{1}{\\dfrac{1}{{{R}}} \\,-\\, \\dfrac{{{v0}}^{2}}{2G\\,{{M}}}}',
          binds: ['M', 'R', 'v0'],
          note: prose(
            p(
              m`r_{\max}`,
              ' — farthest distance from the body’s centre; ',
              m`v_0`,
              ' — launch speed (your slider). Altitude at ',
              term('apex', 'apex'),
              ' is ',
              m`r_{\max} - R`,
              '. As ',
              m`v_0`,
              ' approaches ',
              m`v_{\text{esc}}`,
              ', the denominator approaches zero and the apex runs away to infinity — that ',
              'divergence is the escape threshold itself.',
            ),
            p(
              'Worked example (Earth sliders at default): ',
              m`M`,
              ' = 5.972 × 10²⁴ kg, ',
              m`R`,
              ' = 6.371 × 10⁶ m gives ',
              m`v_{\text{esc}}`,
              ' = 11.19 km/s. Launching at ',
              m`v_0`,
              ' = 8 km/s puts the apex near 6,700 km of altitude — a little more than one Earth ',
              'radius up — before the fall back begins.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The derivation is two lines of energy bookkeeping. Specific orbital energy is ',
          m`\varepsilon = v^2/2 - GM/r`,
          '; escape means reaching ',
          m`r \to \infty`,
          ' with ',
          m`v \geq 0`,
          ', i.e. ',
          m`\varepsilon \geq 0`,
          '. The non-obvious step is that the well has finite depth at all: ',
          m`\int_R^\infty GM/r^2\,dr = GM/R`,
          ' converges. Setting ',
          m`v^2/2 = GM/R`,
          ' gives ',
          m`v_{\text{esc}} = \sqrt{2GM/R}`,
          '. Note it is ',
          m`\sqrt{2}`,
          ' times the circular orbit speed at the same radius, which is why “add 41% to orbital ',
          'velocity” is a serviceable rule of thumb for leaving from orbit.',
        ),
        p(
          'The assumptions, stated as assumptions. Spherical symmetry, so the ',
          term('shell theorem', 'shell-theorem'),
          ' ',
          'reduces the body to a point mass, degraded for oblate or irregular bodies at low ',
          'altitude. An isolated two-body system: in reality, escaping Earth’s well only delivers ',
          'you into the Sun’s; leaving the Solar System from Earth’s surface takes about 16.6 km/s ',
          'once Earth’s orbital motion is spent wisely. A non-rotating body: Earth’s equator ',
          'donates 0.47 km/s eastward for free, which is why launch sites favour low latitudes. A ',
          'vacuum: atmospheric drag makes an actual 11 km/s surface launch a fireball, so quoted ',
          'escape velocities are surface values applied, in practice, from above the atmosphere. ',
          'And Newtonian gravity throughout.',
        ),
        p(
          'That last assumption fails interestingly. Set ',
          m`v_{\text{esc}} = c`,
          ' and solve for the radius: ',
          m`r = 2GM/c^2`,
          ', which is exactly the ',
          term('Schwarzschild radius', 'schwarzschild-radius'),
          ' of general relativity. Michell in 1784 and ',
          'Laplace after him ran this argument and predicted “dark stars.” The numerical agreement ',
          'is the right answer reached by the wrong physics: the Newtonian picture of light as a ',
          'projectile that decelerates is wrong. In relativity nothing slows the light; inside the ',
          'horizon there are no outgoing paths at all. What does carry over is the formula itself: ',
          'an observer hovering at radius ',
          m`r`,
          ' would measure the escape speed as exactly ',
          m`\sqrt{2GM/r}`,
          ', reaching ',
          m`c`,
          ' at the horizon.',
        ),
        p(
          'Atmospheric escape, by contrast, is a live research field. The mechanisms — ',
          term('Jeans escape', 'jeans-escape'),
          ' from the thermal tail, ',
          term('hydrodynamic outflow', 'hydrodynamic-escape'),
          ', solar-wind stripping and ',
          term('sputtering', 'sputtering'),
          ' — operate at rates MAVEN has now measured at Mars: roughly 100 grams per ',
          'second lost to solar-wind stripping today, a few kilograms per second in total, ',
          'spiking during solar storms, and integrating to most of Mars’s original atmosphere ',
          'over four billion years. Zahnle and Catling’s “cosmic shoreline” — an empirical line ',
          'in the plane of escape velocity versus stellar irradiation separating airless bodies ',
          'from air-bearing ones — turns this module’s parameter into an axis of one of exoplanet ',
          'science’s open questions: whether rocky planets around M-dwarfs sit above or below the ',
          'line. The first JWST measurements of the inner TRAPPIST-1 planets lean toward bare ',
          'rock, and the question is unsettled.',
        ),
        p(
          'The simulation’s shortcuts, in full. Drag and heating are the largest omission near ',
          'the surface, and the vacuum result is honest only above roughly 100 km, which is why ',
          'real launches are powered rather than thrown. Sphericity costs nothing (a uniform ',
          'sphere pulls exactly as a point mass would) but rotation does: rotation and the ',
          'equatorial bulge together lower Earth’s equatorial gravity by about 0.5%. Escape ',
          'speed is direction-independent for an unpowered object, but an angled launch traces a ',
          'conic section rather than the vertical line drawn. The projectile does not recoil ',
          'the planet, and the further 12.3 km/s to leave the Sun is counted from Earth’s orbital ',
          'position. Playback compresses the flight to seconds while keeping its relative timing, ',
          'so the projectile still spends most of it near the apex, where it is slowest. The ',
          'altitude axis is linear near the surface and logarithmic above, which distorts the ',
          'path’s shape across the switchover but not any altitude read from it. And the path is ',
          'integrated with velocity Verlet at a fixed timestep, stretched only when a flight would ',
          'not otherwise fit the step budget: symplectic and second-order, each step opening with ',
          'a half kick so position and velocity stay in step. That matters most just below escape ',
          'speed, where the apex goes as ',
          m`1/(1 - v_0^2/v_{\text{esc}}^2)`,
          ' and magnifies any energy error; even there the drawn peak agrees with the closed form ',
          'to within about a hundredth of a percent (0.001% at 11.1 km/s on Earth). The readout ',
          'and the status use the closed form.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'kepler-orbits',
          reason:
            'Below escape speed, aim sideways instead of up: escape velocity is √2 times circular orbit speed, and everything between the two thresholds is an orbit.',
        },
        {
          moduleId: 'black-holes',
          reason:
            'Where escape velocity reaches the speed of light — and why that Newtonian phrasing is famously almost right.',
        },
        {
          moduleId: 'planetary-atmospheres',
          reason:
            'The shoreline between worlds that keep their air and worlds that leak it into space.',
        },
      ],
    },
  },

  references: [
    {
      label: 'NASA Planetary Fact Sheet (D. R. Williams, NASA GSFC)',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
      note: 'Planetary escape velocities quoted in layer 4',
    },
    {
      label: 'CODATA 2018 recommended values of the fundamental constants',
      url: 'https://physics.nist.gov/cuu/Constants/',
      note: 'Value of G',
    },
    {
      label: 'Jakosky et al. 2018, “Loss of the Martian atmosphere to space”, Icarus 315',
      url: 'https://www.sciencedirect.com/science/article/abs/pii/S0019103517306917',
      note: 'MAVEN loss rates in layer 6',
    },
    {
      label: 'Zahnle & Catling 2017, “The Cosmic Shoreline”, ApJ 843:122',
      url: 'https://iopscience.iop.org/article/10.3847/1538-4357/aa7846',
      note: 'Escape velocity vs irradiation boundary',
    },
    {
      label: 'Bate, Mueller & White, “Fundamentals of Astrodynamics”',
      url: 'https://store.doverpublications.com/0486600610.html',
      note: 'Energy derivation and orbital mechanics background',
    },
  ],
};

export default escapeVelocity;

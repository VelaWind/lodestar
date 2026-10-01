/**
 * Wormholes and white holes — the eighteenth published Lodestar module, and
 * the third of the relativity batch.
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
import { figure, m, p, prose, term } from '../rich';

const wormholes: Module = {
  id: 'wormholes',
  title: 'Wormholes and White Holes',
  tagline:
    'Einstein’s equations allow tunnels through space and black holes run backwards. Nothing we know of can build either.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Einstein’s equations allow a tunnel through space: step into one end and out of the other, ',
          'light-years away, a few paces later. Nothing proven forbids it, but it needs one ingredient ',
          'that nobody has ever found in quantity.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Draw two dots at opposite ends of a sheet of paper. The shortest way between them runs across ',
          'the sheet. Now fold the paper so the dots sit one above the other, and push a pencil through ',
          'both. The pencil is a shortcut: a path between the dots far shorter than the one across the ',
          'sheet.',
        ),
        p(
          'That is the picture of a wormhole. The sheet is space, the two dots are places far apart, and ',
          'the pencil hole is a tunnel joining them directly. Einstein’s theory of gravity says space can ',
          'bend, and its equations allow bends like this one, with two openings joined by a narrow ',
          'throat.',
        ),
        p(
          'The difficulty is keeping the tunnel open. Gravity pulls things together, so any throat made ',
          'of ordinary matter or energy pinches shut the moment it forms. Holding one open needs ',
          'something that pushes outward, something with negative energy, and the only negative energy ',
          'ever measured comes in amounts too small to hold open a tunnel the width of an atom.',
        ),
        p(
          'Where the analogy breaks: the paper folds through the room around it, but space does not need ',
          'anything to fold through; the bending is in space itself, and the fold in the drawing is only ',
          'a way of showing it. And a pencil goes through paper easily, while nothing we know of can ',
          'hold a real throat open.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'wormholes',
      caption: prose(
        p(
          'Widen and narrow the throat of the tunnel, and see how much negative mass it would take to ',
          'hold it open, and how impossibly close two plates would have to sit to make negative energy ',
          'that dense.',
        ),
      ),
      params: [
        {
          id: 'b0',
          friendlyLabel: 'How wide is the throat?',
          technicalLabel: 'Throat radius',
          symbol: 'b_0',
          unit: 'm',
          // A millimetre to about seventy AU. Default: one metre, wide enough to step through.
          min: 1e-3,
          max: 1e13,
          default: 1,
          // decades; 1600 steps of 0.01, shrunk by one part in 10¹² so (max − min) / step
          // rounds up to 1600 and the input can reach its maximum. The shrink is kept that
          // small so the default, 300 steps up, stays on the grid to a part in 10¹¹.
          step: ((Math.log10(1e13) - Math.log10(1e-3)) / 1600) * (1 - 1e-12),
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'm', factor: 1 } },
        },
      ],
      approximations: [
        prose(
          p(
            'The wormhole is the simplest traversable kind, with the same gravity everywhere along it and no tidal stretching. Other shapes need less negative mass in total but pack it more densely.',
          ),
        ),
        prose(
          p(
            'The negative mass is treated as smooth matter spread around the throat. Whether any real field can supply it in these amounts is exactly what is unknown.',
          ),
        ),
        prose(
          p(
            'The drawing is the usual embedding diagram: space around the throat shown as a curved surface, with one dimension left out so it can be drawn. There is no higher dimension that the tunnel bends through.',
          ),
        ),
        prose(
          p(
            'The negative mass quoted is the exotic matter’s density added up over all space; from outside, this wormhole has no net mass at all. A traveller moving through still feels sideways tidal forces.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A ',
          term('wormhole'),
          ' is a solution of general relativity in which two separate regions of space are joined by a ',
          'throat. Its geometry was first noticed by Ludwig Flamm in 1916 and made explicit in 1935 by ',
          'Albert Einstein and Nathan Rosen, inside the mathematics of the simplest black hole: the ',
          'full solution contains two outside regions joined ',
          'at the horizon, an ',
          term('Einstein–Rosen bridge', 'einstein-rosen-bridge'),
          '. In 1962 Robert Fuller and John Wheeler showed it cannot be crossed. The throat opens and ',
          'pinches shut faster than light could travel from one side to the other, and anything that ',
          'tried would be caught in the collapse. A black hole formed by a collapsing star has no bridge ',
          'at all; the collapsing star replaces the second region.',
        ),
        p(
          'In 1988 Michael Morris and Kip Thorne asked what a wormhole a person could travel through would ',
          'need, and answered: at the throat, matter with negative energy density, which they called ',
          term('exotic matter'),
          '. Every form of matter and energy ever observed in quantity obeys the ',
          term('energy condition'),
          ' that forbids it. The amount is the problem. For the simplest traversable wormhole, a throat ',
          'one metre in radius needs negative mass about equal to the mass of Jupiter, and the ',
          'requirement grows in step with the throat: a throat a kilometre in radius needs a negative ',
          'Sun.',
        ),
        p(
          'Negative energy density does exist, in small amounts. In the ',
          term('Casimir effect'),
          ', two metal plates very close together feel a slight attraction because the vacuum between ',
          'them has a little less energy than the vacuum outside; Steven Lamoreaux measured it in 1997, ',
          'and it is now routine. But it is feeble. To reach the density a one-metre throat needs, the ',
          'plates would have to be about 3 × 10⁻¹⁸ metres apart, a three-hundredth of the radius of a ',
          'proton, where the idea of metal plates no longer means anything.',
        ),
        p(
          'A ',
          term('white hole'),
          ' is the black hole’s time reverse: a region nothing can enter, from which matter and light can ',
          'only leave. It appears in the same mathematics as the Einstein–Rosen bridge, as the past of ',
          'the full solution. Douglas Eardley showed in 1974 that a white hole is unstable: anything ',
          'falling towards it piles up at its edge and collapses it into a black hole. None has been ',
          'seen, and no process is known that would make one.',
        ),
        p(
          'Two misconceptions. Black holes are not wormholes: a real black hole has no exit, and whatever ',
          'falls in stays in. And the wormholes of films are not predictions. The equations allow them ',
          'the way they allow many things that do not happen; what decides is whether nature supplies ',
          'the negative energy, and so far it has not.',
        ),
        /*
         * Source: https://svs.gsfc.nasa.gov/13326/ ("Black Hole Accretion Disk
         * Visualization", NASA Scientific Visualization Studio, released 25
         * September 2019). The page describes the visualisation: "This new
         * visualization of a black hole illustrates how its gravity distorts
         * our view, warping its surroundings as if seen in a carnival mirror",
         * created by Jeremy Schnittman at NASA's Goddard Space Flight Center,
         * and credits every item "Credit: NASA's Goddard Space Flight
         * Center/Jeremy Schnittman". Taken from the first frame of the page's
         * 360° sequence, BH_Accretion_Disk_Sim_360_4k_Prores.00001_print.jpg
         * (1024 × 1024, the disc seen edge-on), cropped to its central
         * 1024 × 576 and converted to webp. The page's larger still,
         * BH_labeled.jpg, carries explanatory labels across the image and was
         * not used.
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
         * page's own.
         */
        figure({
          src: '/figures/wormholes.webp',
          width: 1024,
          height: 576,
          alt: 'A black hole seen from the side against black space: a thin, glowing orange-red disc crosses the image, the far side of the disc appears bent up and over a dark central circle in a bright arch, and a smaller glowing arc of its underside is bent into view below.',
          caption:
            'An illustration, not an observation: a black hole seen close up, its own light bent around it. The Einstein–Rosen bridge lies hidden in the mathematics of the simplest black hole, closed to anything trying to cross.',
          credit: 'NASA’s Goddard Space Flight Center/Jeremy Schnittman',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'shape',
          tex: 'r(\\ell) \\;=\\; \\sqrt{ {{b0}}^{2} + \\ell^{2} }',
          binds: ['b0'],
          note: prose(
            p(
              m`r`,
              ' — the size of the tunnel, measured as its circumference divided by 2π, at a distance ',
              m`\ell`,
              ' along it from the throat; ',
              m`b_0`,
              ' — the throat radius (your slider). The tunnel is narrowest at ',
              m`\ell = 0`,
              ' and widens either way.',
            ),
          ),
        },
        {
          id: 'exotic-mass',
          tex: 'M_{\\text{exotic}} \\;=\\; -\\dfrac{\\pi}{2}\\,\\dfrac{c^{2}\\,{{b0}}}{G}',
          binds: ['b0'],
          note: prose(
            p(
              m`M_{\text{exotic}}`,
              ' — the total negative mass of the matter holding the throat open, for this simplest ',
              'wormhole. It grows in step with the throat.',
            ),
          ),
        },
        {
          id: 'throat-density',
          tex: '\\rho \\;=\\; -\\dfrac{c^{2}}{8\\pi G\\,{{b0}}^{2}}',
          binds: ['b0'],
          note: prose(
            p(
              m`\rho`,
              ' — the density of that matter at the throat, negative. A smaller throat needs less mass in ',
              'total but packs it far more densely.',
            ),
            p('Worked example, a throat one metre in radius: ', m`b_0 = 1\,\text{m}`, '.'),
            p(
              m`M_{\text{exotic}} = -(3.142 / 2) \times (2.998 \times 10^{8})^2 \times 1 / (6.674 \times 10^{-11}) = -2.12 \times 10^{27}\,\text{kg}`,
              ', about minus one Jupiter.',
            ),
            p(
              m`\rho = -(2.998 \times 10^{8})^2 / (8\pi \times 6.674 \times 10^{-11} \times 1^2) = -5.4 \times 10^{25}\,\text{kg/m}^3`,
              ', a few hundred million times the density of an atomic nucleus, negative.',
            ),
            p(
              'The Casimir effect between plates a distance ',
              m`a`,
              ' apart gives ',
              m`\rho = -\pi^2\hbar/(720\,c\,a^4)`,
              '. Setting the two equal gives ',
              m`a \approx 3 \times 10^{-18}\,\text{m}`,
              ', about a three-hundredth of a proton’s radius.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Morris and Thorne wrote the static wormhole as ',
          m`ds^2 = -e^{2\Phi(r)} c^2 dt^2 + dr^2/(1 - b(r)/r) + r^2 d\Omega^2`,
          ', with a redshift function ',
          m`\Phi`,
          ' and a shape function ',
          m`b`,
          '; the throat is the smallest radius, ',
          m`r = b_0`,
          ', where ',
          m`b(b_0) = b_0`,
          '. Keeping the throat open requires the flare-out condition, that the embedded ',
          'surface widen away from the throat, which through the Einstein equations forces the null ',
          'energy condition to fail there: along some light rays, the energy density plus pressure is ',
          'negative. This is general, not a feature of one model; Hochberg and Visser showed it holds for ',
          'any throat, static or not. The sim uses the zero-tidal Ellis wormhole, ',
          m`\Phi = 0`,
          ' and ',
          m`b = b_0^2/r`,
          ', for which the exotic density falls as ',
          m`r^{-4}`,
          ' and integrates to ',
          m`-(\pi/2)c^2 b_0/G`,
          '. Matt Visser’s thin-shell wormholes, cut and glued from two copies of a spacetime, confine ',
          'the exotic matter to a shell at the throat and can make the total arbitrarily small, at the ',
          'price of arbitrarily large densities there.',
        ),
        p(
          'Quantum fields do violate the null energy condition locally, in the Casimir effect, in ',
          'squeezed states of light, and near black-hole horizons, but not freely. The quantum ',
          'inequalities of Lawrence Ford and Thomas Roman bound how negative the energy density can be ',
          'and over what extent: roughly, a negative energy density of magnitude ',
          m`u`,
          ' can be sustained only over a region no larger than about ',
          m`(\hbar c/u)^{1/4}`,
          '. For a one-metre throat this rough rule already confines the exotic matter to about ',
          m`10^{-17}`,
          ' m; Ford and Roman’s full calculation, made for a massless scalar field and their own ',
          'example geometries, is stricter: for a typical such wormhole, about a millionth of a ',
          'proton’s size. ',
          'Either the throat is only a little larger than the Planck length, or the negative energy ',
          'sits in a band many orders of magnitude thinner than the throat. The averaged ',
          'null energy condition, integrated along complete light rays, is proven for quantum fields in ',
          'flat space. Its achronal version in curved spacetime, if it holds, rules out any wormhole ',
          'that is a shortcut; proposals that evade it use quantum effects that are nonlocal or need special geometries. In 2017 Ping Gao, ',
          'Daniel Jafferis and Aron Wall found a wormhole made traversable by a coupling between its two ',
          'mouths in anti-de Sitter space, a model universe used in quantum gravity; it transmits ',
          'signals, but more slowly than going around the outside, so it offers no shortcut.',
        ),
        p(
          'Two further ideas keep wormholes in current research. ER = EPR, proposed by Juan Maldacena and ',
          'Leonard Susskind in 2013, conjectures that every pair of entangled particles is connected by a ',
          'microscopic, non-traversable Einstein–Rosen bridge, which would make wormholes the geometric ',
          'form of quantum entanglement; it is a proposal about quantum gravity, not a route to travel. ',
          'And, as the time-dilation module describes, a traversable wormhole whose mouths move relative ',
          'to one another becomes a time machine containing a ',
          term('closed timelike curve'),
          ', which is the strongest argument that something, perhaps Hawking’s chronology protection, ',
          'forbids them. White holes, finally, appear in proposals that a black hole’s end, after ',
          term('Hawking radiation'),
          ' has shrunk it to the Planck scale, is a quantum bounce into a white hole; these are ',
          'speculative, and no observation distinguishes them. Everything in this layer is theory. The ',
          'tunnels and the time reversals are allowed by the mathematics, and no experiment or ',
          'observation has found either.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'black-holes',
          reason:
            'The Einstein–Rosen bridge is hidden in that module’s black hole; its horizon is where the bridge’s two sides meet.',
        },
        {
          moduleId: 'time-dilation',
          reason:
            'That module’s last layer is what a traversable wormhole would become if one mouth were moved: a time machine.',
        },
        {
          moduleId: 'hawking-radiation',
          reason:
            'Evaporation is where white holes reappear, in proposals for how a black hole’s last moment might end.',
        },
        {
          moduleId: 'gravitational-waves',
          reason:
            'Those waves are spacetime curvature that has been measured; a wormhole would be curvature that has not.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Einstein & Rosen 1935, “The Particle Problem in the General Theory of Relativity”, Phys. Rev. 48, 73',
      url: 'https://doi.org/10.1103/PhysRev.48.73',
      note: 'The Einstein–Rosen bridge',
    },
    {
      label: 'Ellis 1973, “Ether flow through a drainhole: A particle model in general relativity”, J. Math. Phys. 14, 104',
      url: 'https://doi.org/10.1063/1.1666161',
      note: 'The wormhole geometry the sim uses',
    },
    {
      label:
        'Morris & Thorne 1988, “Wormholes in spacetime and their use for interstellar travel: A tool for teaching general relativity”, Am. J. Phys. 56, 395',
      url: 'https://doi.org/10.1119/1.15620',
      note: 'Traversable wormholes and exotic matter',
    },
    {
      label: 'Eardley 1974, “Death of White Holes in the Early Universe”, Phys. Rev. Lett. 33, 442',
      url: 'https://doi.org/10.1103/PhysRevLett.33.442',
      note: 'The instability of white holes',
    },
    {
      label: 'Lamoreaux 1997, “Demonstration of the Casimir Force in the 0.6 to 6 μm Range”, Phys. Rev. Lett. 78, 5',
      url: 'https://doi.org/10.1103/PhysRevLett.78.5',
      note: 'The Casimir effect measured',
    },
  ],
};

export default wormholes;

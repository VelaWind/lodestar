/**
 * Supernovae — the twelfth published Lodestar module.
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
import { LIGHT_YEAR, M_SUN, PARSEC } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const supernovae: Module = {
  id: 'supernovae',
  title: 'Supernovae',
  tagline:
    'How a star dies depends on one number, its mass. Above a line, it ends in the brightest event in its galaxy.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'When a star fifteen times heavier than the Sun dies, its core collapses in under a ',
          'second, and for a few weeks the explosion shines as bright as hundreds of millions of ',
          'Suns. Some of the iron in your blood was made that way.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'A star is a balancing act. Gravity pulls everything toward the centre; the heat of the ',
          'core pushes back. Think of a hot-air balloon: as long as the burner runs, the balloon ',
          'holds its shape and its height. The star’s burner is fusion at the core, light atoms ',
          'merging into heavier ones and giving off heat as they do, and it has run for the Sun’s ',
          'whole life.',
        ),
        p(
          'Fuel runs out. For a star like the Sun that is undramatic: the core shrinks, the outer ',
          'layers drift away as a glowing shell, and what is left is a hot, dense ember the size ',
          'of the Earth that cools for the rest of time. But a star many times heavier burns ',
          'through its fuel in a few million years and then, in its last day, forges iron at its ',
          'centre. Iron gives no heat when it fuses. In a star that weighs more than eight Suns, ',
          'the burner goes out at the centre. The core falls in on itself at a quarter of the ',
          'speed of light. It stops only when it is as dense as an atomic nucleus, the tiny, heavy ',
          'heart of an atom, and can fall no further. The ',
          'infalling layers slam into it, and the rebound, driven by a flood of particles from the ',
          'new core, blows the rest of the star into space.',
        ),
        p(
          'Where the analogy breaks: a balloon with its burner out sinks; it does not ',
          'collapse in a second and rebound. And the balloon’s burner gives out because the fuel ',
          'is gone, while the star’s core stops because it has made a fuel, iron, that no fusion ',
          'can burn. There is a second way for a star to explode, with no burner involved at all, ',
          'and the next layer describes it.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'supernovae',
      caption: prose(
        p(
          'Slide the star’s birth mass across the line at eight Suns and see its fate change from ',
          'a quiet ember to a collapse. Then take a supernova of the kind that always flares to ',
          'about the same peak brightness, move it nearer and farther, and see how far away it ',
          'would still be visible to the naked eye.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How heavy is the star at birth? (in Suns)',
          technicalLabel: 'Initial mass',
          symbol: 'M',
          unit: 'kg',
          // Half a solar mass to 32. Stars below about 0.9 M☉ have not yet had time to
          // die (a 0.5 M☉ star lives about 57 billion years); their fate is the
          // prediction, and the sim discloses it. Default: the Sun.
          min: 0.5 * M_SUN,
          // 0.5 × 2⁶, so the grid below lands on 0.5, 1, 2, 4, 8, 16 and 32 M☉ exactly
          max: 32 * M_SUN,
          default: M_SUN,
          // decades; 30 steps per doubling, shrunk by one part in 10⁹ so
          // (max − min) / step rounds up to 180 and the input can reach its
          // maximum. Without the shrink, floating point leaves it one step short.
          step: (Math.log10(2) / 30) * (1 - 1e-9),
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'M☉', factor: 1 / M_SUN } },
        },
        {
          id: 'd',
          friendlyLabel: 'How far away does it explode?',
          technicalLabel: 'Distance to a Type Ia',
          symbol: 'd',
          unit: 'm',
          // Three parsecs to a gigaparsec. Default: Betelgeuse's distance, 168 pc.
          min: 1e17,
          max: 3e25,
          default: 168 * PARSEC,
          // decades; 848 equal steps, shrunk by one part in 10⁹ so (max − min) / step
          // rounds up to 848 and the input can reach its maximum. Without the
          // shrink, floating point leaves it one step short.
          step: ((Math.log10(3e25) - Math.log10(1e17)) / 848) * (1 - 1e-9),
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'light-years', factor: 1 / LIGHT_YEAR },
          },
        },
      ],
      approximations: [
        prose(
          p(
            'Fates are drawn as sharp cuts at 8 and 20 times the Sun’s mass. The real boundaries are fuzzy by a couple of Suns either way.',
          ),
        ),
        prose(
          p(
            'Lifetime and brightness use simple rules of thumb, good to about a factor of two up to 20 Suns; above that they make stars burn out too fast.',
          ),
        ),
        prose(
          p(
            'The brightness panel uses one kind of supernova at its average peak brightness, with no dust in the way. The kind made by a collapsing core is usually about six times fainter.',
          ),
        ),
        prose(
          p(
            'Stars lighter than about 0.9 Suns have not had time to die yet; the fate shown for them is a prediction.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A supernova is the explosion of a star, and there are two ways to make one. A ',
          term('core-collapse supernova'),
          ' is the death of a star born with more than about eight times the Sun’s mass. Such a ',
          'star fuses successively heavier elements in its core, each stage faster than the last, ',
          'ending with iron; since fusing iron absorbs energy rather than releasing it, the core ',
          'becomes an inert ball that grows until it passes the ',
          term('Chandrasekhar limit'),
          ', about 1.4 solar masses, the most that the pressure of packed electrons can hold up. ',
          'It then collapses in under a second to a ',
          term('neutron star'),
          ', a sphere about 24 km across, or, for the heaviest stars, straight to a black hole. ',
          'About 99 percent of the energy released, some 3 × 10⁴⁶ joules, leaves as neutrinos; ',
          'well under one percent goes into the explosion and about a hundredth of that into light. ',
          'Twenty-five of those neutrinos were caught on Earth in February 1987 from SN 1987A in ',
          'the Large Magellanic Cloud, arriving hours before the light, the only supernova ',
          'neutrinos ever detected.',
        ),
        p(
          'A ',
          term('Type Ia supernova', 'type-ia-supernova'),
          ' is different: no massive star, no core collapse. A ',
          term('white dwarf'),
          ', the ember left by a Sun-like star, gains mass from a companion until it nears the ',
          'Chandrasekhar limit, and its carbon ignites near its centre and a burning front ',
          'consumes the whole star in about a second. Nothing is left behind. Because every ',
          'Type Ia detonates at nearly the ',
          'same mass, every one reaches nearly the same peak brightness, an absolute magnitude of ',
          'about −19.3, which makes them the best ',
          term('standard candle'),
          ' in the sky: measure how bright one looks, and you have its distance. It was Type Ia ',
          'supernovae that revealed the accelerating expansion of the universe in 1998.',
        ),
        p(
          'Most stars will do neither. Below about eight solar masses, which is nearly every star, ',
          'the end is, or for the lightest will be, a ',
          term('planetary nebula'),
          ' and a white dwarf; the Sun will go this way in about five billion years, and the ember ',
          'will be roughly half its present mass. Between about 8 and 20 solar masses the core ',
          'leaves a neutron star; above about 20, a black hole, and some of those stars may ',
          'collapse without any visible explosion. The ',
          term('main sequence'),
          ' lifetime before all this scales steeply with mass: ten billion years for the Sun, a ',
          'few million for a star of twenty solar masses.',
        ),
        p(
          'Two misconceptions. Stars do not explode because they run out of fuel; only the heavy ',
          'ones do, and only because iron cannot burn. And the light of a supernova is not the ',
          'star burning up: for a Type Ia, and for months after a core collapse once its first ',
          'glow fades, the light is powered by the radioactive decay of the nickel forged in the ',
          'blast, about 0.6 of a solar mass of it in a Type Ia.',
        ),
        p(
          'The mass boundaries here are approximate. The 8 solar-mass line is known to within ',
          'about one solar mass from the stars seen to explode; the 20 solar-mass line is ',
          'contested, and the mechanism that turns a collapse into an explosion is still being ',
          'worked out in three-dimensional simulations.',
        ),
        /*
         * Source: https://science.nasa.gov/missions/hubble/a-giant-hubble-mosaic-of-the-crab-nebula/
         * ("A Giant Hubble Mosaic of the Crab Nebula", NASA Hubble Mission Team,
         * 1 December 2005; no redirect). The page's credit reads "NASA, ESA, J.
         * Hester and A. Loll (Arizona State University)". Image asset
         * STScI-01EVT7YTWSRJ9Y430R55VM6TP6, taken as a 2560 × 2560 rendition and
         * converted to 1280 px wide webp.
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
         * image page's own, ESA included.
         */
        figure({
          src: '/figures/supernovae.webp',
          width: 1280,
          height: 1280,
          alt: 'A ragged, roughly oval cloud on a black starfield: a web of orange and red filaments, green-tinged toward the lower left, wrapped around a pale blue glow that fills the interior.',
          caption:
            'The Crab Nebula, the remains of a core-collapse supernova seen from Earth in 1054. At its centre is a neutron star, the star’s collapsed core packed into a ball the size of a city, spinning thirty times a second; the filaments are the star’s outer layers, still expanding at 1 500 km/s.',
          credit: 'NASA, ESA, J. Hester and A. Loll (Arizona State University)',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'lifetime',
          tex: 't_{\\text{MS}} \\;=\\; 10^{10}\\,\\text{yr}\\cdot\\left(\\dfrac{{{M}}}{M_\\odot}\\right)^{-2.5}',
          binds: ['M'],
          note: prose(
            p(
              m`t_{\text{MS}}`,
              ' — the main-sequence lifetime, the time a star fuses hydrogen steadily; ',
              m`M`,
              ' — the star’s mass at birth (your slider); ',
              m`M_\odot`,
              ' — the Sun’s mass. Heavier stars have more fuel but burn it far faster, so they ',
              'live shorter lives.',
            ),
          ),
        },
        {
          id: 'luminosity',
          tex: 'L \\;=\\; L_\\odot\\cdot\\left(\\dfrac{{{M}}}{M_\\odot}\\right)^{3.5}',
          binds: ['M'],
          note: prose(
            p(
              m`L`,
              ' — the star’s brightness on the main sequence; ',
              m`L_\odot`,
              ' — the Sun’s. Doubling the mass makes a star eleven times brighter, which is why it ',
              'burns out sooner.',
            ),
          ),
        },
        {
          id: 'apparent-magnitude',
          tex: 'm \\;=\\; M_{\\text{Ia}} + 5\\log_{10}\\!\\left(\\dfrac{{{d}}}{10\\,\\text{pc}}\\right)',
          binds: ['d'],
          note: prose(
            p(
              m`m`,
              ' — how bright the supernova looks from Earth, on the ',
              term('magnitude scale', 'apparent-magnitude'),
              ' where smaller is brighter; ',
              m`M_{\text{Ia}}`,
              ' — the peak absolute magnitude of a Type Ia, −19.3, its brightness as it would look ',
              'from 10 parsecs; ',
              m`d`,
              ' — its distance (your slider). Every factor of ten in distance adds five magnitudes.',
            ),
            p(
              'Worked example, a star like Betelgeuse: ',
              m`M = 18\,M_\odot`,
              ', at ',
              m`d = 168\,\text{pc}`,
              ' (550 light-years).',
            ),
            p(
              m`t_{\text{MS}} = 10^{10}\,\text{yr} \times 18^{-2.5} = 10^{10} / 1\,375 = 7.3\text{ million years}`,
            ),
            p(
              m`L = 18^{3.5}\,L_\odot = 24\,700\,L_\odot`,
              ' on the main sequence; Betelgeuse has since swollen to about 100 000 ',
              m`L_\odot`,
            ),
            p(
              'Fate: ',
              m`18\,M_\odot`,
              ' is between 8 and 20, so a neutron star, in a core-collapse supernova.',
            ),
            p(
              'If a Type Ia went off at that distance: ',
              m`m = -19.3 + 5\log_{10}(168 / 10) = -19.3 + 6.1 = -13.2`,
              ', brighter than the full Moon at −12.7. Betelgeuse’s own explosion, a core collapse, ',
              'would be about two magnitudes fainter: still visible by day.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Iron sits at the peak of binding energy per nucleon, so once a core of it has formed, ',
          'at about ',
          m`3 \times 10^{9}\,\text{K}`,
          ', no further fusion can support it. Two processes then remove pressure: ',
          'photodisintegration of iron nuclei into alpha particles and neutrons by the thermal ',
          'photons, and electron capture on protons, which lowers the electron fraction ',
          m`Y_e`,
          ' and with it the Chandrasekhar mass, ',
          m`M_{\text{Ch}} = 1.46\,(Y_e / 0.5)^2\,M_\odot`,
          '. The core collapses on a free-fall time of a few hundred milliseconds until the inner ',
          'core reaches nuclear density, about ',
          m`2.7 \times 10^{17}\,\text{kg/m}^3`,
          ', where the equation of state stiffens and it rebounds. The bounce shock stalls within ',
          'a few hundred kilometres, drained by photodisintegrating the infalling iron; in the ',
          'standard picture it is revived by neutrino heating from the hot proto-neutron star, ',
          'which radiates its ',
          m`3 \times 10^{46}\,\text{J}`,
          ' of binding energy over about ten seconds, and by convective and hydrodynamic ',
          'instabilities that keep matter in the heating region longer. Three-dimensional ',
          'simulations now explode for a range of progenitors, but not all, and the “island” of ',
          'masses that fail to explode and collapse to black holes is an open question.',
        ),
        p(
          'The light is a separate story from the energy. The kinetic energy of a typical ',
          'explosion is ',
          m`10^{44}\,\text{J}`,
          ' and the radiated light ',
          m`10^{42}\,\text{J}`,
          ', one percent of that. For a Type Ia the light curve is powered by the decay chain ',
          m`{}^{56}\text{Ni} \to {}^{56}\text{Co} \to {}^{56}\text{Fe}`,
          ', with half-lives of 6.1 and 77 days, from about ',
          m`0.6\,M_\odot`,
          ' of nickel; the peak brightness scales with the nickel mass, and the width of the ',
          'light curve with the diffusion time, which is why the Phillips relation between peak ',
          'luminosity and decline rate can standardise Type Ia peaks to about 0.1 magnitude, or 5 ',
          'percent in distance. That precision is what made the 1998 acceleration measurement ',
          'possible and what anchors the far rung of the distance ladder today, including the ',
          'SH0ES value of ',
          m`H_0`,
          ' on the high side of the Hubble tension. The Type Ia progenitor itself is less settled ',
          'than its use: whether the white dwarf accretes from a normal companion or merges with ',
          'another white dwarf, and whether most detonate below the Chandrasekhar limit through a ',
          'surface helium flash, are open, and the two channels may both operate.',
        ),
        p(
          'SN 1987A is the anchor of the core-collapse picture. Kamiokande-II, IMB and Baksan ',
          'recorded 25 neutrinos in about 13 seconds, with a total energy and duration consistent ',
          'with a proto-neutron star cooling by neutrino emission; the light rose over the ',
          'following hours. The progenitor, a blue supergiant of about ',
          m`18\,M_\odot`,
          ', contradicted the expectation of a red supergiant, and the compact remnant was not ',
          'identified until a 2024 JWST detection of ionised argon at the centre, consistent with ',
          'a neutron star. Nucleosynthesis divides by type: Type Ia supernovae produce most of the ',
          'iron-peak elements, core collapses most of the oxygen through calcium, and the heaviest ',
          'r-process elements such as gold are now attributed mainly to neutron-star mergers, ',
          'following GW170817 in 2017. The upper mass boundary in the sim, ',
          m`20\,M_\odot`,
          ', is where the “red supergiant problem” lives: no core-collapse progenitor above about ',
          m`18\,M_\odot`,
          ' has been identified in pre-explosion images, which may mean that heavier stars ',
          'collapse quietly, or that their late-stage dust hides them.',
        ),
        p(
          'The simulation’s shortcuts, in full. The fate boundaries at 8 and 20 ',
          m`M_\odot`,
          ' are for a star of the Sun’s composition; they are uncertain by a couple of solar ',
          'masses, shift with composition and rotation, and some stars above 20 collapse to black ',
          'holes with no explosion at all. Lifetime and luminosity use the main-sequence power ',
          'laws ',
          m`t \propto M^{-2.5}`,
          ' and ',
          m`L \propto M^{3.5}`,
          ', good to about a factor of two between 0.5 and 20 ',
          m`M_\odot`,
          '; above that they overstate how quickly a star burns out, by about a factor of three at ',
          'the top of the slider, because the most luminous stars level off near the Eddington ',
          'limit. The brightness panel is a Type Ia at its average peak, ',
          m`M = -19.3`,
          ', with no extinction; a core-collapse supernova is typically two magnitudes fainter, ',
          'and no single explosion is exactly average.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'stellar-fusion',
          reason:
            'The fusion that lights the Sun is what a massive star runs through in stages until it reaches iron; that module is where the burner is lit.',
        },
        {
          moduleId: 'black-holes',
          reason: 'Above about twenty solar masses, this is how the black holes in that module are made.',
        },
        {
          moduleId: 'cosmic-distance-ladder',
          reason:
            'The Type Ia panel here is the top rung of that ladder, and its 5 percent precision is why the Hubble tension is sharp enough to matter.',
        },
        {
          moduleId: 'nebulae',
          reason: 'The Crab is one; that module is about how gas clouds glow, this one about the explosion that made the Crab.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Smartt 2009, “Progenitors of Core-Collapse Supernovae”, ARA&A 47, 63',
      url: 'https://doi.org/10.1146/annurev-astro-082708-101737',
      note: 'The 8 M☉ lower boundary and the red supergiant problem',
    },
    {
      label:
        'Janka 2012, “Explosion Mechanisms of Core-Collapse Supernovae”, Annu. Rev. Nucl. Part. Sci. 62, 407',
      url: 'https://doi.org/10.1146/annurev-nucl-102711-094901',
      note: 'Collapse, bounce, neutrino heating and the energetics',
    },
    {
      label:
        'Kalirai et al. 2008, “The Initial-Final Mass Relation: Direct Constraints at the Low-Mass End”, ApJ 676, 594',
      url: 'https://doi.org/10.1086/527028',
      note: 'White-dwarf remnant mass, M_f = 0.109 M_i + 0.394 M☉',
    },
    {
      label: 'Richardson et al. 2014, “Absolute-magnitude Distributions of Supernovae”, AJ 147, 118',
      url: 'https://doi.org/10.1088/0004-6256/147/5/118',
      note: 'Type Ia peak −19.3 and the two-magnitude gap to core collapse',
    },
    {
      label:
        'Hirata et al. 1987, “Observation of a neutrino burst from the supernova SN1987A”, Phys. Rev. Lett. 58, 1490',
      url: 'https://doi.org/10.1103/PhysRevLett.58.1490',
      note: 'The Kamiokande-II neutrinos',
    },
  ],
};

export default supernovae;

/**
 * The early universe — the tenth published Lodestar module.
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
import { C, EV, JULIAN_YEAR, M_ELECTRON } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const earlyUniverse: Module = {
  id: 'early-universe',
  title: 'The Early Universe',
  tagline:
    'From a trillion-degree soup of quarks to the first atoms: what the universe was made of at every moment, and why it changed.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'One second after it began, the entire universe was ten billion degrees, hotter than ',
          'the centre of any star. Every proton in your body was already there, and had been for ',
          'most of that second.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Think of steam cooling. While it is hot, water is a gas of separate molecules, too ',
          'energetic to hold on to each other. Cool it and droplets form, because at last the ',
          'molecules can stick. Cool it further and the droplets freeze into ice, a structure that ',
          'could not have survived a moment earlier. Each step down in temperature lets something ',
          'new exist.',
        ),
        p(
          'The universe cooled the same way, in stages. At first it was too hot even for protons: ',
          'their parts flew about separately. As it cooled, the parts locked into protons and ',
          'neutrons. Cooler still, protons and neutrons stuck together into the first nuclei. ',
          'Then, much later, nuclei captured electrons and became atoms. Each of those steps ',
          'happened everywhere at once, at a temperature the universe passed through on its way ',
          'down, and each left behind a layer of the world we live in.',
        ),
        p(
          'Where the analogy breaks: steam cools by handing its heat to the room around it. The ',
          'universe had no room to hand heat to. It cooled only because it was stretching, and ',
          'every wave of light in it was stretched longer and weaker. And water freezes at one ',
          'temperature; the universe passed through many, each adding a new kind of thing.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'early-universe',
      caption: prose(
        p(
          'Drag through the first second, the first three minutes and the first million years, ',
          'and watch the temperature fall and the contents change. Then pick a particle and find ',
          'the moment the universe became too cold to make it.',
        ),
      ),
      params: [
        {
          id: 't',
          friendlyLabel: 'How long after the beginning?',
          technicalLabel: 'Time since the Big Bang',
          symbol: 't',
          unit: 's',
          // Min: one microsecond, the quark–gluon plasma; earlier is theory without
          // direct evidence. Max: the Planck 2018 age. Default: one second.
          min: 1e-6,
          max: 13.8e9 * JULIAN_YEAR,
          default: 1,
          // decades; 2300 equal steps, shrunk by one part in 10⁹ so (max − min) / step
          // rounds up to 2300 and the input can reach its maximum. Without the
          // shrink, floating point leaves it one step short.
          step: ((Math.log10(13.8e9 * JULIAN_YEAR) - Math.log10(1e-6)) / 2300) * (1 - 1e-9),
          scale: 'log',
          format: { notation: 'auto', digits: 3 },
        },
        {
          id: 'E',
          friendlyLabel: 'How heavy a particle?',
          technicalLabel: 'Particle rest energy',
          symbol: 'mc^2',
          unit: 'J',
          // About 6 keV to 600 GeV. Default is the electron, 0.511 MeV. The range is
          // exactly eight decades, so a 0.01-decade step reaches the maximum as it
          // is; the shrunk-step trick the time slider needs is not needed here.
          min: 1e-15,
          max: 1e-7,
          default: M_ELECTRON * C * C,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'MeV', factor: 1 / (1e6 * EV) } },
        },
      ],
      approximations: [
        prose(
          p(
            'Before about 100 seconds the sim uses the radiation-era formula with the particle count switched in three steps, at 170, 100 and 0.5 MeV. Real transitions are gradual and the epoch boundaries are drawn sharp; the small flat notch near ten to twenty microseconds is an artefact of the steps, and times there are uncertain by about a factor of two.',
          ),
        ),
        prose(
          p(
            'After that it follows the standard model of cosmology, ΛCDM, with Planck 2018 densities, and treats neutrinos as massless.',
          ),
        ),
        prose(
          p(
            '‘Being made’ means the light’s typical energy, kT, is above the particle’s rest energy, mc². Real freeze-out is a race between reaction rates and expansion, and happens somewhat later than that line.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'The ',
          term('Big Bang', 'big-bang'),
          ' is not an explosion at a point but the hot, dense state the whole universe expanded ',
          'from, and the story of its first minutes is a story of cooling. The sim starts at one ',
          'microsecond, because from there on the physics has been tested in laboratories: ',
          'particle colliders recreate those conditions, briefly, in head-on collisions of heavy ',
          'nuclei. Before that, the physics is theory. At one microsecond the universe was a ',
          term('quark–gluon plasma', 'quark-gluon-plasma'),
          ' at about 6 × 10¹² K, denser than an atomic nucleus, and its temperature fell as one ',
          'over the square root of time. Between ten and twenty microseconds the quarks locked ',
          'into protons and neutrons. At one second, at ten billion kelvin, the neutrinos stopped ',
          'interacting and have travelled freely ever since, a background that has never been ',
          'detected directly. A few seconds later the positrons annihilated with most of the ',
          'electrons, leaving one electron per proton. Between about three and twenty-five ',
          'minutes came ',
          term('Big Bang nucleosynthesis', 'nucleosynthesis'),
          ': protons and neutrons fused into deuterium, then helium, so that a quarter of the ',
          'ordinary matter by mass has been helium ever since, with traces of lithium. Nothing ',
          'heavier was made. Every other element came later, from stars.',
        ),
        p(
          'Then, for a long time, little happened. Light outweighed matter for the first fifty ',
          'thousand years, the ',
          term('radiation era', 'radiation-era'),
          '; after ',
          term('matter–radiation equality', 'matter-radiation-equality'),
          ', matter set the pace of expansion. At 380 000 years came ',
          term('recombination'),
          ', and the ',
          term('cosmic microwave background'),
          ' was released. There followed the dark ages, neutral gas and no stars, until the first ',
          'stars lit around one or two hundred million years in. Galaxies followed, and 13.8 ',
          'billion years after the start, us.',
        ),
        p(
          'Each step in this sequence is a ',
          term('freeze-out'),
          '. While the light is hot enough, meaning ',
          m`kT`,
          ', the typical energy of a particle at temperature ',
          m`T`,
          ', exceeds a particle’s rest energy ',
          m`mc^2`,
          ', collisions make that particle in pairs as fast as it annihilates. Once the ',
          'temperature drops below that, production stops and only the survivors remain. The ',
          'sim’s second slider is exactly that comparison.',
        ),
        p(
          'Two misconceptions. The Big Bang did not happen somewhere; it happened everywhere, and ',
          'the space we are in was part of it. And the “beginning” in the sim is not time zero. ',
          'General relativity, Einstein’s theory of gravity, predicts a singularity there, a point ',
          'where its equations stop working, which is a limit of the theory rather than a known ',
          'event. The earliest moment of which the universe itself keeps a record is the first ',
          'second: the neutron-to-proton ratio froze then, and the helium it went on to make is ',
          'still measurable.',
        ),
        p(
          'The times here are Planck 2018 values run backwards through the standard model of ',
          'cosmology. The quark transition temperature is from lattice calculations of the strong ',
          'force; the helium fraction is measured in the oldest gas clouds and agrees with the ',
          'prediction to within a few percent.',
        ),
        /*
         * Source: https://map.gsfc.nasa.gov/media/060915/index.html, which now
         * redirects (301) to https://science.nasa.gov/mission/wmap/wmap-overview/.
         * The page shows the illustration as "Timeline of the Universe: A
         * representation of the evolution of the universe over 13.77 billion
         * years", file 060915_CMB_Timeline600.jpg, with the credit line
         * "Credit: NASA / WMAP Science Team". Converted from a 2560 × 1842 JPEG
         * rendition to 1280 px wide webp. It is an illustration, and the caption
         * says so.
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
          src: '/figures/early-universe.webp',
          width: 1280,
          height: 921,
          alt: 'An illustration of the universe as a bell shape on its side, drawn as a wire-frame grid that widens from a bright white glow at the left to a broad open mouth at the right. Near the narrow end a green mottled disc is labelled as the afterglow light at 375,000 years, followed by a dark band labelled the dark ages, the first stars, and then a widening region scattered with galaxies. A small spacecraft sits beyond the open end, and a bracket beneath spans 13.77 billion years.',
          caption:
            'An artist’s timeline, not a measurement: the hot beginning at the left, the release of the microwave background as the mottled disc, the dark ages, the first stars as the bright band, and today’s galaxies at the right. Expansion stretches the shape outward. The illustration’s own dates come from an earlier analysis and differ slightly from the text.',
          credit: 'NASA / WMAP Science Team',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'radiation-temperature',
          tex:
            'kT \\;=\\; \\left(\\dfrac{90\\,\\hbar^{3} c^{5}}{32\\pi^{3} G\\, g_*}\\right)^{1/4}' +
            ' \\Big/ \\sqrt{{{t}}}',
          binds: ['t'],
          note: prose(
            p(
              m`T`,
              ' — the temperature at time ',
              m`t`,
              ' (your slider); ',
              m`k`,
              ' — Boltzmann’s constant; ',
              m`\hbar`,
              ' — the reduced Planck constant; ',
              m`G`,
              ' — the gravitational constant; ',
              m`g_*`,
              ' — the number of particle species light enough to exist at that temperature, 10.75 ',
              'around one second. In the radiation era, temperature falls as one over the square root ',
              'of time.',
            ),
          ),
        },
        {
          id: 'scale-factor',
          tex:
            'a \\;=\\; \\dfrac{T_0}{T({{t}})}\\,' +
            '\\left(\\dfrac{g_{s,0}}{g_s}\\right)^{1/3}',
          binds: ['t'],
          note: prose(
            p(
              m`a`,
              ' — the ',
              term('scale factor'),
              ', how much smaller the universe was than today; ',
              m`T_0`,
              ' — today’s temperature, 2.7255 K; ',
              m`g_s`,
              ' — the entropy count of particle species, 3.91 today and 10.75 before positrons ',
              'annihilated. The second factor is 0.71 before that and 1 after.',
            ),
          ),
        },
        {
          id: 'freeze-out',
          tex:
            't_f \\;=\\; \\left(\\dfrac{90\\,\\hbar^{3} c^{5}}{32\\pi^{3} G\\, g_*}\\right)^{1/2}' +
            ' \\Big/ \\left({{E}}\\right)^{2}',
          binds: ['E'],
          note: prose(
            p(
              m`t_f`,
              ' — the time the universe cooled below the particle’s rest energy; ',
              m`E = mc^2`,
              ' — the rest energy (your slider). The heavier the particle, the earlier it stopped ',
              'being made.',
            ),
            p('Worked example, one second in, with ', m`g_* = 10.75`, '.'),
            p(
              m`(90\,\hbar^3 c^5 / (32\pi^3 G\, g_*))^{1/4} = 1.38 \times 10^{-13}\,\text{J}`,
              ', so ',
              m`kT = 1.38 \times 10^{-13}\,\text{J} / \sqrt{1} = 0.86\,\text{MeV}`,
              ' and ',
              m`T = 1.0 \times 10^{10}\,\text{K}`,
              '.',
            ),
            p(
              m`a = (2.7255 / 1.0 \times 10^{10}) \times 0.71 = 1.9 \times 10^{-10}`,
              ': a region a metre across today was a fifth of a nanometre across then.',
            ),
            p(
              'For the electron, ',
              m`E = 0.511\,\text{MeV} = 8.19 \times 10^{-14}\,\text{J}`,
              ': ',
              m`t_f = (1.38 \times 10^{-13})^2 / (8.19 \times 10^{-14})^2 = 2.8\,\text{s}`,
              '. Positrons began to vanish three seconds in.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The radiation-era relation follows from the Friedmann equation, general relativity’s ',
          'expansion equation for a uniform universe, applied to a relativistic gas. Its energy ',
          'density is ',
          m`\rho = (\pi^2/30)\, g_*\, (kT)^4 / (\hbar c)^3`,
          ', where ',
          m`g_*`,
          ' counts the ',
          term('relativistic degrees of freedom', 'degrees-of-freedom'),
          ', bosons fully and fermions at 7/8. With ',
          m`H = 1/(2t)`,
          ' in radiation domination, ',
          m`t = (90\,\hbar^3 c^5 / 32\pi^3 G\, g_*)^{1/2} / (kT)^2`,
          ', or ',
          m`t \approx 0.74\,\text{s}\,(10.75/g_*)^{1/2}\,(\text{MeV}/kT)^2`,
          '. Above the QCD crossover at ',
          m`T_c \approx 155\,\text{MeV}`,
          ', where quarks bind into hadrons, ',
          m`g_* \approx 61.75`,
          ' with u, d and s quarks and gluons; between the pion and electron mass scales, 10.75; ',
          'today, with photons and three massless neutrinos, 3.36. The sim switches ',
          m`g_*`,
          ' in steps at 170, 100 and 0.5 MeV; the real function is smooth, and the lattice-QCD ',
          'tabulation of Borsányi et al. (2016) is the standard reference.',
        ),
        p(
          'Scale factor and temperature are tied by entropy conservation, ',
          m`g_s a^3 T^3 = \text{constant}`,
          ', with ',
          m`g_s`,
          ' the entropy degrees of freedom. When electrons and positrons annihilate at ',
          m`kT \approx 0.5\,\text{MeV}`,
          ' their entropy goes to the photons, which the already-decoupled neutrinos do not share, ',
          'so ',
          m`T_\nu = (4/11)^{1/3}\,T_\gamma = 1.95\,\text{K}`,
          ' today and, running backwards, ',
          m`a = (T_0/T)(4/11)^{1/3}`,
          ' before annihilation. Neutrinos decouple near 1 MeV, when their weak-interaction rate, ',
          'proportional to ',
          m`T^5`,
          ', falls below the expansion rate, proportional to ',
          m`T^2`,
          '. The standard-model prediction ',
          m`N_\text{eff} = 3.044`,
          ' accounts for their incomplete decoupling; Planck measures ',
          m`N_\text{eff} = 2.99 \pm 0.17`,
          '.',
        ),
        p(
          'Nucleosynthesis fixes the helium fraction almost by kinematics. The neutron-to-proton ',
          'ratio freezes near ',
          m`kT \approx 0.7\,\text{MeV}`,
          ' at ',
          m`n/p = \exp(-\Delta m c^2/kT) \approx 1/6`,
          ', and free-neutron decay, with a lifetime of 879 s, brings it to about 1/7 by the time ',
          'the deuterium bottleneck opens at ',
          m`kT \approx 0.08\,\text{MeV}`,
          ', around three minutes, when the photon tail can no longer split deuterium despite a ',
          'billion photons per baryon. Nearly every neutron then ends in helium-4, giving ',
          m`Y_p \approx 2(n/p)/(1 + n/p) \approx 0.25`,
          '; observed, ',
          m`Y_p = 0.245 \pm 0.004`,
          '. Deuterium is more sensitive: ',
          m`\text{D/H} = (2.53 \pm 0.03) \times 10^{-5}`,
          ' fixes the baryon density ',
          m`\Omega_b h^2 = 0.0224`,
          ', in agreement with the CMB value to one percent. Lithium-7 does not fit: predicted at ',
          'about three times the abundance seen in old halo stars, the “lithium problem”, ',
          'unresolved after two decades.',
        ),
        p(
          'Before the sim’s first microsecond lie the electroweak transition at ',
          m`kT \approx 160\,\text{GeV}`,
          ', near ',
          m`10^{-11}\,\text{s}`,
          ', and, far earlier, ',
          term('inflation'),
          ': a period of exponential expansion proposed to explain why the universe is flat and ',
          'why regions of the CMB that were never in contact share one temperature. Its ',
          'predictions of flatness and a nearly scale-invariant spectrum of fluctuations, ',
          m`n_s = 0.965 \pm 0.004`,
          ', are confirmed; its energy scale is not measured and its mechanism is not known. Nor ',
          'is the origin of the ',
          term('baryon asymmetry'),
          ': why any matter survived annihilation, at one part in a billion, ',
          m`\eta \approx 6 \times 10^{-10}`,
          '. Sakharov’s three conditions for generating it are met in the standard model, but the ',
          'amount produced falls short by many orders of magnitude. The sim’s first microsecond is ',
          'in this sense the edge of the map: from there on the physics has been tested in the ',
          'laboratory, and from the first second on, against the universe’s own record; everything ',
          'before it is inferred.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'cosmic-microwave-background',
          reason:
            'The 3000 K stop on that module’s slider is the 380 000-year mark on this one; the story hands over there.',
        },
        {
          moduleId: 'expansion-of-the-universe',
          reason:
            'The far end of the time slider is the 13.8 billion years that module derives from H₀ and the densities.',
        },
        {
          moduleId: 'stellar-fusion',
          reason:
            'Fusion stopped at helium within half an hour; in stars it has been running ever since, and that module shows why.',
        },
        {
          moduleId: 'supernovae',
          reason:
            'Every element heavier than lithium was made in stars and scattered by these; that module follows the heavy elements.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'Planck Collaboration 2020, “Planck 2018 results VI: Cosmological parameters”, A&A 641, A6',
      url: 'https://doi.org/10.1051/0004-6361/201833910',
      note: 'Ω_m, Ω_Λ, the 13.80 Gyr age, z_eq, N_eff and n_s',
    },
    {
      label: 'Fields, Olive, Yeh & Young 2020, “Big-Bang Nucleosynthesis after Planck”, JCAP 03, 010',
      url: 'https://doi.org/10.1088/1475-7516/2020/03/010',
      note: 'Y_p, D/H, Ω_b h² and the lithium problem',
    },
    {
      label:
        'Borsányi et al. 2016, “Calculation of the axion mass based on high-temperature lattice quantum chromodynamics”, Nature 539, 69',
      url: 'https://doi.org/10.1038/nature20115',
      note: 'g_*(T) and g_s(T) across the QCD crossover',
    },
    {
      // Title as registered on Crossref for this DOI; the brief's label gave a
      // paraphrase ("A precise calculation of the effective number of cosmic
      // neutrino species") that is not the paper's title.
      label:
        'Akita & Yamaguchi 2020, “A precision calculation of relic neutrino decoupling”, JCAP 08, 012',
      url: 'https://doi.org/10.1088/1475-7516/2020/08/012',
      note: 'N_eff = 3.044',
    },
    {
      label: 'Navas et al. (Particle Data Group) 2024, “Review of Particle Physics”, Phys. Rev. D 110, 030001',
      url: 'https://doi.org/10.1103/PhysRevD.110.030001',
      note: 'Neutron lifetime; the Big-Bang cosmology and nucleosynthesis reviews',
    },
  ],
};

export default earlyUniverse;

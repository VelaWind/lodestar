/**
 * The habitable zone — the thirteenth published Lodestar module.
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
import { AU, A_EARTH, L_SUN } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const habitableZone: Module = {
  id: 'habitable-zone',
  title: 'The Habitable Zone',
  tagline:
    'Around every star there is a ring where water can stay liquid. Being in it is where the question starts, not where it ends.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Put the Earth a third closer to the Sun and its oceans boil away; put it twice as far ',
          'out and they freeze solid. Every planet found around another star is asked the same ',
          'first question: does it sit between those two?',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Sit by a campfire on a cold night. Too close and your face burns; too far and you ',
          'shiver; somewhere in between is a ring where it is comfortable, and everyone finds it ',
          'without being told. Build a bigger fire and the ring moves outward and gets wider. Let ',
          'the fire die down and it shrinks toward the embers.',
        ),
        p(
          'A star is the fire and a planet is the person. The comfortable ring is the band of ',
          'distances where the planet is warm enough for water to stay liquid but not so warm ',
          'that it boils, and it is called the habitable zone. A bright star has a wide zone far ',
          'out; a dim one has a narrow zone hugging the star. Where a planet sits in that ring ',
          'decides, before anything else, whether it could have oceans.',
        ),
        p(
          'There is one more thing you can do at a campfire: put on a coat. A coat lets you sit ',
          'farther out and still be warm. A planet’s coat is its atmosphere, and it can make an ',
          'enormous difference: Earth’s makes it 33 degrees warmer than it would otherwise be.',
        ),
        p(
          'Where the analogy breaks: a fire warms only the side of you that faces it, while a ',
          'spinning planet shares the heat around. And a coat only keeps heat in; a thick ',
          'atmosphere can trap so much that the planet ends up hotter than one nearer the star ',
          'with no coat at all. Venus, closer to the Sun than we are but wrapped in a coat a ',
          'hundred times thicker than ours, is hotter than Mercury.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'habitable-zone',
      caption: prose(
        p(
          'Make the star brighter and dimmer and watch the green band slide and stretch. Then ',
          'move the planet through it, and change how much light it reflects, to see how a ',
          'world’s temperature is set before its atmosphere has a say.',
        ),
      ),
      params: [
        {
          id: 'L',
          friendlyLabel: 'How bright is the star? (in Suns)',
          technicalLabel: 'Stellar luminosity',
          symbol: 'L',
          unit: 'W',
          // The faintest red dwarfs to a star of a few solar masses. Default: the Sun.
          // Six decades exactly; the maximum is reachable with a 0.01-decade step.
          min: 1e-4 * L_SUN,
          max: 1e2 * L_SUN,
          default: L_SUN,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'L☉', factor: 1 / L_SUN } },
        },
        {
          id: 'd',
          friendlyLabel: 'How far out is the planet? (in Earth–Sun distances)',
          technicalLabel: 'Orbital distance',
          symbol: 'd',
          unit: 'm',
          // A hundredth of an AU, inside the faintest red dwarfs' zones, to 100 AU.
          // Default: the Earth. Four decades exactly; the maximum is reachable.
          min: 0.01 * AU,
          max: 100 * AU,
          default: AU,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'AU', factor: 1 / AU } },
        },
        {
          id: 'A',
          friendlyLabel: 'How much light does it reflect?',
          technicalLabel: 'Bond albedo',
          symbol: 'A',
          unit: '',
          // 0 is black, 0.9 fresh snow. Earth 0.30, Mars 0.25, Venus 0.77.
          min: 0,
          max: 0.9,
          default: A_EARTH,
          step: 0.01,
          scale: 'linear',
          format: { notation: 'fixed', digits: 2 },
        },
      ],
      approximations: [
        prose(
          p(
            'The planet is a fast-spinning bare rock that absorbs and radiates evenly, so its temperature is a single number. A real planet has a day side, a night side and weather.',
          ),
        ),
        prose(
          p(
            'The zone edges are the climate-model limits for a Sun-like star, from Kopparapu and colleagues. Around redder or bluer stars they shift, by up to about a quarter in distance for the coolest, faintest stars, most at the outer edge; the sim does not model this. Outside about a tenth to ten times the Sun’s brightness, the edges are an extrapolation.',
          ),
        ),
        prose(
          p(
            'The dashed curve adds Earth’s 33 kelvin of greenhouse warming everywhere. A thicker atmosphere adds far more: Venus’s adds about 510 kelvin.',
          ),
        ),
        prose(
          p(
            'The length of the year takes the star’s mass from its brightness with a rule of thumb for stars in mid-life, like the Sun: brightness grows as mass to the power 3.5. It is good to about a factor of two. A real star’s mass is measured, not inferred.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'The ',
          term('habitable zone'),
          ' is the range of orbital distances at which a planet with an atmosphere like Earth’s ',
          'could keep liquid water on its surface. The word does the work of a definition and no ',
          'more: it is about temperature, and it says nothing about whether anything lives there. ',
          'The zone is set by the star’s luminosity, its total light output, since the light ',
          'reaching a planet falls with the square of its distance: for the Sun it runs, in the ',
          'most cautious estimate, from 0.99 to 1.71 astronomical units, and a star four times as ',
          'bright pushes both edges twice as far out.',
        ),
        p(
          'A planet’s temperature starts from one balance. It absorbs the starlight it does not ',
          'reflect, and it radiates heat back to space as any warm body does; the temperature at ',
          'which those match is the ',
          term('equilibrium temperature'),
          '. The fraction reflected is the ',
          term('Bond albedo'),
          ': 0.30 for Earth, 0.25 for Mars, 0.77 for cloud-covered Venus. For Earth the balance ',
          'gives 255 K, or −18 °C, which is the temperature of a frozen world. What lifts it to ',
          'the 288 K we live at is the ',
          term('greenhouse effect'),
          ', the atmosphere absorbing outgoing heat and sending part of it back down. Venus’s ',
          'balance gives 227 K, colder than Earth’s because it reflects so much; its atmosphere ',
          'then adds 510 K, to a surface of 737 K.',
        ),
        p(
          'That is why the zone edges come from climate models rather than from the simple ',
          'balance. The inner edge is where an ocean starts to evaporate faster than the extra ',
          'water vapour can be tolerated: water vapour is itself a greenhouse gas, the warming ',
          'feeds the evaporation, and the process runs away until the oceans are gone, a ',
          term('runaway greenhouse'),
          '. The outer edge is where even a thick carbon-dioxide atmosphere can no longer keep ',
          'the surface above freezing, because a still thicker carbon-dioxide atmosphere scatters ',
          'away more sunlight than it traps. A more generous pair of edges takes the last time Venus might have had ',
          'oceans and the time early Mars apparently did.',
        ),
        p(
          'Three in four stars are ',
          term('red dwarfs', 'red-dwarf'),
          ', fainter than a few hundredths of the Sun, so most habitable zones in the galaxy sit ',
          'within about a tenth of an astronomical unit of their star, closer than Mercury is to ',
          'ours. A planet there orbits in days, and gravity locks it so that one side always ',
          'faces the star, a state called ',
          term('tidal locking'),
          '. Whether such a planet can hold an atmosphere and spread its heat to the night side ',
          'is an open question, and the answer will come from the seven planets of TRAPPIST-1, ',
          'forty light-years away, three of them in the zone, which are the first Earth-sized ',
          'habitable-zone planets whose air can be studied.',
        ),
        p(
          'Two misconceptions. Being in the zone does not make a planet habitable: the Moon is in ',
          'the Sun’s zone. And being outside it does not rule out liquid water; Europa and ',
          'Enceladus have oceans under ice, warmed from within, well beyond the outer edge. The ',
          'zone is where a planet could have water on its surface, which is where a telescope ',
          'could see it.',
        ),
        p(
          'The edges are model results and carry about a ten percent uncertainty: the choice of ',
          'limit and of climate model moves the inner edge between 0.95 and 0.99 AU for the Sun. The ',
          'Sun was about 30 percent dimmer when it formed, so the zone has been moving outward ',
          'the whole time. The conservative inner edge already sits just inside Earth’s orbit; ',
          'the runaway-greenhouse limit reaches 1 AU in roughly a billion years.',
        ),
        /*
         * Source: https://www.nasa.gov/image-article/blue-marble-image-of-earth-from-apollo-17/
         * ("Blue Marble - Image of the Earth from Apollo 17", NASA image article; no
         * redirect). The page describes the "View of the Earth as seen by the
         * Apollo 17 crew … traveling toward the moon", the photograph catalogued
         * as AS17-148-22727 (7 December 1972), and credits it "NASA" ("Image
         * Credit: NASA"). Taken from the page's own image,
         * 135918main_bm1_high.jpg, 1041 × 1042, converted to webp at its native
         * size.
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
          src: '/figures/habitable-zone.webp',
          width: 1041,
          height: 1042,
          alt: 'The whole Earth, fully lit, on black. Africa runs from the tan Sahara at the top down to the continent’s southern tip, with Arabia at the upper right and Madagascar off the east coast; swirls of white cloud cover the blue ocean around it, and the Antarctic ice cap fills the bottom of the disc.',
          caption:
            'Earth, the one habitable-zone planet known to be inhabited. At its distance from the Sun (1 AU, the yardstick astronomers use within the Solar System) it receives 1 361 watts on every square metre facing the Sun, as much as about fourteen 100-watt bulbs, reflects 30 percent, and would sit at −18 °C without its atmosphere.',
          credit: 'NASA',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'flux',
          tex: 'S \\;=\\; \\dfrac{{{L}}}{4\\pi\\,{{d}}^{2}}',
          binds: ['L', 'd'],
          note: prose(
            p(
              m`S`,
              ' — the starlight falling on each square metre of the planet; ',
              m`L`,
              ' — the star’s luminosity (your slider); ',
              m`d`,
              ' — the orbital distance (your slider). Earth receives 1 361 W/m².',
            ),
          ),
        },
        {
          id: 'equilibrium',
          tex:
            'T_{\\text{eq}} \\;=\\; \\left(\\dfrac{(1 - {{A}})\\,{{L}}}{16\\pi\\sigma\\,{{d}}^{2}}\\right)^{1/4}',
          binds: ['L', 'd', 'A'],
          note: prose(
            p(
              m`T_{\text{eq}}`,
              ' — the equilibrium temperature, with no atmosphere; ',
              m`A`,
              ' — the Bond albedo, the fraction reflected (your slider); ',
              m`\sigma`,
              ' — the Stefan–Boltzmann constant. The 16 is 4 for the sphere’s area against the ',
              'disc that catches light, times 4π. Temperature goes as the fourth root, so doubling ',
              'the light warms a planet by only 19 percent.',
            ),
          ),
        },
        {
          id: 'zone-edge',
          tex: 'd_{\\text{edge}} \\;=\\; 1\\,\\text{AU}\\cdot\\sqrt{\\dfrac{{{L}} / L_\\odot}{S_{\\text{eff}}}}',
          binds: ['L'],
          note: prose(
            p(
              m`d_{\text{edge}}`,
              ' — the distance of a zone edge; ',
              m`S_{\text{eff}}`,
              ' — the climate-model limit in units of Earth’s flux, 1.014 at the inner edge and ',
              '0.343 at the outer for a Sun-like star. The zone scales with the square root of ',
              'luminosity.',
            ),
            p(
              'Worked example, Earth. ',
              m`L = L_\odot = 3.83 \times 10^{26}\,\text{W}`,
              ', ',
              m`d = 1\,\text{AU} = 1.496 \times 10^{11}\,\text{m}`,
              ', ',
              m`A = 0.30`,
              '.',
            ),
            p(m`S = 3.83 \times 10^{26} / (4\pi \times (1.496 \times 10^{11})^2) = 1\,361\,\text{W/m}^2`),
            p(
              m`T_{\text{eq}} = (0.70 \times 3.83 \times 10^{26} / (16\pi \times 5.67 \times 10^{-8} \times (1.496 \times 10^{11})^2))^{1/4} = (4.20 \times 10^{9})^{1/4} = 255\,\text{K}`,
              ', or −18 °C',
            ),
            p('With Earth’s 33 K of greenhouse warming: 288 K, or 15 °C.'),
            p(
              'Inner edge: ',
              m`1\,\text{AU} \times \sqrt{1 / 1.014} = 0.99\,\text{AU}`,
              '. Outer edge: ',
              m`1\,\text{AU} \times \sqrt{1 / 0.343} = 1.71\,\text{AU}`,
              '. Earth sits at 1.00, Mars at 1.52; Venus, at 0.72, is outside.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The equilibrium temperature follows from energy balance for a body of radius ',
          m`R`,
          ' at distance ',
          m`d`,
          ': absorbed power ',
          m`(1 - A)\,L\,\pi R^2 / (4\pi d^2)`,
          ' equals emitted power ',
          m`4\pi R^2 \varepsilon \sigma T^4`,
          ', with emissivity ',
          m`\varepsilon = 1`,
          ' for a ',
          term('blackbody'),
          ', giving ',
          m`T_{\text{eq}} = [(1 - A)\,L / (16\pi\sigma d^2)]^{1/4}`,
          '. The factor 4 between the intercepting disc and the radiating sphere assumes heat is ',
          'distributed over the whole surface, which holds for a rapid rotator or a thick ',
          'atmosphere; a tidally locked airless body radiates from its day side alone and its ',
          'day side averages ',
          m`2^{1/4}`,
          ' hotter, its substellar point √2 hotter, while the night side falls toward the cosmic background. The greenhouse ',
          'offset can be folded in as an effective emissivity ',
          m`\varepsilon < 1`,
          ' in the outgoing term: Earth’s 288 K corresponds to ',
          m`\varepsilon \approx 0.61`,
          '.',
        ),
        p(
          'The inner edge is a limit on outgoing radiation. As the surface warms, the lower ',
          'atmosphere saturates with water vapour, whose infrared opacity caps the thermal flux ',
          'the planet can emit at the Simpson–Nakajima limit, about 280–300 W/m² for Earth’s ',
          'gravity; if absorbed sunlight exceeds it, no equilibrium exists and the oceans ',
          'evaporate entirely. Before that, at a lower flux, the stratosphere becomes wet enough ',
          'for ultraviolet light to split water and let hydrogen escape to space over a few ',
          'hundred million years, the moist-greenhouse limit at ',
          m`S_{\text{eff}} = 1.014`,
          ' that the sim uses as the conservative inner edge; the runaway proper is at 1.107 for ',
          'an Earth-mass planet and shifts with mass. The outer edge is the maximum-greenhouse ',
          'limit: adding CO₂ warms a planet until, at about 8 bar, Rayleigh scattering and ',
          'condensation reflect more sunlight than the added gas traps, at ',
          m`S_{\text{eff}} = 0.343`,
          ' for the Sun. All four edges depend on stellar effective temperature through the ',
          'albedo of ice and of Rayleigh scattering, which favour the redder light of cooler ',
          'stars; Kopparapu et al. give polynomial fits in ',
          m`T_{\text{eff}} - 5780\,\text{K}`,
          ', and the sim’s fixed values are the Sun’s.',
        ),
        p(
          'Three-dimensional climate models move the edges from these one-dimensional limits. ',
          'Cloud feedbacks push the Sun’s inner edge inward to about 0.95 AU, and for tidally ',
          'locked planets the permanent cloud deck over the substellar point reflects so much ',
          'light that the inner edge for red dwarfs moves inward by about a factor of two in ',
          'flux. Red-dwarf zones carry other problems the sim omits: the star’s luminosity falls ',
          'by a factor of ten or more during its first hundred million years, so a planet now in ',
          'the zone spent its youth inside the runaway limit and may have lost its water before ',
          'it had a chance; flares and stellar wind erode atmospheres at those distances; and the ',
          'zone itself, within about 0.05 AU for the faintest stars, is deep enough in the star’s ',
          'gravity that any planet is locked. Whether locked planets keep an atmosphere is the ',
          'question JWST is now putting to the TRAPPIST-1 planets, with the two innermost so far ',
          'showing no thick atmosphere at all.',
        ),
        p(
          'Finally, the zone moves. ',
          term('Main-sequence', 'main-sequence'),
          ' stars brighten as their cores convert hydrogen to helium; the Sun was about 30 percent ',
          'dimmer on the zero-age main sequence, so the “continuously habitable ',
          'zone” over the past four billion years is narrower than the present one. The ',
          'conservative inner edge already sits just inside Earth’s orbit, and the ',
          'runaway-greenhouse limit reaches 1 AU in roughly a billion years, long before the Sun ',
          'leaves the main sequence. The faint young Sun paradox, that early Earth had liquid ',
          'water four billion years ago under a Sun then about 25 percent dimmer than today, is ',
          'usually resolved by a thicker CO₂ or methane ',
          'atmosphere then, which is the greenhouse coat of the analogy doing exactly its job.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'exoplanets',
          reason:
            'Every planet found by the transits in that module is placed on this axis first; a period and a star’s mass give the distance, and the distance gives the verdict.',
        },
        {
          moduleId: 'planetary-atmospheres',
          reason: 'The zone assumes a planet keeps its air; that module is about whether it can.',
        },
        {
          moduleId: 'stellar-fusion',
          reason:
            'The luminosity slider here is what that module’s fusion rate becomes at the surface of a star.',
        },
        {
          moduleId: 'kepler-orbits',
          reason: 'The orbital distance here is the semi-major axis there; the two sliders are one quantity.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Kopparapu et al. 2013, “Habitable Zones around Main-sequence Stars: New Estimates”, ApJ 765, 131',
      url: 'https://doi.org/10.1088/0004-637X/765/2/131',
      note: 'The S_eff limits and their T_eff dependence; the erratum (ApJ 770, 82) gives the corrected inner edges',
    },
    {
      label:
        'Kopparapu et al. 2014, “Habitable Zones around Main-sequence Stars: Dependence on Planetary Mass”, ApJL 787, L29',
      url: 'https://doi.org/10.1088/2041-8205/787/2/L29',
      note: 'Runaway greenhouse limit 1.107 for Earth mass and its mass dependence',
    },
    {
      label: 'Kasting, Whitmire & Reynolds 1993, “Habitable Zones around Main Sequence Stars”, Icarus 101, 108',
      url: 'https://doi.org/10.1006/icar.1993.1010',
      note: 'The modern definition and the moist and maximum greenhouse limits',
    },
    {
      label: 'Gough 1981, “Solar interior structure and luminosity variations”, Solar Physics 74, 21',
      url: 'https://doi.org/10.1007/BF00151270',
      note: 'The Sun’s brightening: about 30 percent dimmer at formation, and the zone’s outward drift',
    },
    {
      label:
        'Gillon et al. 2017, “Seven temperate terrestrial planets around the nearby ultracool dwarf star TRAPPIST-1”, Nature 542, 456',
      url: 'https://doi.org/10.1038/nature21360',
      note: 'The TRAPPIST-1 system',
    },
  ],
};

export default habitableZone;

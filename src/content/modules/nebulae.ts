/**
 * Nebulae — the fourteenth published Lodestar module.
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
import { Q_O7V } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const nebulae: Module = {
  id: 'nebulae',
  title: 'Nebulae',
  tagline:
    'A cloud of gas lit from inside by newborn stars glows the way a neon sign does: its atoms are driven to give off light in colours all their own.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'On a dark night the middle “star” of Orion’s sword is not a star but a cloud of gas, lit ',
          'from inside by four newborn suns, and you can see it with the naked eye. It glows the way ',
          'a neon sign does: its gas is driven to give off light in colours all its own.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'A neon sign is a glass tube of thin gas with electricity run through it. Fast electrons ',
          'bump the atoms into a higher-energy state, and as each settles back it flashes a colour ',
          'that belongs to that gas alone. The gas is not burning; it is being poked, and it ',
          'answers with light.',
        ),
        p(
          'A nebula is a neon sign the size of a solar system or far larger, with no tube and no ',
          'wires. The poking is done by the harsh ultraviolet light of very hot, young stars. It ',
          'strips electrons from the hydrogen, and the gas glows two ways: hydrogen flashes as ',
          'electrons rejoin it, and oxygen flashes after the loose electrons bump it, as in the ',
          'sign. That is why nebulae everywhere share the same red and green.',
        ),
        p(
          'The glow has a limit. Each particle of ultraviolet light, a photon, strips one ',
          'electron, and every electron eventually rejoins an atom and must be stripped again. ',
          'Beyond the distance where the star’s photons can keep up, the gas goes dark: how much ',
          'ultraviolet the star makes, and how crowded the gas is, set the size of the glow.',
        ),
        p(
          'Where the analogy breaks: a sign glows to the ends of its tube, because the current ',
          'runs the whole way. A nebula’s glow stops, sharply, where the star’s light runs out.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'nebulae',
      caption: prose(
        p(
          'Turn the star’s ultraviolet up and down and thicken or thin the gas, and watch the glowing ',
          'bubble grow and shrink. Then look at the spectrum below to see where the red and the green ',
          'come from.',
        ),
      ),
      params: [
        {
          id: 'Q',
          friendlyLabel: 'How much ultraviolet does the star put out? (photons each second; 100 watts of yellow light is about 3 × 10²⁰)',
          technicalLabel: 'Ionizing photon rate',
          symbol: 'Q',
          unit: 's^{-1}',
          // An early B star to the brightest O stars. Default: an O7 star, roughly the
          // brightest star in Orion. Five decades exactly; the maximum is
          // reachable with a 0.01-decade step.
          min: 1e45,
          max: 1e50,
          default: Q_O7V,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'photons/s', factor: 1 } },
        },
        {
          id: 'n',
          friendlyLabel: 'How crowded is the gas? (particles per cubic centimetre; the air you breathe has about 2.5 × 10¹⁹)',
          technicalLabel: 'Hydrogen number density',
          symbol: 'n',
          unit: 'm^{-3}',
          // 1 to 100 000 atoms per cubic centimetre. Default 100, a typical diffuse
          // H II region; Orion's core is about 10 000. Five decades exactly; the
          // maximum is reachable with a 0.01-decade step.
          min: 1e6,
          max: 1e11,
          default: 1e8,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'per cm³', factor: 1e-6 } },
        },
      ],
      approximations: [
        prose(
          p(
            'The gas is uniform and pure hydrogen, so the glowing region is a perfect sphere. Real nebulae are clumpy, have their gas blown to one side, and their sizes vary from this by a factor of two or so.',
          ),
        ),
        prose(
          p(
            'The star’s ultraviolet is a single number, the count of photons able to strip hydrogen of its electron. Which star it is, and how hot, are folded into that count.',
          ),
        ),
        prose(
          p(
            'The line strengths on the spectrum are typical for a nebula like Orion and do not change with the sliders except in overall brightness. Real ratios vary with temperature, density and how much oxygen and nitrogen the gas holds.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'The cloud in Orion’s sword is an ',
          term('emission nebula'),
          ', or in astronomers’ language an ',
          term('H II region', 'h-ii-region'),
          ': a cloud of hydrogen in which the atoms have been split into protons and electrons, a ',
          'state called ',
          term('ionization'),
          ', by the ultraviolet light of hot stars. Only photons with wavelengths shorter than 91.2 ',
          'nm carry enough energy to ionize hydrogen, and only stars hotter than about 25 000 K, of ',
          'spectral types O and early B, produce them in quantity. Such stars live a few million ',
          'years for O stars, and at most a few tens of millions for early B stars, so an H II region marks a place where massive stars have formed very ',
          'recently; the four Trapezium stars lighting Orion are less than a million years old, and ',
          'the whole cloud is still making more.',
        ),
        p(
          'The glow is recombination light. When a free electron rejoins a proton it cascades down ',
          'through the atom’s energy levels and emits a photon at each step; the step to the second ',
          'level gives the Balmer series, and its brightest line, Hα at 656 nm, is the red of every ',
          'nebula photograph. The green comes from oxygen: a ',
          term('forbidden line'),
          ' at 500.7 nm from twice-ionized oxygen, a transition so slow that in a laboratory the ',
          'atom would be knocked out of the state by a collision long before it could emit, but in ',
          'gas this thin, a hundred atoms per cubic centimetre, nothing comes along to knock it. To ',
          'the eye at a telescope a bright nebula looks grey-green, because the eye is most ',
          'sensitive there; the red belongs to cameras.',
        ),
        p(
          'The size of the glow was worked out by Bengt Strömgren in 1939. Each ionizing photon ',
          'frees one electron; in gas of density ',
          m`n`,
          ', electrons and protons recombine at a rate proportional to ',
          m`n^2`,
          '; the ionized region grows until recombinations throughout its volume exactly consume ',
          'the star’s supply of photons, and stops there. The result, the ',
          term('Strömgren sphere', 'stromgren-sphere'),
          ', has a radius proportional to the cube root of the photon rate divided by ',
          m`n^{2/3}`,
          ': about 3 parsecs, 10 light-years, for a single O star in gas of 100 atoms per cubic ',
          'centimetre. The edge is sharp, a transition from ionized to neutral gas only about a ',
          'hundred astronomical units thick, because a photon entering neutral gas is absorbed ',
          'within that distance. The ionized gas sits at about 10 000 K, a hundred times hotter than the ',
          'neutral cloud around it, and its pressure drives the nebula outward at about ten ',
          'kilometres per second, so real H II regions are not static spheres but expanding, often ',
          'lopsided blisters on the face of the dark cloud that made their stars. Orion’s is one: ',
          'the Trapezium sits in a cavity that has broken open toward us.',
        ),
        p(
          'Not every nebula shines this way. A ',
          term('reflection nebula'),
          ' only scatters the light of nearby stars and shows their colour, usually blue; a ',
          term('dark nebula'),
          ' is a cloud thick enough with dust to hide what lies behind it, and it is inside those ',
          'that stars form; a ',
          term('planetary nebula'),
          ' is the shell shed by a dying Sun-like star, lit by the white dwarf at its centre; and ',
          'the Crab is the debris of a ',
          term('core-collapse supernova'),
          '. All are “nebulae” because to the first telescopes they were all the same: a faint ',
          'smudge.',
        ),
        p(
          'Two misconceptions. Nebulae are not dense: a hundred atoms per cubic centimetre is a ',
          'better vacuum than almost any laboratory on Earth can make, and a spacecraft flying through ',
          'Orion would notice nothing. And the colours in the famous images are usually not what an ',
          'eye would see; the Hubble palette maps sulphur, hydrogen and oxygen lines to red, green ',
          'and blue to separate them, which turns hydrogen’s red into green.',
        ),
        p(
          'The sim’s formula assumes uniform gas, and real regions are neither uniform nor ',
          'spherical; their measured sizes scatter around the Strömgren value by a factor of two or ',
          'so. The photon rates of O stars are themselves model values, uncertain by a factor of ',
          'about two for a given spectral type.',
        ),
        /*
         * Source: https://science.nasa.gov/asset/hubble/hubbles-sharpest-view-of-the-orion-nebula/
         * ("Hubble's Sharpest View of the Orion Nebula", released 11 January 2006,
         * STScI-PRC06-01a; the former HubbleSite page
         * https://hubblesite.org/contents/media/images/2006/01/1826-Image.html
         * redirects here). The page's credit reads "NASA, ESA, Hubble Space
         * Telescope Orion Treasury Project Team, Massimo Robberto (STScI, ESA)".
         * Image asset STScI-01EVT7X0BR54ZWDP1AG2DA54RA, taken as the unframed
         * 6000 × 6000 rendition and converted to 1280 px wide webp.
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
          src: '/figures/nebulae.webp',
          width: 1280,
          height: 1280,
          alt: 'A billowing cloud of glowing gas on a dark starfield: pink and rose light pours from a bright, cream-white core a little left of centre, where a small tight group of stars sits, and spreads into orange-brown ridges to the right and a dark lane of dust at the upper left; a smaller pink-violet bubble sits at the upper left, and scattered blue-white stars dot the whole field.',
          caption:
            'The Orion Nebula, 1 300 light-years away, about 10 light-years across in this view. The four Trapezium stars near the centre supply the ultraviolet; hydrogen gives the red, oxygen the green, and the dark cloud that made the stars fills the background.',
          credit: 'NASA, ESA, Hubble Space Telescope Orion Treasury Project Team, Massimo Robberto (STScI, ESA)',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'stromgren',
          tex: 'R_S \\;=\\; \\left(\\dfrac{3\\,{{Q}}}{4\\pi\\,{{n}}^{2}\\,\\alpha_B}\\right)^{1/3}',
          binds: ['Q', 'n'],
          note: prose(
            p(
              m`R_S`,
              ' — the Strömgren radius, the size of the ionized sphere; ',
              m`Q`,
              ' — the star’s rate of ionizing photons (your slider); ',
              m`n`,
              ' — the hydrogen number density (your slider); ',
              m`\alpha_B`,
              ' — the recombination coefficient, ',
              m`2.59 \times 10^{-19}\,\text{m}^3/\text{s}`,
              ' at 10 000 K, the rate at which a proton and an electron find each other per unit ',
              'density. Ten times the density shrinks the bubble by a factor of 4.6.',
            ),
          ),
        },
        {
          id: 'ionized-mass',
          tex: 'M \\;=\\; \\tfrac{4}{3}\\pi R_S^{3}\\,{{n}}\\,m_p',
          binds: ['Q', 'n'],
          note: prose(
            p(
              m`M`,
              ' — the mass of glowing gas; ',
              m`m_p`,
              ' — the proton mass. Since ',
              m`R_S^3 \propto Q / n^2`,
              ', the mass goes as ',
              m`Q / n`,
              ': a star lights up more gas when the gas is thinner.',
            ),
          ),
        },
        {
          id: 'recombination-time',
          tex: 't_{\\text{rec}} \\;=\\; \\dfrac{1}{{{n}}\\,\\alpha_B}',
          binds: ['n'],
          note: prose(
            p(
              m`t_{\text{rec}}`,
              ' — how long, on average, a proton waits before it captures an electron. If the star ',
              'switched off, the nebula would fade on this timescale.',
            ),
            p(
              'Worked example, an O7 star in diffuse gas. ',
              m`Q = 10^{49}\,\text{photons/s}`,
              ', ',
              m`n = 10^{8}\,\text{m}^{-3}`,
              ' (100 per cm³).',
            ),
            p(
              m`R_S = (3 \times 10^{49} / (4\pi \times (10^{8})^2 \times 2.59 \times 10^{-19}))^{1/3} = (9.22 \times 10^{50})^{1/3} = 9.7 \times 10^{16}\,\text{m} = 3.2\,\text{pc}`,
              ', or 10 light-years',
            ),
            p(
              m`M = (4/3)\,\pi\,(9.7 \times 10^{16})^3 \times 10^{8} \times 1.67 \times 10^{-27} = 6.5 \times 10^{32}\,\text{kg} = 325\,M_\odot`,
            ),
            p(
              m`t_{\text{rec}} = 1 / (10^{8} \times 2.59 \times 10^{-19}) = 3.9 \times 10^{10}\,\text{s}`,
              ' = 1 200 years',
            ),
            p(
              'In Orion’s core, at 10⁴ per cm³, the same star’s sphere shrinks to 0.15 pc, half a ',
              'light-year: the bright heart of the nebula.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Ionization balance in a static, uniform, pure-hydrogen nebula equates the star’s ',
          'ionizing photon rate to the volume recombination rate: ',
          m`Q = \tfrac{4}{3}\pi R_S^3\, n_e n_p \alpha_B`,
          ', with ',
          m`n_e = n_p = n`,
          ' for full ionization. ',
          m`\alpha_B`,
          ' is the case-B coefficient, which excludes recombinations directly to the ground state ',
          'on the argument that the Lyman-continuum photon they emit is reabsorbed nearby and ',
          'ionizes another atom; it scales roughly as ',
          m`T^{-0.8}`,
          ' and is ',
          m`2.59 \times 10^{-19}\,\text{m}^3/\text{s}`,
          ' at ',
          m`10^4\,\text{K}`,
          '. The ionization front is thin because the photoionization cross-section at threshold, ',
          m`6.3 \times 10^{-22}\,\text{m}^2`,
          ', gives a mean free path ',
          m`1/(n\sigma)`,
          ' of order ',
          m`10^{-3}\,\text{pc}`,
          ' at ',
          m`n = 10^8\,\text{m}^{-3}`,
          '; over that distance the neutral fraction rises from below ',
          m`10^{-3}`,
          ' to near unity. A region that runs out of gas before it runs out of photons is ',
          'density-bounded and leaks ionizing radiation into the galaxy; the escape fraction from ',
          'H II regions, of order ten to thirty percent, is one input to how the first galaxies ',
          'reionized the universe.',
        ),
        p(
          'The sphere does not stay put. Photoionization deposits a few eV per ionization as ',
          'electron kinetic energy, and the gas is cooled chiefly by the forbidden lines, above all ',
          '[O III] 500.7 nm, which act as a thermostat holding H II regions between about 7 000 and ',
          '10 000 K almost regardless of the star. The ionized gas at ',
          m`10^4\,\text{K}`,
          ' has a pressure some hundred times that of the neutral cloud at 100 K around it, so the ',
          'region expands behind a shock at roughly its own sound speed, about 10 km/s. Spitzer’s ',
          'solution for the expansion phase, ',
          m`R(t) = R_S\,(1 + 7 c_s t / 4 R_S)^{4/7}`,
          ', is what the sim’s million-year readout evaluates, and it triples the radius of the ',
          'worked example in that time; it holds until the interior pressure matches the ',
          'surroundings, or, usually sooner, until the region bursts out of its parent cloud into ',
          'the lower-density gas beyond, the “champagne flow” that shapes Orion and most others. The ',
          'forbidden lines also serve as diagnostics: the [S II] 671.6/673.1 nm ratio measures ',
          'electron density, and the [O III] 436.3/500.7 nm ratio measures temperature, which is how ',
          'the numbers in the sim are known at all.',
        ),
        p(
          'Because the Hα luminosity of a region counts its recombinations and therefore its ',
          'ionizing photons, and those come only from stars younger than about 10 Myr, the Hα output ',
          'of a whole galaxy is a clock on its current star formation: Kennicutt’s calibration, a ',
          'star formation rate of ',
          m`7.9 \times 10^{-42}`,
          ' solar masses per year per erg per second of Hα, is the standard measure of how fast ',
          'galaxies form stars, from nearby dwarfs to the most distant systems whose H II regions ',
          'JWST now resolves. Planetary nebulae obey the same physics with a hotter and smaller ',
          'engine: a white dwarf at ',
          m`10^5\,\text{K}`,
          ' ionizes helium twice over and adds the He II line at 468.6 nm, and its nebula is a few ',
          'tens of thousands of years from dispersing rather than a few million. The open questions are mostly ',
          'about what the simple model leaves out: dust inside the region, which absorbs a large ',
          'share of the ionizing photons and re-radiates them in the infrared; magnetic fields, ',
          'which can carry as much pressure as the gas; and the clumpiness of real clouds, which ',
          'lets ionizing photons escape along low-density channels and makes the measured sizes ',
          'scatter around the Strömgren value.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'stellar-fusion',
          reason:
            'That module is how the Sun’s core burns. The stars doing the ionizing here are far heavier, with cores more than twice as hot, where the other route to fusion it mentions takes over.',
        },
        {
          moduleId: 'supernovae',
          reason:
            'The same stars end that way within a few million years, and their supernovae are what finally blow apart the clouds these regions light.',
        },
        {
          moduleId: 'early-universe',
          reason:
            'The first stars’ H II regions, grown until they overlapped, are how the universe was reionized after the dark ages of that module.',
        },
        {
          moduleId: 'exoplanets',
          reason: 'Stars form inside the dark clouds these regions carve out; every planet in that module began in one.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Strömgren 1939, “The Physical State of Interstellar Hydrogen”, ApJ 89, 526',
      url: 'https://doi.org/10.1086/144074',
      note: 'The Strömgren sphere',
    },
    {
      label: 'Hummer & Storey 1987, “Recombination-line intensities for hydrogenic ions. I”, MNRAS 224, 801',
      url: 'https://doi.org/10.1093/mnras/224.3.801',
      note: 'Case-B recombination coefficient',
    },
    {
      label:
        'Sternberg, Hoffmann & Pauldrach 2003, “Ionizing Photon Emission Rates from O- and Early B-Type Stars and Clusters”, ApJ 599, 1333',
      url: 'https://doi.org/10.1086/379506',
      note: 'Q for O stars by spectral type',
    },
    {
      label: 'O’Dell 2001, “The Orion Nebula and its Associated Population”, ARA&A 39, 99',
      url: 'https://doi.org/10.1146/annurev.astro.39.1.99',
      note: 'Orion’s structure, density and blister geometry',
    },
    {
      label: 'Kennicutt 1998, “Star Formation in Galaxies Along the Hubble Sequence”, ARA&A 36, 189',
      url: 'https://doi.org/10.1146/annurev.astro.36.1.189',
      note: 'The Hα star-formation-rate calibration',
    },
  ],
};

export default nebulae;

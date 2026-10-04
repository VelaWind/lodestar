/**
 * Galaxies — the twenty-first published Lodestar module.
 *
 * Every figure here was recomputed from `@/physics/galaxies` and the sourced
 * constants before it was written, and the sanity block `verifyGalaxyModel`
 * holds the code to them: the encounter's two-body energy (drift 1.7 × 10⁻⁷), a
 * lone star's circle (0.55%), the closest-approach speed against
 * √(2G(M₁+M₂)/r_p), prograde against retrograde tails at the defaults, closer
 * passes pulling out more, the exact near-edge tide (4.22, 3.99 softened; the
 * linear formula's 0.42 fails at d/r_p = 0.75) and the angular-speed match at
 * closest approach, the star-collision chance (1.3 × 10⁻¹² per crossing), the
 * hook's 1 155 km (Proxima, a bead) and 1 187 km (Alpha Centauri A, a ball), and
 * Andromeda's 6.84 billion years at constant speed against 3.1 (timing mass) or
 * 3.5 (combined mass) with gravity.
 *
 * Tail fraction against closest approach, prograde, 300 Myr after it (%):
 *   M₂ = 0.1 M₁: 10 kpc 14, 15 kpc 13, 20 kpc 10, 25 kpc 2, 30 kpc and beyond 0.
 *   M₂ = 0.5 M₁: 51, 48, 36, 19, 8 at 30, 1 at 35, 0 at 40.
 *   M₂ = 1   M₁: 64, 61, 49, 35, 19 at 30, 7 at 35, 1 at 40.
 * Smallest tails at the defaults come at tilts of 105–150° (1.4% at 120°).
 *
 * Sources cited in comments rather than in the five-reference list:
 *   - Hubble 1936, The Realm of the Nebulae (the tuning fork; "early" and
 *     "late" meant no evolution). Hubble 1925, Cepheids in M31 and M33 at about
 *     930 000 light-years, a third of today's distance; Baade (1952) found the
 *     Cepheids he used brighter than assumed, doubling it.
 *   - The Great Debate, Shapley and Curtis, National Academy of Sciences,
 *     26 April 1920.
 *   - Li et al. 2021, ApJ 920, 84: M31 at 761 ± 11 kpc (the site uses 765).
 *   - van der Marel et al. 2012, ApJ 753, 8 (Paper II): radial velocity
 *     −109.3 ± 4.4 km/s, tangential 17 km/s, timing mass 4.93 × 10¹² M☉.
 *   - Lauer et al. 2021, ApJ 906, 77: New Horizons' optical background, room
 *     for about twice the galaxies Hubble can see.
 *   - Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529: Milky Way stellar mass
 *     5 × 10¹⁰ M☉ (so 100–400 billion stars for a mean stellar mass of 0.1–0.5
 *     M☉), Sb–Sbc and barred; thin-disc scale height ~300 pc; local stellar
 *     mass density 0.043 M☉ pc⁻³.
 *   - Reylé et al. 2021, A&A 650, A201: 540 stars, brown dwarfs and planets
 *     within 10 pc.
 *   - Lintott et al. 2008, MNRAS 389, 1179: Galaxy Zoo, launched July 2007,
 *     nearly 900 000 galaxies classified in its first year.
 *   - Dressler 1980, ApJ 236, 351: the morphology–density relation.
 *   - Kormendy & Ho 2013, ARA&A 51, 511: black-hole mass about 0.5% of the
 *     bulge's, and M ∝ σ^4.4.
 *   - Naidu et al. 2026, Open Journal of Astrophysics: MoM-z14 at z = 14.44,
 *     spectroscopically confirmed; it superseded JADES-GS-z14-0 (z = 14.18).
 *     Early "too massive" JWST galaxies: many now attributed to accreting black
 *     holes ("little red dots") and revised masses; an excess of UV-bright
 *     galaxies at z > 10 is still debated.
 *   - Ibata et al. 2013, Nature 493, 62 (Andromeda's plane of satellites);
 *     Sawala et al. 2023, Nature Astronomy 7, 481 (the Milky Way's plane
 *     consistent with ΛCDM, and transient).
 */
import {
  GALAXY_MAIN_MASS,
  KILOPARSEC,
  M_SUN,
} from '@/physics/constants';
import type { Module } from '../types';
import { figure, m, p, prose, term } from '../rich';

const DEG = Math.PI / 180;

const galaxies: Module = {
  id: 'galaxies',
  title: 'Galaxies',
  tagline: 'Islands of hundreds of billions of stars. When two meet, their stars almost never touch, but gravity pulls both into new shapes.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'When two galaxies collide, their stars almost never hit each other. Shrink the Sun to a ',
          'ping-pong ball, and its nearest neighbours are balls and beads about 1 200 kilometres away.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture two huge crowds, each swirling slowly around its own middle, walking straight through ',
          'each other. The people are so spread out that almost nobody bumps into anyone. But each crowd ',
          'pulls on the other as it passes. People on the near side are tugged harder than those on the ',
          'far side, and long streams of them are drawn out behind. Those circling the same way the other ',
          'crowd goes past are pulled the longest, and stream out the furthest.',
        ),
        p(
          'That is what happens when galaxies meet. A galaxy is a vast spinning system of stars, gas and ',
          'dust held together by its own gravity. In a collision the stars slip past one another, but ',
          'gravity reshapes both galaxies, stretching them into long, curving tails of stars.',
        ),
        p(
          'Where the analogy breaks: people do not pull on each other by gravity. And most of a real ',
          'galaxy’s pull comes from matter we cannot see, a vast cloud of dark matter reaching far beyond ',
          'its stars.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'galaxies',
      caption: prose(
        p(
          'A smaller galaxy swings past a bigger one. Tilt the bigger disc from 0 degrees, spinning the ',
          'same way the companion goes round, to 180 degrees, spinning against it, and compare the tails. ',
          'Bring the two closer, or make the companion heavier, for a stronger pull.',
        ),
      ),
      params: [
        {
          id: 'M2',
          friendlyLabel: 'How heavy is the companion? (in billions of Suns; the main galaxy is 100 billion)',
          technicalLabel: 'Companion mass',
          symbol: 'M_2',
          unit: 'kg',
          // A tenth of the main galaxy's mass to an equal one. Default: half,
          // where a prograde pass throws out long tails and a retrograde one
          // barely disturbs the disc.
          min: 0.1 * GALAXY_MAIN_MASS,
          max: GALAXY_MAIN_MASS,
          default: 0.5 * GALAXY_MAIN_MASS,
          step: 1e9 * M_SUN,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'billion M☉', factor: 1 / (1e9 * M_SUN) } },
        },
        {
          id: 'rp',
          friendlyLabel: 'How close do they pass? (in kiloparsecs; one is about 3 260 light-years)',
          technicalLabel: 'Closest approach',
          symbol: 'r_p',
          unit: 'm',
          // 10 to 40 kpc: inside the disc's edge to over two and a half disc
          // radii away. Past 40 kpc no mass on the slider pulls out even 1% of
          // the disc (scan at +300 Myr: equal mass 0.9% at 40, 0 at 45), so the
          // range stops there. Default 20 kpc, 1.3 times the 15 kpc disc radius.
          min: 10 * KILOPARSEC,
          max: 40 * KILOPARSEC,
          default: 20 * KILOPARSEC,
          step: 0.5 * KILOPARSEC,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'kpc', factor: 1 / KILOPARSEC } },
        },
        {
          id: 'tilt',
          friendlyLabel: 'How is the main disc tilted against the orbit? (in degrees: 0 spins with it, 180 against it)',
          technicalLabel: 'Disc inclination to the orbit',
          symbol: 'i',
          unit: 'rad',
          // 0° prograde (the disc spins with the orbit) to 180° retrograde.
          min: 0,
          max: 180 * DEG,
          default: 0,
          step: 1 * DEG,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: '°', factor: 1 / DEG } },
        },
      ],
      approximations: [
        prose(
          p(
            'Each galaxy is a single point of mass, standing for its centre and the inner part of its unseen cloud of dark matter. Real galaxies spread their mass through that cloud, far beyond their stars.',
          ),
        ),
        prose(
          p(
            'So stars far out circle more slowly than nearer ones, unlike real galaxies, where dark matter keeps speeds nearly flat far out (see the Dark Matter module). Here a star 33 000 light-years out moves at 206 kilometres a second, and one at 49 000 light-years at 169.',
          ),
        ),
        prose(
          p(
            'Stars are spread evenly across the disc, with none in its central fifth; real discs crowd toward the middle, so the share thrown out here is higher than a real galaxy’s.',
          ),
        ),
        prose(
          p(
            'Each galaxy’s pull is softened within about 3 300 light-years (1 kiloparsec) of its centre, so a star passing close is not flung off by an infinitely sharp point.',
          ),
        ),
        prose(
          p(
            'Stars feel the two galaxies’ pull but not each other’s. So no spiral arms or bars form on their own, as they do in real discs.',
          ),
        ),
        prose(
          p(
            'There is no gas, so there are none of the bursts of new stars that light up real collisions.',
          ),
        ),
        prose(
          p(
            'Nothing slows the galaxies down. In reality each drags on the other’s dark matter, so close pairs usually swing back and merge. Here they pass once and separate.',
          ),
        ),
        prose(
          p(
            'The two follow a parabola, the boundary between a closed orbit and an escape, starting twice their closest distance apart. Every star starts on a perfect circle.',
          ),
        ),
        prose(
          p(
            'The main galaxy weighs 100 billion Suns and its disc reaches about 49 000 light-years (15 kiloparsecs) from its centre. The companion’s disc is smaller, in proportion to the square root of its mass. Both discs are tilted by the same angle.',
          ),
        ),
        prose(
          p(
            'A star counts as pulled far out once it is more than twice the disc’s radius, about 98 000 light-years, from the main galaxy’s centre. That includes stars in a tail and stars captured by the companion.',
          ),
        ),
        prose(
          p(
            'Every pass is followed for 300 million years after closest approach, so passes are compared at the same age. At the slider’s farthest pass, about 130 000 light-years (40 kiloparsecs), the disc barely notices: under 1 percent of its stars are pulled out.',
          ),
        ),
        prose(
          p(
            'Stars move in steps of a million years. A lone star, with no companion, keeps to its circle within about half a percent.',
          ),
        ),
        prose(
          p(
            'Time is sped up by the same factor at every setting: one second on screen is 50 million years. While a slider moves, fewer stars are drawn until it stops, and the tail percentage is approximate.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A ',
          term('galaxy'),
          ' is a system of stars, gas, dust and dark matter bound by its own gravity. Ours, the Milky ',
          'Way, is a barred spiral, usually classed SBbc. It holds a few hundred billion stars, with estimates from ',
          '100 to 400 billion, in a disc about 100 000 light-years (30 kiloparsecs) across, more if its ',
          'faint outer edge is counted. The nearest large galaxy, Andromeda, is about 2.5 million ',
          'light-years away. How many galaxies the observable universe holds is uncertain: at least two ',
          'trillion, most too faint to see, by a 2016 estimate; only hundreds of billions, from the faint ',
          'glow of the sky that New Horizons reported in 2021.',
        ),
        p(
          'In the 1920 “Great Debate” Harlow Shapley argued that the spiral nebulae lay within our galaxy, ',
          'Heber Curtis that they were galaxies like ours. Edwin Hubble settled it in 1925: ',
          term('Cepheid variables', 'cepheid-variable'),
          ' in Andromeda put it about 900 000 light-years away, far outside the Milky Way. His figure was ',
          'a third of today’s, because those Cepheids are brighter than he assumed; the Cosmic Distance ',
          'Ladder module tells that story.',
        ),
        p(
          'In 1926 Hubble sorted galaxies by shape; in 1936 he drew the scheme as a tuning fork, now ',
          'called the ',
          term('Hubble sequence', 'hubble-sequence'),
          '. ',
          term('Elliptical galaxies', 'elliptical-galaxy'),
          ', from round (E0) to flattened (E7), form the handle; ',
          term('spiral galaxies', 'spiral-galaxy'),
          ', plain (S) and barred (SB), form the prongs. At the join sit lenticulars (S0), discs ',
          'without arms, added in 1936 and identified in real galaxies only later. He called ellipticals “early” and spirals ',
          '“late”, meaning no evolution, but the labels misled many. Galaxies do not move along the ',
          'fork. Spirals are mostly gas-rich discs in ordered rotation, still forming stars; ellipticals ',
          'are mostly old stars on random orbits, with little gas. Since 2007 Galaxy Zoo volunteers have ',
          'sorted galaxies by eye: nearly a million in its first year.',
        ),
        p(
          'Galaxies collide, and the ',
          term('tidal force', 'tidal-force'),
          ' between them reshapes both. In 1972 Alar and Juri Toomre showed, with a model like the one ',
          'above, that the long ',
          term('tidal tails', 'tidal-tail'),
          ' of pairs like the Antennae are stars flung out in one close pass. Tails are longest when a ',
          'disc spins the same way the companion goes round, called prograde. When it spins the other ',
          'way, retrograde, it throws out only short, stubby loops; tilts of about 105 to 150 degrees give ',
          'the smallest tails. Andromeda is approaching the Milky Way at about ',
          '110 km/s, about 400 000 km/h. A first pass in about 4 billion years and a merger about 2 ',
          'billion years later were long described as all but certain. A 2025 analysis of Gaia and ',
          'Hubble data gives roughly even odds of a merger within 10 billion years: the current best ',
          'estimate, not the last word.',
        ),
        /*
         * Source: https://esahubble.org/images/heic0615a/ (ESA/Hubble release
         * heic0615, "Colliding galaxies make love, not war"), the large JPEG
         * (3915 × 3885), resized to 1280 px wide webp. The image page links its
         * usage terms at https://esahubble.org/copyright/: "ESA/Hubble images,
         * videos and web texts are released under the Creative Commons
         * Attribution 4.0 International license and may on a non-exclusive
         * basis be reproduced without fee provided they are clearly and visibly
         * credited" — and "the full image or footage credit must be presented in
         * a clear and readable manner to all users, with the wording unaltered".
         * The credit below is the wording the image page carries. The page gives
         * the distance as 75 million light-years; later measurements disagree
         * (about 45 to 72 million), so the caption gives none.
         */
        figure({
          src: '/figures/galaxies.webp',
          width: 1280,
          height: 1270,
          alt: 'Two glowing, tangled galaxy cores on black, one above the other, wrapped in swirls of pale starlight, crossed by brown lanes of dust and dotted with bright pink and blue knots.',
          caption:
            'The Antennae galaxies, two spirals in the middle of merging, seen by Hubble. Pink knots are clouds of hydrogen lit by newborn stars, set off by the collision; dark lanes are dust. The two long tails of stars that give the pair its name reach far beyond this frame.',
          credit:
            'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)-ESA/Hubble Collaboration. Acknowledgement: B. Whitmore (Space Telescope Science Institute) and James Long (ESA/Hubble).',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      intro: prose(
        p(
          'The first equation is the stretch, the second the speed of the pass, the third why the spin ',
          'direction matters.',
        ),
      ),
      equations: [
        {
          id: 'tide',
          tex: '\\Delta a \\;\\approx\\; \\dfrac{2G\\,{{M2}}\\,d}{{{rp}}^{3}}',
          binds: ['M2', 'rp'],
          note: prose(
            p(
              m`\Delta a`,
              ' — how much harder the companion pulls on the near edge of the main disc than on its ',
              'centre, at closest approach; ',
              m`M_2`,
              ' — the companion’s mass; ',
              m`r_p`,
              ' — the closest approach; ',
              m`d = 15\,\text{kpc}`,
              ' — the disc’s radius. The steep ',
              m`r_p^{-3}`,
              ' is why only close passes matter. The approximation is valid only when the disc is much ',
              'smaller than the closest-approach distance.',
            ),
            p(
              'Worked example, the defaults, where it is not: ',
              m`d/r_p = 0.75`,
              '. The exact difference on the near edge, ',
              m`GM_2\left[1/(r_p - d)^2 - 1/r_p^2\right] = 6.674 \times 10^{-11} \times 9.94 \times 10^{40} \times 3.94 \times 10^{-41} = 2.6 \times 10^{-10}\,\text{m/s}^2`,
              ', is about four times the pull holding the edge star on, ',
              m`GM_1/d^2 = 6.2 \times 10^{-11}\,\text{m/s}^2`,
              ': for a moment the companion out-pulls its own galaxy. The sim’s softened pulls give 4.0; on ',
              'the far edge the stretch is 0.19 of the edge star’s own pull.',
            ),
          ),
        },
        {
          id: 'pericentre',
          tex: 'v_p \\;=\\; \\sqrt{\\dfrac{2G\\,(M_1 + {{M2}})}{{{rp}}}}',
          binds: ['M2', 'rp'],
          note: prose(
            p(
              m`v_p`,
              ' — the two galaxies’ relative speed at closest approach on a parabolic orbit, one with ',
              'zero total energy; ',
              m`M_1 = 10^{11}\,M_\odot`,
              '. At the defaults ',
              m`v_p = 254\,\text{km/s}`,
              '; the sim’s integrated orbit, with its softened pull, gives 253.7.',
            ),
            p(
              'Worked example, Andromeda: 765 kpc away and closing at 109.3 km/s. At constant speed the gap ',
              'would close in ',
              m`7.65 \times 10^{5}\,\text{pc} \times 3.086 \times 10^{13}\,\text{km/pc} / 109.3\,\text{km/s} = 6.84`,
              ' billion years. Gravity speeds it up: a straight-line fall starting at today’s 109.3 km/s, ',
              'with the Local Group timing mass, ',
              m`4.9 \times 10^{12}\,M_\odot`,
              ' (the paper’s combined estimate, ',
              m`3.2 \times 10^{12}`,
              ', gives 3.5), brings two point masses together in 3.1 billion years. Andromeda’s small sideways motion, the pulls of the Large ',
              'Magellanic Cloud and M33, and the uncertain masses are why the newest forecast gives even ',
              'odds of a merger within 10 billion years instead.',
            ),
          ),
        },
        {
          id: 'resonance',
          tex: '\\Omega_p = \\dfrac{v_p}{{{rp}}} \\quad\\text{vs}\\quad \\Omega_\\ast = \\dfrac{2\\pi}{T} = \\sqrt{\\dfrac{GM_1}{d^{3}}}',
          // Ω_p depends on the companion's mass through v_p, as well as on r_p.
          binds: ['M2', 'rp'],
          note: prose(
            p(
              m`\Omega_p`,
              ' — how fast the companion sweeps around the main galaxy at closest approach, in radians a ',
              'second; ',
              m`\Omega_\ast`,
              ' — how fast a star at the disc’s edge goes round, ',
              m`T`,
              ' its orbital period. When the two are close and turn the same way, the edge stars ride ',
              'along with the companion’s pull for a long time and are drawn far out: Toomre and Toomre’s ',
              'explanation of prograde tails. Turning the other way, each star feels the pull only briefly.',
            ),
            p(
              'Worked example, the defaults: ',
              m`\Omega_p = 2.54 \times 10^{5} / 6.17 \times 10^{20} = 4.1 \times 10^{-16}\,\text{rad/s}`,
              ' and ',
              m`\Omega_\ast = 3.7 \times 10^{-16}\,\text{rad/s}`,
              ', a period of 540 million years: within about 12 percent of each other.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Why stars do not collide: near the Sun there are about 0.1 stars per cubic parsec, and the ',
          'disc’s scale height is about 300 pc, so a star crossing it face-on passes through a column of ',
          'about 60 stars per square parsec. Two Sun-sized stars touch if their centres pass within two ',
          'solar radii, a target of ',
          m`\pi(2R_\odot)^2 = 6.4 \times 10^{-15}\,\text{pc}^2`,
          ', which gravitational focusing enlarges about threefold at a relative speed of 400 km/s. The ',
          'chance per crossing is about ',
          m`1.3 \times 10^{-12}`,
          '. Multiplied by the few hundred billion stars of both galaxies, that is still less than about ',
          'one collision per crossing, probably far fewer since most stars are smaller than the Sun. Any ',
          'that do happen would most likely be in a crowded centre.',
        ),
        p(
          'Galaxies grew hierarchically. Small ',
          term('dark matter halos', 'dark-matter-halo'),
          ' formed first and merged into larger ones, while gas cooled at their centres into stars. Gas ',
          'that keeps its angular momentum settles into a disc; a merger of comparable galaxies scrambles ',
          'discs into an elliptical, and ',
          term('dynamical friction', 'dynamical-friction'),
          ', the drag of a moving mass on the matter it passes through, is what brings such pairs back ',
          'together after a first pass. Where galaxies are crowded, in rich clusters, most are ',
          'ellipticals and lenticulars; in the sparse field most are spirals (Dressler 1980, the ',
          'morphology–density relation). A galaxy stops forming stars, is quenched, when its gas is ',
          'heated or removed: by energy from its central black hole, by being stripped as it plunges ',
          'through a cluster’s hot gas, or by being cut off from fresh supply.',
        ),
        p(
          'Nearly every large galaxy has a supermassive black hole at its centre, and its mass tracks the ',
          'galaxy’s central bulge: about half a percent of the bulge’s mass, and rising as roughly the ',
          'fourth to fifth power of the bulge stars’ velocity spread, ',
          m`\sigma`,
          ' (the ',
          m`M\text{–}\sigma`,
          ' relation). That the two keep in step suggests they grew together, though how is debated.',
        ),
        p(
          'The James Webb Space Telescope sees galaxies a few hundred million years after the Big Bang; ',
          'among the most distant confirmed by spectroscopy is MoM-z14, at redshift 14.44. It finds more ',
          'bright galaxies at those times than most models predicted. What is measured is their light; ',
          'their masses are inferred. Early claims of galaxies too massive for the standard cosmology have ',
          'largely eased, as some proved to be growing black holes, the “little red dots”, and mass ',
          'estimates came down. Whether the remaining excess needs faster star formation or new physics ',
          'is open.',
        ),
        p(
          'The Milky Way and Andromeda each have dozens of satellite galaxies. Many of the Milky Way’s lie ',
          'in a thin plane and orbit the same way, and Andromeda has a similar plane (Ibata et al. 2013). ',
          'Some argue such planes are too rare in cold-dark-matter simulations; an analysis with Gaia ',
          'orbits (Sawala et al. 2023) found the Milky Way’s plane a short-lived alignment, consistent ',
          'with them. The question is not settled.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'dark-matter',
          reason:
            'Most of a galaxy’s mass is the dark halo around it; that module shows how the stars’ speeds reveal it.',
        },
        {
          moduleId: 'black-holes',
          reason: 'Every large galaxy has a supermassive black hole at its heart, grown in step with its central bulge.',
        },
        {
          moduleId: 'expansion-of-the-universe',
          reason:
            'Andromeda is one of the few galaxies coming toward us; almost all the rest recede, faster the farther away they are.',
        },
        {
          moduleId: 'scale-of-the-universe',
          reason: 'Where a galaxy sits among the sizes, from a proton to the observable universe.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Hubble 1926, “Extragalactic nebulae”, ApJ 64, 321',
      url: 'https://doi.org/10.1086/143018',
      note: 'The classification by shape that became the tuning fork',
    },
    {
      label: 'Toomre & Toomre 1972, “Galactic Bridges and Tails”, ApJ 178, 623',
      url: 'https://doi.org/10.1086/151823',
      note: 'The restricted three-body model the sim uses; prograde passes make tails',
    },
    {
      label:
        'van der Marel et al. 2012, “The M31 Velocity Vector. III. Future Milky Way M31–M33 Orbital Evolution, Merging, and Fate of the Sun”, ApJ 753, 9',
      url: 'https://doi.org/10.1088/0004-637X/753/1/9',
      note: 'The earlier forecast: first passage in about 3.9 billion years, merger in about 5.9',
    },
    {
      label: 'Sawala et al. 2025, “No certainty of a Milky Way–Andromeda collision”, Nature Astronomy 9, 1206',
      url: 'https://doi.org/10.1038/s41550-025-02563-1',
      note: 'With Gaia and Hubble data: close to 50% chance of no merger within 10 billion years',
    },
    {
      label: 'Conselice et al. 2016, “The Evolution of Galaxy Number Density at z < 8 and Its Implications”, ApJ 830, 83',
      url: 'https://doi.org/10.3847/0004-637X/830/2/83',
      note: 'At least two trillion galaxies in the observable universe',
    },
  ],
};

export default galaxies;

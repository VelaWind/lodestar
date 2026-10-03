/**
 * Dark matter — the twentieth published Lodestar module.
 *
 * Every figure here was recomputed from `@/physics/darkmatter` and the sourced
 * constants before it was written, and the sanity block `verifyDarkMatterModel`
 * holds the code to them: the Freeman disc's peak at 2.15 scale lengths, 226.9
 * km/s at the Sun's radius with the defaults (229.0 measured), a 222-million-year
 * orbit, 1.01 × 10¹¹ M☉ inside it on the spherical estimate, and Planck 2018's
 * 5.36 to 1 (84.3% of matter; Ω_c = 0.264).
 *
 * Sources cited in comments rather than in the five-reference list:
 *   - Rubin & Ford 1970, ApJ 159, 379 (Andromeda); Rubin, Ford & Thonnard 1978,
 *     ApJL 225, L107, and 1980, ApJ 238, 471 (the Sc galaxy sample).
 *   - Zwicky 1933, Helv. Phys. Acta 6, 110; van den Bergh 1999, PASP 111, 657,
 *     for the factor of 400 falling to about 50 with a modern H₀.
 *   - Gonzalez, Sivanandam, Zabludoff & Zaritsky 2013, ApJ 778, 14: cluster
 *     baryon fractions within r₅₀₀ a few percent to ~20% below the cosmic 0.157,
 *     so stars and gas are about a seventh of a cluster's mass.
 *   - GRAVITY Collaboration 2021, A&A 647, A59: R₀ = 8.275 kpc.
 *   - Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529: stars plus cold gas
 *     6.3 × 10¹⁰ M☉; thin-disc scale length 2.6 ± 0.5 kpc; bulge region about
 *     30% of the stellar mass.
 *   - Freeman 1970, ApJ 160, 811: the exponential disc's rotation curve.
 *   - Planck Collaboration 2020, A&A 641, A6: Ω_c h² = 0.1200, Ω_b h² = 0.02237.
 *   - Milgrom 1983, ApJ 270, 365 (MOND); McGaugh, Lelli & Schombert 2016, PRL
 *     117, 201101 (radial acceleration relation, g† = 1.2 × 10⁻¹⁰ m/s²);
 *     Skordis & Złośnik 2021, PRL 127, 161302 (a relativistic MOND that fits the
 *     CMB, with an extra field that behaves like dark matter in cosmology).
 *   - Navarro, Frenk & White 1996, ApJ 462, 563 (the NFW profile).
 *   - LZ Collaboration 2025, PRL 135, 011802 (4.2 tonne-years: no excess;
 *     2.2 × 10⁻⁴⁸ cm² at 40 GeV, 90% CL); LZ, December 2025, 417 live days
 *     (boron-8 solar neutrinos at 4.5σ, no WIMPs from 3 to 9 GeV); LZ
 *     Collaboration 2026, arXiv:2609.02823 (one 248 keV nuclear-recoil event,
 *     2.6σ global, 3.4σ local, not claimed as a detection).
 *   - Ackermann et al. 2015, PRL 115, 231301 (Fermi-LAT dwarf galaxies: the
 *     thermal-relic rate excluded below about 100 GeV for b b̄ and τ⁺τ⁻).
 *   - Eilers et al. 2019, ApJ 871, 120: local dark matter density
 *     0.30 ± 0.03 GeV/cm³ from their NFW fit.
 *   - Small-scale tensions: Klypin et al. 1999, ApJ 522, 82, and Moore et al.
 *     1999, ApJL 524, L19 (missing satellites; 11 known then); Boylan-Kolchin,
 *     Bullock & Kaplinghat 2011, MNRAS 415, L40 (too big to fail); Pontzen &
 *     Governato 2012, MNRAS 421, 3464 (cores from supernova feedback); Kim,
 *     Peter & Hargis 2018, PRL 121, 211302 (completeness-corrected satellite
 *     counts consistent with cold dark matter).
 *   - Peccei & Quinn 1977, PRL 38, 1440; Weinberg 1978 and Wilczek 1978, PRL
 *     40, 223 and 279 (the axion).
 */
import {
  HALO_V_INF_DEFAULT,
  KILOPARSEC,
  M_SUN,
  MW_BARYONIC_MASS,
  MW_DISC_SCALE_LENGTH,
  R0_GALACTIC,
} from '@/physics/constants';
import type { Module } from '../types';
import { figure, m, p, prose, term } from '../rich';

const darkMatter: Module = {
  id: 'dark-matter',
  title: 'Dark Matter',
  tagline: 'Stars at a galaxy’s edge orbit too fast for the matter we can see. Something unseen is pulling on them.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Most of the matter in the universe has never been seen, by any telescope, in any kind of ',
          'light. The only sign of it is an extra pull of gravity on everything we can see.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture a merry-go-round whose horses are held on only by ropes to the centre. The faster a ',
          'horse goes, the harder its rope must pull to keep it circling. Now suppose the horses at the ',
          'rim go round just as fast as the ones near the middle, but the ropes you can see are too thin ',
          'to hold them at that speed. Something you cannot see must be helping to hold them on.',
        ),
        p(
          'A galaxy is like that. Its stars circle the centre, held by gravity instead of ropes. Most of ',
          'the stars and gas we can see crowd toward the middle, so stars far out should feel a weaker ',
          'pull and move more slowly, the way Neptune crawls round the Sun while Mercury races. Instead, ',
          'stars far out move about as fast as stars much further in. Something unseen is adding to the ',
          'pull, and astronomers call it dark matter.',
        ),
        p(
          'Where the analogy breaks: the ropes all run to the centre. The unseen matter is not at the ',
          'centre. It is spread through the galaxy and far beyond it, in a vast cloud, and a star feels ',
          'the pull of all of that cloud lying inside its orbit.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'dark-matter',
      caption: prose(
        p(
          'Each star circles at the speed the graph below gives for its distance. Take the dark halo ',
          'away, with the button or by dragging its strength to zero, and the outer stars slow to what ',
          'the visible matter alone can hold. Move the marked star outward and watch the two speeds ',
          'part.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How much visible matter is in the disc?',
          technicalLabel: 'Disc mass (stars and gas)',
          symbol: 'M_{\\text{disc}}',
          unit: 'kg',
          // A billion to a trillion Suns: a dwarf galaxy's disc to a giant's.
          // Default: the Milky Way's stars plus cold gas, 6.3 × 10¹⁰ M☉
          // (Bland-Hawthorn & Gerhard 2016).
          min: 1e9 * M_SUN,
          max: 1e12 * M_SUN,
          default: MW_BARYONIC_MASS,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'billion M☉', factor: 1 / (1e9 * M_SUN) } },
        },
        {
          id: 'Rd',
          friendlyLabel: 'How spread out is the visible disc?',
          technicalLabel: 'Disc scale length',
          symbol: 'R_d',
          unit: 'm',
          // 1 to 8 kpc: compact to very extended discs. Default: the Milky
          // Way's thin disc, 2.6 ± 0.5 kpc (Bland-Hawthorn & Gerhard 2016).
          min: 1 * KILOPARSEC,
          max: 8 * KILOPARSEC,
          default: MW_DISC_SCALE_LENGTH,
          step: 0.1 * KILOPARSEC,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'kpc', factor: 1 / KILOPARSEC } },
        },
        {
          id: 'vInf',
          friendlyLabel: 'How strong is the dark halo? (its speed far out)',
          technicalLabel: 'Halo asymptotic speed',
          symbol: 'v_\\infty',
          unit: 'm/s',
          // 0 removes the halo; 600 km/s is three times the default. Default:
          // 200 km/s, tuned (with the fixed 5 kpc core) so the Milky Way-like
          // defaults give 227 km/s at the Sun, against 229 measured.
          min: 0,
          max: 600e3,
          default: HALO_V_INF_DEFAULT,
          step: 1e3,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'km/s', factor: 1e-3 } },
        },
        {
          id: 'R',
          friendlyLabel: 'How far out is the marked star?',
          technicalLabel: 'Marker radius',
          symbol: 'R',
          unit: 'm',
          // 1 to 30 kpc, the plot's range. Default: the Sun's distance from the
          // Galactic Centre, 8.275 kpc (GRAVITY 2021).
          min: 1 * KILOPARSEC,
          max: 30 * KILOPARSEC,
          default: R0_GALACTIC,
          step: 0.1 * KILOPARSEC,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'kpc', factor: 1 / KILOPARSEC } },
        },
      ],
      approximations: [
        prose(
          p(
            'The visible galaxy is one flat disc of stars and gas, thinning out steadily from the centre. The Milky Way’s central bulge and bar, about a third of its stars, are folded into the disc, and so is its gas, which in reality spreads about twice as far as its stars. The curve inside about 3 kiloparsecs (10 000 light-years) is therefore only rough.',
          ),
        ),
        prose(
          p(
            'The dark halo is a perfect sphere whose density is flat in a core 5 kiloparsecs (about 16 000 light-years) in radius and falls off with the square of distance outside it. Real halos may be flattened, and simulations give them a denser centre; the Milky Way’s true shape is uncertain.',
          ),
        ),
        prose(
          p(
            'The defaults are tuned, not fitted. The disc’s mass and size are the Milky Way’s measured values, and the halo’s strength and core are set by hand so that the speed at the Sun’s distance comes out at 227 km/s, within 1% of the measured 229. The curve is not a fit to the Milky Way’s measured rotation curve.',
          ),
        ),
        prose(
          p(
            'Every star moves in a perfect circle in the plane of the disc. Real stars also wander in and out and up and down, by a few tens of kilometres a second.',
          ),
        ),
        prose(
          p(
            'The masses inside the marked star’s orbit count the disc inside a cylinder, since it is flat, and the halo inside a sphere.',
          ),
        ),
        prose(
          p(
            'Stars are scattered evenly around the disc, without spiral arms, and the halo’s violet glow is drawn so you can see where it is: real dark matter gives off no light at all.',
          ),
        ),
        prose(
          p(
            'Time is sped up by the same factor at every setting: one second on screen is 25 million years.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'How fast stars orbit at each distance from a galaxy’s centre is its ',
          term('rotation curve'),
          '. Vera Rubin and Kent Ford measured it for the Andromeda galaxy in 1970, and for dozens of ',
          'spirals from 1978 to 1980, from how the colour of glowing gas shifts as it moves toward or ',
          'away from us; radio astronomers tracing hydrogen further out found the same. The curves stay ',
          'flat far beyond where the light fades. The Milky Way’s is nearly flat: at the Sun, 8.3 ',
          'kiloparsecs (27 000 light-years) from the centre, it is about 229 km/s, enough to cross the ',
          'Atlantic in 25 seconds, and out to 25 kiloparsecs it falls only 1.7 km/s per kiloparsec; ',
          'later Gaia studies give 229 to 237 at the Sun. The 63 billion Suns of visible stars and gas ',
          'cannot hold stars that fast so far out. The extra pull is attributed to ',
          term('dark matter'),
          ': matter that gives off, absorbs and reflects no light we can detect, and shows itself only ',
          'through its gravity. Around a galaxy it is inferred to form a roughly round ',
          term('halo', 'dark-matter-halo'),
          ' reaching far beyond the disc.',
        ),
        p(
          'The same shortfall appears independently elsewhere. In 1933 Fritz Zwicky found the Coma ',
          'Cluster’s galaxies moving so fast that, by his estimate, it needed about 400 times more mass ',
          'than its light suggested. With today’s distance scale that factor is nearer 50, and most of ',
          'the ordinary matter turned out to be hot gas seen only in X-rays; even so, stars and gas are ',
          'only about a seventh of a cluster’s mass. ',
          term('Gravitational lensing'),
          ', the bending of light by mass, weighs clusters without assuming how their galaxies move, ',
          'and agrees. In the Bullet Cluster, pictured below, two clusters ',
          'collided. Their hot gas, most of their ordinary matter, was slowed in the crash, while the ',
          'mass the lensing reveals carried on with the galaxies, an offset measured at eight standard ',
          'deviations.',
        ),
        p(
          'The pattern of warm and cool spots in the ',
          term('cosmic microwave background', 'cosmic-microwave-background'),
          ', the light left from 380 000 years after the Big Bang, fixes how much ordinary and dark ',
          'matter the young universe held. The Planck satellite finds dark matter outweighs ordinary ',
          'matter 5.4 to 1: about 84 percent of all matter, and about 26 percent of the universe’s total ',
          'energy content, against 5 percent for ordinary matter. Without its pull, the faint lumps in ',
          'that light could not have grown into galaxies in time.',
        ),
        p(
          'A common misconception is that dark matter is ordinary matter not yet spotted: dim stars, ',
          'cold gas, the black holes dead stars leave. But the microwave background and the light ',
          'elements forged in the first minutes each measure all the ordinary matter, and it is only a ',
          'sixth of what gravity requires.',
        ),
        /*
         * Source: https://chandra.harvard.edu/photo/2006/1e0657/ — Chandra X-ray
         * Observatory, "1E 0657-56: NASA Finds Direct Proof of Dark Matter", the
         * composite image (1e0657_4k.jpg, 4104 × 2304), resized to 1440 px wide
         * and converted to webp. The page states the cluster is about 3.8
         * billion light years away, that the pink clumps are hot gas detected
         * by Chandra, and that the blue areas, mapped by gravitational lensing,
         * are where most of the mass is.
         *
         * Licence, from Chandra's image use policy,
         * https://chandra.harvard.edu/photo/image_use.html: "no claim to
         * copyright is being asserted and the material may be used in
         * accordance with NASA guidelines", and "It is requested that use of
         * this work by NASA/SAO be given all appropriate acknowledgement.
         * Credits are provided with each image". The credit below is the
         * image's own.
         */
        figure({
          src: '/figures/dark-matter.webp',
          width: 1440,
          height: 808,
          alt: 'A field of stars and small orange galaxies on black. At the centre, two pink clouds sit side by side, and two larger blue clouds lie outside them, one to the left and one to the right.',
          caption:
            'The Bullet Cluster, about 3.8 billion light-years away: two clusters of galaxies that have passed through each other. Pink is hot gas seen in X-rays by NASA’s Chandra telescope, most of the ordinary matter. Blue is where gravitational lensing finds most of the mass, not with the gas but with the galaxies.',
          credit:
            'X-ray: NASA/CXC/CfA/M.Markevitch et al.; Optical: NASA/STScI; Magellan/U.Arizona/D.Clowe et al.; Lensing Map: NASA/STScI; ESO WFI; Magellan/U.Arizona/D.Clowe et al.',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      intro: prose(
        p(
          'The first equation adds the two pulls; the second is the disc’s own; the third turns a speed ',
          'into the mass it needs.',
        ),
      ),
      equations: [
        {
          id: 'total',
          tex: 'v(R) \\;=\\; \\sqrt{\\,v_{\\text{disc}}(R)^{2} \\;+\\; {{vInf}}^{2}\\left[1 - \\dfrac{r_c}{{{R}}}\\arctan\\dfrac{{{R}}}{r_c}\\right]}',
          binds: ['vInf', 'R'],
          note: prose(
            p(
              m`v(R)`,
              ' — the circular speed at radius ',
              m`R`,
              ' (your marker); ',
              m`v_{\text{disc}}`,
              ' — the visible disc’s contribution, below; ',
              m`v_\infty`,
              ' — the halo’s speed far out (your halo slider); ',
              m`r_c = 5\,\text{kpc}`,
              ' — its core radius, fixed here. The accelerations of disc and halo add, so their squared ',
              'speeds do. The halo term is the cored isothermal sphere, ',
              m`\rho = \rho_0/(1 + r^2/r_c^2)`,
              ' with ',
              m`v_\infty^2 = 4\pi G \rho_0 r_c^2`,
              '.',
            ),
            p(
              'Worked example, the defaults at the Sun’s distance, ',
              m`R = 8.275\,\text{kpc}`,
              ': ',
              m`\arctan(1.655) = 1.027`,
              ', so the halo gives ',
              m`200 \times \sqrt{1 - 1.027/1.655} = 123\,\text{km/s}`,
              '. With the disc’s ',
              m`191\,\text{km/s}`,
              ', ',
              m`v = \sqrt{191^2 + 123^2} = 227\,\text{km/s}`,
              ', against 229 measured.',
            ),
          ),
        },
        {
          id: 'disc',
          tex: 'v_{\\text{disc}}^{2} \\;=\\; 4\\pi G\\,\\Sigma_0 {{Rd}}\\, y^{2}\\left[I_0(y)K_0(y) - I_1(y)K_1(y)\\right], \\quad \\Sigma_0 = \\dfrac{{{M}}}{2\\pi {{Rd}}^{2}}, \\quad y = \\dfrac{R}{2{{Rd}}}',
          binds: ['M', 'Rd'],
          note: prose(
            p(
              m`\Sigma_0`,
              ' — the disc’s central surface density; ',
              m`M_{\text{disc}}`,
              ' and ',
              m`R_d`,
              ' — its mass and scale length (your sliders); ',
              m`I_n, K_n`,
              ' — modified Bessel functions. This is Freeman’s 1970 result for a razor-thin disc with ',
              'surface density ',
              m`\Sigma_0 e^{-R/R_d}`,
              '. It peaks at ',
              m`R = 2.15\,R_d`,
              ' and approaches the Keplerian ',
              m`\sqrt{GM/R}`,
              ' far outside the disc: the fall a flat curve does not show.',
            ),
            p(
              'Worked example, the defaults: ',
              m`\Sigma_0 = 6.3 \times 10^{10}\,M_\odot / (2\pi \times (2.6\,\text{kpc})^2) = 1\,480\,M_\odot/\text{pc}^2`,
              '. At the Sun, ',
              m`y = 1.59`,
              ' and ',
              m`v_{\text{disc}} = 191\,\text{km/s}`,
              '; at the peak, 5.6 kpc out, ',
              m`201\,\text{km/s}`,
              '; at 30 kpc, ',
              m`97\,\text{km/s}`,
              ', where the curve with the halo is still at 200.',
            ),
          ),
        },
        {
          id: 'mass',
          tex: 'M(<{{R}}) \\;=\\; \\dfrac{v^{2}\\,{{R}}}{G}',
          binds: ['R'],
          note: prose(
            p(
              'The mass a circular orbit needs inside it, exact for a spherical mass. If ',
              m`v`,
              ' is constant, ',
              m`M \propto R`,
              ', so ',
              m`dM/dR = 4\pi R^2 \rho = v^2/G`,
              ' and the density falls as ',
              m`\rho = v^2/(4\pi G R^2)`,
              ': the isothermal halo. A flat curve means mass growing in step with distance, long after ',
              'the light has run out.',
            ),
            p(
              'Worked example, the Sun: ',
              m`v = 229\,\text{km/s}`,
              ' and ',
              m`R = 8.275\,\text{kpc}`,
              ' give ',
              m`M = 1.01 \times 10^{11}\,M_\odot`,
              ', and one orbit takes ',
              m`2\pi R/v = 222`,
              ' million years. The sim’s own count inside the Sun’s orbit is lower, ',
              m`5.2 \times 10^{10}`,
              ' in the disc and ',
              m`2.9 \times 10^{10}\,M_\odot`,
              ' in the halo, because a flat disc pulls harder in its own plane than a sphere of the same ',
              'mass: the spherical formula overestimates.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The halo here is the cored isothermal sphere, the usual form for fitting observed rotation ',
          'curves. Cosmological simulations of cold dark matter produce instead the Navarro–Frenk–White ',
          'profile, ',
          m`\rho \propto 1/[(r/r_s)(1 + r/r_s)^2]`,
          ', with a central cusp ',
          m`\rho \propto r^{-1}`,
          ' and a steeper ',
          m`r^{-3}`,
          ' fall far out, so its curve is flat only over a limited range and then declines. Eilers and ',
          'colleagues’ fit of that profile to the Milky Way gives a local dark matter density of about ',
          '0.3 GeV per cubic centimetre, the figure direct searches assume.',
        ),
        p(
          'What dark matter is remains open. It must have been slow-moving, or cold, in the early ',
          'universe, or it would have smoothed away the small lumps that became dwarf galaxies; that ',
          'leaves the known neutrinos as at most a small part. ',
          term('WIMPs', 'wimp'),
          ', particles with a few to thousands of times a proton’s mass, interacting about as weakly as ',
          'neutrinos, were long favoured because annihilation at that strength in the hot early universe ',
          'leaves about the right amount behind. ',
          term('Axions', 'axion'),
          ', far lighter, were proposed in 1977–78 to explain why the strong nuclear force respects CP ',
          'symmetry, which its theory allows it to break. ',
          term('Primordial black holes', 'primordial-black-hole'),
          ' could make up all of it only between about ',
          m`10^{14}`,
          ' and ',
          m`10^{20}`,
          ' kg; the Hawking Radiation module covers the limits on either side.',
        ),
        p(
          'No search has detected dark matter particles. Underground detectors holding tonnes of liquid ',
          'xenon wait for a nucleus to recoil from a passing particle. LZ’s 4.2 tonne-year result (2025) ',
          'found no excess and excludes spin-independent WIMP–nucleon cross-sections above ',
          m`2.2 \times 10^{-48}\,\text{cm}^2`,
          ' at 40 GeV, at 90% confidence. Its December 2025 analysis saw solar neutrinos scattering off ',
          'xenon nuclei at 4.5σ, the background that will ultimately limit such searches. In September ',
          '2026 LZ reported a single nuclear recoil at 248 keV in a search extended to high energies, in tension with ',
          'background alone at 2.6σ once the many models tested are accounted for: worth watching, far ',
          'from a detection. Gamma rays from the Milky Way’s dwarf satellites, seen by Fermi, rule out ',
          'WIMPs lighter than about 100 GeV that annihilate into quarks or tau leptons at the rate the ',
          'early universe would need; a gamma-ray excess at the Galactic Centre ',
          'remains disputed, with unresolved pulsars the main rival explanation. The Large Hadron ',
          'Collider has seen no missing-energy signal beyond the Standard Model.',
        ),
        p(
          term('MOND'),
          ', proposed by Mordehai Milgrom in 1983, replaces dark matter with a change to gravity: ',
          'below an acceleration ',
          m`a_0 \approx 1.2 \times 10^{-10}\,\text{m/s}^2`,
          ', the pull tends to ',
          m`\sqrt{g_N a_0}`,
          ' rather than Newton’s ',
          m`g_N`,
          '. Far out that gives a flat curve with ',
          m`v^4 = G M_b a_0`,
          ', the baryonic Tully–Fisher relation, which galaxies follow with remarkably little scatter, ',
          'and it predicts each galaxy’s curve from its visible matter alone. Dark matter models have to ',
          'reproduce that regularity through the physics of galaxy formation. MOND’s difficulties are ',
          'elsewhere: clusters still need about twice the mass seen, even with modified gravity; the ',
          'Bullet Cluster’s lensing follows the galaxies rather than the gas, which modified gravity ',
          'alone cannot arrange; and the microwave background’s peak heights need a component that does ',
          'not oscillate with the light. A relativistic version (Skordis and Złośnik, 2021) does fit the ',
          'microwave background, by adding a field that behaves like dark matter on cosmic scales.',
        ),
        p(
          'Cold dark matter has small-scale tensions of its own. Simulated halos have cusps, while many ',
          'dwarf galaxies show cores; simulations predict hundreds of satellite halos around a galaxy ',
          'like ours, where about a dozen satellites were known when the problem was named in 1999; and ',
          'the largest predicted satellites are denser than any observed. Gas blown out by supernovae can flatten cusps in simulations, and ',
          'surveys since 2005 have found many faint satellites, with corrections for those too faint to ',
          'see suggesting the count may match. Whether ordinary-matter physics resolves all three, or ',
          'the dark matter is warmer or interacts with itself, is not settled.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'kepler-orbits',
          reason:
            'Far out, the curve visible matter alone predicts becomes Kepler’s: speed falling with distance, as it does from Mercury to Neptune.',
        },
        {
          moduleId: 'cosmic-microwave-background',
          reason: 'The heights of its acoustic peaks are where the 5.4-to-1 ratio of dark to ordinary matter is measured.',
        },
        {
          moduleId: 'early-universe',
          reason:
            'The light elements made in the first minutes count the ordinary matter, and come up about five-sixths short of what gravity needs.',
        },
        {
          moduleId: 'expansion-of-the-universe',
          reason:
            'Dark matter is about a quarter of the universe’s energy content, and its pull slowed the expansion for billions of years.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Rubin, Ford & Thonnard 1980, “Rotational properties of 21 Sc galaxies with a large range of luminosities and radii”, ApJ 238, 471',
      url: 'https://doi.org/10.1086/158003',
      note: 'Flat rotation curves across a sample of spiral galaxies',
    },
    {
      label: 'Eilers, Hogg, Rix & Ness 2019, “The Circular Velocity Curve of the Milky Way from 5 to 25 kpc”, ApJ 871, 120',
      url: 'https://doi.org/10.3847/1538-4357/aaf648',
      note: 'The Milky Way’s rotation curve: 229.0 km/s at the Sun, falling 1.7 km/s per kpc',
    },
    {
      label: 'Clowe et al. 2006, “A Direct Empirical Proof of the Existence of Dark Matter”, ApJ 648, L109',
      url: 'https://doi.org/10.1086/508162',
      note: 'The Bullet Cluster: lensing mass offset from the X-ray gas at 8σ',
    },
    {
      label: 'Planck Collaboration 2020, “Planck 2018 results VI: Cosmological parameters”, A&A 641, A6',
      url: 'https://doi.org/10.1051/0004-6361/201833910',
      note: 'Ω_c h² = 0.1200 and Ω_b h² = 0.02237: dark matter 5.4 times ordinary matter',
    },
    {
      label: 'LZ Collaboration 2025, “Dark Matter Search Results from 4.2 Tonne-Years of Exposure of the LUX-ZEPLIN (LZ) Experiment”, PRL 135, 011802',
      url: 'https://doi.org/10.1103/4dyc-z8zf',
      note: 'Direct detection: no excess; cross-sections above 2.2 × 10⁻⁴⁸ cm² excluded at 40 GeV (90% confidence)',
    },
  ],
};

export default darkMatter;

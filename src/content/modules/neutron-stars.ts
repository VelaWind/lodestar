/**
 * Neutron stars and pulsars — the nineteenth published Lodestar module.
 *
 * Every figure here was recomputed from `@/physics/neutronstar` and the sourced
 * constants before it was written, and the sanity block `verifyNeutronStarModel`
 * holds the code to them: at 1.4 M☉ and 12 km, a mean density of 3.85 × 10¹⁷
 * kg/m³ (1.42 times nuclear saturation density), 1.9 × 10¹² kg to a teaspoon,
 * 1.6 × 10¹¹ g at the surface, an escape speed of 0.587 c, a redshift of 0.235;
 * the Crab's spin-down power and characteristic age against the ATNF catalogue.
 *
 * Adding a module is exactly two files and no shell edits:
 *   1. src/content/modules/<id>.ts   (this file; basename must equal `id`)
 *   2. src/sims/<simKey>.tsx         (default-exports a component taking SimProps)
 */
import { CRAB_F0, FASTEST_PULSAR_FREQUENCY, M_SUN } from '@/physics/constants';
import type { Module } from '../types';
import { figure, m, p, prose, term } from '../rich';

/** Spin period slider: the fastest known pulsar's period to ten seconds. */
const P_MIN = 1 / FASTEST_PULSAR_FREQUENCY;
const P_MAX = 10;
/** Mass slider: 1.1 to 2.5 Suns, past the 2.3 M☉ collapse threshold on purpose. */
const M_MIN = 1.1 * M_SUN;
const M_MAX = 2.5 * M_SUN;
const DEG = Math.PI / 180;

const neutronStars: Module = {
  id: 'neutron-stars',
  title: 'Neutron Stars and Pulsars',
  tagline: 'A star’s collapsed core, heavier than the Sun and a city across, sweeping the sky with its beams.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'The collapsed core of a dead star, a neutron star, is so dense that a teaspoon of it ',
          'would weigh about two billion tonnes, as much as a mountain. The fastest one known spins ',
          '716 times a second.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture a lighthouse, its lamp turning. From a ship you never see the lamp ',
          'itself, only a flash each time the beam sweeps across you; count the flashes and you know ',
          'how fast it turns.',
        ),
        p(
          'When a big star runs out of fuel, its core can collapse into a ball about the size of a ',
          'city but heavier than the Sun: a neutron star. It spins, often many times a second, and ',
          'is a magnet stronger than any on Earth. Two narrow beams of radio waves stream out ',
          'from its magnetic poles, and as the star turns they sweep around the sky like a ',
          'lighthouse’s. If a beam crosses Earth, we catch a pulse every turn: the star is a pulsar.',
        ),
        p(
          'Where the analogy breaks: a lighthouse’s beam turns flat around its tower, so every ship ',
          'sees it. A neutron star’s magnetic poles are tilted away from the axis it spins on, so each ',
          'beam sweeps around a cone, like the light from a tilted torch you turn in your hand. You see ',
          'pulses only if you sit near the rim of that cone, where the beam passes; inside it or outside ',
          'it, the beam never reaches you.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'neutron-stars',
      caption: prose(
        p(
          'Spin the star faster and slower, tilt its magnet, and move the Earth around it. A pulse ',
          'appears on the trace below only when a beam sweeps across our line of sight. Then make ',
          'the star heavier and watch its gravity climb toward the point where it would collapse.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How heavy is it? (in Suns)',
          technicalLabel: 'Mass',
          symbol: 'M',
          unit: 'kg',
          // 1.1 to 2.5 M☉. Precisely measured neutron-star masses run from about
          // 1.2 to 2.08 M☉ (PSR J0740+6620; PSR J0952−0607's less certain
          // 2.35 ± 0.17 M☉ is higher); past 2.3 M☉ the sim collapses the star
          // to a black hole, so the top of the slider shows that. Default: 1.4 M☉.
          min: M_MIN,
          max: M_MAX,
          default: 1.4 * M_SUN,
          step: 0.01 * M_SUN,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'M☉', factor: 1 / M_SUN } },
        },
        {
          id: 'P',
          friendlyLabel: 'How fast does it spin? (time for one turn)',
          technicalLabel: 'Spin period',
          symbol: 'P',
          unit: 's',
          // The fastest known pulsar's 1.397 ms (716 Hz) to ten seconds; the
          // slowest radio pulsars turn once in several seconds or more. Default:
          // the Crab's 33.39 ms (ATNF, 1991 epoch).
          min: P_MIN,
          max: P_MAX,
          default: 1 / CRAB_F0,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'ms', factor: 1e3 } },
        },
        {
          id: 'alpha',
          friendlyLabel: 'How far is the magnet tilted from the spin axis?',
          technicalLabel: 'Magnetic inclination',
          symbol: '\\alpha',
          unit: 'rad',
          // 0° (magnet along the spin axis: no sweep) to 90° (an orthogonal
          // rotator, whose two beams can both cross the line of sight).
          min: 0,
          max: 90 * DEG,
          default: 45 * DEG,
          step: 1 * DEG,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: '°', factor: 1 / DEG } },
        },
        {
          id: 'zeta',
          friendlyLabel: 'Where is the Earth, measured from the spin axis?',
          technicalLabel: 'Viewing angle',
          symbol: '\\zeta',
          unit: 'rad',
          // 0° (looking down the spin axis) to 90° (in the equatorial plane).
          // Default 50°, five degrees off the default tilt: one beam crosses.
          min: 0,
          max: 90 * DEG,
          default: 50 * DEG,
          step: 1 * DEG,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: '°', factor: 1 / DEG } },
        },
      ],
      approximations: [
        prose(
          p(
            'The star is a ball 12 kilometres in radius at every mass. Its real size depends on how its matter resists squeezing, which is not known; measurements put it between about 11 and 13 kilometres.',
          ),
        ),
        prose(
          p(
            'The heaviest neutron star measured precisely, PSR J0740+6620, is 2.08 times the Sun’s mass (a less certain measurement puts PSR J0952−0607 at about 2.35). Above 2.3 times the Sun’s mass the sim collapses the star; the true limit is unknown and could be a little lower or higher, and is for a star that does not spin: fast spin can hold up somewhat more.',
          ),
        ),
        prose(
          p(
            'Gravity is worked out for a star that does not spin. Spun near its limit, a real one bulges at the equator, where gravity is then weaker.',
          ),
        ),
        prose(
          p(
            'Each beam is a cone 20 degrees across (10 degrees either side of its centre) at every spin. Real beams are wider for fast pulsars and narrower for slow ones, and each pulsar’s pulse has its own shape.',
          ),
        ),
        prose(
          p(
            'The spin is drawn slowed down so you can follow it, except for stars that take longer than about three and a half seconds to turn, which are drawn at the real speed; the readouts and the trace’s time axis always use the real speed.',
          ),
        ),
        prose(
          p(
            'The fastest spin before it flies apart uses a fit to detailed models, good to a few percent for stars well below the heaviest possible.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A ',
          term('neutron star'),
          ' is what is left when the core of a star born with more than about eight times the ',
          'Sun’s mass collapses in a supernova; above about 20, the core usually collapses further, ',
          'to a black hole. Most measured masses are close to 1.4 times the ',
          'Sun’s; the heaviest measured precisely, PSR J0740+6620, is 2.08 (a less certain ',
          'measurement puts PSR J0952−0607 at about 2.35). The radius is about 12 km: NICER, ',
          'an X-ray telescope on the International Space Station, and the gravitational waves of the ',
          'neutron-star merger GW170817 together put a star of 1.4 solar masses at 12.45 ± 0.65 km. ',
          'So more than the Sun’s mass fits inside a city. The mean density, about 4 × 10¹⁷ kg/m³, is ',
          'roughly one and a half times the density inside an atomic nucleus. Gravity at the surface is ',
          'about 160 billion times Earth’s, and the escape speed is close to 60 percent of the speed of ',
          'light.',
        ),
        p(
          'The collapse keeps the core’s spin and squeezes its magnetic field, as the core shrinks ',
          'from a few thousand kilometres across to about 24, so a newborn neutron star spins fast and ',
          'is intensely magnetised. A ',
          term('pulsar'),
          ' is one whose radio beams, streaming from its magnetic poles, sweep across Earth, giving a ',
          'pulse each turn. The Crab pulsar, at the heart of the Crab Nebula, the wreck of the ',
          'supernova seen in 1054, turns about 30 times a second, and its period lengthens by about 13 ',
          'millionths of a second each year as it radiates its spin away.',
        ),
        p(
          'Walter Baade and Fritz Zwicky proposed neutron stars in 1934, as the remnants of ',
          'supernovae, two years after the neutron itself was discovered. One was first found in 1967, ',
          'when Jocelyn Bell Burnell, a graduate student at Cambridge, noticed a small, odd signal in ',
          'Antony Hewish’s radio survey that resolved into pulses 1.337 seconds apart. They were so ',
          'regular that the team briefly labelled the source LGM-1, for “little green men”, while they ',
          'ruled out an artificial origin. The discovery was published in 1968. The 1974 Nobel Prize in ',
          'Physics went to Hewish, for his role in the discovery of pulsars, and to Martin Ryle, for ',
          'his radio observations and the aperture-synthesis technique; Bell Burnell was not included.',
        ),
        p(
          'A common misconception is that a pulsar switches on and off. It does not: the beams shine ',
          'all the time, and the pulsing is a beam sweeping past us. That is also why most neutron ',
          'stars are never seen as pulsars at all; their beams never cross Earth.',
        ),
        /*
         * Source: https://chandra.harvard.edu/photo/2018/crab/ — Chandra X-ray
         * Observatory, "Crab Nebula: A Crab Walks Through Time", the X-ray image
         * (crab_xray.jpg, 864 × 561), converted to webp. The page credits the
         * X-ray data "X-ray: NASA/CXC/SAO".
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
          src: '/figures/neutron-stars.webp',
          width: 864,
          height: 561,
          alt: 'A cloud of blue and white light on black, brightest at a small point near its centre that is circled by a bright ring, with a bright jet running from the centre down to the lower left.',
          caption:
            'The Crab Nebula in X-rays, seen by NASA’s Chandra telescope. The pulsar is the bright point at the centre. The ring around it and the jet below are matter flung out by the spinning star, still glowing almost a thousand years after the supernova.',
          credit: 'X-ray: NASA/CXC/SAO',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      intro: prose(
        p(
          'The first two equations take your mass slider and describe a neutron star up to the ',
          '2.3-solar-mass threshold where the sim collapses it. Past that, the sim’s star is no ',
          'longer a neutron star but a black hole, and the numbers they show describe nothing real. ',
          'The third is the Crab’s worked case: it takes your period slider, but the rate the period ',
          'lengthens has no slider, so the values beneath it are the Crab’s, not the sim’s.',
        ),
      ),
      equations: [
        {
          id: 'density',
          tex: '\\bar\\rho \\;=\\; \\dfrac{3\\,{{M}}}{4\\pi R^{3}}',
          binds: ['M'],
          note: prose(
            p(
              m`\bar\rho`,
              ' — the mean density; ',
              m`M`,
              ' — the star’s mass (your slider); ',
              m`R`,
              ' — its radius, 12 km here at every mass.',
            ),
            p(
              'Worked example, 1.4 solar masses: ',
              m`\bar\rho = 3 \times 2.78 \times 10^{30} / (4\pi \times (1.2 \times 10^{4})^{3}) = 3.85 \times 10^{17}\,\text{kg/m}^3`,
              ', 1.42 times the nuclear saturation density of ',
              m`2.7 \times 10^{17}\,\text{kg/m}^3`,
              '. A 5 mL teaspoon of it holds ',
              m`1.9 \times 10^{12}\,\text{kg}`,
              '.',
            ),
          ),
        },
        {
          id: 'escape',
          tex: '\\dfrac{v_{\\text{esc}}}{c} \\;=\\; \\sqrt{\\dfrac{2G\\,{{M}}}{R\\,c^{2}}}',
          binds: ['M'],
          note: prose(
            p(
              m`v_{\text{esc}}`,
              ' — the escape speed from the surface, as measured there; ',
              m`G`,
              ' — the gravitational constant. Newton’s formula, and also the exact relativistic one, ',
              'with ',
              m`R`,
              ' the areal radius, the one a tape around the equator would give: the same coincidence ',
              'the escape-velocity module explains. Under the root is twice the compactness ',
              m`\beta = GM/(Rc^2)`,
              ', which is exactly ',
              m`1/2`,
              ' for a black hole.',
            ),
            p(
              'Worked example, 1.4 solar masses: ',
              m`\beta = 0.172`,
              ', 34 percent of the way to a black hole, and ',
              m`v_{\text{esc}} = \sqrt{0.345}\,c = 0.587\,c`,
              '. The surface gravity, ',
              m`g = GM/(R^2\sqrt{1 - 2\beta}) = 1.59 \times 10^{12}\,\text{m/s}^2`,
              ', is ',
              m`1.6 \times 10^{11}`,
              ' times Earth’s, and light leaving the surface is redshifted by ',
              m`z = 1/\sqrt{1 - 2\beta} - 1 = 0.235`,
              '.',
            ),
          ),
        },
        {
          id: 'spin-down',
          tex: '\\dot E \\;=\\; \\dfrac{4\\pi^{2} I\\,\\dot P}{{{P}}^{3}}',
          binds: ['P'],
          note: prose(
            p(
              'The Crab’s worked case. ',
              m`\dot E`,
              ' — the power the star loses as it slows; ',
              m`P`,
              ' — its spin period (your slider); ',
              m`\dot P`,
              ' — how fast the period lengthens, seconds per second, with no slider here; ',
              m`I`,
              ' — the moment of inertia, conventionally ',
              m`10^{38}\,\text{kg m}^2`,
              '. The same ',
              m`P`,
              ' sets the light-cylinder radius ',
              m`c/\Omega = cP/2\pi`,
              ', and with ',
              m`\dot P`,
              ' the characteristic age ',
              m`\tau = P/(2\dot P)`,
              '.',
            ),
            p(
              'Worked example, the Crab (ATNF catalogue, 1991): ',
              m`P = 0.03339\,\text{s}`,
              ' and ',
              m`\dot P = 4.21 \times 10^{-13}`,
              ', so ',
              m`\dot E = 4\pi^2 \times 10^{38} \times 4.21 \times 10^{-13} / 0.03339^3 = 4.5 \times 10^{31}\,\text{W}`,
              ', about 120 000 times the Sun’s output, which is what lights the nebula. The light ',
              'cylinder is ',
              m`1\,590\,\text{km}`,
              ' out, and ',
              m`\tau = 0.03339 / (2 \times 4.21 \times 10^{-13}) = 4.0 \times 10^{10}\,\text{s}`,
              ', 1 260 years, against a true age of 937 years at that date.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'A neutron star’s structure is set by its ',
          term('equation of state'),
          ', the pressure of matter as a function of density, which is not known above about twice ',
          'nuclear saturation density, where the inner core sits. Below it, theory and experiment ',
          'agree: an outer crust of nuclei in a sea of electrons, an inner crust where neutrons drip ',
          'out of the nuclei, then a core of neutrons with a few percent protons and electrons. What ',
          'the inner core holds, whether hyperons, deconfined quarks or only denser nucleons, is ',
          'open. Each candidate gives a different mass–radius relation, and observation is closing ',
          'in from two sides. Masses come from binary orbits: the Shapiro delay of PSR J0740+6620’s ',
          'signal passing its companion gives 2.08 ± 0.07 solar masses, the heaviest measured ',
          'precisely, so any viable equation of state must hold at least that much up (a less ',
          'certain measurement puts PSR J0952−0607 at about 2.35). GW170817’s remnant, which is ',
          'thought to have collapsed to a black hole within a second or so, bounds the maximum from ',
          'above at about 2.16 (+0.17, −0.15) solar masses. Radii come from NICER’s modelling of how ',
          'hot spots on a spinning star bend in and out of view, and from the tidal deformation ',
          'GW170817 imprinted on its waveform; combined, they give 12.45 ± 0.65 km at 1.4 solar ',
          'masses and 12.35 ± 0.75 km at 2.08, nearly the same, which is why the sim can hold the ',
          'radius fixed. NICER’s 2024 analysis of the nearest millisecond pulsar, PSR J0437−4715, ',
          'came out smaller, 11.36 (+0.95, −0.63) km at 1.42 solar masses.',
        ),
        p(
          'The spin limit is relativistic too. Spun faster than its ',
          'Keplerian frequency, a star sheds matter from its equator; for a non-rotating mass and ',
          'radius the limit is about ',
          m`f_K \approx 1.08\,\text{kHz}\,(M/M_\odot)^{1/2}(R/10\,\text{km})^{-3/2}`,
          ' (Haensel et al. 2009), 972 Hz at 1.4 solar masses and 12 km, which is only 0.59 of the ',
          'naive Newtonian orbital frequency, mainly because the spinning star bulges at its ',
          'equator. The fastest known ',
          'pulsar, at 716 Hz, sits safely inside it. Pulsars that fast are ',
          term('millisecond pulsars', 'millisecond-pulsar'),
          ', first found in 1982: old neutron stars spun up again by matter falling onto them from a ',
          'companion star, with weaker fields, slower spin-down and the steadiest rotation of any ',
          'natural clock.',
        ),
        p(
          'The spin-down power is only the rotational energy lost, whatever carries it away. What ',
          'carries it is the magnetic field: field lines that would have to turn faster than light, ',
          'beyond the ',
          term('light cylinder'),
          ', cannot co-rotate and are opened, and along them flows the wind of particles and field ',
          'that lights a nebula like the Crab’s. Modelling the star as a rotating magnetic dipole ',
          'gives the braking law, and integrating it from a much faster birth spin gives the ',
          'characteristic age. The Crab’s, about 1 260 years, overstates its true age because it ',
          'was born spinning only about twice as fast as now, with a period near 19 ms, rather ',
          'than much faster, as the formula assumes. Its braking, which is not exactly dipolar ',
          '(braking index about 2.5), pushes the estimate the other way; with both, it comes to ',
          'about 950 years. At the other extreme are ',
          term('magnetars', 'magnetar'),
          ', neutron stars with the strongest magnetic fields known, whose bursts of X-rays and ',
          'gamma rays are powered by the decay of the field itself rather than by the spin.',
        ),
        p(
          'Pulsars are also instruments. The first binary pulsar, found by Russell Hulse and Joseph ',
          'Taylor in 1974, has an orbit shrinking within 0.2 percent of the rate general relativity ',
          'predicts for energy carried off by gravitational waves: the indirect proof of the waves. ',
          'The 1993 Nobel Prize went to the pulsar’s discovery, which opened that test. A clock on a neutron star’s surface runs slow by the same factor ',
          'that redshifts its light, the gravitational time dilation of the time-dilation module: ',
          'at 1.4 solar masses, 1.235 seconds pass far away for each second on the surface. And ',
          'millisecond pulsars spread across the sky form ',
          term('pulsar timing arrays', 'pulsar-timing-array'),
          ', in which a gravitational wave of years-long period shows up as correlated drifts in ',
          'arrival times; NANOGrav reported evidence for such a background in 2023.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'supernovae',
          reason:
            'Where neutron stars come from: that module’s slider crosses the eight-Sun line where a dying star’s core collapses into one.',
        },
        {
          moduleId: 'black-holes',
          reason:
            'Push this module’s mass past its limit and the star collapses; that module starts where this one stops.',
        },
        {
          moduleId: 'gravitational-waves',
          reason:
            'Two neutron stars spiralling together made GW170817, the merger seen in both gravitational waves and light.',
        },
        {
          moduleId: 'time-dilation',
          reason:
            'A clock on a neutron star’s surface runs about a fifth slower than one far away; that module shows why gravity slows time.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Hewish, Bell, Pilkington, Scott & Collins 1968, “Observation of a Rapidly Pulsating Radio Source”, Nature 217, 709',
      url: 'https://doi.org/10.1038/217709a0',
      note: 'The discovery of pulsars, pulses 1.337 s apart',
    },
    {
      label: 'Hessels et al. 2006, “A Radio Pulsar Spinning at 716 Hz”, Science 311, 1901',
      url: 'https://doi.org/10.1126/science.1123430',
      note: 'The fastest known pulsar, PSR J1748−2446ad',
    },
    {
      label: 'Fonseca et al. 2021, “Refined Mass and Geometric Measurements of the High-mass PSR J0740+6620”, ApJL 915, L12',
      url: 'https://doi.org/10.3847/2041-8213/ac03b8',
      note: 'The heaviest measured neutron star, 2.08 ± 0.07 M☉',
    },
    {
      label: 'Miller et al. 2021, “The Radius of PSR J0740+6620 from NICER and XMM-Newton Data”, ApJL 918, L28',
      url: 'https://doi.org/10.3847/2041-8213/ac089b',
      note: 'Radii of 12.45 ± 0.65 km at 1.4 M☉ and 12.35 ± 0.75 km at 2.08 M☉',
    },
    {
      label:
        'Haensel, Zdunik, Bejger & Lattimer 2009, “Keplerian frequency of uniformly rotating neutron stars and strange stars”, A&A 502, 605',
      url: 'https://doi.org/10.1051/0004-6361/200811605',
      note: 'The breakup spin, f_K = 1.08 kHz (M/M☉)^½ (R/10 km)^−3/2',
    },
  ],
};

export default neutronStars;

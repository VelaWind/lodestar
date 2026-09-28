/**
 * The expansion of the universe — the eighth published Lodestar module.
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
import { H0_PLANCK_2018, KM_S_PER_MPC, LIGHT_YEAR } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const expansionOfTheUniverse: Module = {
  id: 'expansion-of-the-universe',
  title: 'The Expansion of the Universe',
  tagline: 'Almost every galaxy is moving away from us, and the farther it is, the faster it goes.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Point a telescope at almost any distant galaxy and it is moving away from you; point ',
          'at one twice as far, and it is leaving twice as fast. This is not because you are at ',
          'the centre of anything.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Take a rubber band, mark it with ink dots a centimetre apart, and stretch it to twice ',
          'its length. The dot that was one centimetre from you is now two centimetres away: it ',
          'moved one centimetre. The dot that was five centimetres away is now ten: it moved ',
          'five. Farther dots move farther in the same time, so they move faster. And this is ',
          'true from whichever dot you choose. No dot is the centre of the stretching.',
        ),
        p(
          'That is what the galaxies are doing. They are not flying through space away from us. ',
          'The space between them is stretching, and the farther the galaxy, the more stretching ',
          'lies between here and there.',
        ),
        p(
          'Light is stretched the same way. A light wave that leaves a galaxy arrives with its ',
          'crests farther apart, and light with crests farther apart is redder. The farther the ',
          'galaxy, the redder its light arrives. A galaxy close enough for its own motion to beat ',
          'the stretching, and only a handful are, arrives bluer instead.',
        ),
        p(
          'Where the analogy breaks: a rubber band has ends and is stretched into the room around ',
          'it. The universe has no known edge and is not stretching into anything. And the ink ',
          'dots stretch with the band; galaxies do not. Gravity holds each galaxy together while ',
          'the space between them grows.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'expansion-of-the-universe',
      caption: prose(
        p(
          'Drag the galaxy farther away and watch the line in its light slide toward red. Then ',
          'give the galaxy some motion of its own and see how close it has to be before that ',
          'motion wins.',
        ),
      ),
      params: [
        {
          id: 'd',
          friendlyLabel: 'How far away is the galaxy?',
          technicalLabel: 'Proper distance',
          symbol: 'd',
          unit: 'm',
          // 1e22 m ≈ 1 million light-years, the Local Group; 3e25 m ≈ 3.2 billion
          // light-years, ≈ 1 Gpc, where the linear redshift approximation is a
          // few percent low. Default is the Coma Cluster, ≈ 100 Mpc.
          min: 1e22,
          max: 3e25,
          default: 3.0857e24,
          step: 0.01, // decades
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'million light-years', factor: 1 / (1e6 * LIGHT_YEAR) },
          },
        },
        {
          id: 'H0',
          friendlyLabel: 'How fast is space stretching?',
          technicalLabel: 'Hubble constant',
          symbol: 'H_0',
          // Written `s^{-1}` rather than `s^-1`: the equation layer sets this
          // inside \mathrm{}, and KaTeX would raise only the minus sign.
          unit: 's^{-1}',
          // 60 to 80 km/s/Mpc covers both sides of the Hubble tension with room
          // either way: Planck's 67.4 and SH0ES's 73.04.
          min: 60 * KM_S_PER_MPC,
          max: 80 * KM_S_PER_MPC,
          default: H0_PLANCK_2018,
          step: 0.1 * KM_S_PER_MPC,
          scale: 'linear',
          format: {
            notation: 'fixed',
            digits: 1,
            displayUnit: { unit: 'km/s/Mpc', factor: 1 / KM_S_PER_MPC },
          },
        },
        {
          id: 'vPec',
          friendlyLabel: 'Is the galaxy also moving on its own?',
          technicalLabel: 'Peculiar velocity',
          symbol: 'v_{\\text{pec}}',
          unit: 'm/s',
          // Positive is away from us. Typical galaxy peculiar velocities are a
          // few hundred km/s; ±1000 km/s reaches the fastest cluster members.
          min: -1e6,
          max: 1e6,
          default: 0,
          step: 1e4,
          scale: 'linear',
          // 'auto' at three figures prints every reachable value (a multiple of
          // 10 km/s up to 1000) exactly as whole kilometres per second, and
          // unlike `digits: 0` it survives `siValueToTex`, which reads `digits`
          // as significant figures when the equation layer substitutes v_pec.
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'km/s', factor: 1e-3 } },
        },
      ],
      approximations: [
        prose(
          p(
            'Redshift here is speed divided by the speed of light. That holds nearby; at the far end of the distance slider it is a few percent below the full result.',
          ),
        ),
        prose(
          p(
            'Distance means how far the galaxy is right now. The light you see left it long ago, when it was closer.',
          ),
        ),
        prose(
          p(
            'Light travel time is distance divided by the speed of light, ignoring that space stretched while the light was in flight. About a tenth off at the far end of the slider.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'What we have been calling stretching is the expansion of space, and the rule the sim ',
          'draws is the ',
          term('Hubble–Lemaître law', 'hubble-lemaitre-law'),
          ': a galaxy’s ',
          term('recession velocity'),
          ', the speed at which the distance to it grows, equals its distance multiplied by the ',
          term('Hubble constant'),
          ', ',
          m`H_0`,
          '. Current measurements put ',
          m`H_0`,
          ' near 70 km/s per ',
          term('megaparsec'),
          ' (3.26 million light-years), so every extra 3.26 million light-years of distance adds ',
          'about 70 km/s of speed.',
        ),
        p(
          'The stretching shows up in light as ',
          term('redshift'),
          ': the fractional increase in wavelength, the crest-to-crest length of the wave, ',
          'between emission and arrival, written ',
          m`z`,
          '. Astronomers measure it from spectral lines, the sharp features atoms leave at fixed ',
          'wavelengths. The hydrogen line the sim uses, Hα, sits at 656.28 nm in the laboratory; ',
          'from a galaxy at ',
          m`z = 0.02`,
          ' it arrives at 669 nm. This is a ',
          term('cosmological redshift'),
          ': the wave was lengthened by space stretching while the light was in flight. It is ',
          'not a Doppler shift, the change in pitch of a passing siren, though at small ',
          m`z`,
          ' the two give the same number and the sim treats them as the same. A galaxy moving ',
          'toward us fast enough shows a ',
          term('blueshift'),
          ', a shortening of wavelength. Andromeda does: its own motion through space, its ',
          term('peculiar velocity'),
          ', carries it toward the Milky Way at about 110 km/s, more than the roughly 50 km/s of ',
          'expansion across the 2.5 million light-years between us. Gravity wins over expansion ',
          'inside groups and clusters of galaxies; expansion wins across the gulfs between them.',
        ),
        p(
          'The history is often told wrong. Vesto Slipher measured the first of these shifts ',
          'between 1912 and 1917, beginning with Andromeda’s blueshift. Georges Lemaître derived ',
          'the velocity–distance relation from general relativity, Einstein’s theory of gravity, ',
          'in 1927 and estimated the constant. Edwin Hubble published the relation with measured ',
          'distances in 1929, with a constant near 500 km/s/Mpc, seven times too high because his ',
          'distances were wrong. The International Astronomical Union recommended the name ',
          'Hubble–Lemaître law in 2018.',
        ),
        p(
          'Two misconceptions. The galaxies are not fleeing a central explosion: the Big Bang, the ',
          'hot dense state the expansion began from, happened everywhere, and every observer sees ',
          'the same recession from their own position. And the expansion is not into anything. ',
          'The universe has no known edge, and “outside” is not a place.',
        ),
        p(
          'The value of ',
          m`H_0`,
          ' is disputed. Fitting the cosmic microwave background, the faint glow left over from ',
          'the early universe, gives 67.4 ± 0.5 km/s/Mpc; measuring nearby galaxies directly gives ',
          '73.0 ± 1.0. The gap is five times larger than either uncertainty and has survived a ',
          'decade of checking. Nobody yet knows whether a measurement is wrong or the model is. ',
          'The sim’s slider covers both values.',
        ),
        /*
         * Source: https://esahubble.org/images/heic0813a/ (ESA/Hubble release
         * heic0813, "The Coma Galaxy Cluster as seen by Hubble"), converted from
         * the release's publication JPEG (4000 × 2840) to 1280 px wide webp.
         * The image page itself says: "Crediting this image with the full credit
         * line, in a visible way is MANDATORY, if you want to use it without
         * paying a fee. The full credit line to use can be found in each image
         * caption." and links its usage terms at https://esahubble.org/copyright/:
         * "ESA/Hubble images, videos and web texts are released under the
         * Creative Commons Attribution 4.0 International license and may on a
         * non-exclusive basis be reproduced without fee provided they are clearly
         * and visibly credited" — and "the full image or footage credit must be
         * presented in a clear and readable manner to all users, with the wording
         * unaltered". The credit below is the wording the image page carries.
         */
        figure({
          src: '/figures/expansion-of-the-universe.webp',
          width: 1280,
          height: 909,
          alt: 'A black field scattered with smooth, pale golden oval galaxies of different sizes, the largest just right of centre, with a tilted bluish spiral galaxy at upper left and hundreds of tiny orange specks, far more distant galaxies, filling the background.',
          caption:
            'The Coma Cluster, about 320 million light-years away and the sim’s starting point. Every galaxy in it is receding from us at roughly 6 700 km/s; the redshift of the whole cluster was one of the first measured.',
          credit:
            'NASA, ESA, and the Hubble Heritage Team (STScI/AURA). Acknowledgment: D. Carter (Liverpool John Moores University) and the Coma HST ACS Treasury Team.',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'recession-velocity',
          tex: 'v \\;=\\; {{H0}}\\,{{d}}',
          binds: ['H0', 'd'],
          note: prose(
            p(
              m`v`,
              ' — recession velocity, the rate at which the distance grows; ',
              m`H_0`,
              ' — the Hubble constant (your slider); ',
              m`d`,
              ' — proper distance now (your slider). Linear: twice the distance, twice the speed.',
            ),
          ),
        },
        {
          id: 'redshift',
          tex:
            'z \\;=\\; \\dfrac{\\lambda_{\\text{obs}} - \\lambda_{\\text{rest}}}{\\lambda_{\\text{rest}}}' +
            ' \\;\\approx\\; \\dfrac{{{H0}}\\,{{d}} + {{vPec}}}{c}',
          binds: ['H0', 'd', 'vPec'],
          note: prose(
            p(
              m`\lambda_{\text{obs}}`,
              ' — the wavelength that arrives; ',
              m`\lambda_{\text{rest}}`,
              ' — the laboratory wavelength, 656.28 nm for Hα; ',
              m`v_{\text{pec}}`,
              ' — the galaxy’s own motion (your slider); ',
              m`c`,
              ' — the speed of light. The approximation holds while ',
              m`z`,
              ' is much less than 1.',
            ),
          ),
        },
        {
          id: 'hubble-time',
          tex: 't_H \\;=\\; \\dfrac{1}{{{H0}}}',
          binds: ['H0'],
          note: prose(
            p(
              m`t_H`,
              ' — the Hubble time, the age the universe would have if it had always expanded at ',
              'today’s rate. The true age is close to it: see going deeper.',
            ),
            p(
              'Worked example, the Coma Cluster. ',
              m`d = 3.09 \times 10^{24}\,\text{m}`,
              ' (326 million light-years, 100 Mpc), ',
              m`H_0 = 2.18 \times 10^{-18}\,\text{s}^{-1}`,
              ' (67.4 km/s/Mpc), ',
              m`v_{\text{pec}} = 0`,
              '.',
            ),
            p(m`v = 2.18 \times 10^{-18} \times 3.09 \times 10^{24} = 6.74 \times 10^{6}\,\text{m/s} = 6\,740\,\text{km/s}`),
            p(m`z = 6.74 \times 10^{6} / 3.00 \times 10^{8} = 0.0225`),
            p(m`\lambda_{\text{obs}} = 656.28\,\text{nm} \times 1.0225 = 671.0\,\text{nm}`),
            p(
              m`t_H = 1 / (2.18 \times 10^{-18}\,\text{s}^{-1}) = 4.58 \times 10^{17}\,\text{s}`,
              ' = 14.5 billion years',
            ),
            p('Coma’s measured redshift is 0.023; the small difference is its peculiar velocity.'),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Write the distance to any galaxy as ',
          m`d(t) = a(t)\,\chi`,
          ', where ',
          m`\chi`,
          ' is a fixed comoving coordinate labelling the galaxy and ',
          m`a(t)`,
          ' is the scale factor, the single number recording how stretched the universe is at ',
          'time ',
          m`t`,
          '. Differentiating, ',
          m`\dot d = \dot a\,\chi = (\dot a / a)\,d`,
          '. The velocity–distance relation is therefore a consequence of homogeneity: any ',
          'uniform stretching produces a speed proportional to distance, with the same ',
          'proportionality seen from every point. The Hubble parameter ',
          m`H(t) = \dot a / a`,
          ' is a function of time; ',
          m`H_0`,
          ' is its value now. “Constant” means constant across space, not across history.',
        ),
        p(
          'Cosmological redshift follows from the same scale factor with no velocity in it: ',
          m`1 + z = a(t_0) / a(t_{\text{emit}})`,
          '. The wavelength grows by exactly the factor the universe grew while the light was ',
          'travelling. Expanding in small ',
          m`z`,
          ' recovers ',
          m`z \approx H_0 d / c`,
          ', but the next term depends on the expansion history. For comoving distance, ',
          m`d = (c/H_0)\,[\,z - (1 + q_0)\,z^2/2 + \dots\,]`,
          ', where ',
          m`q_0 = -\ddot a\,a / \dot a^2`,
          ' is the deceleration parameter. With the Planck 2018 densities, ',
          m`\Omega_m = 0.315`,
          ' and ',
          m`\Omega_\Lambda = 0.685`,
          ', ',
          m`q_0 = \Omega_m/2 - \Omega_\Lambda \approx -0.53`,
          ': the expansion is accelerating, a result first established from ',
          term('Type Ia supernovae', 'type-ia-supernova'),
          ' in 1998 and attributed to ',
          term('dark energy'),
          '. The sim’s linear ',
          m`z = v/c`,
          ' therefore underestimates ',
          m`z`,
          ' by about 2% at ',
          m`z = 0.1`,
          ' and about 5% at the far end of the distance slider.',
        ),
        p(
          '“Distance” also stops being one number. Proper distance now, the distance the light ',
          'travelled, and the luminosity distance inferred from brightness differ by factors of ',
          'order ',
          m`(1 + z)`,
          ' and agree only for ',
          m`z \lesssim 0.1`,
          '. The sim’s ',
          m`d`,
          ' is proper distance now.',
        ),
        p(
          'Recession velocity ',
          m`H_0 d`,
          ' exceeds ',
          m`c`,
          ' beyond the Hubble radius ',
          m`c/H_0`,
          ', about 4.4 Gpc or 14.5 billion light-years. This violates nothing: special ',
          'relativity limits motion through space, and recession is not motion through space. ',
          'Light from beyond the Hubble radius still reaches us because the Hubble radius grows ',
          'over time, overtaking photons that were once being carried away. The observable ',
          'universe extends to about 46 billion light-years, more than three Hubble radii.',
        ),
        p(
          'The Hubble tension is the field’s central open problem. The early-universe route fits ',
          'the cosmic microwave background with the ',
          term('ΛCDM', 'lambda-cdm'),
          ' model and predicts ',
          m`H_0 = 67.4 \pm 0.5`,
          ' km/s/Mpc. The late-universe route calibrates Type Ia supernovae with ',
          term('Cepheid variables', 'cepheid-variable'),
          ' and measures 73.04 ± 1.04 (SH0ES, 2022). The discrepancy exceeds ',
          m`5\sigma`,
          '. The tip-of-the-red-giant-branch calibration returned 69.8 ± 0.8 (stat) ± 1.7 (sys) ',
          'in 2019, between the two, and JWST measurements since 2024 have sharpened rather than ',
          'settled the argument: SH0ES Cepheid photometry was confirmed and crowding ruled out at ',
          'high significance, while the Carnegie-Chicago programme’s three JWST methods gave ',
          'values between 68 and 72. Proposed explanations divide into distance-ladder ',
          'systematics and new physics, such as an early dark energy component that shrinks the ',
          term('sound horizon'),
          ' the CMB fit depends on. None is accepted.',
        ),
        p(
          'Finally, the age. ',
          m`1/H_0`,
          ' is the age the universe would have if it had always expanded at today’s rate; at ',
          m`H_0 = 67.4`,
          ' km/s/Mpc it is 14.5 billion years. Deceleration by matter early on and acceleration ',
          'by ',
          m`\Lambda`,
          ' late on nearly cancel, so the ΛCDM age, 13.80 ± 0.02 billion years, is 0.95 of the ',
          'Hubble time.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'scale-of-the-universe',
          reason:
            'The distance slider here covers the same range you climbed there; now each step has a speed attached.',
        },
        {
          moduleId: 'cosmic-microwave-background',
          reason:
            'Run the stretching backward far enough and the light reaching you left before there were any galaxies.',
        },
        {
          moduleId: 'early-universe',
          reason: '1/H₀ is a rough age. That module walks through the first moments of it.',
        },
        {
          moduleId: 'cosmic-distance-ladder',
          reason:
            'Every point on the Hubble diagram needs a distance measured some other way. That is where the distances come from, and why two teams disagree.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'Planck Collaboration 2020, “Planck 2018 results VI: Cosmological parameters”, A&A 641, A6',
      url: 'https://doi.org/10.1051/0004-6361/201833910',
      note: 'H₀ = 67.4 ± 0.5 km/s/Mpc, Ω_m, Ω_Λ and the 13.80 Gyr age',
    },
    {
      label:
        'Riess et al. 2022, “A Comprehensive Measurement of the Local Value of the Hubble Constant”, ApJL 934, L7',
      url: 'https://doi.org/10.3847/2041-8213/ac5c5b',
      note: 'SH0ES value 73.04 ± 1.04 km/s/Mpc',
    },
    {
      label: 'Freedman et al. 2019, “The Carnegie-Chicago Hubble Program. VIII”, ApJ 882, 34',
      url: 'https://doi.org/10.3847/1538-4357/ab2f73',
      note: 'TRGB value 69.8 km/s/Mpc',
    },
    {
      label:
        'Hubble 1929, “A relation between distance and radial velocity among extra-galactic nebulae”, PNAS 15, 168',
      url: 'https://doi.org/10.1073/pnas.15.3.168',
      note: 'The original velocity–distance plot and the ~500 km/s/Mpc constant',
    },
    {
      label: 'NIST Atomic Spectra Database, H I lines',
      url: 'https://physics.nist.gov/asd',
      note: 'Hα air wavelength 656.28 nm',
    },
  ],
};

export default expansionOfTheUniverse;

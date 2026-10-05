/**
 * The cosmic distance ladder — the fifteenth published Lodestar module.
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
import { D_LMC, LIGHT_YEAR, PARSEC } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const cosmicDistanceLadder: Module = {
  id: 'cosmic-distance-ladder',
  title: 'The Cosmic Distance Ladder',
  tagline:
    'Almost every distance to a galaxy rests on a shorter one, all the way down to the width of Earth’s orbit.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Almost every distance to a galaxy you have ever read was measured by standing on a shorter ',
          'one. At the bottom of the stack is the trick your eyes use to judge how far away your ',
          'thumb is.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Imagine standing at the end of a long, dark street lined with lamps, trying to work out ',
          'how long the street is. The nearest lamp you can judge directly: close one eye, then the ',
          'other, and it jumps against the houses behind it; the bigger the jump, the closer the ',
          'lamp. That works for a few lamps, then the jump gets too small to see.',
        ),
        p(
          'But suppose every lamp on this street uses the same kind of bulb. Once you know how ',
          'bright that bulb is, from the near lamps you measured, you can judge any lamp by how ',
          'faint it looks, since a lamp twice as far away looks four times fainter. That carries ',
          'you much farther. And at the far end, where even these bulbs fade out, there are a few ',
          'floodlights, always of the same make. You never get close enough to a floodlight to ',
          'judge it by the jump; you calibrate it from the bulbs beside it, which you calibrated by ',
          'the jump.',
        ),
        p(
          'That chain is the cosmic distance ladder. Each rung reaches farther than the one below, ',
          'and each is only as good as the one it stands on.',
        ),
        p(
          'Where the analogy breaks: real “bulbs” are not quite identical, and the ones astronomers ',
          'use flicker, which turns out to be the most useful thing about them. And street lamps ',
          'stay put, while at the far end of the ladder everything is moving away, which gives the ',
          'top rung a measure of its own.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'cosmic-distance-ladder',
      caption: prose(
        p(
          'Slide out from the nearest stars to about 3.3 billion light-years and watch which methods can still ',
          'reach. Then introduce a small error in how bright the standard stars are assumed to be, ',
          'and see what it does to the expansion rate at the top.',
        ),
      ),
      params: [
        {
          id: 'd',
          friendlyLabel: 'How far away?',
          technicalLabel: 'Distance',
          symbol: 'd',
          unit: 'm',
          // One parsec to a gigaparsec. Default: the Large Magellanic Cloud. Nine
          // decades exactly; the maximum is reachable with a 0.01-decade step.
          min: PARSEC,
          max: 1e9 * PARSEC,
          default: D_LMC,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'light-years', factor: 1 / LIGHT_YEAR } },
        },
        {
          id: 'delta',
          friendlyLabel: 'How wrong is the bulbs’ assumed brightness? (in magnitudes, astronomers’ brightness scale; 0.1 is about 10 percent)',
          technicalLabel: 'Calibration offset',
          symbol: '\\delta',
          unit: '',
          // A step of 0.005 puts 0.175, the offset that turns Planck's H0 into
          // SH0ES's, on the grid. 120 steps; the maximum is reachable.
          min: -0.3,
          max: 0.3,
          default: 0,
          step: 0.005,
          scale: 'linear',
          format: { notation: 'fixed', digits: 3, displayUnit: { unit: 'mag', factor: 1 } },
        },
      ],
      approximations: [
        prose(
          p(
            'The ranges drawn for each method are rough; where a method stops working depends on the telescope, the target and how much precision is enough.',
          ),
        ),
        prose(
          p(
            'The calibration panel assumes the true expansion rate is the one the microwave background, the faint glow left from the early universe, predicts and asks what error on the ladder would change it. That is a way to measure the size of the disagreement, not a claim about which side is right.',
          ),
        ),
        prose(
          p(
            'The Gaia space telescope’s precision in measuring a star’s parallax, half its yearly shift, is taken as one figure: 20 millionths of an ',
            term('arcsecond'),
            '. That is the width of a large coin on the Moon seen from Earth. Faint stars are measured several times less precisely.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'The ',
          term('cosmic distance ladder'),
          ' is the chain of methods astronomers use to measure distance, each calibrated by the one ',
          'below. Its first rung is ',
          term('parallax'),
          ': as Earth goes around the Sun, a nearby star shifts back and forth against the far ',
          'background. Half that swing is its parallax angle, and its distance in parsecs is one ',
          'divided by that angle in arcseconds; the parsec, 3.26 light-years, is defined that way. ',
          'The shifts are tiny. The nearest star, Proxima Centauri, has a parallax of 0.77 ',
          'arcseconds, about the width of a coin seen from five ',
          'kilometres. The Gaia spacecraft measures parallaxes to about 20 millionths of an ',
          'arcsecond for bright stars, which gives distances good to a few percent out to a few ',
          'thousand light-years.',
        ),
        p(
          'The second rung is the ',
          term('Cepheid variable', 'cepheid-variable'),
          ', a supergiant star that swells and shrinks with a steady period of days to months. ',
          'Henrietta Swan Leavitt, measuring photographic plates of the Small Magellanic Cloud at ',
          'Harvard, noticed in 1908 that the brighter Cepheids pulsed more slowly, and published the ',
          'relation in 1912; it is now called the ',
          term('Leavitt law'),
          '. Measure the period and you know the star’s true brightness. Astronomers express ',
          'brightness in magnitudes, where larger numbers mean fainter: a star’s ',
          term('absolute magnitude'),
          ' is how bright it would look from 10 parsecs, its ',
          term('apparent magnitude'),
          ' is how bright it does look, and the difference between them, the ',
          term('distance modulus'),
          ', gives its distance. A 30-day Cepheid has an absolute magnitude of about −5.2, some ten ',
          'thousand times the Sun’s brightness, and the Hubble and Webb telescopes pick them out in ',
          'galaxies 40 million parsecs away. Calibrated by Gaia parallaxes of Cepheids in the Milky ',
          'Way, and by a distance to the Large Magellanic Cloud measured from eclipsing binary stars ',
          'to one percent, Cepheids are the bridge from our galaxy to others.',
        ),
        p(
          'The third rung is the ',
          term('Type Ia supernova', 'type-ia-supernova'),
          ', a ',
          term('standard candle'),
          ' bright enough to be seen across billions of light-years. Cepheids cannot be seen that ',
          'far, but a few dozen galaxies have hosted both, and those galaxies fix the supernovae’s ',
          'brightness. Beyond about 50 million parsecs, a galaxy’s own motion, a few hundred ',
          'kilometres per second, is small against its recession, and distances enter the ',
          term('Hubble flow'),
          ', where speed and distance follow one line. The slope of that line is the ',
          term('Hubble constant'),
          ', and measuring it is what the whole ladder is for.',
        ),
        p(
          'Edwin Hubble’s ladder in 1929 gave a slope of about 500 km/s/Mpc, seven times too high, ',
          'partly because the Cepheid calibration of the day mixed two kinds of pulsating star, one ',
          'about four times fainter than the other. Walter Baade separated them in 1952 and the ',
          'known universe doubled in size. The lesson has stood: an error low on the ladder carries ',
          'all the way up.',
        ),
        p(
          'Two misconceptions. The ladder is not one method pushed to its limit; it hands ',
          'calibration from one method to the next through objects that both can reach. And ',
          '“standard candle” does not mean identical: no two Cepheids or supernovae are exactly as ',
          'bright as each other, but each obeys a rule, period for Cepheids and the shape of the ',
          'light curve for supernovae, that makes its brightness predictable to about ten percent, ',
          'which pins each distance to about five percent.',
        ),
        p(
          'Today the top of the ladder gives H₀ = 73.0 ± 1.0 km/s/Mpc, while the cosmic microwave ',
          'background, which uses no ladder at all, predicts 67.4 ± 0.5. The difference, the Hubble ',
          'tension, is what a calibration error of 0.17 magnitudes would produce: the candles ',
          'about 17 percent brighter than assumed. Whether there is such an error is the open ',
          'question, and the sim’s second slider is that question.',
        ),
        /*
         * Source: https://science.nasa.gov/asset/hubble/cepheid-variable-star-rs-puppis/
         * ("Cepheid Variable Star RS Puppis", released 17 December 2013 with
         * "Hubble Watches Super Star Create Holiday Light Show",
         * https://science.nasa.gov/missions/hubble/hubble-watches-super-star-create-holiday-light-show/).
         * The asset page and the release both credit it "NASA, ESA, and the
         * Hubble Heritage Team (STScI/AURA)-Hubble/Europe Collaboration;
         * Acknowledgment: H. Bond (STScI and Pennsylvania State University)".
         * Image asset STScI-01EVT3G1573FFHV8VDP51P7PDE, taken as the full
         * 3958 × 3695 rendition and converted to 1280 px wide webp.
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
          src: '/figures/cosmic-distance-ladder.webp',
          width: 1280,
          height: 1195,
          alt: 'A brilliant white star at the centre with long thin diffraction spikes crossing the frame, wrapped in a wreath of wispy dust lit in pale blue and grey near the star and brown and rust further out, on a black field scattered with smaller blue-white and orange stars.',
          caption:
            'RS Puppis, a Cepheid (a star that pulses in brightness on a strict schedule) about 6 500 light-years away that brightens and fades every 41.4 days. The dust around it reflects each pulse, and timing those light echoes gave its distance to about one and a half percent.',
          credit:
            'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)-Hubble/Europe Collaboration; Acknowledgment: H. Bond (STScI and Pennsylvania State University)',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'parallax',
          tex: 'p \\;=\\; \\dfrac{1\\,\\text{AU}}{{{d}}}',
          binds: ['d'],
          note: prose(
            p(
              m`p`,
              ' — the parallax angle, in radians; ',
              m`\text{AU}`,
              ' — the radius of Earth’s orbit; ',
              m`d`,
              ' — the distance (your slider). One parsec is the distance at which ',
              m`p`,
              ' is one arcsecond.',
            ),
          ),
        },
        {
          id: 'distance-modulus',
          tex: 'm \\;=\\; M + 5\\log_{10}\\!\\left(\\dfrac{{{d}}}{10\\,\\text{pc}}\\right)',
          binds: ['d'],
          note: prose(
            p(
              m`m`,
              ' — how bright the star looks; ',
              m`M`,
              ' — its absolute magnitude, −5.2 for a 30-day Cepheid and −19.3 for a Type Ia ',
              'supernova. Every factor of ten in distance adds five magnitudes.',
            ),
          ),
        },
        {
          id: 'inferred-h0',
          tex: 'H_{0,\\text{ladder}} \\;=\\; H_{0,\\text{true}}\\cdot 10^{{{delta}} / 5}',
          binds: ['delta'],
          note: prose(
            p(
              m`\delta`,
              ' — the error in the candles’ assumed absolute magnitude (your slider), positive if ',
              'they were assumed fainter than they are. Assumed too faint, they are placed too ',
              'close, and nearer galaxies receding at the same speed mean a faster expansion.',
            ),
            p(
              'Worked example, the Large Magellanic Cloud. ',
              m`d = 49.6\,\text{kpc} = 1.53 \times 10^{21}\,\text{m}`,
              '.',
            ),
            p(
              m`p = 1.50 \times 10^{11} / 1.53 \times 10^{21} = 9.8 \times 10^{-11}\,\text{rad}`,
              ' = 20 millionths of an arcsecond: the same as Gaia’s precision, which is why the ',
              'Cloud’s distance comes from eclipsing binaries instead.',
            ),
            p(
              m`5\log_{10}(49\,600 / 10) = 18.48`,
              ', so a 30-day Cepheid there looks ',
              m`-5.21 + 18.48 = +13.3`,
              ', easy for a modest telescope; a Type Ia there would be −0.8, brighter than every star ',
              'in the night sky except Sirius.',
            ),
            p(
              'The tension: with ',
              m`\delta = 0.175`,
              ', ',
              m`67.4 \times 10^{0.035} = 67.4 \times 1.084 = 73.1\,\text{km/s/Mpc}`,
              '.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Each rung carries its own systematics, and the error budget of the top rung is the sum ',
          'of all of them. Gaia parallaxes have a zero-point offset of about −20 microarcseconds ',
          'that varies with magnitude, colour and position on the sky, calibrated by Lindegren and ',
          'colleagues against quasars, whose true parallax is zero; at the distances of the Milky ',
          'Way Cepheids used as calibrators, typically 1–3 kpc, that offset is a percent-level ',
          'correction to the distance and cannot be ignored. The geometric anchors are three: those ',
          'parallaxes; the Large Magellanic Cloud at 49.59 ± 0.55 kpc from detached eclipsing ',
          'binaries, whose radii come from their light curves and whose angular sizes come from a ',
          'calibrated relation between surface brightness and colour; and NGC 4258 at 7.58 Mpc, ',
          'measured to 1.5 percent from water masers orbiting its central black hole. That the ',
          'three agree to within their errors is itself a test of the bottom rung.',
        ),
        p(
          'Cepheid photometry fights dust and crowding. Dust dims and reddens; the SH0ES programme ',
          'uses a reddening-free Wesenheit magnitude, the near-infrared magnitude minus 0.386 times ',
          'an optical colour, which removes the extinction to first order under a standard dust ',
          'law. Crowding by unresolved neighbours in a galaxy 30 Mpc away adds light; it is ',
          'measured by injecting artificial stars into the images and, since 2023, checked with ',
          'JWST’s sharper infrared images, which reproduce the Hubble photometry. The Leavitt law has ',
          'a metallicity term of about −0.2 magnitudes per dex in the infrared, relevant because the ',
          'anchor galaxies and the supernova hosts differ in metal content.',
        ),
        p(
          'Type Ia peak magnitudes scatter by about 0.3–0.4 mag raw; the standardisation of ',
          'Phillips (1993), refined into the Tripp relation, corrects them for light-curve width and ',
          'colour and reduces the scatter to about 0.1–0.15 mag. A residual “mass step” of about ',
          '0.05 mag between supernovae in high-mass and low-mass host galaxies is added as a ',
          'correction and its origin, probably the age or dust of the progenitor population, is not ',
          'settled. Selection effects matter at the faint end: a flux-limited survey preferentially ',
          'finds the brighter members of a population, the Malmquist bias, which the analyses model ',
          'with simulated surveys.',
        ),
        p(
          'The bottom panel makes the scale of the dispute concrete. The SH0ES total uncertainty on ',
          'H₀ is about 1.4 percent, equivalent to 0.03 magnitudes; closing the tension requires a ',
          'coherent error of 0.17 magnitudes somewhere in the chain, six times that. Independent ',
          'second rungs test the Cepheids directly: the tip of the red giant branch, the sharp upper ',
          'brightness limit of old red giants at an absolute I magnitude of about −4.05, and the ',
          'J-region asymptotic giant branch stars both calibrate supernovae without Cepheids. The ',
          'Carnegie–Chicago programme’s values from these, 68 to 70 km/s/Mpc, sit between the two ',
          'sides, while other groups using the same methods find values near 73. Proposals that ',
          'change the physics rather than the ladder, such as an early dark energy that shrinks the ',
          'sound horizon the CMB fit depends on, would leave every rung of the ladder correct and ',
          'move the prediction instead.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'expansion-of-the-universe',
          reason:
            'The slope that module lets you set is the number this ladder exists to measure, and the two teams disagreeing about it are the two lines drawn there.',
        },
        {
          moduleId: 'supernovae',
          reason:
            'The Type Ia panel there is the top rung here; its brightness at every distance is what this module calibrates.',
        },
        {
          moduleId: 'cosmic-microwave-background',
          reason:
            'The other side of the tension. Its prediction of H₀ uses no ladder at all, which is why the disagreement is interesting.',
        },
        {
          moduleId: 'scale-of-the-universe',
          reason: 'The distances that module lets you climb are the ones measured here, rung by rung.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'Leavitt & Pickering 1912, “Periods of 25 Variable Stars in the Small Magellanic Cloud”, Harvard College Observatory Circular 173, 1',
      url: 'https://ui.adsabs.harvard.edu/abs/1912HarCi.173....1L',
      note: 'The period–luminosity relation',
    },
    {
      label:
        'Benedict et al. 2007, “Hubble Space Telescope Fine Guidance Sensor Parallaxes of Galactic Cepheid Variable Stars: Period-Luminosity Relations”, AJ 133, 1810',
      url: 'https://doi.org/10.1086/511980',
      note: 'The Leavitt law zero point and slope used here',
    },
    {
      label: 'Gaia Collaboration 2023, “Gaia Data Release 3: Summary of the content and survey properties”, A&A 674, A1',
      url: 'https://doi.org/10.1051/0004-6361/202243940',
      note: 'Parallax precision',
    },
    {
      label:
        'Pietrzyński et al. 2019, “A distance to the Large Magellanic Cloud that is precise to one per cent”, Nature 567, 200',
      url: 'https://doi.org/10.1038/s41586-019-0999-4',
      note: 'The LMC anchor, 49.59 ± 0.55 kpc',
    },
    {
      label: 'Riess et al. 2022, “A Comprehensive Measurement of the Local Value of the Hubble Constant”, ApJL 934, L7',
      url: 'https://doi.org/10.3847/2041-8213/ac5c5b',
      note: 'The SH0ES ladder, its error budget and H₀ = 73.04 ± 1.04',
    },
  ],
};

export default cosmicDistanceLadder;

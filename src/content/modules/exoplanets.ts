/**
 * Exoplanets, by the transit method — the sixth published Lodestar module.
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
import { AU, M_SUN, R_EARTH, R_JUPITER, R_SUN } from '@/physics/constants';
import { em, figure, m, p, prose, term } from '../rich';
import { logMinThrough, logStep } from '../grid';

/*
 * Slider bottoms nudged by under 1% so each default is exactly a grid point,
 * with the top fixed and reachable (src/content/grid.ts).
 */
const MSTAR_MAX = 10 * M_SUN;
const MSTAR_MIN = logMinThrough(M_SUN, MSTAR_MAX, 210, 110);
const A_MAX = 5 * AU;
const A_MIN = logMinThrough(0.05 * AU, A_MAX, 270, 70);

const exoplanets: Module = {
  id: 'exoplanets',
  title: 'Exoplanets',
  tagline: 'A star dims by a hundredth, on schedule, and there is a world in the way.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'We know of more than six thousand planets around other stars, and we have ',
          'photographed almost none of them. Most were found by watching starlight blink.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Watch a streetlight from across a valley at night. A moth is circling it, far too ',
          'small and too far away for you to see. But every time the moth crosses in front of the ',
          'bulb, the light dims. Not much: a flicker at the edge of what you can measure. You ',
          'could never point to the moth. Yet suppose the flicker comes back again and again on a ',
          'perfect schedule: same dimming, same duration, like clockwork. Then you know something ',
          'is circling that light. You know how big it is compared to the bulb, and how long its ',
          'laps take. You have discovered the moth without ever seeing it.',
        ),
        p(
          'That is the transit method. The streetlight is a star, the moth is a planet, and the ',
          'schedule is everything: one dip could be anything, but the same dip returning on the ',
          'same clock is an orbit.',
        ),
        p(
          'The analogy breaks in one place that matters: a streetlight shines steadily, but real ',
          'stars flicker on their own, with spots, flares, and a constant simmer of variation ',
          'often larger than the dip itself. Finding the planet means telling its ',
          'metronome-regular ',
          'shadow apart from the star’s own restlessness, which is why it took space ',
          'telescopes staring at one field for years.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'exoplanets',
      caption: prose(
        p(
          'Build the system: a star, a planet, an orbit. Then watch the crossing and the dip it ',
          'carves: top panel the view, bottom panel the measurement, on the same clock.',
        ),
      ),
      params: [
        {
          id: 'Mstar',
          friendlyLabel: 'How heavy is the star? (in Suns)',
          technicalLabel: 'Stellar mass',
          symbol: 'M_\\star',
          unit: 'kg',
          // About 0.08 M_☉ is the hydrogen-burning limit at the bottom of the red
          // dwarfs; 10 M_☉ is a young B star. Mass sets only the period here —
          // the depth does not care how heavy the star is, which is itself worth
          // discovering with the slider. The minimum is 0.0794 M_☉, so the Sun is
          // step 110 of 210.
          min: MSTAR_MIN,
          max: MSTAR_MAX,
          default: M_SUN,
          step: logStep(MSTAR_MIN, MSTAR_MAX, 210), // decades, about 0.01
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'M☉', factor: 1 / M_SUN },
          },
        },
        {
          id: 'Rstar',
          friendlyLabel: 'How big is the star? (in Sun widths)',
          technicalLabel: 'Stellar radius',
          symbol: 'R_\\star',
          unit: 'm',
          // 0.1 R_☉ is an M dwarf barely larger than Jupiter; 10 R_☉ is a
          // giant. Independent of mass on purpose: a transit measures the
          // radius ratio, and nothing about the star's mass enters the depth.
          min: 0.1 * R_SUN,
          max: 10 * R_SUN,
          default: R_SUN,
          step: 0.01,
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'R☉', factor: 1 / R_SUN },
          },
        },
        {
          id: 'Rp',
          friendlyLabel: 'How big is the planet? (in Earth widths)',
          technicalLabel: 'Planet radius',
          symbol: 'R_p',
          unit: 'm',
          // Half an Earth to two Jupiters: the whole range transit surveys
          // return, from the sub-Earths Kepler found around quiet dwarfs to the
          // inflated hot Jupiters that dominate the early catalogues. The default
          // is a fraction of a step off this grid; putting it on would change the
          // step by 0.3%, which the keyboard contract (0.05 decades a press) does
          // not allow on this short slider.
          min: 0.5 * R_EARTH,
          max: 2 * R_JUPITER,
          default: R_JUPITER,
          step: 0.01,
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'R⊕', factor: 1 / R_EARTH },
          },
        },
        {
          id: 'a',
          friendlyLabel: 'How far out does it orbit? (in Earth–Sun distances)',
          technicalLabel: 'Orbital distance',
          symbol: 'a',
          unit: 'm',
          // 0.01 AU around a Sun is an 8.8 h orbit (known periods reach about
          // 4 h, around smaller stars); 5 AU is Jupiter's
          // distance, where a transit lasts a day and repeats once a decade. The
          // minimum is 0.00998 AU, so the default is step 70 of 270.
          min: A_MIN,
          max: A_MAX,
          default: 0.05 * AU, // a hot Jupiter, which is what the method found first
          step: logStep(A_MIN, A_MAX, 270), // decades, about 0.01
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'AU', factor: 1 / AU },
          },
        },
      ],
      approximations: [
        prose(
          p(
            'The star is drawn evenly bright. Real stars are dimmer at the edge, so a real ',
            term('light curve', 'light-curve'),
            ' has rounded corners rather than this trapezoid’s sharp ones.',
          ),
        ),
        prose(
          p(
            'The planet crosses the middle of the star, an ',
            term('impact parameter', 'impact-parameter'),
            ' of zero. Most cross off-centre, which gives a shorter, more V-shaped dip.',
          ),
        ),
        prose(
          p(
            'The orbit is a circle, seen exactly edge-on. The chance-of-alignment readout holds for circular orbits only.',
          ),
        ),
        prose(
          p(
            'The planet is a dark ball that gives off no light of its own.',
          ),
        ),
        prose(
          p(
            'One planet, one star. Real neighbouring planets tug on each other and shift transit times by minutes.',
          ),
        ),
        prose(
          p(
            'The frame shows only the transit and its own length again either side, not the whole orbit. Inside the frame, sizes and speed are to scale.',
          ),
        ),
        prose(
          p(
            'The dip stops at total: a planet bigger than its star blocks all of its light, and no more.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A ',
          em('transit'),
          ' is a planet crossing its star’s face as seen from here, and the record of ',
          'brightness against time is a ',
          em('light curve'),
          '. Its dip carries the geometry directly: the ',
          em('depth'),
          ' — the fraction of light lost — is the ratio of the two discs’ areas, so a dip of ',
          'one percent means a planet one tenth its star’s diameter. Jupiter crossing the Sun ',
          'would dim it by about 1%. Earth would manage 84 parts per million (a porch light ',
          'dimming for a gnat) which is the whole reason finding another Earth required leaving ',
          'the atmosphere.',
        ),
        p(
          'The method’s short history is steep. The first planet around a Sun-like star, in ',
          '1995, was found by a different technique (the wobble it raised in its star) and ',
          'turned out to be a giant skimming its star in four days, a ',
          em(term('hot Jupiter', 'hot-jupiter')),
          ' no theorist had ordered. The first transit came in 1999, when one of those giants, ',
          'HD 209458 b, was caught dimming its star by about 1.5% right on the wobble’s ',
          'schedule. Then the strategy scaled: NASA’s Kepler telescope stared at one patch of ',
          '150,000 stars for four years, and found planets in such numbers that the count now ',
          'exceeds six thousand, most of them transit discoveries. Worlds between Earth’s size ',
          'and Neptune’s (some rocky super-Earths, some gas-wrapped sub-Neptunes), a kind our ',
          'own system lacks, turned out to be the most common find of all.',
        ),
        p(
          'Transits have a built-in blind spot: the orbit must be edge-on to us. For a planet ',
          'like Earth around a star like the Sun, that alignment is roughly a 1-in-213 accident. ',
          'Every count is therefore a floor: for each transiting world, a couple of hundred ',
          'siblings hide at other tilts. Correcting for this turns Kepler’s tally into ',
          'occurrence rates, and together with microlensing surveys, which count planets on ',
          'wider orbits, those rates show the galaxy holds more planets than stars.',
        ),
        p(
          'The misconception to retire is that a transit shows a silhouette. Nothing is resolved; ',
          'the star itself is a single point of light. Everything in this module — the planet’s ',
          'size, its orbit, its very existence — is read out of one wiggling number, brightness ',
          'against time. That a dip in a graph can weigh in as discovery of a world is the ',
          'method’s actual magic.',
        ),
        /*
         * Plotted here from the mission's own photometry, not a press graphic.
         *
         * Source: Kepler long-cadence light curves for HAT-P-7 (KIC 10666592),
         * quarters 0 and 1, from the Mikulski Archive for Space Telescopes —
         * https://archive.stsci.edu/pub/kepler/lightcurves/0106/010666592/
         * (kplr010666592-2009131105131_llc.fits and -2009166043257_llc.fits).
         * Kepler data are in the public domain; NASA asks only that the mission
         * and the archive be acknowledged, which the credit line does.
         *
         * Processing, in full, because a plot is evidence and what was done to
         * it is part of the claim:
         *   1. Cadences with a non-zero SAP_QUALITY flag discarded, and the
         *      pipeline's PDCSAP_FLUX column used — 1,872 good cadences of
         *      2,115 across the two quarters.
         *   2. Split at gaps longer than half a day; the longest contiguous run
         *      taken, and its first ten days kept — 453 cadences from
         *      BKJD 131.512.
         *   3. One straight line fitted to the out-of-transit points of that
         *      window and divided out, then divided by the median.
         * Nothing else: no smoothing, no clipping, no phase folding, and every
         * surviving cadence is drawn.
         *
         * Validated before it was encoded, against what HAT-P-7b is known to
         * do: five transits, consecutive centres 2.1968–2.2129 days apart
         * against a catalogued period of 2.2047, and a mean depth of 0.632%.
         * Had either failed the plot would have been thrown away rather than
         * captioned.
         */
        figure({
          src: '/figures/exoplanets.webp',
          width: 1280,
          height: 622,
          alt: 'A graph of Kepler’s measured brightness of the star HAT-P-7 over ten days, dipping sharply at each transit of the planet.',
          caption:
            'A real transit, plotted from the archive: the Kepler space telescope watching HAT-P-7b, a hot Jupiter (a giant planet in a scorching close orbit), cross its star every 2.2 days, in the mission’s earliest brightness measurements. The dip is under one percent, and where the sim draws a trapezoid, nature rounds the corners.',
          credit: 'NASA Kepler mission data via MAST (KIC 10666592); plotted for this page',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'transit-depth',
          tex: '\\delta \\;=\\; \\left(\\dfrac{{{Rp}}}{{{Rstar}}}\\right)^{2}',
          binds: ['Rp', 'Rstar'],
          note: prose(
            p(
              m`\delta`,
              ' — fraction of the star’s light blocked (dimensionless); ',
              m`R_p`,
              ' — the planet’s radius (your slider); ',
              m`R_\star`,
              ' — the star’s radius (your slider). Areas, not radii: a planet half the ',
              'star’s radius blocks a quarter of its light.',
            ),
          ),
        },
        {
          id: 'transit-duration',
          tex: 'T \\;=\\; \\dfrac{P}{\\pi}\\,\\arcsin\\!\\left(\\dfrac{{{Rstar}} + {{Rp}}}{{{a}}}\\right)',
          binds: ['Mstar', 'Rstar', 'Rp', 'a'],
          note: prose(
            p(
              m`T`,
              ' — time from first contact to last; ',
              m`P`,
              ' — the orbital period, which Kepler’s third law supplies from the star’s mass ',
              m`M_\star`,
              ' and the distance ',
              m`a`,
              ' (both your sliders) — this equation reads the same period() the orbits module runs ',
              'on; ',
              m`a`,
              ' — the orbital distance. The arcsin is the slice of the orbit the star’s disc ',
              'subtends.',
            ),
            p(
              'Worked example (defaults — a hot Jupiter at 0.05 AU): ',
              m`\delta`,
              ' = 1.01%, and ',
              m`P`,
              ' = 4.08 days gives ',
              m`T`,
              ' = 3.2 hours. Slide the planet out to Earth’s distance and shrink it to ',
              'Earth’s size: the dip collapses to 84 parts per million, 13 hours long, once a ',
              'year — the signal Kepler was built to catch.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The duration formula is the central-chord best case, and its failure modes are the ',
          'working tools. A real transit crosses at ',
          em('impact parameter'),
          ' ',
          m`b`,
          ', the miss distance from the disc’s centre in stellar radii; the chord shortens as ',
          m`\sqrt{1 - b^2}`,
          ', so duration alone cannot separate a grazing pass of a big star from a central pass ',
          'of a small one. The degeneracy is broken by the dip’s ',
          em('shape'),
          ': ingress and egress lengthen and the bottom rounds as ',
          m`b`,
          ' grows, which is why fitting the full curve (not reading off depth and width) is how ',
          'parameters are actually extracted. ',
          em(term('Limb', 'limb'), ' darkening'),
          ' rounds the shoulders further: a stellar disc is dimmer at its edge, so this ',
          'module’s trapezoid is the zeroth-order sketch of a subtler profile.',
        ),
        p(
          'The dip also has to earn belief. A background ',
          term('eclipsing binary', 'eclipsing-binary'),
          ' blended into the same ',
          'pixel fakes a transit convincingly, and early surveys drowned in such impostors: ',
          'nearly two thousand of Kepler’s candidates remain unconfirmed a decade after the ',
          'mission ended. Vetting is statistical ',
          'and multi-instrument: the odd-even depth test (a binary’s alternating eclipses ',
          'differ), the hunt for a secondary dip at half-phase, and mass limits from the wobble ',
          'method. When both methods land on the same object, they compound: the transit gives ',
          'the radius, the wobble gives the mass, and together a ',
          em('density'),
          ', the single number that says gas giant, water world, or iron-cored rock.',
        ),
        p(
          'The frontier is what happens during the dip itself. A planet with an atmosphere is ',
          'fractionally bigger at wavelengths its gases absorb, so the transit is measurably ',
          'deeper there: the depth’s wavelength-dependence is a chemical assay of air on a ',
          'world no one can see. This is ',
          em('transmission spectroscopy'),
          ', and JWST performs it routinely: its first clear detection of carbon dioxide in an ',
          'exoplanet atmosphere, on the hot giant WASP-39 b in 2022, was a proof that the same ',
          'trick that counts planets can read them. Whether it can read a ',
          em('small'),
          ' one is the open question: the TRAPPIST-1 rocky worlds sit at the edge of ',
          'feasibility, their measurements to date compatible with thin atmospheres or none, and ',
          'the answer bears directly on whether transiting rocky planets are airless by rule or ',
          'by exception.',
        ),
        p(
          'The simulation’s shortcuts, in full. The disc is uniformly bright, but the limb shows ',
          'higher, cooler layers, so the planet blocks less light as it first crosses it; even a ',
          'uniform disc would curve the shoulders, because the overlap of two circles does not ',
          'grow in proportion to time. Fitting that curvature is how limb-darkening coefficients ',
          'are measured, and getting it wrong biases the radius by a few percent. The transit is ',
          'central, but duration and impact parameter are degenerate in a single light curve, ',
          'which is why a measured radius always comes with a fitted impact parameter beside it. ',
          'Eccentricity changes the duration through the planet’s speed at conjunction (a planet ',
          'transiting near periapsis crosses faster), and the alignment probability is the ',
          'geometric one for a circular orbit. Real hot Jupiters emit and reflect enough to be ',
          'detected in secondary eclipse, and a few are tidally stretched enough to matter. ',
          'Planets perturb one another into transit timing variations of minutes, which is how ',
          'several have been found without ever transiting. The default transit is 3% of its ',
          'period, an Earth’s around a Sun 0.15%, so a whole-orbit axis would draw the dip a ',
          'pixel wide. And the sliders reach a planet larger than its star (2 ',
          m`R_J`,
          ' around a 0.1 ',
          m`R_\odot`,
          ' dwarf), where the transit is a total eclipse and the flux goes to zero rather than ',
          'the formula’s negative.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'kepler-orbits',
          reason:
            'The duration equation imports this module’s third law verbatim: the period under every transit is Kepler’s.',
        },
        {
          moduleId: 'planetary-atmospheres',
          reason:
            'Transmission spectroscopy reads air on invisible worlds. Whether small planets keep any is the shoreline question.',
        },
        {
          moduleId: 'escape-velocity',
          reason:
            'Whether a found world holds an atmosphere comes down to the threshold this module ends on.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'Mayor & Queloz 1995, "A Jupiter-mass companion to a solar-type star", Nature 378, 355',
      url: 'https://doi.org/10.1038/378355a0',
      note: '51 Peg b in layer 4',
    },
    {
      label:
        'Charbonneau et al. 2000, "Detection of Planetary Transits Across a Sun-like Star", ApJL 529, L45',
      url: 'https://doi.org/10.1086/312457',
      note: 'HD 209458 b, the first transit',
    },
    {
      label: 'Borucki et al. 2010, "Kepler Planet-Detection Mission", Science 327, 977',
      url: 'https://doi.org/10.1126/science.1185402',
      note: 'The 150,000-star survey in layer 4',
    },
    {
      label: 'NASA Exoplanet Archive (NExScI, Caltech/IPAC)',
      url: 'https://exoplanetarchive.ipac.caltech.edu/',
      note: 'The running count; the 6,000 milestone passed in September 2025',
    },
    {
      label:
        'JWST Transiting Exoplanet Community ERS Team 2023, "Identification of carbon dioxide in an exoplanet atmosphere", Nature 614, 649',
      url: 'https://doi.org/10.1038/s41586-022-05269-w',
      note: 'WASP-39 b in layer 6',
    },
  ],
};

export default exoplanets;

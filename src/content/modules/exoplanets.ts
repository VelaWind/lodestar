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
import { em, m, p, prose } from '../rich';

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
          'Watch a streetlight from across a valley at night. A moth is circling it — far too ',
          'small and too far away for you to see. But every time the moth crosses in front of the ',
          'bulb, the light dims. Not much: a flicker at the edge of what you can measure. You ',
          'could never point to the moth. Yet if the flicker comes back again and again on a ',
          'perfect schedule — same dimming, same duration, like clockwork — you know something is ',
          'circling that light, you know how big it is compared to the bulb, and you know how ',
          'long its laps take. You have discovered the moth without ever seeing it.',
        ),
        p(
          'That is the transit method. The streetlight is a star, the moth is a planet, and the ',
          'schedule is everything: one dip could be anything, but the same dip returning on the ',
          'same clock is an orbit.',
        ),
        p(
          'The analogy breaks in one place that matters: a streetlight shines steadily, but real ',
          'stars flicker on their own — spots, flares, a constant simmer of variation often ',
          'larger than the dip itself. Finding the planet means telling its metronome-regular ',
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
          'carves — top panel the view, bottom panel the measurement, on the same clock.',
        ),
      ),
      params: [
        {
          id: 'Mstar',
          friendlyLabel: 'How heavy is the star?',
          technicalLabel: 'Stellar mass',
          symbol: 'M_\\star',
          unit: 'kg',
          // 0.08 M_☉ is the hydrogen-burning limit at the bottom of the red
          // dwarfs; 10 M_☉ is a young B star. Mass sets only the period here —
          // the depth does not care how heavy the star is, which is itself worth
          // discovering with the slider.
          min: 0.08 * M_SUN,
          max: 10 * M_SUN,
          default: M_SUN,
          step: 0.01, // decades
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'M☉', factor: 1 / M_SUN },
          },
        },
        {
          id: 'Rstar',
          friendlyLabel: 'How big is the star?',
          technicalLabel: 'Stellar radius',
          symbol: 'R_\\star',
          unit: 'm',
          // 0.1 R_☉ is an M dwarf barely larger than Jupiter; 10 R_☉ is a
          // subgiant. Independent of mass on purpose: a transit measures the
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
          friendlyLabel: 'How big is the planet?',
          technicalLabel: 'Planet radius',
          symbol: 'R_p',
          unit: 'm',
          // Half an Earth to two Jupiters: the whole range transit surveys
          // return, from the sub-Earths Kepler found around quiet dwarfs to the
          // inflated hot Jupiters that dominate the early catalogues.
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
          friendlyLabel: 'How far out does it orbit?',
          technicalLabel: 'Orbital distance',
          symbol: 'a',
          unit: 'm',
          // 0.01 AU is inside the shortest known periods; 5 AU is Jupiter's
          // distance, where a transit lasts a day and repeats once a decade.
          min: 0.01 * AU,
          max: 5 * AU,
          default: 0.05 * AU, // a hot Jupiter, which is what the method found first
          step: 0.01,
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'AU', factor: 1 / AU },
          },
        },
      ],
      approximations: [
        'The stellar disc is uniformly bright. It is not: a star is limb-darkened, dimmer at the edge than at the centre, because looking at the limb you see higher and cooler layers. So a real light curve has no corners — the planet blocks less light as it first crosses the dim limb, and the shoulders of this trapezoid are rounded off. Fitting that curvature is how limb-darkening coefficients are measured, and getting it wrong biases the planet radius by a few percent.',
        'The transit is central: the planet crosses the middle of the disc, impact parameter zero. Almost none are. A real transit is a chord, and a shorter one — a planet crossing near the limb takes less time and gives a V-shaped curve with barely any flat bottom. Duration and impact parameter are degenerate in a single light curve, which is why a measured planet radius always comes with a fitted impact parameter beside it.',
        'The orbit is circular and edge-on. Eccentricity changes the transit duration through the planet’s speed at conjunction — a planet transiting near periapsis crosses faster — and the "chance of alignment" readout is the geometric probability for a circular orbit only.',
        'The planet is opaque, spherical and contributes no light of its own. Real hot Jupiters emit and reflect enough to be detected in secondary eclipse when they pass behind the star, and a few are oblate enough to matter.',
        'One planet, one star. Multi-planet systems perturb each other, and those perturbations shift transit times by minutes — transit timing variations, which is how several planets have been found without ever seeing their own transit.',
        'The frame shows the transit and half again either side, not the whole orbit. At the default settings the transit is 3% of the period, and for an Earth around a Sun it is 0.15%: an axis spanning one orbit would draw the dip a pixel wide. What is inside the frame is to scale — the planet against the star, and its speed across the disc — the axis simply stops at the edges of the event.',
        'Depth is capped at total. The sliders reach a planet larger than its star, which is a real configuration for a 2 R_J planet around a 0.1 R_☉ dwarf; there the "transit" is a total eclipse and the flux goes to zero rather than the formula’s negative.',
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
          'would dim it by about 1%. Earth would manage 84 parts per million — a porch light ',
          'dimming for a gnat — which is the whole reason finding another Earth required leaving ',
          'the atmosphere.',
        ),
        p(
          'The method’s short history is steep. The first planet around a Sun-like star, in ',
          '1995, was found by a different technique — the wobble it raised in its star — and ',
          'turned out to be a giant skimming its star in four days, a ',
          em('hot Jupiter'),
          ' no theorist had ordered. The first transit came in 1999, when one of those giants, ',
          'HD 209458 b, was caught dimming its star by about 1.5% right on the wobble’s ',
          'schedule. Then the strategy scaled: NASA’s Kepler telescope stared at one patch of ',
          '150,000 stars for four years, and found planets in such numbers that the count now ',
          'exceeds six thousand, most of them transit discoveries — with rocky worlds between ',
          'Earth’s size and Neptune’s, a kind our own system lacks, the most common find of ',
          'all.',
        ),
        p(
          'Transits have a built-in blind spot: the orbit must be edge-on to us. For a planet ',
          'like Earth around a star like the Sun, that alignment is roughly a 1-in-213 accident. ',
          'Every count is therefore a floor — for each transiting world, a couple of hundred ',
          'siblings hide at other tilts, and correcting for this is how we know the galaxy holds ',
          'more planets than stars.',
        ),
        p(
          'The misconception to retire is that a transit shows a silhouette. Nothing is resolved; ',
          'the star itself is a single point of light. Everything in this module — the planet’s ',
          'size, its orbit, its very existence — is read out of one wiggling number, brightness ',
          'against time. That a dip in a graph can weigh in as discovery of a world is the ',
          'method’s actual magic.',
        ),
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
          ' grows, which is why fitting the full curve — not reading off depth and width — is how ',
          'parameters are actually extracted. ',
          em('Limb darkening'),
          ' rounds the shoulders further: a stellar disc is dimmer at its edge, so this ',
          'module’s trapezoid is the zeroth-order sketch of a subtler profile.',
        ),
        p(
          'The dip also has to earn belief. A background eclipsing binary blended into the same ',
          'pixel fakes a transit convincingly, and early surveys drowned in such impostors — ',
          'Kepler’s candidates outnumber its confirmed planets still. Vetting is statistical ',
          'and multi-instrument: the odd-even depth test (a binary’s alternating eclipses ',
          'differ), the hunt for a secondary dip at half-phase, and mass limits from the wobble ',
          'method. When both methods land on the same object, they compound: the transit gives ',
          'the radius, the wobble gives the mass, and together a ',
          em('density'),
          ' — the single number that says gas giant, water world, or iron-cored rock.',
        ),
        p(
          'The frontier is what happens during the dip itself. A planet with an atmosphere is ',
          'fractionally bigger at wavelengths its gases absorb, so the transit is measurably ',
          'deeper there: the depth’s wavelength-dependence is a chemical assay of air on a ',
          'world no one can see. This is ',
          em('transmission spectroscopy'),
          ', and JWST performs it routinely — its first clear detection of carbon dioxide in an ',
          'exoplanet atmosphere, on the hot giant WASP-39 b in 2022, was a proof that the same ',
          'trick that counts planets can read them. Whether it can read a ',
          em('small'),
          ' one is the open question: the TRAPPIST-1 rocky worlds sit at the edge of ',
          'feasibility, their measurements to date compatible with thin atmospheres or none, and ',
          'the answer bears directly on whether transiting rocky planets are airless by rule or ',
          'by exception.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'kepler-orbits',
          reason:
            'The duration equation imports this module’s third law verbatim — the period under every transit is Kepler’s.',
        },
        {
          moduleId: 'planetary-atmospheres',
          reason:
            'Transmission spectroscopy reads air on invisible worlds — and whether small planets keep any is the shoreline question.',
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

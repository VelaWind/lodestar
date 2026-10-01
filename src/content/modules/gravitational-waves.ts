/**
 * Gravitational waves — the fifth published Lodestar module.
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
import { M_SUN, MEGAPARSEC } from '@/physics/constants';
import { em, figure, m, p, prose, term } from '../rich';
import { logMinThrough, logStep } from '../grid';

/** The distance slider's top, m, and a bottom that puts the default, 408 Mpc, on the grid. */
const D_MAX = 1e26;
const D_MIN = logMinThrough(1.26e25, D_MAX, 400, 310);

const gravitationalWaves: Module = {
  id: 'gravitational-waves',
  title: 'Gravitational Waves',
  tagline: 'Two black holes fall together, and space itself rings.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'In September 2015, a ripple in space itself swept through Earth. For a fifth of a ',
          'second it changed the distance between mirrors four kilometres apart, by far less ',
          'than the width of a single proton. We caught it.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Drop a stone into a still pond and rings spread outward, carrying a little of the ',
          'splash’s energy away across the surface. Now make the stone two black holes, circling ',
          'each other dozens of times a second and climbing, and make the pond space itself. ',
          'Their frantic ',
          'orbit churns the fabric they sit in, and the disturbance spreads out in all directions ',
          'at the speed of light, growing fainter as it goes. By the time it washes over Earth, ',
          'the ripple from even the most violent collision in the universe has thinned to almost ',
          'nothing.',
        ),
        p(
          'As the two holes spiral closer they circle faster, so the ripples come quicker and ',
          'stronger, rising together toward a crescendo — and then stop. That rising sweep is ',
          'called the chirp, and it is what the simulation below draws and plays.',
        ),
        p(
          'The analogy breaks in one deep place: pond ripples are water moving up and down, a ',
          'thing moving ',
          em('through'),
          ' a medium. A gravitational wave has no medium. It is the distances between things that ',
          'ripple; the “pond” is the geometry you are made of, and when the wave passes, you are ',
          'stretched one way and squeezed the other, then the reverse, over and over.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'gravitational-waves',
      caption: prose(
        p(
          'Choose two masses and how far away they collide, then watch the final moments of the ',
          'spiral. The trace rises in frequency and strength together — the chirp — and shows only ',
          'the final octave, the last doubling of pitch, slowed down. The button plays the chirp ',
          'at true speed and at its true frequencies. It starts from 30 Hz (thirty vibrations a ',
          'second), where a detector’s band opens, or from the start of the final octave if that ',
          'is lower. For a pair as light as two neutron stars, the city-sized collapsed cores of ',
          'dead stars, it plays only the last six seconds. For black holes, those frequencies ',
          'happen to sit in the range of human hearing.',
        ),
      ),
      params: [
        {
          id: 'm1',
          friendlyLabel: 'How heavy is the first one? (in Suns)',
          technicalLabel: 'Primary mass',
          symbol: 'm_1',
          unit: 'kg',
          // 1 to 100 M_☉ spans most of what ground-based detectors see: from below
          // a neutron star to black holes as heavy as GW190521's 85 M_☉ primary. A
          // few catalogued components are heavier than the slider reaches.
          min: 1 * M_SUN,
          max: 100 * M_SUN,
          default: 36 * M_SUN, // GW150914's heavier component
          step: 0.01, // decades
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'M☉', factor: 1 / M_SUN },
          },
        },
        {
          id: 'm2',
          friendlyLabel: 'How heavy is the other one? (in Suns)',
          technicalLabel: 'Secondary mass',
          symbol: 'm_2',
          unit: 'kg',
          min: 1 * M_SUN,
          max: 100 * M_SUN,
          default: 29 * M_SUN, // GW150914's lighter component
          step: 0.01,
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'M☉', factor: 1 / M_SUN },
          },
        },
        {
          id: 'd',
          friendlyLabel: 'How far away did it happen? (1 Mpc ≈ 3.26 million light-years)',
          technicalLabel: 'Distance',
          symbol: 'd',
          unit: 'm',
          // About 1e22 m ≈ 0.3 Mpc, inside the Local Group, short of Andromeda
          // (0.77 Mpc); 1e26 m ≈ 3 Gpc, out
          // to where many detected mergers lie (GW190521, among the most distant,
          // was about 5.3 Gpc away). The minimum is nudged
          // 0.4% above 1e22 so the default is step 310 of 400.
          min: D_MIN,
          max: D_MAX,
          default: 1.26e25, // 408 Mpc: GW150914's measured 410 Mpc luminosity distance, rounded
          step: logStep(D_MIN, D_MAX, 400), // decades, about 0.01
          scale: 'log',
          format: {
            notation: 'auto',
            digits: 3,
            displayUnit: { unit: 'Mpc', factor: 1 / MEGAPARSEC },
          },
        },
      ],
      approximations: [
        prose(
          p(
            'Only the leading term of the physics is used. It drifts from the real wave in the last few orbits, when the bodies move at a third of the speed of light.',
          ),
        ),
        prose(
          p(
            'The ',
            term('inspiral', 'inspiral'),
            ' stops once the two bodies are close enough to plunge together. The collision and the ringing that follows are not drawn, though for the default pair most of the energy comes out there.',
          ),
        ),
        prose(
          p(
            'The orbit is a circle and the bodies do not spin. Real pairs have had their orbits rounded off long before we hear them; their spin matters more.',
          ),
        ),
        prose(
          p(
            'The ',
            term('strain', 'strain'),
            ' shown is for the best possible angle, the pair face-on and directly overhead. A typical pair elsewhere on the sky gives about a third of it.',
          ),
        ),
        prose(
          p(
            'Nothing is redshifted: the masses are the pair’s own, and the distance is a simple ',
            term('luminosity distance', 'luminosity-distance'),
            ', the one its brightness implies.',
          ),
        ),
        prose(
          p(
            'The trace shows only the final octave, slowed by the factor shown beside it. At true speed the default pair’s octave lasts under a fifth of a second, and a hundred-to-one pair’s about seven.',
          ),
        ),
        prose(
          p(
            'The sound is a stand-in, not a recording: a tone at the wave’s own frequency and strength. Below about 20 Hz, under human hearing, the pitch is held at 20 Hz.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A ',
          em('gravitational wave'),
          ' is a travelling stretch-and-squeeze of space, predicted by Einstein in 1916 and ',
          'radiated by any mass whose motion is violent and lopsided enough: in practice, pairs ',
          'of compact objects in their final orbits. The wave’s size is expressed as ',
          em('strain'),
          ', ',
          m`h`,
          ': the fractional change in any length it crosses. The strains reaching Earth are ',
          'around ',
          m`10^{-21}`,
          ' — across the four-kilometre arms of a detector, a few ',
          em('thousandths'),
          ' the width of a proton — a distance smaller than anything else humanity has ever ',
          'measured.',
        ),
        p(
          'Measuring that takes an ',
          em('interferometer'),
          ': two perpendicular arms, laser light bouncing between mirrors, arranged so the two ',
          'beams cancel exactly — until a passing wave stretches one arm while squeezing the ',
          'other and light leaks through. LIGO’s two detectors caught the first signal, GW150914, ',
          'on 14 September 2015: the final fifth of a second of two black holes, thirty-six and ',
          'twenty-nine solar masses, that may have spiralled toward each other for billions of ',
          'years. The wave reached Earth from 1.3 billion light-years away.',
        ),
        p(
          'The signal’s signature is the ',
          em('chirp'),
          ' (frequency and amplitude rising together as the orbit shrinks) and remarkably, one ',
          'number controls its shape: the ',
          em('chirp mass'),
          ', a particular blend of the two masses. Read the chirp’s timing and you have weighed ',
          'the system.',
        ),
        p(
          'Two years later came the discovery that opened a second field: GW170817, two neutron ',
          'stars, whose chirp lasted about a hundred seconds in the detectors’ band and ended in ',
          'an explosion telescopes could ',
          'see. Comparing the wave’s arrival with the light’s showed gravitational waves travel ',
          'at the speed of light to exquisite precision.',
        ),
        p(
          'The misconception to head off sits in this module’s own play button: gravitational ',
          'waves are not sound. They cross empty space, where sound cannot; playing the chirp is ',
          'a ',
          em('sonification'),
          ', honest only because the frequencies happen to be audible ones. And unlike a ',
          'telescope, which collects light’s energy (falling as ',
          m`1/d^2`,
          '), a gravitational-wave detector records the wave’s amplitude itself, which falls as ',
          m`1/d`,
          ', with the striking consequence that making a detector twice as sensitive reaches ',
          'twice as far, and so eight times as much universe.',
        ),
        /*
         * Source: https://www.ligo.caltech.edu/image/ligo20160211a — LIGO's own
         * rendering of the GW150914 strain figure (Fig. 1 of Abbott et al.,
         * PRL 116, 061102), three panels: Hanford and Livingston each against
         * the predicted waveform, and the two overlaid after the 6.9 ms shift.
         * Licence, quoted from https://www.ligo.caltech.edu/page/image-use-policy
         * as it reads today: images "may be used for any purpose without prior
         * permission, subject to the special cases noted below", and "the
         * credit line should be 'Courtesy Caltech/MIT/LIGO Laboratory'". The
         * operative restriction is that "the endorsement of any product or
         * service by Caltech, MIT, LIGO, or the National Science Foundation
         * (NSF) must neither be claimed nor implied", which nothing here does.
         * This image's own page notes its credit as "Caltech/MIT/LIGO Lab", so
         * that is the line used, in place of the authored one.
         *
         * An earlier version of this comment had the policy narrower than it
         * is — "journalistic, educational, and personal uses" with commercial
         * use restricted, which is the special case for third-party material
         * rather than the general rule.
         */
        figure({
          src: '/figures/gravitational-waves.webp',
          width: 1024,
          height: 1280,
          alt: 'Three stacked panels of gravitational-wave strain against time; in the lowest, the traces from the two detectors overlaid, oscillating faster and larger over two tenths of a second before settling to a flat line.',
          caption:
            'The first gravitational wave detected: strain (how far space was stretched) against time at the two sites of LIGO, the Laser Interferometer Gravitational-Wave Observatory, on 14 September 2015, the same waveform arriving 6.9 milliseconds apart across the continent. From first tremor to silence the signal lasts a fifth of a second; the sim’s chirp is this curve made audible.',
          credit: 'Caltech/MIT/LIGO Lab',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'chirp-mass',
          tex: '\\mathcal{M}_c \\;=\\; \\dfrac{\\left({{m1}}\\,{{m2}}\\right)^{3/5}}{\\left({{m1}} + {{m2}}\\right)^{1/5}}',
          binds: ['m1', 'm2'],
          note: prose(
            p(
              m`\mathcal{M}_c`,
              ' — chirp mass, the one combination of the masses the chirp’s timing measures; ',
              m`m_1`,
              ', ',
              m`m_2`,
              ' — the two masses (your sliders). Equal masses give ',
              m`\mathcal{M}_c \approx 0.87\,m`,
              '; the blend is weighted toward the lighter partner.',
            ),
          ),
        },
        {
          id: 'strain',
          tex: 'h \\;=\\; \\dfrac{4}{{{d}}}\\left(\\dfrac{G\\mathcal{M}_c}{c^{2}}\\right)^{5/3}\\left(\\dfrac{\\pi f}{c}\\right)^{2/3}',
          binds: ['m1', 'm2', 'd'],
          note: prose(
            p(
              m`h`,
              ' — strain, the fractional stretch (dimensionless); ',
              m`d`,
              ' — distance to the source (your slider); ',
              m`f`,
              ' — the wave’s frequency; ',
              m`G`,
              ', ',
              m`c`,
              ' — the usual constants. ',
              m`\mathcal{M}_c`,
              ' enters from equation 1, so both mass sliders reach this equation through it. Note ',
              'the first factor: amplitude falls as ',
              m`1/d`,
              ' alone.',
            ),
            p(
              'Worked example (defaults — GW150914): ',
              m`m_1`,
              ' = 36 and ',
              m`m_2`,
              ' = 29 solar masses give ',
              m`\mathcal{M}_c`,
              ' = 28.1 solar masses. At the model’s ',
              term('cutoff frequency', 'cutoff-frequency'),
              ', 68 Hz, and the default 408 ',
              term('megaparsecs', 'megaparsec'),
              ' (GW150914’s measured 410, rounded), an optimally oriented source gives ',
              m`h`,
              ' = 1.3 × 10⁻²¹ — which over a four-kilometre arm is a length change of 5 × 10⁻¹⁸ m, ',
              'about one three-hundredth the width of a proton. Slide both masses down to 1.4 — a ',
              'neutron-star pair — and the chirp from 30 Hz to merger stretches from under a third ',
              'of a second to nearly a minute.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Why ',
          term('quadrupole', 'quadrupole'),
          ' radiation and nothing simpler? Conservation laws forbid the ',
          'alternatives. Monopole radiation would require the total mass-energy to oscillate; it ',
          'is conserved. Dipole radiation would require the mass dipole’s second derivative (the ',
          'centre of mass) to accelerate; momentum conservation forbids it. The leading ',
          'radiative term is therefore the mass ',
          em('quadrupole'),
          ': the strain goes with its second time derivative and the radiated power with the ',
          'square of its third, which is why gravitational radiation is so faint and why only violently asymmetric ',
          'motion emits usefully: a perfectly spherical collapse, however cataclysmic, radiates ',
          'nothing.',
        ),
        p(
          'The chirp mass is both the model’s power and its confession. To leading order the ',
          'waveform’s phase evolution depends on ',
          m`m_1`,
          ' and ',
          m`m_2`,
          ' ',
          em('only'),
          ' through ',
          m`\mathcal{M}_c`,
          ': a 36 + 29 binary and a very different pair with the same chirp mass trace nearly ',
          'identical chirps. The degeneracy breaks only at higher ',
          term('post-Newtonian', 'post-newtonian'),
          ' orders, where ',
          'the mass ratio enters; that is how full analyses recover both masses, and why their ',
          'individual error bars are always wider than the chirp mass’s. The Newtonian quadrupole ',
          'model here fails in the same regime: it treats the orbit as Kepler’s, and by the last ',
          'orbits (speeds past a third of light) the post-Newtonian corrections it drops are no ',
          'longer corrections. The sim’s cutoff at the innermost stable orbit is where even that ',
          'expansion gives way to numerical relativity, which is how the ',
          term('merger', 'merger'),
          ' and ',
          term('ringdown', 'ringdown'),
          ' ',
          'beyond the cutoff are actually computed.',
        ),
        p(
          'The simulation’s shortcuts, in full. The waveform is the Newtonian quadrupole; real ',
          'searches match templates carrying corrections to 3.5 post-Newtonian order and beyond, ',
          'because the phase has to stay right for hundreds of cycles. The cutoff is the ',
          'Schwarzschild ISCO of the combined mass, a conventional marker rather than a derived ',
          'boundary for a two-body system: GW150914 crosses it near 68 Hz, while the real signal ',
          'ran on to about 250 Hz. Gravitational radiation circularises an eccentric orbit long ',
          'before it reaches a detector’s band, but spin shifts both the cutoff and the phase, ',
          'and measuring it is part of what a detection is for. The amplitude is for an optimally ',
          'oriented source; averaged over sky position and orientation, the root-mean-square ',
          'detected amplitude is 2/5 of it (the plain mean, 0.35). A detector records ',
          m`F_+h_+ + F_\times h_\times`,
          ', its antenna pattern and the orbit’s inclination setting how much of each ',
          'polarisation gets through. Nothing is redshifted: a signal from 410 Mpc arrives with ',
          'every frequency lowered by ',
          m`(1+z) \approx 1.09`,
          ', so GW150914’s detector-frame chirp mass is about 30.5 ',
          m`M_\odot`,
          ' against a source-frame 28.1. The final octave holds about 7.7 cycles for a near-equal ',
          'pair and nearly 200 at a hundred to one, and lasts from 7 ms for two neutron stars to ',
          'about seven seconds at a hundred to one.',
        ),
        p(
          'The waves were believed in long before they were caught. The Hulse–Taylor binary ',
          'pulsar, found in 1974, is a natural clock in a decaying orbit, and four decades of ',
          'timing show the decay tracking the energy gravitational waves should carry off to ',
          'within 0.2 percent. That was the indirect proof. The 1993 Nobel prize went to the ',
          'pulsar’s discovery, which opened that test; LIGO’s direct detection came twenty-two ',
          'years later.',
        ),
        p(
          'What the field is becoming is an instrument. A chirp’s amplitude and its timing ',
          'together yield the source’s absolute distance with no rung borrowed from the ',
          'astronomical distance ladder: a ',
          em('standard siren'),
          '. GW170817, with its optical counterpart pinning the host galaxy, gave an independent ',
          'measurement of the universe’s expansion rate; with enough such events, sirens could ',
          'arbitrate the current tension between competing expansion-rate measurements. And the ',
          'band is widening at both ends: ',
          term('pulsar timing arrays', 'pulsar-timing-array'),
          ' reported evidence in 2023 of a ',
          'nanohertz background (plausibly the murmur of supermassive pairs across cosmic ',
          'history) while the space interferometer LISA is being built for the millihertz ',
          'decades between, where a million-solar-mass merger rings for hours instead of ',
          'milliseconds.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'black-holes',
          reason:
            'The objects doing the colliding — and where the energy of three Suns went in a fifth of a second.',
        },
        {
          moduleId: 'kepler-orbits',
          reason:
            'The inspiral is Kepler’s clockwork right up until it isn’t: the wave’s frequency is set by the orbit’s, doubled.',
        },
        {
          moduleId: 'cosmic-distance-ladder',
          reason:
            'Standard sirens measure distance with no ladder at all; every other cosmic distance borrows a rung from somewhere.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'Abbott et al. 2016, “Observation of Gravitational Waves from a Binary Black Hole Merger”, PRL 116, 061102',
      url: 'https://doi.org/10.1103/PhysRevLett.116.061102',
      note: 'GW150914 throughout',
    },
    {
      label:
        'Abbott et al. 2017, “GW170817: Observation of Gravitational Waves from a Binary Neutron Star Inspiral”, PRL 119, 161101',
      url: 'https://doi.org/10.1103/PhysRevLett.119.161101',
      note: 'The neutron-star event in layers 4 and 6',
    },
    {
      label:
        'Abbott et al. 2017, “Gravitational Waves and Gamma-Rays from a Binary Neutron Star Merger: GW170817 and GRB 170817A”, ApJL 848, L13',
      url: 'https://doi.org/10.3847/2041-8213/aa920c',
      note: 'Speed-of-gravity constraint',
    },
    {
      label: 'Weisberg & Huang 2016, “Relativistic Measurements from Timing the Binary Pulsar PSR B1913+16”, ApJ 829, 55',
      url: 'https://doi.org/10.3847/0004-637X/829/1/55',
      note: 'Hulse–Taylor orbital decay in layer 6: 0.9983 ± 0.0016 of the prediction',
    },
    {
      label:
        'Agazie et al. (NANOGrav) 2023, “Evidence for a Gravitational-wave Background”, ApJL 951, L8',
      url: 'https://doi.org/10.3847/2041-8213/acdac6',
      note: 'The nanohertz background in layer 6',
    },
  ],
};

export default gravitationalWaves;

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
import { M_SUN, PARSEC } from '@/physics/constants';
import { em, m, p, prose, term } from '../rich';

/** Megaparsec in metres — the natural unit for a source at this distance. */
const MEGAPARSEC = 1e6 * PARSEC;

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
          'momentarily, very slightly, taller and thinner.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'gravitational-waves',
      caption: prose(
        p(
          'Choose two masses and how far away they collide, then watch the final moments of the ',
          'spiral. The trace rises in frequency and strength together — the chirp — and the ',
          'button plays it at its true frequencies, which for black holes sit, by coincidence, in ',
          'the range of human hearing.',
        ),
      ),
      params: [
        {
          id: 'm1',
          friendlyLabel: 'How heavy is the first one?',
          technicalLabel: 'Primary mass',
          symbol: 'm_1',
          unit: 'kg',
          // 1 to 100 M_☉ spans the range ground-based detectors work in: from
          // below a neutron star to the heaviest binary black holes catalogued.
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
          friendlyLabel: 'How heavy is the other one?',
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
          friendlyLabel: 'How far away did it happen?',
          technicalLabel: 'Distance',
          symbol: 'd',
          unit: 'm',
          // 1e22 m ≈ 0.3 Mpc, just past the Andromeda galaxy; 1e26 m ≈ 3 Gpc,
          // beyond the most distant merger detected so far.
          min: 1e22,
          max: 1e26,
          default: 1.26e25, // ≈410 Mpc, GW150914's luminosity distance
          step: 0.01,
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
            'Newtonian ',
            term('quadrupole', 'quadrupole'),
            ' only: the leading-order waveform, with no ',
            term('post-Newtonian', 'post-newtonian'),
            ' corrections. The error grows as the bodies speed up, which is exactly where the signal is loudest: by the last few cycles the orbital velocity is a third of the speed of light and the leading-order phase has drifted measurably from the real one. Real searches match against waveforms carrying corrections to 3.5 post-Newtonian order and beyond, precisely because the phase has to stay right for hundreds of cycles.',
          ),
        ),
        prose(
          p(
            'The waveform stops at the innermost stable circular orbit and there is no ',
            term('merger', 'merger'),
            ' or ',
            term('ringdown', 'ringdown'),
            '. Everything after that cutoff is numerical relativity rather than algebra: the two bodies plunge together, merge, and the remnant rings down, radiating past the ',
            term('cutoff frequency', 'cutoff-frequency'),
            ' at amplitudes larger than anything the ',
            term('inspiral', 'inspiral'),
            ' formula predicts. GW150914 crosses this model’s cutoff around 68 Hz; the real signal ran on to about 250 Hz, and most of its energy came out after this trace ends. The cutoff itself uses the Schwarzschild ISCO of the combined mass, which is a conventional marker rather than a derived boundary for a two-body system.',
          ),
        ),
        prose(
          p(
            'The orbit is circular, and the bodies are point masses with no spin. Circularity is the mildest assumption here: gravitational radiation itself circularises an eccentric orbit long before it reaches a detector’s band, so it is good late in the inspiral and poor early. Spin is not so mild: it shifts both the cutoff and the phase, and measuring it is one of the things a real detection is for.',
          ),
        ),
        prose(
          p(
            'The amplitude is averaged over sky position and orientation. A real detector measures F₊h₊ + F×h×: what gets through depends on where the source sits in the antenna pattern and how the orbital plane is tilted to the line of sight, varying the ',
            term('strain', 'strain'),
            ' by a factor of a few either way. The readout is an order-of-magnitude figure, not a prediction of what a particular instrument would record.',
          ),
        ),
        prose(
          p(
            'Nothing here is redshifted. The masses are source-frame and the distance is treated as a simple ',
            term('luminosity distance', 'luminosity-distance'),
            '; a real signal from 410 ',
            term('Mpc', 'megaparsec'),
            ' arrives with every frequency lowered by (1+z) ≈ 1.09, which is why the mass a detector measures directly — the redshifted, detector-frame chirp mass — is about 30.5 M_☉ for GW150914 while the source-frame value is 28.1.',
          ),
        ),
        prose(
          p(
            'The trace covers the final octave of frequency, and it is played slowly. Choosing an octave rather than a fixed duration keeps the picture honest across the slider’s range (every binary shows the same 7.7 cycles) but the durations differ enormously: 175 ms for the default pair, 7 ms for two neutron stars. Playback is slowed by the factor shown beside it, because at true speed the whole trace would flick past in under a fifth of a second.',
          ),
        ),
        prose(
          p(
            'The sound is a sonification, not a recording. A gravitational wave is a stretching of space, not a pressure wave, and there is nothing to hear where it comes from; the tone is an oscillator driven at the wave’s own frequency and amplitude. The frequencies are true and unshifted (which is possible only because a stellar-mass inspiral happens to sweep through the range human hearing covers) and where the true band falls below about 20 Hz the pitch is held there rather than transposed.',
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
          'twenty-nine solar masses, that had spiralled toward each other for the better part of ',
          'the universe’s age. The wave reached Earth from 1.3 billion light-years away.',
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
          'stars, whose chirp lasted nearly a minute and ended in an explosion telescopes could ',
          'see. Comparing the wave’s arrival with the light’s showed gravitational waves travel ',
          'at the speed of light to exquisite precision.',
        ),
        p(
          'The misconception to head off sits in this module’s own play button: gravitational ',
          'waves are not sound. They cross empty space, where sound cannot; playing the chirp is ',
          'a ',
          em('sonification'),
          ', honest only because the frequencies happen to be audible ones. And unlike sound or ',
          'light from a bulb, what falls off with distance is the wave’s amplitude, as ',
          m`1/d`,
          ' rather than ',
          m`1/d^2`,
          ', with the striking consequence that making a detector twice as sensitive reaches ',
          'twice as far, and so eight times as much universe.',
        ),
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
              ' = 28.1 solar masses. At the model’s cutoff frequency, 68 Hz, and 408 megaparsecs, ',
              m`h`,
              ' = 1.3 × 10⁻²¹ — which over a four-kilometre arm is a length change of 5 × 10⁻¹⁸ m, ',
              'about one three-hundredth the width of a proton. Slide both masses down to 1.4 — a ',
              'neutron-star pair — and the chirp stretches from a fifth of a second to nearly a ',
              'minute.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Why quadrupole radiation and nothing simpler? Conservation laws forbid the ',
          'alternatives. Monopole radiation would require the total mass-energy to oscillate; it ',
          'is conserved. Dipole radiation would require the mass dipole’s second derivative (the ',
          'centre of mass) to accelerate; momentum conservation forbids it. The leading ',
          'radiative term is therefore the third derivative of the mass ',
          em('quadrupole'),
          ', which is why gravitational radiation is so faint and why only violently asymmetric ',
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
          'identical chirps. The degeneracy breaks only at higher post-Newtonian orders, where ',
          'the mass ratio enters; that is how full analyses recover both masses, and why their ',
          'individual error bars are always wider than the chirp mass’s. The Newtonian quadrupole ',
          'model here fails in the same regime: it treats the orbit as Kepler’s, and by the last ',
          'orbits (speeds past a third of light) the post-Newtonian corrections it drops are no ',
          'longer corrections. The sim’s cutoff at the innermost stable orbit is where even that ',
          'expansion gives way to numerical relativity, which is how the merger and ringdown ',
          'beyond the cutoff are actually computed.',
        ),
        p(
          'The waves were believed in long before they were caught. The Hulse–Taylor binary ',
          'pulsar, found in 1974, is a natural clock in a decaying orbit, and four decades of ',
          'timing show the decay tracking the energy gravitational waves should carry off to ',
          'better than a percent. That was the indirect proof, and a Nobel prize, twenty years ',
          'before LIGO’s direct one.',
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
      label: 'Weisberg & Taylor 2005, “The Relativistic Binary Pulsar B1913+16”, ASP Conf. 328',
      url: 'https://arxiv.org/abs/astro-ph/0407149',
      note: 'Hulse–Taylor orbital decay in layer 6',
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

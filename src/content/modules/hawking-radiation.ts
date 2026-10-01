/**
 * Hawking radiation — the seventeenth published Lodestar module, and the second
 * of the relativity batch.
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
import { figure, m, p, prose, term } from '../rich';

const hawkingRadiation: Module = {
  id: 'hawking-radiation',
  title: 'Hawking Radiation',
  tagline: 'Black holes are not quite black. The small ones glow, shrink, and end in a flash.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'A black hole with the mass of a mountain would be about the size of a proton, a hundred ',
          'billion degrees hot, and slowly boiling away. None has ever been found, but nothing rules ',
          'out a few.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture a bucket with a hole in the bottom, but a strange hole: the less water there is in ',
          'the bucket, the wider the hole gets. A full bucket barely drips. As it empties, the drip ',
          'becomes a trickle, the trickle a stream, and the last of the water rushes out all at once.',
        ),
        p(
          'A black hole leaks like that bucket. For a black hole the size of a star, the leak is so ',
          'slow that it is nothing at all; it takes in more from the faint warmth of space than it ',
          'lets out. But the smaller a black hole is, the faster it leaks, and as it leaks it gets ',
          'smaller, so it leaks faster still. A black hole light enough will leak itself away ',
          'completely, finishing in a final burst.',
        ),
        p(
          'What leaks out is a faint glow of light and particles, like the glow of a warm object, and ',
          'the smaller the hole, the hotter the glow.',
        ),
        p(
          'Where the analogy breaks: water leaks out of a bucket from inside it, but nothing comes out ',
          'of a black hole from inside. The glow is made just outside the edge, from the energy of the ',
          'hole’s own gravity, and that is how the hole loses mass without anything ever escaping it.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'hawking-radiation',
      caption: prose(
        p(
          'Make the black hole lighter and heavier and watch its glow heat up and cool down. Find the ',
          'mass where it goes from shrinking to growing, and then the mass that would be ending its ',
          'life right about now.',
        ),
      ),
      params: [
        {
          id: 'M',
          friendlyLabel: 'How heavy is the black hole?',
          technicalLabel: 'Mass',
          symbol: 'M',
          unit: 'kg',
          // A hundred tonnes to five Suns. Default: a trillion kilograms, a mountain's mass in a proton's size.
          min: 1e5,
          max: 1e31,
          default: 1e12,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'kg', factor: 1 } },
        },
      ],
      approximations: [
        prose(
          p(
            'Power and lifetime count light only, so a real hole evaporates faster than shown: nearly twice as fast for one as heavy as the Sun (see Going deeper).',
          ),
        ),
        prose(
          p(
            'Lighter than about 10²¹ kg, a hole gives off neutrinos as well, and from about 2 × 10²⁰ kg down it evaporates about fourteen times as fast, more once heavier particles join in.',
          ),
        ),
        prose(
          p(
            'So the hole finishing its evaporation today started near 5 × 10¹¹ kg, not the 1.7 × 10¹¹ the sim gives.',
          ),
        ),
        prose(
          p(
            'Each kind of particle switches on sharply here, once the hole is hot enough to make it. Really, each turns on gradually.',
          ),
        ),
        prose(
          p(
            'The hole does not spin, carries no charge and sits alone. A real one also swallows whatever falls in, starting with the faint glow left over from the Big Bang, which is why the heavy ones are growing.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'In 1974 Stephen Hawking combined quantum theory with general relativity and found that a ',
          'black hole should glow: it emits ',
          term('Hawking radiation'),
          ', a thermal spectrum at the ',
          term('Hawking temperature'),
          ', which is inversely proportional to the hole’s mass. For a black hole with the Sun’s mass ',
          'that temperature is sixty billionths of a kelvin. Every black hole ever observed is heavier ',
          'than that, and therefore colder than the ',
          term('cosmic microwave background'),
          ', the 2.7 K glow that fills space; so every known black hole absorbs more than it emits, and ',
          'grows. The crossover, a hole exactly as warm as the background, is at 4.5 × 10²² kg, about ',
          'three-fifths of the Moon’s mass, squeezed into a sphere a tenth of a millimetre across.',
        ),
        p(
          'Lighter holes are hotter than their surroundings and shrink, and because a black hole has ',
          term('negative heat capacity'),
          ', getting hotter as it loses energy, the shrinking runs away. The time to evaporate grows as ',
          'the cube of the mass: counting light only, the Sun’s mass would take about 10⁶⁷ years and ',
          'a mountain’s a few trillion years, and a hole of about 5 × 10¹¹ kg, counting every ',
          'particle it can emit, would ',
          'be finishing just now, 13.8 billion years after the Big Bang. At that mass it is smaller than ',
          'an atomic nucleus. In its last second it releases the energy of millions of megatons, mostly ',
          'as gamma rays and particles.',
        ),
        p(
          'No star can make a black hole that light; collapsing stars make holes of a few Suns or more. ',
          'The only candidates are ',
          term('primordial black holes', 'primordial-black-hole'),
          ', which might have formed in the first fraction of a second if some regions of the young ',
          'universe were dense enough to collapse directly. Yakov Zel’dovich and Igor Novikov proposed ',
          'them in 1966 and Hawking in 1971, before he found they would glow. None has been seen. ',
          'Gamma-ray telescopes, including NASA’s Fermi, have searched for the final bursts of ',
          'evaporating ones and the background glow the rest would add up to, and found nothing, which ',
          'limits them to a small share of the universe’s matter at the masses that should be ',
          'evaporating now. Heavier primordial holes remain a candidate, among many, for dark matter.',
        ),
        p(
          'Hawking radiation itself has never been detected from any black hole; for the ones we know ',
          'of it is far too faint ever to detect. What has been seen is its analogue. In ',
          term('analogue gravity'),
          ', a flowing fluid can contain a point beyond which sound cannot travel upstream, a horizon ',
          'for sound; in 2016 Jeff Steinhauer’s group measured entangled Hawking-like pairs of sound ',
          'waves at such a horizon in an ultracold gas of atoms, and in 2019 showed that their ',
          'spectrum is thermal, at the predicted temperature.',
        ),
        p(
          'Two misconceptions. The popular picture of particle pairs popping up at the horizon, one ',
          'falling in and one escaping, is a heuristic Hawking himself offered, not the calculation; ',
          'the radiation is better thought of as coming from the whole region just outside the ',
          'horizon. And a black hole does not evaporate because something escapes from inside it. ',
          'Nothing does. The mass it loses is the energy of the curved space around it.',
        ),
        /*
         * Source: https://svs.gsfc.nasa.gov/14090/ ("Fermi's 12-year View of the
         * Gamma-ray Sky", NASA Scientific Visualization Studio, released 12
         * February 2022). The page describes the image: "This all-sky view shows
         * how the sky appears at energies greater than 1 billion electron volts
         * (GeV) according to 12 years of data from NASA's Fermi Gamma-ray Space
         * Telescope", and credits the file "Credit: NASA/DOE/Fermi LAT
         * Collaboration"; NASA Science's copy of the same image
         * (https://science.nasa.gov/image-detail/fermi-144-month-fermi-all-sky-hammer-4000x2000/)
         * carries the same credit. Taken from
         * Fermi_144-month_Fermi_all-sky_hammer_2160x1080.png, converted to
         * 1280 px wide webp.
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
         * image's own.
         */
        figure({
          src: '/figures/hawking-radiation.webp',
          width: 1280,
          height: 640,
          alt: 'An oval map of the whole sky on a black background, mostly deep blue speckled with hundreds of small orange and yellow dots, with a bright band of red, orange and yellow running straight across the middle and brightest at the centre.',
          caption:
            'The whole sky in gamma rays, the most energetic kind of light, as seen by NASA’s Fermi telescope. An evaporating black hole ending its life anywhere nearby would flash in this light. None has been seen.',
          credit: 'NASA/DOE/Fermi LAT Collaboration',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'temperature',
          tex: 'T_H \\;=\\; \\dfrac{\\hbar c^{3}}{8\\pi G\\,{{M}}\\,k}',
          binds: ['M'],
          note: prose(
            p(
              m`T_H`,
              ' — the Hawking temperature; ',
              m`M`,
              ' — the black hole’s mass (your slider); ',
              m`\hbar`,
              ' — the reduced Planck constant; ',
              m`k`,
              ' — Boltzmann’s constant. Halve the mass and the temperature doubles.',
            ),
          ),
        },
        {
          id: 'power',
          tex: 'P \\;=\\; \\dfrac{\\hbar c^{6}}{15\\,360\\,\\pi G^{2}\\,{{M}}^{2}}',
          binds: ['M'],
          note: prose(
            p(
              m`P`,
              ' — the power the hole radiates as light. Smaller holes are hotter and radiate more, ',
              'though they have less surface.',
            ),
          ),
        },
        {
          id: 'lifetime',
          tex: 't \\;=\\; \\dfrac{5\\,120\\,\\pi G^{2}\\,{{M}}^{3}}{\\hbar c^{4}}',
          binds: ['M'],
          note: prose(
            p(
              m`t`,
              ' — the time to evaporate completely, left alone, counting light only. Twice the mass ',
              'lives eight times as long.',
            ),
            p('Worked example, a mountain’s mass: ', m`M = 10^{12}\,\text{kg}`, '.'),
            p(
              'Size: ',
              m`r_s = 2GM/c^2 = 2 \times 6.674 \times 10^{-11} \times 10^{12} / (2.998 \times 10^{8})^2 = 1.49 \times 10^{-15}\,\text{m}`,
              ', about the size of a proton.',
            ),
            p(
              'Temperature: ',
              m`T_H = 6.17 \times 10^{-8}\,\text{K} \times (1.989 \times 10^{30} / 10^{12}) = 1.23 \times 10^{11}\,\text{K}`,
              ', so ',
              m`kT`,
              ' is about 10.6 MeV: hot enough to emit electrons and positrons.',
            ),
            p(
              'Power: ',
              m`P = 3.6 \times 10^{8}\,\text{W}`,
              ' in light, about a third of a large power station.',
            ),
            p(
              'Lifetime: ',
              m`t = 8.4 \times 10^{19}\,\text{s}`,
              ' = 2.7 trillion years, two hundred times the present age of the universe.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'Hawking’s derivation treats matter fields quantum mechanically on the classical geometry of ',
          'a collapsing star. The vacuum state defined by observers before the collapse is not the ',
          'vacuum for observers far away afterwards; the Bogoliubov transformation between the two, ',
          'dominated by modes that were exponentially redshifted climbing out from near the forming ',
          'horizon, yields a thermal flux at ',
          m`T_H = \hbar\kappa/(2\pi c k)`,
          ', where ',
          m`\kappa = c^4/(4GM)`,
          ' is the surface gravity. The spectrum is Planckian at the horizon and modified by greybody ',
          'factors, the transmission through the potential barrier around the hole, which suppress ',
          'low-frequency emission and differ by spin, so that a non-rotating hole emits, per unit ',
          'energy, most in neutrinos, then photons, then gravitons (Page 1976). The photons-only ',
          'coefficients used in the sim are an order-of-magnitude account. Page’s full calculation, ',
          'with the two massless neutrino flavours then known, gives a power about ten times ',
          'larger; counting the three flavours now known, as Bambeck and Hiscock (2005) do, it is ',
          'about fourteen, and about twenty-five if neutrinos are Dirac particles, with twice as ',
          'many states. Neutrinos have mass, so they switch on only where ',
          m`kT`,
          ' exceeds it: the second-lightest from about 1.2 × 10²¹ kg down, the heaviest below ',
          'about 2 × 10²⁰ kg. A hole too cold for any of them, near a solar mass, gains a factor of ',
          'only about 1.8 from gravitons and the exact emission factors, and since the lightest ',
          'neutrino’s mass is unknown, even that is a floor. Heavier species shorten the lifetime ',
          'further once ',
          m`kT`,
          ' passes their rest energies; each species turns on over a few times that ',
          'temperature, not at the sharp threshold the sim’s emission bands draw.',
        ),
        p(
          'The thermodynamics is exact in form. The Bekenstein–Hawking entropy, ',
          m`S = kA/(4\ell_P^2)`,
          ', a quarter of the horizon area in Planck units, together with ',
          m`T_H`,
          ' satisfies the first law ',
          m`dM\,c^2 = T\,dS`,
          ', and the generalised second law holds when the hole’s entropy is added to that outside. ',
          'For the Sun’s mass, ',
          m`S/k`,
          ' is about 10⁷⁷, more than all the other entropy in the Sun by twenty orders of magnitude. ',
          'The negative heat capacity follows from ',
          m`T \propto 1/M`,
          ': a hole in a box of radiation is in unstable equilibrium, and a hole in the real universe, ',
          'colder than the microwave background, grows until the universe cools below it, at which ',
          'point the ',
          'evaporation clock begins.',
        ),
        p(
          'Evaporation reopened the question of what happens to information. A thermal spectrum ',
          'carries none of the details of what formed the hole, so complete evaporation would turn a ',
          'pure quantum state into a mixed one, which unitary quantum mechanics does not allow. The ',
          'black-holes module describes where that stands: the Page curve, the expected rise and fall ',
          'of the radiation’s entanglement entropy, has been recovered from semiclassical gravity ',
          'since 2019 through quantum extremal surfaces and replica wormholes, without agreement on ',
          'how the information is carried. The final stage, when the hole approaches the Planck mass ',
          'and semiclassical physics fails, is not described by any accepted theory; remnants, a final ',
          'explosion, and a transition to a white hole have all been proposed.',
        ),
        p(
          // "primordial black hole" is marked once per module, in layer 4 (tests/content.test.ts).
          'Observationally, the limits on primordial black hole abundance around 5 × 10¹¹ kg come from ',
          'the extragalactic gamma-ray background and from the ',
          'non-detection of bursts by very-high-energy gamma-ray observatories such as HAWC and ',
          'H.E.S.S.; holes of about 10⁶–10¹⁰ kg, evaporating after nucleosynthesis, are constrained ',
          'by light-element abundances, and those of 10¹⁰–10¹¹ kg by their imprint on the microwave ',
          'background. Between about 10¹⁴ and 10²⁰ kg, ',
          'microlensing and other limits leave a window where primordial holes could still be all of ',
          'the dark matter, provided some early-universe mechanism, perhaps during or after ',
          term('inflation'),
          ', made them. The analogue experiments test the kinematics of horizons, not quantum gravity: ',
          'they confirm that a horizon in any medium produces thermal emission at a temperature set by ',
          'its surface gravity, which is Hawking’s result stripped of everything specific to gravity.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'black-holes',
          reason:
            'That module’s slider stops where this one’s story is still asleep: every hole on it is colder than the background and growing.',
        },
        {
          moduleId: 'cosmic-microwave-background',
          reason:
            'The background’s 2.7 K is the line every black hole is compared against here; it decides whether a hole shrinks or grows.',
        },
        {
          moduleId: 'early-universe',
          reason:
            'If primordial black holes exist, they formed in the first fraction of a second that module walks through.',
        },
        {
          moduleId: 'time-dilation',
          reason:
            'A clock near the horizon runs slow; the Hawking glow is light that has climbed out of that same slowed region, redshifted on the way.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Hawking 1975, “Particle creation by black holes”, Commun. Math. Phys. 43, 199',
      url: 'https://doi.org/10.1007/BF02345020',
      note: 'The derivation of the prediction announced in Nature in 1974',
    },
    {
      label:
        'Page 1976, “Particle emission rates from a black hole: Massless particles from an uncharged, nonrotating hole”, Phys. Rev. D 13, 198',
      url: 'https://doi.org/10.1103/PhysRevD.13.198',
      note: 'Emission by species, greybody factors and lifetimes',
    },
    {
      label: 'Carr, Kohri, Sendouda & Yokoyama 2021, “Constraints on primordial black holes”, Rep. Prog. Phys. 84, 116902',
      url: 'https://doi.org/10.1088/1361-6633/ac1e31',
      note: 'Evaporation limits and the dark-matter window',
    },
    {
      label:
        'Bambeck & Hiscock 2005, “Effects of nonzero neutrino masses on black hole evaporation”, Class. Quantum Grav. 22, 4247',
      url: 'https://doi.org/10.1088/0264-9381/22/20/006',
      note: 'Page’s coefficients recounted for three neutrino flavours, and the neutrino-mass thresholds',
    },
    {
      label:
        'Muñoz de Nova, Golubkov, Kolobov & Steinhauer 2019, “Observation of thermal Hawking radiation and its temperature in an analogue black hole”, Nature 569, 688',
      url: 'https://doi.org/10.1038/s41586-019-1241-0',
      note: 'The analogue spectrum is thermal, at the predicted temperature',
    },
  ],
};

export default hawkingRadiation;

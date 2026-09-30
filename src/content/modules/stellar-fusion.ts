/**
 * Why the Sun shines — the eleventh published Lodestar module.
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
import { RHO_SUN_CORE, T_SUN_CORE } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const stellarFusion: Module = {
  id: 'stellar-fusion',
  title: 'Why the Sun Shines',
  tagline:
    'The Sun is not hot enough for its protons to touch. They fuse anyway, and the reason is quantum.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'By the physics of everyday objects, the Sun is not hot enough to shine: its protons ',
          'should never get close enough to fuse. They do anyway, because the very small plays by ',
          'different rules.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Throw a ball at a hill. If it does not have the speed to reach the top, it rolls back, ',
          'every time; no amount of throwing changes that. Now suppose the ball is not a ball but ',
          'a puff of mist. Most of it rolls back too. But a wisp drifts through the hill and comes ',
          'out the far side, as if the hill had not been there.',
        ),
        p(
          'A proton is more mist than ball. Two protons repel each other, and that repulsion is ',
          'the hill: the closer they get, the steeper it becomes, and the top is hundreds of times ',
          'higher than the energy a proton in the Sun’s core typically has. Thrown as balls, they ',
          'would never meet. As mist, a tiny wisp of each one is already on the far side, and once ',
          'there they stick, and release energy. The wisp is extraordinarily small. But the Sun’s ',
          'core holds more protons than there are grains of sand on every beach, many times over, ',
          'and they collide constantly, so even a wisp is enough to light a star.',
        ),
        p(
          'Where the analogy breaks: mist gets through a hill because the hill is porous; there is ',
          'nothing in the proton’s hill that lets it through. And the proton does not take a path ',
          'through the barrier. Ask where it is, and until it is measured the answer is not a ',
          'single place. “Past the barrier” is one of the places, and sometimes that is where it ',
          'is found.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'stellar-fusion',
      caption: prose(
        p(
          'Heat the core and watch the small window where fusion happens slide to higher energies ',
          'and open wider. Then look below at how much barrier the protons cross without ever ',
          'having the energy to climb it.',
        ),
      ),
      params: [
        {
          id: 'T',
          friendlyLabel: 'How hot is the core?',
          technicalLabel: 'Core temperature',
          symbol: 'T',
          unit: 'K',
          // 1 million K, below any star's core, to 100 million K, helium burning.
          // Default: the Sun's centre. Two decades exactly, so a 0.01-decade step
          // reaches the maximum; the template's shrunk-step trick is not needed.
          min: 1e6,
          max: 1e8,
          default: T_SUN_CORE,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'million K', factor: 1e-6 } },
        },
        {
          id: 'rho',
          friendlyLabel: 'How dense is the core?',
          technicalLabel: 'Core density',
          symbol: '\\rho',
          unit: 'kg/m^3',
          // Water to a thousand times the Sun's centre. Default: 150 g/cm³. Three
          // decades exactly; the maximum is reachable with a 0.01-decade step.
          min: 1e3,
          max: 1e6,
          default: RHO_SUN_CORE,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'g/cm³', factor: 1e-3 } },
        },
      ],
      approximations: [
        prose(
          p(
            'Only the first step of the proton–proton chain is computed, with the hydrogen fraction fixed at the Sun’s central value of 0.34. The temperature and density sliders scale that one rate. The upper panel scales each curve to its own maximum, so heights compare shapes, not amounts.',
          ),
        ),
        prose(
          p(
            'The barrier is bare electrical repulsion down to 1.4 fm and a sharp well inside. Screening by the surrounding electrons, which raises the real rate by a few percent, is left out.',
          ),
        ),
        prose(
          p(
            'The rate formula is the standard fit around solar conditions. Below about 3 million K it overstates the true rate, and above about 17 million K a different chain, the CNO cycle, takes over and is not shown.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'Two protons repel each other electrically, and the ',
          term('Coulomb barrier', 'coulomb-barrier'),
          ' between them, the energy needed to bring them close enough to touch, is about 1 MeV: ',
          'a million electronvolts, where one electronvolt is the energy an electron gains ',
          'crossing one volt, and a keV is a thousand of them. The typical energy of a proton in ',
          'the Sun’s core is ',
          m`kT`,
          ', where ',
          m`T`,
          ' is the temperature, 15.7 million K, and ',
          m`k`,
          ' is Boltzmann’s constant: about 1.35 keV, more than seven hundred times too little. ',
          'Even the fastest protons in the core fall far short. By the rules of classical physics ',
          'the Sun cannot fuse anything.',
        ),
        p(
          'It does because of ',
          term('quantum tunnelling'),
          '. A proton is described by a wave, and a wave hitting a barrier does not stop dead; it ',
          'decays inside the barrier, and a small part of it emerges on the other side. The chance ',
          'of tunnelling rises steeply with the collision energy, while the number of protons with ',
          'that energy falls steeply. The product of the two is a narrow hump, the ',
          term('Gamow peak'),
          ', at about 6 keV in the Sun: nearly all fusion happens within a few keV of it. At that ',
          'energy a collision tunnels through about one time in ten thousand, and the supply is ',
          'thin: compared with the crowd at typical energies, protons at the peak are outnumbered ',
          'about a hundred to one.',
        ),
        p(
          'The reaction itself is the ',
          term('proton–proton chain', 'proton-proton-chain'),
          ', worked out by Hans Bethe in 1939: four protons become one helium nucleus in three ',
          'steps, converting 0.7 percent of their mass into 26.7 MeV of energy and two neutrinos. ',
          'Its first step, two protons fusing into deuterium, is the slowest process in the chain ',
          'by far, because it also needs one proton to turn into a neutron through the weak force. ',
          'A given proton in the Sun’s core waits, on average, several billion years for it. That ',
          'slowness is why the Sun has lasted 4.6 billion years and will last as long again.',
        ),
        p(
          'The idea has a history. Arthur Eddington argued in 1920 that the Sun must run on ',
          'hydrogen becoming helium, and was told it was not hot enough. George Gamow found the ',
          'tunnelling formula in 1928, for radioactive decay; Robert Atkinson and Fritz Houtermans ',
          'turned it around the next year to show stars could fuse. The proof came from ',
          term('solar neutrinos', 'solar-neutrino'),
          ': the pp chain’s neutrinos leave the core unhindered, and the Borexino detector ',
          'measured them directly, first in 2014 and comprehensively in 2018, at the rate the ',
          'model predicts.',
        ),
        p(
          'Two misconceptions. Fusion is not burning; no oxygen, no chemistry, nothing but nuclei ',
          'merging. And the Sun is not hot enough for fusion: that is the point, not a mistake. It ',
          'fuses because quantum mechanics lets it, slowly, which is exactly the rate at which a ',
          'star should fuse if it is to last.',
        ),
        p(
          'The rates here come from laboratory cross sections extrapolated down to solar energies, ',
          'where they cannot be measured directly; the agreed values carry uncertainties of about ',
          'one percent. The core temperature and density are from the standard solar model, ',
          'checked against helioseismology and the neutrino flux.',
        ),
        /*
         * Source: https://science.nasa.gov/photojournal/image-of-sun-from-nasas-solar-dynamics-observatory/
         * (NASA Photojournal PIA26681, "Image of Sun From NASA's Solar Dynamics
         * Observatory", added 15 September 2025). The page describes it as "On
         * Sept. 10, 2025, NASA's Solar Dynamics Observatory captured this image
         * of the Sun" and credits it "NASA/GSFC/Solar Dynamics Observatory". The
         * image itself is stamped "SDO/AIA 171 2025-09-10 15:55:22 UT": the full
         * disc in the 171 Å extreme-ultraviolet channel. Converted from the
         * 4096 × 4096 JPEG to 1280 px wide webp.
         *
         * Licence, from NASA's media usage guidelines,
         * https://www.nasa.gov/nasa-brand-center/images-and-media/: "NASA
         * content – images, audio, video, and media files used in the rendition
         * of 3-dimensional models, such as texture maps and polygon data in any
         * format – generally are not subject to copyright in the United States.
         * You may use this material for educational or informational purposes,
         * including photo collections, textbooks, public exhibits, computer
         * graphical simulations and Internet Web pages." — and "NASA should be
         * acknowledged as the source of the material." SDO's own data rules,
         * https://sdo.gsfc.nasa.gov/data/rules.php, say the same for the
         * mission: "SDO images and movies are not copyrighted unless explicitly
         * noted." The credit below is the image page's own.
         */
        figure({
          src: '/figures/stellar-fusion.webp',
          width: 1280,
          height: 1280,
          alt: 'The whole Sun as a golden disc on black, its face mottled with darker and brighter patches. Bright active regions near the left and right edges and at lower right trail looping arcs of glowing gas, and fine luminous strands reach out from the rim into the darkness around it.',
          caption:
            'The Sun in extreme ultraviolet light, from the Solar Dynamics Observatory. Everything visible here is powered by protons tunnelling into each other in a core the surface hides.',
          credit: 'NASA/GSFC/Solar Dynamics Observatory',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'gamow-peak',
          tex: 'E_0 \\;=\\; \\left(\\dfrac{E_G\\,(k\\,{{T}})^{2}}{4}\\right)^{1/3}',
          binds: ['T'],
          note: prose(
            p(
              m`E_0`,
              ' — the Gamow peak, the collision energy where most fusion happens; ',
              m`E_G`,
              ' — the Gamow energy, 493 keV for two protons, set by their charges and mass; ',
              m`k`,
              ' — Boltzmann’s constant; ',
              m`T`,
              ' — the core temperature (your slider). Hotter cores fuse at higher energies, but ',
              'only as the cube root of ',
              m`T^2`,
              '.',
            ),
          ),
        },
        {
          id: 'tunnelling',
          tex:
            'P \\;=\\; \\exp\\!\\left(-\\left(\\dfrac{4\\,E_G^{2}}{(k\\,{{T}})^{2}}\\right)^{1/6}\\right)',
          binds: ['T'],
          note: prose(
            p(
              m`P`,
              ' — the chance that a collision at the Gamow peak tunnels through the barrier. This is ',
              m`\exp(-\sqrt{E_G / E_0})`,
              ' with ',
              m`E_0`,
              ' from equation 1 written out, so that ',
              m`T`,
              ' appears. At the Sun’s ',
              m`E_0`,
              ' of 6 keV the exponent is −9, so about one collision in ten thousand succeeds.',
            ),
          ),
        },
        {
          id: 'pp-rate',
          tex:
            '\\varepsilon \\;=\\; 0.241\\,{{rho}}\\,X^{2}\\,T_6^{-2/3}' +
            '\\,\\exp\\!\\left(-33.80\\,T_6^{-1/3}\\right)',
          binds: ['rho', 'T'],
          note: prose(
            p(
              m`\varepsilon`,
              ' — energy released per kilogram per second, W/kg; ',
              m`\rho`,
              ' — the core density (your slider); ',
              m`X`,
              ' — the hydrogen mass fraction, 0.34 at the Sun’s centre; ',
              m`T_6`,
              ' — the temperature in millions of kelvin. The exponential is the tunnelling; ',
              'everything else is bookkeeping.',
            ),
            p(
              'Worked example, the Sun’s centre. ',
              m`T = 1.57 \times 10^{7}\,\text{K}`,
              ', ',
              m`\rho = 1.5 \times 10^{5}\,\text{kg/m}^3`,
              ', ',
              m`X = 0.34`,
              '.',
            ),
            p(m`kT = 8.617 \times 10^{-5}\,\text{eV/K} \times 1.57 \times 10^{7}\,\text{K} = 1.35\,\text{keV}`),
            p(
              m`E_0 = (493\,\text{keV} \times (1.35\,\text{keV})^2 / 4)^{1/3} = (226\,\text{keV}^3)^{1/3} = 6.1\,\text{keV}`,
            ),
            p(m`P = \exp(-\sqrt{493 / 6.1}) = \exp(-9.0) = 1.2 \times 10^{-4}`),
            p(
              m`T_6 = 15.7`,
              ': ',
              m`T_6^{-1/3} = 0.399`,
              ', ',
              m`\exp(-33.80 \times 0.399) = 1.4 \times 10^{-6}`,
              ', ',
              m`T_6^{-2/3} = 0.159`,
            ),
            p(
              m`\varepsilon = 0.241 \times 1.5 \times 10^{5} \times 0.34^2 \times 0.159 \times 1.4 \times 10^{-6} = 9 \times 10^{-4}\,\text{W/kg}`,
            ),
            p(
              'Less heat per kilogram than a compost heap. The Sun shines because a few times 10²⁹ ',
              'kilograms of core are at it at once, and have been for 4.6 billion years.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'The tunnelling factor comes from the WKB approximation to the Schrödinger equation: the ',
          'transmission through a barrier ',
          m`V(r)`,
          ' at energy ',
          m`E`,
          ' is ',
          m`\exp\!\left(-2\int \sqrt{2m(V - E)}/\hbar \; dr\right)`,
          ' across the classically forbidden region. For a Coulomb potential with the turning ',
          'point far outside the nucleus, the integral evaluates to ',
          m`\exp(-2\pi\eta)`,
          ', where ',
          m`\eta = Z_1 Z_2 e^2 / (4\pi\varepsilon_0 \hbar v)`,
          ' is the Sommerfeld parameter and ',
          m`v`,
          ' the relative velocity. Written in terms of energy, ',
          m`2\pi\eta = \sqrt{E_G/E}`,
          ', with ',
          m`E_G = 2 m_r c^2 (\pi\alpha Z_1 Z_2)^2`,
          ': 493 keV for two protons, and rising as the square of the charges, which is why ',
          'heavier nuclei need hotter stars.',
        ),
        p(
          'The reaction rate per pair is ',
          m`\langle\sigma v\rangle = \int \sigma(E)\, v\, \varphi(E)\, dE`,
          ' over the Maxwell–Boltzmann distribution ',
          m`\varphi`,
          '. Writing ',
          m`\sigma(E) = S(E)\exp(-\sqrt{E_G/E})/E`,
          ' removes the tunnelling and the geometric ',
          m`1/E`,
          ', leaving the astrophysical S-factor, which varies slowly and can be extrapolated from ',
          'laboratory energies. The integrand ',
          m`\exp(-E/kT - \sqrt{E_G/E})`,
          ' peaks at ',
          m`E_0 = (E_G (kT)^2/4)^{1/3}`,
          ' with a Gaussian width ',
          m`\Delta = 4\sqrt{E_0 kT/3}`,
          ', about 6.6 keV in the Sun, and the rate depends on temperature as ',
          m`T^\nu`,
          ' with ',
          m`\nu = (\tau - 2)/3`,
          ', ',
          m`\tau = 3E_0/kT`,
          ': about ',
          m`T^{3.8}`,
          ' for the pp chain at solar temperatures. For pp, ',
          m`S(0) = 4.01 \times 10^{-22}\,\text{keV·barn}`,
          ' (Adelberger et al. 2011), tiny because the step requires a weak interaction; the ',
          'corresponding mean life of a proton against fusion in the solar core is about ',
          m`9 \times 10^{9}`,
          ' years. The ',
          term('CNO cycle', 'cno-cycle'),
          ', catalysed by carbon, nitrogen and oxygen, has ',
          m`E_G`,
          ' a hundred times larger and ',
          m`\nu \approx 18`,
          '; it overtakes pp near ',
          m`1.7 \times 10^{7}\,\text{K}`,
          ' and powers stars above about 1.3 solar masses. Borexino detected the Sun’s CNO ',
          'neutrinos in 2020, at about one percent of the total.',
        ),
        p(
          'Two effects the sim omits. Electron screening: the plasma’s electrons cluster around ',
          'each nucleus and lower the barrier by roughly ',
          m`kT`,
          ' × (a few tenths), raising the pp rate by about five percent in the Sun. And the ',
          'neutrino history: the first solar-neutrino experiments, from 1968, found a third of the ',
          'predicted flux, the “solar neutrino problem”; the resolution, established by SNO in ',
          '2001, was that neutrinos change flavour in flight, which was new physics about ',
          'neutrinos rather than about the Sun. The standard solar model’s predictions of the ',
          'core have since been confirmed to a few percent by both neutrinos and helioseismology, ',
          'though a discrepancy remains between helioseismology and the lower solar metal ',
          'abundances measured after 2005, the “solar abundance problem”.',
        ),
        p(
          'A note on the cat. Tunnelling works because the proton’s state before measurement is a ',
          term('superposition'),
          ': a wave with amplitude on both sides of the barrier, not a particle that is secretly ',
          'on one side. Erwin Schrödinger’s 1935 cat, poisoned or not depending on whether an atom ',
          'has decayed, was his argument that this could not sensibly be extended to a cat, since ',
          'nobody has ever seen a superposed cat. The modern answer is decoherence: a cat ',
          'interacts with its surroundings so fast and so thoroughly that any superposition of its ',
          'states is destroyed long before anyone looks, while a proton in a collision has no ',
          'surroundings to speak of for the ',
          m`10^{-21}`,
          ' seconds that matter. The cat is not in two states. The proton is, and the Sun shines ',
          'because of it.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'early-universe',
          reason:
            'Fusion ran once before, everywhere at once, for twenty-five minutes; that module shows why it stopped at helium.',
        },
        {
          moduleId: 'supernovae',
          reason: 'When a core runs out of things to fuse, this is what happens next.',
        },
        {
          moduleId: 'habitable-zone',
          reason:
            'The brightness this rate sets, integrated over a core, is what decides where liquid water can exist.',
        },
        {
          moduleId: 'exoplanets',
          reason: 'Every planet in that module orbits a star powered this way.',
        },
      ],
    },
  },

  references: [
    {
      label:
        'Bahcall, Serenelli & Basu 2005, “New Solar Opacities, Abundances, Helioseismology, and Neutrino Fluxes”, ApJ 621, L85',
      url: 'https://doi.org/10.1086/428929',
      note: 'Standard solar model: central temperature, density and hydrogen fraction',
    },
    {
      label:
        'Adelberger et al. 2011, “Solar fusion cross sections. II. The pp chain and CNO cycles”, Rev. Mod. Phys. 83, 195',
      url: 'https://doi.org/10.1103/RevModPhys.83.195',
      note: 'S(0) for pp and the recommended rates',
    },
    {
      label: 'Gamow 1928, “Zur Quantentheorie des Atomkernes”, Z. Phys. 51, 204',
      url: 'https://doi.org/10.1007/BF01343196',
      note: 'The tunnelling formula',
    },
    {
      label: 'Bethe 1939, “Energy Production in Stars”, Phys. Rev. 55, 434',
      url: 'https://doi.org/10.1103/PhysRev.55.434',
      note: 'The pp chain and CNO cycle',
    },
    {
      label:
        'Borexino Collaboration 2018, “Comprehensive measurement of pp-chain solar neutrinos”, Nature 562, 505',
      url: 'https://doi.org/10.1038/s41586-018-0624-y',
      note: 'Direct measurement of the pp neutrino flux',
    },
  ],
};

export default stellarFusion;

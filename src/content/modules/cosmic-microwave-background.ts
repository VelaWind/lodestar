/**
 * The cosmic microwave background — the ninth published Lodestar module.
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
import { T_CMB, V_SUN_CMB } from '@/physics/constants';
import { figure, m, p, prose, term } from '../rich';

const cosmicMicrowaveBackground: Module = {
  id: 'cosmic-microwave-background',
  title: 'The Cosmic Microwave Background',
  tagline:
    'The oldest light there is still fills the sky, cooled by the stretching of space to three degrees above absolute zero.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'The oldest light in the universe reaches you from every direction, all day, every ',
          'day. It set out before there was a single star, and it has been cooling ever since.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture a room filled with glowing fog, so thick and bright that you cannot see ',
          'across it. Then, in one moment, the fog clears everywhere at once. The light that was ',
          'trapped inside it is suddenly free, and sets off in every direction.',
        ),
        p(
          'Now imagine the room’s walls have been moving apart ever since, slowly, for a very ',
          'long time. The light that set out when the fog cleared is still crossing the room. ',
          'Along the way the stretching of the room has stretched the light too, pulling each ',
          'wave longer and longer. What began as an orange glow, like the inside of a hot oven, ',
          'has been drawn out into something far redder than red. It is now a faint hum of ',
          'microwaves, the kind a microwave oven uses, but billions of times weaker.',
        ),
        p(
          'That is what a radio dish pointed at an empty patch of sky picks up. Not the light of ',
          'a star or a galaxy, but the leftover glow of the fog itself, arriving from every ',
          'direction because the fog was everywhere.',
        ),
        p(
          'Where the analogy breaks: fog in a room clears from the edges inward, but this fog ',
          'cleared everywhere at the same instant. And there is no far wall the light is heading ',
          'toward. It keeps arriving because in every direction there is somewhere whose light is ',
          'only now reaching us.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'cosmic-microwave-background',
      caption: prose(
        p(
          'Heat the universe back up and watch the glow climb from microwaves toward visible ',
          'light. Then change how fast we are moving through it and see the sky tilt warm on ',
          'one side and cool on the other.',
        ),
      ),
      params: [
        {
          id: 'T',
          friendlyLabel: 'How hot is the universe?',
          technicalLabel: 'Radiation temperature',
          symbol: 'T',
          unit: 'K',
          // Min is today. Max is where the universe became transparent; hotter
          // than that, no light from the glow reaches us directly.
          min: T_CMB,
          max: 3000,
          default: T_CMB,
          // decades; 304 equal steps, shrunk by one part in 10⁹ so (max − min) / step
          // rounds up to 304 and the input can reach its maximum. Without the
          // shrink, floating point leaves it one step short.
          step: ((Math.log10(3000) - Math.log10(T_CMB)) / 304) * (1 - 1e-9),
          scale: 'log',
          format: { notation: 'auto', digits: 5 },
        },
        {
          id: 'lambda',
          friendlyLabel: 'Which wavelength (crest to crest) are you tuned to?',
          technicalLabel: 'Observing wavelength',
          symbol: '\\lambda_{\\text{obs}}',
          unit: 'm',
          // 0.1 mm to 1 m: far infrared to radio. Default 1 mm, near today's peak.
          min: 1e-4,
          max: 1,
          default: 1e-3,
          step: 0.01, // decades
          scale: 'log',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'mm', factor: 1e3 } },
        },
        {
          id: 'v',
          friendlyLabel: 'How fast are we moving through it?',
          technicalLabel: 'Observer velocity relative to the CMB',
          symbol: 'v',
          unit: 'm/s',
          // Rest to about 1000 km/s in a thousand steps of about 1 km/s, sized so that
          // the Sun's 369.82 km/s is step 370 exactly.
          min: 0,
          max: 1000 * (V_SUN_CMB / 370),
          default: V_SUN_CMB,
          step: V_SUN_CMB / 370,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'km/s', factor: 1e-3 } },
        },
      ],
      approximations: [
        prose(
          p(
            'The spectrum is a perfect blackbody, the glow of something shining only by its own heat. The real one matches that shape to better than one part in ten thousand; the tiny deviations are the science, not the shape.',
          ),
        ),
        prose(
          p(
            'The slider stops at 3000 kelvin (about 2 700 degrees Celsius), where the universe first became transparent. It was hotter before that, but no light from those times can reach us directly.',
          ),
        ),
        prose(
          p(
            'The sky panel shows only the hot-ahead, cool-behind pattern from our own motion. The real map has spots a hundred times fainter on top of it, and the sim does not draw them.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'The glow is the ',
          term('cosmic microwave background'),
          ', the CMB, and the fog was the early universe itself. For its first 380 000 years the ',
          'universe was a plasma, a gas of free electrons and nuclei so dense that light could ',
          'not travel more than a short distance before scattering. As the universe expanded it ',
          'cooled, and at about 3000 K, roughly the temperature of a lamp filament, the electrons ',
          'settled onto the nuclei to form neutral atoms. That event is called ',
          term('recombination'),
          '. Neutral gas is transparent, so from that moment the light travelled freely, and it ',
          'has been travelling ever since. The shell of sky it comes from is the ',
          term('surface of last scattering', 'last-scattering'),
          ', at a ',
          term('redshift'),
          ' of about 1090.',
        ),
        p(
          'The light is a ',
          term('blackbody'),
          ' spectrum: the fixed shape any object glows with when its only source of light is its ',
          'own heat. Expansion stretches every wavelength by the same factor, so a blackbody stays ',
          'a blackbody and only its temperature falls. It has fallen from about 3000 K to 2.7255 K ',
          'today, measured to a precision of a fraction of a thousandth of a degree, and the peak ',
          'of the glow has moved from just below visible light to a wavelength of about one ',
          'millimetre. The CMB is the most perfect blackbody ever measured; nothing made in a ',
          'laboratory comes close. That match is the strongest single piece of evidence that the ',
          'universe was once hot and dense everywhere.',
        ),
        p(
          'Arno Penzias and Robert Wilson found the glow in 1965 with a horn antenna in New ',
          'Jersey, as a persistent hiss at a wavelength of 7.35 cm that no amount of cleaning, ',
          'including the removal of pigeons, would remove. Ralph Alpher and Robert Herman had ',
          'predicted a leftover glow at about 5 K in 1948; almost nobody had looked. In 1990 the ',
          'COBE satellite measured the spectrum and found the blackbody shape, and in 1992 it ',
          'found the first ',
          term('anisotropy'),
          ': the sky is not the same in every direction, but varies by about one part in one ',
          'hundred thousand. The same primordial ripples, on scales smaller than this map resolves, ',
          'seeded every galaxy and cluster. The much larger ',
          term('CMB dipole', 'cmb-dipole'),
          ', a smooth variation of about three thousandths of a degree from one side of the sky ',
          'to the other, is not a feature of the universe but of us: the Solar System is moving ',
          'through the background at about 370 km/s, toward the constellation Leo, and the glow ',
          'ahead is very slightly hotter.',
        ),
        p(
          'Two misconceptions. The CMB is not the light of the Big Bang itself; the universe was ',
          'opaque for its first 380 000 years, and this is the earliest light that could escape. ',
          'And the surface of last scattering is not an edge of the universe. It is a horizon: the ',
          'farthest we can see with light, because before it the universe was opaque; an observer ',
          'in a distant galaxy sees their own surface, centred on them.',
        ),
        p(
          'The 3000 K figure is rounded, and recombination was not instant. It took tens of ',
          'thousands of years, and the “surface” is a shell of some thickness. The numbers above ',
          'are Planck 2018 values; the temperature is from the COBE FIRAS instrument.',
        ),
        /*
         * Source: https://map.gsfc.nasa.gov/media/121238/index.html, which now
         * redirects (301) to https://science.nasa.gov/mission/wmap/wmap-overview/.
         * The page shows the image ("WMAP full Sky Image with Galaxy signal
         * removed - 9 years of data used"), file ilc_9yr_moll4096.png, with the
         * credit line "Credit: NASA / WMAP Science Team". Converted from the
         * 4096 × 2048 PNG to 1280 px wide webp.
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
         * image page's own.
         */
        figure({
          src: '/figures/cosmic-microwave-background.webp',
          width: 1280,
          height: 640,
          alt: 'An oval map of the whole sky, mottled all over with small irregular patches: dark and pale blue for cooler regions, green in between, and yellow and red flecks for warmer ones, with no large-scale pattern across it.',
          caption:
            'The whole sky in microwaves, with the average and the dipole (the warm-ahead, cool-behind tilt our own motion adds) removed. Red is warmer than average, blue cooler, by a few hundred-thousandths of a degree. The same primordial ripples, on scales smaller than this map resolves, seeded every galaxy and cluster.',
          credit: 'NASA / WMAP Science Team',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      equations: [
        {
          id: 'temperature-redshift',
          tex: 'z \\;=\\; \\dfrac{{{T}}}{T_0} - 1',
          binds: ['T'],
          note: prose(
            p(
              m`z`,
              ' — the redshift at which the universe had temperature ',
              m`T`,
              '; ',
              m`T`,
              ' — the radiation temperature (your slider); ',
              m`T_0`,
              ' — the temperature today, 2.7255 K. The temperature grows in step with the redshift ',
              'because expansion stretches every wavelength.',
            ),
          ),
        },
        {
          id: 'wien-peak',
          tex: '\\lambda_{\\text{peak}} \\;=\\; \\dfrac{b}{{{T}}}',
          binds: ['T'],
          note: prose(
            p(
              m`\lambda_{\text{peak}}`,
              ' — the wavelength at which the glow is brightest; ',
              m`b`,
              ' — Wien’s constant, 2.898 × 10⁻³ m·K. Hotter glows peak at shorter wavelengths.',
            ),
          ),
        },
        {
          id: 'dipole',
          tex: '\\Delta T \\;=\\; \\dfrac{{{T}}\\,{{v}}}{c}',
          binds: ['T', 'v'],
          note: prose(
            p(
              m`\Delta T`,
              ' — how much hotter the sky is straight ahead than the average; ',
              m`v`,
              ' — our speed through the background (your slider); ',
              m`c`,
              ' — the speed of light. This is the Doppler effect applied to a whole sky of light.',
            ),
            p(
              'Worked example, today’s sky. ',
              m`T = 2.7255\,\text{K}`,
              ', ',
              m`v = 369.8\,\text{km/s}`,
              '.',
            ),
            p(
              m`\lambda_{\text{peak}} = 2.898 \times 10^{-3} / 2.7255 = 1.063 \times 10^{-3}\,\text{m} = 1.06\,\text{mm}`,
            ),
            p(
              m`\Delta T = 2.7255 \times 3.698 \times 10^{5} / 2.998 \times 10^{8} = 3.36 \times 10^{-3}\,\text{K} = 3.36\,\text{mK}`,
            ),
            p(
              'At the surface of last scattering, ',
              m`T = 2973\,\text{K}`,
              ': ',
              m`z = 2973 / 2.7255 - 1 = 1090`,
              ', and ',
              m`\lambda_{\text{peak}} = 2.898 \times 10^{-3} / 2973 = 975\,\text{nm}`,
              ', just beyond the red end of visible light.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'That the CMB is still a blackbody is not an accident of measurement but a consequence ',
          'of expansion acting on a photon gas. Write the ',
          term('scale factor'),
          ' as ',
          m`a`,
          ', with ',
          m`a = 1`,
          ' today. Each photon’s frequency scales as ',
          m`\nu \propto 1/a`,
          ', and the photon number in a comoving volume is conserved, so the occupation number ',
          'per mode, ',
          m`1 / (e^{h\nu/kT} - 1)`,
          ', is preserved provided ',
          m`T \propto 1/a`,
          '. The Planck form survives with the temperature rescaled, which is why the slider’s ',
          'single parameter suffices. The relation ',
          m`T(z) = T_0(1 + z)`,
          ' has been tested directly: CO absorption in a quasar spectrum gives ',
          m`T(z = 2.69) = 10.5^{+0.8}_{-0.6}\,\text{K}`,
          ' against 10.06 K predicted, and the Sunyaev–Zeldovich effect (the scattering of CMB ',
          'photons by hot cluster gas) confirms the scaling below ',
          m`z = 1`,
          '.',
        ),
        p(
          'Photon number density today is ',
          m`n_\gamma = 16\pi\,\zeta(3)\,(kT_0 / hc)^3 \approx 411\,\text{cm}^{-3}`,
          ', against a mean baryon density of about ',
          m`2.5 \times 10^{-7}\,\text{cm}^{-3}`,
          ': a baryon-to-photon ratio ',
          m`\eta \approx 6 \times 10^{-10}`,
          '. That ratio is why recombination happened near 3000 K rather than near 158 000 K, the ',
          'temperature at which ',
          m`kT`,
          ' equals the 13.6 eV binding energy of hydrogen: with over a billion photons per baryon, ',
          'the high-energy tail of the photon distribution kept hydrogen ionized until the ',
          'temperature had fallen to a few percent of that. Saha equilibrium, which includes the ',
          'ratio, puts the midpoint of recombination near 3700 K; the true value is lower because ',
          'the process did not stay in equilibrium. Direct recombination to the ground state ',
          're-emits a photon that ionizes a neighbour, so the universe became neutral through the ',
          'slow channels, two-photon decay from the 2s level and the redshifting of Lyman-α ',
          'photons out of resonance (Peebles 1968), which is why recombination is spread over ',
          m`\Delta z \approx 80`,
          ' and why the surface of last scattering has a thickness.',
        ),
        p(
          'The anisotropies are sound. Before recombination, photons and baryons formed a single ',
          'fluid with pressure, and overdensities seeded by inflation oscillated as acoustic ',
          'waves. At last scattering the phases of those oscillations were frozen into the ',
          'temperature map, producing the ',
          term('acoustic peaks'),
          ' in the angular power spectrum: the first at ',
          m`\ell \approx 220`,
          ', about 1° across; the ',
          term('sound horizon'),
          ' ',
          m`r_* = 144.4`,
          ' ',
          term('Mpc', 'megaparsec'),
          ' (comoving) itself subtends ',
          m`\theta_* = 0.596^\circ`,
          ' at the last-scattering distance, and that angle sets the spacing of the peaks. The ',
          'peak positions measure the ',
          'geometry of the universe, and Planck finds it flat to within 0.4%. The peak heights ',
          'fix the baryon and dark-matter densities; the damping tail at high ',
          m`\ell`,
          ' measures the thickness of last scattering. The ',
          term('ΛCDM', 'lambda-cdm'),
          ' model has six parameters and fits the spectrum to the cosmic-variance limit across ',
          'three decades of angular scale. It is this fit that yields ',
          m`H_0 = 67.4 \pm 0.5`,
          ' km/s/Mpc and the 13.80 Gyr age, and this fit that the local distance ladder ',
          'disagrees with.',
        ),
        p(
          'The CMB is also polarized, at the level of a few microkelvin, by Thomson scattering at ',
          'last scattering. The polarization pattern decomposes into a curl-free E-mode, detected ',
          'and consistent with the temperature spectrum, and a divergence-free B-mode, which ',
          'scalar density perturbations cannot produce at linear order. Primordial gravitational ',
          'waves from inflation would. The tensor-to-scalar ratio is currently bounded at ',
          m`r < 0.036`,
          ' (BICEP/Keck with Planck, 2021); primordial ',
          term('B-modes'),
          ' have not been seen (B-modes made by gravitational lensing have been, since 2013), and a ',
          'detection would be a direct measurement of the energy scale of inflation.',
        ),
        p(
          'Open questions. Several large-angle anomalies, including a hemispherical power ',
          'asymmetry and the Cold Spot, sit at the 2–3σ level and may be statistical flukes; with ',
          'only one sky to measure, cosmic variance limits what can be said. The Hubble tension ',
          'is the sharpest disagreement between the early-universe fit and late-universe ',
          'measurement. And at the other extreme of precision: whether the small departures from ',
          'a blackbody predicted by energy release in the early universe, ',
          m`\mu`,
          '-distortions at parts in ',
          m`10^8`,
          ' and ',
          m`y`,
          '-distortions near parts in ',
          m`10^6`,
          ', can be measured, which is the target of proposed missions such as PIXIE.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'expansion-of-the-universe',
          reason:
            'Every number here follows from the stretching you dragged there; the CMB is that redshift taken to its limit.',
        },
        {
          moduleId: 'early-universe',
          reason:
            'The 380 000 years before this light escaped are that module’s subject, from the first microsecond forward.',
        },
        {
          moduleId: 'gravitational-waves',
          reason:
            'The B-mode search is a hunt for gravitational waves from the first instant; that module explains what such waves are.',
        },
        {
          moduleId: 'scale-of-the-universe',
          reason:
            'The observable universe tops that ladder; the surface of last scattering, just inside its edge, is the farthest we can see with light.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Fixsen 2009, “The Temperature of the Cosmic Microwave Background”, ApJ 707, 916',
      url: 'https://doi.org/10.1088/0004-637X/707/2/916',
      note: 'T₀ = 2.7255 ± 0.0006 K',
    },
    {
      label:
        'Planck Collaboration 2020, “Planck 2018 results VI: Cosmological parameters”, A&A 641, A6',
      url: 'https://doi.org/10.1051/0004-6361/201833910',
      note: 'z_* = 1089.92, r_* = 144.43 Mpc, age and flatness',
    },
    {
      label: 'Planck Collaboration 2020, “Planck 2018 results I: Overview”, A&A 641, A1',
      url: 'https://doi.org/10.1051/0004-6361/201833880',
      note: 'Dipole amplitude 3.3621 mK and Solar System velocity 369.82 km/s',
    },
    {
      label:
        'Penzias & Wilson 1965, “A Measurement of Excess Antenna Temperature at 4080 Mc/s”, ApJ 142, 419',
      url: 'https://doi.org/10.1086/148307',
      note: 'The discovery',
    },
    {
      label:
        'Fixsen et al. 1996, “The Cosmic Microwave Background Spectrum from the Full COBE FIRAS Data Set”, ApJ 473, 576',
      url: 'https://doi.org/10.1086/178173',
      note: 'The blackbody spectrum',
    },
  ],
};

export default cosmicMicrowaveBackground;

/**
 * Tides — the twenty-second published Lodestar module.
 *
 * Every figure here was recomputed from `@/physics/tides` and the sourced
 * constants before it was written, and the sanity block `verifyTideModel`
 * holds the code to them: the Sun-to-Moon tide ratio 0.459; the exact tidal
 * acceleration at 1.025 (near) and 0.976 (far) of 2GMR/d³ and half of it across
 * the line; equilibrium crests of 0.357 m (Moon) and 0.164 m (Sun) above the
 * undisturbed level; spring range 0.781 m and neap 0.289 m on the equator; a
 * 12.42 h semidiurnal period; a 3.37% near/far crest asymmetry; the caption's
 * claims across the whole slider range; the Sun's tide the larger beyond 1.296
 * times the Moon's real distance (1.304 on the exact stretch ratio); perigee
 * against apogee 1.39; and the fluid Roche limit around Saturn, from its mass:
 * 2.14 equatorial radii (129 000 km) for solid ice, 2.47–2.62 for porous ice of
 * 600–500 kg/m³, against the A ring's outer edge at 2.27.
 *
 * "Crest" and "high tide" heights are above the level the water would have with
 * no Moon or Sun; "range" is high water minus low water.
 *
 * Sources cited in comments rather than in the five-reference list:
 *   - NASA Moon Fact Sheet: mass, 384 400 km mean distance, perigee 363 300 km,
 *     apogee 405 500 km.
 *   - Newton, Principia (1687), Book III: tides from the Moon's and Sun's
 *     gravity. Laplace (1775–76): the dynamic theory and his tidal equations.
 *     Galileo, Dialogue (1632), and his 1616 discourse on the tides: tides from
 *     Earth's combined spin and orbital motion, which is wrong.
 *   - Garrett 1972, Nature 238, 441: the Bay of Fundy–Gulf of Maine system's
 *     natural period of about 13.3 h, near the 12.42 h tide.
 *   - Burntcoat Head, Bay of Fundy: 16.3 m recorded (Guinness), up to 17 m
 *     (Canadian Hydrographic Service).
 *   - Love numbers k₂ ≈ 0.30, h₂ ≈ 0.61: the solid Earth's own tide; the ocean
 *     tide against the ground is 1 + k₂ − h₂ ≈ 0.69 of the rigid-Earth figure.
 *   - Saturn: NASA Saturn Fact Sheet (5.6834 × 10²⁶ kg; radii 58 232 km
 *     volumetric mean, 60 268 km equatorial); A ring outer edge 136 775 km.
 *   - Lunar declination up to about 28.6° at major standstill (18.6-year cycle);
 *     the Sun's 23.4°.
 */
import { D_MOON, TIDE_DRAW_EXAGGERATION } from '@/physics/constants';
import type { Module } from '../types';
import { figure, m, p, prose, term } from '../rich';

const DEG = Math.PI / 180;

const tides: Module = {
  id: 'tides',
  title: 'Tides',
  tagline: 'The Moon pulls harder on the near side of Earth than the far side. The oceans stretch both ways, and the sea rises twice a day.',
  status: 'published',

  layers: {
    /* 1 ------------------------------------------------------------------ */
    hook: {
      body: prose(
        p(
          'Most coasts get two high tides a day, not one. The sea piles up on the side of Earth facing the ',
          'Moon, and on the side facing away from it too.',
        ),
      ),
    },

    /* 2 ------------------------------------------------------------------ */
    intuition: {
      body: prose(
        p(
          'Picture three runners in a line, all pulled toward a finish ahead, where the pull is stronger ',
          'the closer you are. The front runner is pulled hardest and gains ground. The back runner is ',
          'pulled least and falls behind. Seen from the middle runner, both the others are moving away: ',
          'the line stretches at both ends.',
        ),
        p(
          'Earth is like that line, and the Moon is the finish. The Moon pulls hardest on the side of ',
          'Earth facing it, less on Earth’s centre, and least on the far side. So, compared with the ',
          'centre, the near-side ocean is pulled toward the Moon and the far-side ocean is left behind. ',
          'The water bulges out on both sides. As Earth turns once a day, a coast passes through both ',
          'bulges: two high tides a day.',
        ),
        p(
          'Where the analogy breaks: runners drive themselves forward, while here gravity does all the ',
          'pulling. And the stretch only shows up compared with Earth’s centre, which is itself falling ',
          'toward the Moon all the time.',
        ),
      ),
    },

    /* 3 ------------------------------------------------------------------ */
    play: {
      simKey: 'tides',
      caption: prose(
        p(
          'Turn the Moon around Earth with the phase slider. At new and full Moon the Sun’s tide adds to ',
          'the Moon’s; at the quarter Moons they partly cancel. Move the Moon closer and its own tide ',
          'grows steeply: halve the distance and it is eight times stronger. Beyond about 1.3 times its real distance, the Sun’s ',
          'tide becomes the larger of the two.',
        ),
      ),
      params: [
        {
          id: 'phase',
          friendlyLabel: 'Where is the Moon in its month? (in degrees from new Moon: 90 is first quarter, 180 full)',
          technicalLabel: 'Sun–Earth–Moon angle',
          symbol: '\\alpha',
          unit: 'rad',
          // 0 new Moon, 90° first quarter, 180° full, 270° last quarter.
          min: 0,
          max: 360 * DEG,
          default: 0,
          step: 1 * DEG,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: '°', factor: 1 / DEG } },
        },
        {
          id: 'dMoon',
          friendlyLabel: 'How far away is the Moon? (in thousands of kilometres; the real Moon stays between 363 and 406)',
          technicalLabel: 'Moon distance',
          symbol: 'd',
          unit: 'm',
          // 0.6 to 2 times the mean 384 400 km, well beyond the real 363 300 to
          // 405 500 km, for exploring the inverse cube. Default: the mean.
          min: 0.6 * D_MOON,
          max: 2 * D_MOON,
          default: D_MOON,
          step: 1e6,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: 'thousand km', factor: 1e-6 } },
        },
        {
          id: 'lat',
          friendlyLabel: 'How far from the equator is the red dot? (latitude, in degrees)',
          technicalLabel: 'Latitude of the coastal point',
          symbol: '\\varphi',
          unit: 'rad',
          // 0 to 60°. With the Moon and Sun over the equator the range falls as
          // cos²φ, to a quarter at 60°.
          min: 0,
          max: 60 * DEG,
          default: 0,
          step: 1 * DEG,
          scale: 'linear',
          format: { notation: 'auto', digits: 3, displayUnit: { unit: '°', factor: 1 / DEG } },
        },
      ],
      approximations: [
        prose(
          p(
            'This is the ',
            term('equilibrium tide', 'equilibrium-tide'),
            ': the shape the water would take if it covered the whole Earth and followed the pull instantly. Real oceans, broken up by continents, cannot. Their tides are waves, as the real picture below explains.',
          ),
        ),
        prose(
          p(
            `Water heights are drawn ${TIDE_DRAW_EXAGGERATION === 2e6 ? 'two million' : `${TIDE_DRAW_EXAGGERATION / 1e6} million`} times too big, and the ocean far too deep. Distances are not to scale: the Moon is really about 60 Earth radii away, and the Sun about 390 times farther than the Moon.`,
          ),
        ),
        prose(
          p(
            'The Moon and Sun are kept over the equator. Really the Moon swings up to about 28.6 degrees north and south, and the Sun 23.4. That makes a day’s two high tides unequal at most places.',
          ),
        ),
        prose(
          p(
            'While Earth turns, the Moon’s phase is held at the slider’s value. Really it moves on about 12 degrees a day, so the large tides of new and full Moon become the small ones of the quarter Moons in about a week.',
          ),
        ),
        prose(
          p(
            'Earth’s rock is treated as rigid. In fact the ground itself rises and falls by a few tens of centimetres, so a tide gauge on the shore would see only about 70 percent of the heights shown here.',
          ),
        ),
        prose(
          p(
            'Heights use a simplified formula. The exact pull makes the bulge facing the Moon about 3 percent higher than the far one.',
          ),
        ),
        prose(
          p(
            'The Moon moves on a circle at the chosen distance. Its real distance swings between 363 300 and 405 500 kilometres each month, changing its tide by about 40 percent.',
          ),
        ),
        prose(
          p(
            'Arrows show the tidal pull of the Moon and Sun together at the coast, all drawn to one fixed scale. The exception: arrows longer than the ocean is drawn deep are shortened to that length, which happens only with the Moon nearer than about 0.95 times its real distance.',
          ),
        ),
        prose(
          p(
            'The ocean’s outline is drawn at the equator, whatever the red dot’s latitude; the trace below it is at the dot’s latitude.',
          ),
        ),
        prose(
          p(
            'Real bulges are carried slightly ahead of the Moon by Earth’s spin; this one sits on the line to the Moon.',
          ),
        ),
        prose(
          p(
            'Time is sped up by the same factor at every setting: one second on screen is two hours.',
          ),
        ),
      ],
    },

    /* 4 ------------------------------------------------------------------ */
    real: {
      body: prose(
        p(
          'A ',
          term('tide'),
          ' is the regular rise and fall of the sea, driven by the ',
          term('tidal force', 'tidal-force'),
          ': the difference between the Moon’s pull on Earth’s near side, on its centre and on its far ',
          'side. Earth as a whole is in free fall around the Earth–Moon centre of mass, so only those ',
          'differences act on the oceans: outward along the line to the Moon on both sides, inward across ',
          'it. The stretch is tiny, about one nine-millionth of Earth’s gravity, and it falls as the ',
          'inverse cube of distance. That is why the Moon, 390 times closer than the Sun, raises the ',
          'bigger tide, although the Sun pulls on Earth about 180 times harder.',
        ),
        p(
          'The Sun raises its own tide, 0.46 of the Moon’s. At new and full Moon the two line up and add, ',
          'giving large ',
          term('spring tides', 'spring-tide'),
          ' (nothing to do with the season). At the quarter Moons they partly cancel, giving small ',
          term('neap tides', 'neap-tide'),
          '.',
        ),
        p(
          'Real tides are not two bulges sweeping round. Continents block them, and the ocean is too ',
          'shallow for a wave to keep pace with the Moon. So the tide travels as waves circling round ',
          term('amphidromic points', 'amphidromic-point'),
          ', places with almost no tide, shown on the map below. The equilibrium tide would rise and fall ',
          'about half a metre; real ranges run from almost nothing to about 16 metres in Canada’s Bay of ',
          'Fundy, where the shape of the bay makes the water resonate.',
        ),
        p(
          'Tides also brake Earth. Its spin drags the tide slightly ahead of the Moon. The pull of that ',
          'water speeds the Moon along its orbit, while the Moon’s pull on it slows Earth. The day lengthens, ',
          'and the Moon recedes by 3.83 centimetres a year, measured since 1969 by laser pulses bounced ',
          'off reflectors left on the Moon. Isaac Newton explained tides by gravity in his Principia ',
          '(1687), and Pierre-Simon Laplace founded their dynamic theory in 1775–76. Galileo had argued, ',
          'wrongly, that Earth’s own motions sloshed the seas.',
        ),
        /*
         * Source: https://commons.wikimedia.org/wiki/File:M2_Tidal_constituent.tif
         * — "Chart showing the M2 tidal constituent in the oceans, from the
         * TOPEX/Poseidon satellite project. Colours show tidal amplitudes (in
         * cm). White lines show contours of equal phase, with lags of 1 lunar
         * hour, with arrows showing direction." Author: Richard D Ray, Goddard
         * Space Flight Center, NASA; file supplied by the author (2007). The
         * 6142 × 3567 TIFF, resized to 1440 px wide webp.
         *
         * Licence: the file page carries {{PD-USGov-NASA}}, a work of NASA and
         * so in the public domain in the United States. NASA's media usage
         * guidelines ask that NASA be acknowledged as the source; the credit
         * below does so, with the author the file page names. The same
         * map appears in NASA GSFC's "TOPEX/Poseidon: Revealing Hidden Tidal
         * Energy" (https://svs.gsfc.nasa.gov/stories/topex/).
         */
        figure({
          src: '/figures/tides.webp',
          width: 1440,
          height: 836,
          alt: 'A world map of the oceans coloured from blue through green and yellow to red, with land in grey. White lines radiate from a dozen points in the oceans, where the colour is darkest blue, and fan out across each ocean basin; the deepest reds hug coasts such as the Bay of Fundy, the English Channel and Patagonia.',
          caption:
            'The main lunar tide, called M2, as measured from orbit by the TOPEX/Poseidon satellite. Colour is its amplitude in centimetres: how far each high tide rises above the mean, half the full rise and fall. White lines join places where high tide comes at the same moment, an hour apart, and they turn around amphidromic points, where the lines meet and there is almost no tide.',
          credit: 'Richard D. Ray, NASA Goddard Space Flight Center (TOPEX/Poseidon)',
        }),
      ),
    },

    /* 5 ------------------------------------------------------------------ */
    math: {
      intro: prose(
        p(
          'The first equation is the stretch, the second why the nearer Moon wins over the heavier Sun, ',
          'the third the rise and fall it makes.',
        ),
      ),
      equations: [
        {
          id: 'stretch',
          tex: 'a \\;\\approx\\; \\dfrac{2GM_{\\text{Moon}}R_\\oplus}{{{dMoon}}^{3}}',
          binds: ['dMoon'],
          note: prose(
            p(
              m`a`,
              ' — the tidal acceleration along the line to the Moon, at the point under it; ',
              m`R_\oplus`,
              ' — Earth’s radius; ',
              m`d`,
              ' — the Moon’s distance. Valid only when Earth is much smaller than the distance, ',
              m`R_\oplus \ll d`,
              '; at the Moon, ',
              m`R_\oplus/d = 0.017`,
              ', and it is good to about 2.5%.',
            ),
            p(
              'Worked example, today: ',
              m`a = 2 \times 6.674 \times 10^{-11} \times 7.346 \times 10^{22} \times 6.371 \times 10^{6} / (3.844 \times 10^{8})^3 = 1.10 \times 10^{-6}\,\text{m/s}^2`,
              ', about one nine-millionth of ',
              m`g`,
              '. The exact difference, ',
              m`GM[1/(d - R)^2 - 1/d^2]`,
              ', gives ',
              m`1.13 \times 10^{-6}`,
              ' on the near side and ',
              m`1.07 \times 10^{-6}`,
              ' on the far side; across the line, the squeeze is half the stretch.',
            ),
          ),
        },
        {
          id: 'ratio',
          tex: '\\dfrac{a_\\odot}{a_{\\text{Moon}}} \\;=\\; \\dfrac{M_\\odot}{M_{\\text{Moon}}}\\left(\\dfrac{{{dMoon}}}{d_\\odot}\\right)^{3}',
          binds: ['dMoon'],
          note: prose(
            p(
              'Each body’s tide goes as its mass over the cube of its distance, while its plain pull goes ',
              'as mass over the square. The Sun is ',
              m`2.7 \times 10^{7}`,
              ' times the Moon’s mass and 389 times as far: its pull on Earth is ',
              m`2.7 \times 10^{7}/389^2 = 179`,
              ' times the Moon’s, its tide ',
              m`2.7 \times 10^{7}/389^3 = 0.46`,
              ' of it.',
            ),
            p(
              'Worked example, today: the solar tidal acceleration is ',
              m`5.05 \times 10^{-7}\,\text{m/s}^2`,
              ', the ratio 0.459. With the Moon 1.30 times farther than now, the two would be equal. The ',
              'sim’s readout, the exact accelerations at the points directly under each body, gives 0.448, ',
              'because the Moon’s exact near-side stretch is 2.5% above the leading-order figure. On that ',
              'exact ratio the crossing is at 1.304 times; the two estimates differ by under 1%.',
            ),
          ),
        },
        {
          id: 'range',
          tex: '\\Delta h \\;=\\; \\tfrac{3}{2}\\cos^{2}{{lat}}\\,\\sqrt{h_{\\text{M}}^{2} + h_\\odot^{2} + 2h_{\\text{M}}h_\\odot\\cos 2{{phase}}}, \\qquad h = \\dfrac{M}{M_\\oplus}\\dfrac{R_\\oplus^{4}}{d^{3}}',
          binds: ['lat', 'phase', 'dMoon'],
          note: prose(
            p(
              m`\Delta h`,
              ' — the equilibrium tide’s range, high water minus low water, at latitude ',
              m`\varphi`,
              ' with both bodies over the equator; ',
              m`h`,
              ' — each body’s crest, the water’s height above its undisturbed level at the point under ',
              'the body (leading order, rigid Earth); ',
              m`\alpha`,
              ' — the phase angle. Each body’s tide is a constant plus ',
              m`\tfrac34 h\cos^2\varphi\cos 2(\lambda - \lambda_{\text{body}})`,
              ', and the two waves add as vectors.',
            ),
            p(
              'Worked example, the equator today: ',
              m`h_{\text{M}} = 0.0123 \times (6.371 \times 10^{6})^4 / (3.844 \times 10^{8})^3 = 0.357\,\text{m}`,
              ' and ',
              m`h_\odot = 0.164\,\text{m}`,
              '. At spring tides ',
              m`\Delta h = 1.5 \times (0.357 + 0.164) = 0.78\,\text{m}`,
              ', at neaps ',
              m`1.5 \times (0.357 - 0.164) = 0.29\,\text{m}`,
              '. Earth turns once relative to the Moon in 24 h 50 min, so high tides come every 12 h 25 min.',
            ),
          ),
        },
      ],
    },

    /* 6 ------------------------------------------------------------------ */
    deeper: {
      body: prose(
        p(
          'A common explanation says the far-side bulge is flung out by centrifugal force as Earth swings ',
          'round the Earth–Moon centre of mass. That swing is real, but it is a revolution without ',
          'rotation: every point of Earth moves on an equal circle, so its acceleration is the same ',
          'everywhere, equal to the Moon’s pull at the centre. Subtracting it is exactly what the ',
          'free-fall frame does, and a term that is the same everywhere cannot make near and far sides ',
          'differ: in that frame the bulges come from how the Moon’s pull varies across Earth. In a frame ',
          'turning with the Earth and Moon a centrifugal term does vary across Earth, and done carefully ',
          'that frame gives the same answer; what is wrong is crediting the far bulge to centrifugal force ',
          'alone and the near bulge to gravity alone. Earth’s daily spin, a separate rotation, raises neither.',
        ),
        p(
          'Ocean basins respond as forced, damped resonators. The main lunar tide travels as long waves, ',
          'deflected by Earth’s rotation, round amphidromic points, mostly counter-clockwise in the north. ',
          'Where a basin’s natural period is near the forcing’s, the tide grows: the Bay of Fundy and Gulf ',
          'of Maine slosh with a period of about 13.3 hours against the tide’s 12.42 (Garrett 1972).',
        ),
        p(
          'Tidal friction moves angular momentum from Earth’s spin to the Moon’s orbit, most of it ',
          'dissipated in shallow seas and over rough deep-ocean floor (Egbert & Ray 2000). It alone would ',
          'lengthen the day by about 2.3 milliseconds a century; eclipse records over 2 700 years give ',
          '1.78. The difference is largely the ground still rising after the last ice age, which makes ',
          'Earth less flattened and speeds it up. Layered tidal sediments, tidal rhythmites, from 620 ',
          'million years ago record about 400 days a year and a Moon at about 96.5 percent of its ',
          'present distance (Williams 2000).',
        ),
        p(
          'Earth’s tides on the young Moon braked its spin until it turned once per orbit, so it keeps ',
          'one face toward us: ',
          term('tidal locking'),
          '. It has been locked for billions of years; exactly when it locked is uncertain. Jupiter’s ',
          'moon Io, kept on an eccentric orbit by resonance with Europa and Ganymede, is flexed by a tide ',
          'that changes through each orbit. It is heated by about ',
          m`9 \times 10^{13}`,
          ' watts (Lainey et al. 2009), making it the most volcanically active world known.',
        ),
        p(
          'A body held together only by its own gravity is torn apart inside the ',
          term('Roche limit', 'roche-limit'),
          ': ',
          m`d = 2.44\,R_p(\rho_p/\rho_s)^{1/3}`,
          ' for a fluid body that deforms freely, ',
          m`1.26\,R_p(\rho_p/\rho_s)^{1/3}`,
          ' for a rigid one. For solid ice around Saturn the fluid limit is about 2.1 Saturn radii; for ',
          'the fluffy, porous ice of real ring particles it is nearer 2.5, outside all the main rings, whose ',
          'outer edge is at 2.27. The same differences in pull ',
          'stretch a body falling into a black hole, and draw tidal tails out of passing galaxies.',
        ),
      ),
    },

    /* 7 ------------------------------------------------------------------ */
    connections: {
      links: [
        {
          moduleId: 'black-holes',
          reason: 'Near a small black hole the same stretch, falling as the cube of distance, would pull a person apart.',
        },
        {
          moduleId: 'galaxies',
          reason: 'Scaled up to galaxies, the tidal force throws stars out into long tidal tails.',
        },
        {
          moduleId: 'kepler-orbits',
          reason: 'The Moon’s orbit and its changing distance, perigee to apogee, are Kepler’s ellipse at work.',
        },
        {
          moduleId: 'habitable-zone',
          reason: 'Planets close to their stars, like TRAPPIST-1’s, are expected to be tidally locked, one side always in daylight.',
        },
      ],
    },
  },

  references: [
    {
      label: 'Williams & Boggs 2016, “Secular tidal changes in lunar orbit and Earth rotation”, Celest. Mech. Dyn. Astron. 126, 89',
      url: 'https://doi.org/10.1007/s10569-016-9702-3',
      note: 'Lunar laser ranging: the Moon recedes 38.30 ± 0.09 mm a year',
    },
    {
      label: 'Stephenson, Morrison & Hohenkerk 2016, “Measurement of the Earth’s rotation: 720 BC to AD 2015”, Proc. R. Soc. A 472, 20160404',
      url: 'https://doi.org/10.1098/rspa.2016.0404',
      note: 'The day lengthens 1.78 ms a century, against 2.3 from tides alone',
    },
    {
      label: 'Egbert & Ray 2000, “Significant dissipation of tidal energy in the deep ocean inferred from satellite altimeter data”, Nature 405, 775',
      url: 'https://doi.org/10.1038/35015531',
      note: 'Where tidal energy is lost, from TOPEX/Poseidon',
    },
    {
      label: 'Williams 2000, “Geological constraints on the Precambrian history of Earth’s rotation and the Moon’s orbit”, Rev. Geophys. 38, 37',
      url: 'https://doi.org/10.1029/1999RG900016',
      note: 'Tidal rhythmites: about 400 days a year 620 million years ago',
    },
    {
      label: 'Lainey et al. 2009, “Strong tidal dissipation in Io and Jupiter from astrometric observations”, Nature 459, 957',
      url: 'https://doi.org/10.1038/nature08108',
      note: 'Io’s tidal heating, (9.33 ± 1.84) × 10¹³ W',
    },
  ],
};

export default tides;

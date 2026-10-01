/**
 * One definition per term, for readers arriving without physics.
 *
 * Central rather than per-module on purpose. `isco` means the same thing in
 * black holes and in gravitational waves, `sputtering` in escape velocity and in
 * atmospheres, and a definition duplicated across module files is a definition
 * that drifts. Modules mark occurrences; this file says what they mean.
 *
 * The rules the entries are written to:
 *
 *   - One or two sentences, no jargon inside the definition. A tooltip that
 *     needs its own tooltip has failed.
 *   - Plain prose, no equations: a number can appear where the number is the
 *     point (a power of ten, a mass in kilograms), and a symbol only where the
 *     entry exists to name it, as λ is in escape parameter. This is the
 *     text a reader meets *before* layer 4, and it is read in a small panel.
 *   - `title` is the natural display form of the id — what the reader would
 *     expect to see written at the top of the panel — not the surface text that
 *     triggered it. "Solar mass" heads the panel whether the page said "solar
 *     masses" or "solar-mass".
 *
 * Both halves of the contract are tested in `tests/content.test.ts`: every
 * `term` node's `ref` resolves here, and every entry here is marked somewhere.
 * An unused entry is dead weight; a missing one is a broken tooltip.
 */

export interface GlossaryEntry {
  /** Display form of the id, shown as the panel's heading. */
  title: string;
  /** The definition itself. Plain prose — rendered as text, never as an AST. */
  body: string;
}

export const glossary: Record<string, GlossaryEntry> = {
  /* Black holes ---------------------------------------------------- */

  'solar-mass': {
    title: 'Solar mass',
    body: 'The Sun’s mass used as a unit, about 2 × 10³⁰ kg. A ten-solar-mass hole weighs ten Suns.',
  },
  'schwarzschild-radius': {
    title: 'Schwarzschild radius',
    body: 'The radius of the event horizon: pack a mass inside it and nothing, light included, gets back out.',
  },
  isco: {
    title: 'ISCO',
    body: 'The closest distance at which anything can steadily orbit a black hole; closer than this, it spirals in.',
  },
  'accretion-disc': {
    title: 'Accretion disc',
    body: 'A swirling disc of hot gas spiralling into a compact object, glowing from friction as it falls.',
  },
  kerr: {
    title: 'Kerr',
    body: 'The exact description of a rotating black hole, found by Roy Kerr in 1963; non-rotating holes follow Schwarzschild’s simpler solution.',
  },
  ergosphere: {
    title: 'Ergosphere',
    body: 'A region just outside a spinning hole’s horizon where space itself is dragged around; the hole’s rotational energy can be extracted there.',
  },
  'proper-time': {
    title: 'Proper time',
    body: 'Time as measured by a clock you carry with you, not by a distant observer.',
  },
  eht: {
    title: 'EHT',
    body: 'A network of radio dishes across Earth acting as one planet-sized telescope; it photographed M87* and Sagittarius A*.',
  },
  'tidal-force': {
    title: 'Tidal force',
    body: 'The difference in gravity’s pull between the near and far side of an object, stretching it along its length.',
  },

  /* Cosmic microwave background ------------------------------------ */

  'cosmic-microwave-background': {
    title: 'Cosmic microwave background',
    body: 'The glow left over from the hot early universe, now stretched to microwaves and 2.7 K, arriving from every direction.',
  },
  recombination: {
    title: 'Recombination',
    body: 'The moment, about 380 000 years in, when the universe cooled enough for electrons to settle onto nuclei and light could travel freely. Despite the name, it was the first time they combined.',
  },
  'last-scattering': {
    title: 'Surface of last scattering',
    body: 'The shell of sky, at redshift about 1090, from which the microwave background light set out. Not an edge of the universe; the farthest we can see with light, because before it the universe was opaque.',
  },
  blackbody: {
    title: 'Blackbody',
    body: 'An object that absorbs all light falling on it and glows only because of its temperature. Its spectrum has one fixed shape, set by that temperature alone.',
  },
  anisotropy: {
    title: 'Anisotropy',
    body: 'Variation from one direction on the sky to another. In the microwave background, spots a few hundred-thousandths of a degree warmer or cooler than average.',
  },
  'cmb-dipole': {
    title: 'CMB dipole',
    body: 'The sky is about three thousandths of a degree hotter ahead of us and cooler behind: the fingerprint of our own motion through the background.',
  },
  'scale-factor': {
    title: 'Scale factor',
    body: 'A single number, a, recording how stretched the universe is compared with today, when a = 1. Any wavelength of light grows in step with it.',
  },
  'acoustic-peaks': {
    title: 'Acoustic peaks',
    body: 'The preferred sizes of the microwave background spots, set by sound waves in the early universe. The first and largest is about one degree across.',
  },
  'b-modes': {
    title: 'B-modes',
    body: 'A swirl pattern in the polarization of the microwave background. The primordial kind, left by gravitational waves from the first instant, is not yet found; a kind made by lensing has been seen since 2013.',
  },

  /* Early universe ------------------------------------------------- */

  'big-bang': {
    title: 'Big Bang',
    body: 'The hot, dense state the whole universe expanded from. Not an explosion at a place; it happened everywhere at once.',
  },
  'quark-gluon-plasma': {
    title: 'Quark–gluon plasma',
    body: 'Matter too hot for quarks to bind into protons and neutrons. The universe was this for its first twenty microseconds.',
  },
  nucleosynthesis: {
    title: 'Big Bang nucleosynthesis',
    body: 'The few minutes when protons and neutrons fused into helium and traces of deuterium and lithium. Nothing heavier was made until stars.',
  },
  'radiation-era': {
    title: 'Radiation era',
    body: 'The first fifty thousand years, when light and neutrinos outweighed matter and set the pace of expansion.',
  },
  'matter-radiation-equality': {
    title: 'Matter–radiation equality',
    body: 'The moment, about 50 000 years in, when the energy in matter first exceeded the energy in light. Matter has led since.',
  },
  'freeze-out': {
    title: 'Freeze-out',
    body: 'When the universe cools below a particle’s rest energy, light can no longer make it in pairs. What exists then is what survives.',
  },
  'degrees-of-freedom': {
    title: 'Degrees of freedom, g*',
    body: 'The count of particle species light enough to be made at a given temperature, with fermions weighted 7/8. Sets how fast the early universe cooled.',
  },
  inflation: {
    title: 'Inflation',
    body: 'A proposed burst of exponential expansion before the first microsecond that would explain why the universe is flat and uniform. Supported, not proven.',
  },
  'baryon-asymmetry': {
    title: 'Baryon asymmetry',
    body: 'For every billion particle–antiparticle pairs that annihilated, about one extra particle survived. That remainder is all the matter there is; why it existed is unknown.',
  },

  /* Escape velocity ------------------------------------------------ */

  apex: {
    title: 'Apex',
    body: 'The top of the flight: where the projectile stops climbing and starts falling back.',
  },
  ballistic: {
    title: 'Ballistic',
    body: 'Unpowered: all the speed is given at launch, and gravity alone does the rest.',
  },
  occultation: {
    title: 'Occultation',
    body: 'One body passing in front of another; timing when a star blinks out behind a planet measures the planet’s size.',
  },
  'shell-theorem': {
    title: 'Shell theorem',
    body: 'Newton’s result that a uniform sphere pulls exactly as if all its mass sat at its centre.',
  },
  'jeans-escape': {
    title: 'Jeans escape',
    body: 'Atmosphere loss one molecule at a time: the fastest few in the gas exceed escape velocity and leave.',
  },
  'hydrodynamic-escape': {
    title: 'Hydrodynamic escape',
    body: 'Atmosphere loss as a wind: a heated light gas flows outward in bulk, dragging heavier gases with it.',
  },
  sputtering: {
    title: 'Sputtering',
    body: 'Atmosphere loss by impact: solar-wind particles strike molecules at the top of the air and knock them into space.',
  },

  /* Exoplanets ----------------------------------------------------- */

  limb: {
    title: 'Limb',
    body: 'The visible edge of a star’s or planet’s disc.',
  },
  'impact-parameter': {
    title: 'Impact parameter',
    body: 'How far off-centre the planet crosses the star’s disc: zero through the middle, near one grazing the edge.',
  },
  'eclipsing-binary': {
    title: 'Eclipsing binary',
    body: 'Two stars orbiting edge-on to us, each dimming the other as it passes; their dips can mimic a planet’s.',
  },
  'hot-jupiter': {
    title: 'Hot Jupiter',
    body: 'A gas giant orbiting scorchingly close to its star, circling in days: the easiest kind of planet to find.',
  },
  'light-curve': {
    title: 'Light curve',
    body: 'A graph of a star’s brightness against time.',
  },

  /* Expansion of the universe -------------------------------------- */

  redshift: {
    title: 'Redshift',
    body: 'The fractional stretching of a light wave between leaving its source and arriving. Positive means longer, redder light.',
  },
  blueshift: {
    title: 'Blueshift',
    body: 'A shortening of the light wave: it arrives bluer than it left. Seen from galaxies approaching us faster than expansion carries them away.',
  },
  'hubble-constant': {
    title: 'Hubble constant',
    body: 'Today’s expansion rate: how much recession speed each unit of distance adds. Near 70 km/s per megaparsec; the exact value is disputed.',
  },
  'hubble-lemaitre-law': {
    title: 'Hubble–Lemaître law',
    body: 'Recession speed grows in step with distance: twice as far, twice as fast. Named for Edwin Hubble and Georges Lemaître.',
  },
  'recession-velocity': {
    title: 'Recession velocity',
    body: 'The rate at which the distance to a galaxy grows because space is expanding. Not motion through space.',
  },
  'peculiar-velocity': {
    title: 'Peculiar velocity',
    body: 'A galaxy’s own motion through space, on top of the expansion. Typically a few hundred km/s.',
  },
  'cosmological-redshift': {
    title: 'Cosmological redshift',
    body: 'The redshift of light crossing an expanding universe: the wave grows by the same factor the universe grew. Usually pictured as stretching, though a sum of tiny Doppler shifts describes it too.',
  },
  'type-ia-supernova': {
    title: 'Type Ia supernova',
    body: 'The explosion of a white dwarf star that has gained too much mass. All reach nearly the same peak brightness, so how bright one looks tells its distance.',
  },
  'cepheid-variable': {
    title: 'Cepheid variable',
    body: 'A star that brightens and dims on a regular cycle whose length reveals its true brightness, and so its distance.',
  },
  'lambda-cdm': {
    title: 'ΛCDM',
    body: 'The standard model of the universe: ordinary matter, cold dark matter and a constant dark energy, Λ, expanding from a hot beginning.',
  },
  'sound-horizon': {
    title: 'Sound horizon',
    body: 'How far pressure waves travelled through the hot early universe before it cleared, about 150 megaparsecs today. A fixed ruler that surveys measure against.',
  },
  'dark-energy': {
    title: 'Dark energy',
    body: 'Whatever is making the expansion speed up rather than slow down. About 70% of the universe’s energy today; its nature is unknown.',
  },

  /* Gravitational waves -------------------------------------------- */

  quadrupole: {
    title: 'Quadrupole',
    body: 'The simplest lopsidedness of a mass arrangement that can radiate gravitational waves; a perfect sphere cannot.',
  },
  'post-newtonian': {
    title: 'Post-Newtonian',
    body: 'Corrections added to Newtonian gravity, order by order in speed, to approach Einstein’s full theory.',
  },
  inspiral: {
    title: 'Inspiral',
    body: 'The final stage of a binary’s life: the orbit shrinking as gravitational waves carry energy away.',
  },
  ringdown: {
    title: 'Ringdown',
    body: 'The last vibration of the merged hole, ringing like a struck bell as it settles into shape.',
  },
  merger: {
    title: 'Merger',
    body: 'The moment the two objects finally touch and become one.',
  },
  strain: {
    title: 'Strain',
    body: 'The fractional stretch a passing wave gives any length; dimensionless, and around 10⁻²¹ at Earth.',
  },
  'luminosity-distance': {
    title: 'Luminosity distance',
    body: 'Distance inferred from how much a signal has faded on its way here.',
  },
  megaparsec: {
    title: 'Megaparsec',
    body: 'About 3.26 million light-years; GW150914’s source sat roughly 410 of them away.',
  },
  'cutoff-frequency': {
    title: 'Cutoff frequency',
    body: 'Where this model stops: the wave frequency at the last stable orbit, just before merger.',
  },
  'pulsar-timing-array': {
    title: 'Pulsar timing array',
    body: 'Millisecond pulsars watched as one galaxy-sized detector: passing waves subtly shift their tick arrivals.',
  },

  /* Kepler orbits -------------------------------------------------- */

  barycentre: {
    title: 'Barycentre',
    body: 'The shared centre of mass two bodies actually orbit; usually inside the star, though for the Sun and Jupiter just outside its surface.',
  },
  'angular-momentum': {
    title: 'Angular momentum',
    body: 'The measure of orbiting or spinning motion that stays constant unless something twists the system.',
  },
  'test-particle': {
    title: 'Test particle',
    body: 'A body so light its own gravity is ignored: it feels the pull without noticeably pulling back.',
  },
  'n-body': {
    title: 'N-body',
    body: 'Three or more bodies all pulling on each other; no formula solves it, only computation.',
  },
  arcsecond: {
    title: 'Arcsecond',
    body: 'One 3,600th of a degree: about a coin seen from four kilometres away.',
  },
  precession: {
    title: 'Precession',
    body: 'A slow rotation of the orbit’s ellipse itself, so the closest-approach point drifts around the star.',
  },

  /* Planetary atmospheres ------------------------------------------ */

  'escape-parameter': {
    title: 'Escape parameter',
    body: 'λ: the squared ratio of escape speed to thermal speed; escape rates depend on it exponentially.',
  },
  photochemistry: {
    title: 'Photochemistry',
    body: 'Chemistry driven by sunlight: high-altitude molecules are split apart, and the light fragments escape.',
  },
  'magnetic-dynamo': {
    title: 'Magnetic dynamo',
    body: 'The churning of a planet’s molten interior that generates its magnetic field, which deflects the solar wind but may not protect the air on net.',
  },
  'maxwell-boltzmann': {
    title: 'Maxwell–Boltzmann',
    body: 'The bell-shaped spread of molecular speeds in a gas: most middling, a few very fast.',
  },
  'red-dwarf': {
    title: 'Red dwarf',
    body: 'The smallest, coolest, most common kind of star: dim, long-lived, and violently flaring when young.',
  },

  /* Scale of the universe ------------------------------------------ */

  comoving: {
    title: 'Comoving',
    body: 'Distance with cosmic expansion factored out, so it stays fixed for galaxies riding the general flow.',
  },
  femtometre: {
    title: 'Femtometre',
    body: '10⁻¹⁵ metres: the scale of protons and atomic nuclei.',
  },
  'muonic-hydrogen': {
    title: 'Muonic hydrogen',
    body: 'Hydrogen with its electron swapped for a heavier muon, which orbits closer and probes the proton more sharply.',
  },
  'standard-deviation': {
    title: 'Standard deviation',
    body: 'The statistician’s yardstick for surprise; five of them makes chance a less than one-in-a-million explanation.',
  },

  /* Stellar fusion ------------------------------------------------- */

  'coulomb-barrier': {
    title: 'Coulomb barrier',
    body: 'The electrical repulsion two nuclei must overcome to touch. For two protons, about a million electronvolts; hundreds of times the energy they typically have in the Sun.',
  },
  'quantum-tunnelling': {
    title: 'Quantum tunnelling',
    body: 'A particle crossing a barrier it does not have the energy to climb. Not a trick of speed: the particle’s position is spread out, and part of that spread lies beyond the wall.',
  },
  'gamow-peak': {
    title: 'Gamow peak',
    body: 'The narrow range of collision energies where almost all fusion happens: high enough to tunnel, low enough that some particles actually have it.',
  },
  'proton-proton-chain': {
    title: 'Proton–proton chain',
    body: 'The sequence of reactions that turns four protons into one helium nucleus in stars like the Sun, releasing 26.7 MeV and two neutrinos.',
  },
  'solar-neutrino': {
    title: 'Solar neutrino',
    body: 'A neutrino made in the Sun’s core and reaching Earth eight minutes later, unscattered. Detecting them is how fusion in the core was confirmed directly.',
  },
  'cno-cycle': {
    title: 'CNO cycle',
    body: 'Fusion of hydrogen using carbon, nitrogen and oxygen as catalysts. Slower than the proton–proton chain in the Sun, dominant in heavier, hotter stars.',
  },
  superposition: {
    title: 'Superposition',
    body: 'A quantum state that is several classical possibilities at once, until a measurement picks one. Tunnelling is a consequence of it.',
  },

  /* Supernovae ----------------------------------------------------- */

  'white-dwarf': {
    title: 'White dwarf',
    body: 'The dense leftover core of a star like the Sun, about Earth’s size and half the Sun’s mass, held up not by heat but by a quantum rule that limits how tightly electrons can pack.',
  },
  'neutron-star': {
    title: 'Neutron star',
    body: 'The collapsed core of a massive star: about 1.4 solar masses packed into a city-sized sphere, denser than an atomic nucleus.',
  },
  'core-collapse-supernova': {
    title: 'Core-collapse supernova',
    body: 'The explosion of a star above about eight solar masses when its iron core gives way. Leaves a neutron star or a black hole.',
  },
  'chandrasekhar-limit': {
    title: 'Chandrasekhar limit',
    body: 'About 1.4 solar masses: the most a white dwarf, or a star’s inert core, can weigh before it must collapse.',
  },
  'standard-candle': {
    title: 'Standard candle',
    body: 'An object whose true brightness is known, so its apparent brightness gives its distance. Type Ia supernovae are the brightest ones.',
  },
  'apparent-magnitude': {
    title: 'Apparent magnitude',
    body: 'How bright something looks from Earth, on the astronomers’ scale where smaller is brighter: the Sun is −27, the full Moon −13, the faintest naked-eye stars +6.',
  },
  'main-sequence': {
    title: 'Main sequence',
    body: 'The long, steady phase of a star’s life, fusing hydrogen in its core. The Sun is about halfway through its ten billion years of it.',
  },
  'planetary-nebula': {
    title: 'Planetary nebula',
    body: 'The glowing shell of gas a Sun-like star sheds at the end of its life, lit by the white dwarf left at its centre. Nothing to do with planets.',
  },

  /* Habitable zone ------------------------------------------------- */

  'habitable-zone': {
    title: 'Habitable zone',
    body: 'The range of distances from a star where a planet with an Earth-like atmosphere could keep liquid water on its surface. A statement about temperature, not about life.',
  },
  'equilibrium-temperature': {
    title: 'Equilibrium temperature',
    body: 'The temperature a planet settles at when the starlight it absorbs balances the heat it radiates, with no atmosphere. Earth’s is 255 K; its surface is 288 K.',
  },
  'bond-albedo': {
    title: 'Bond albedo',
    body: 'The fraction of starlight a planet reflects back to space, over all wavelengths. Earth 0.30, Venus 0.77, the Moon 0.12.',
  },
  'greenhouse-effect': {
    title: 'Greenhouse effect',
    body: 'Warming of a surface by an atmosphere that lets sunlight in but absorbs the heat radiated back. Earth’s adds 33 K; Venus’s adds about 500 K.',
  },
  'runaway-greenhouse': {
    title: 'Runaway greenhouse',
    body: 'What happens when a planet gets warm enough that its evaporating oceans trap more heat, which evaporates more ocean, until the oceans are gone. Venus, probably.',
  },
  'tidal-locking': {
    title: 'Tidal locking',
    body: 'A planet turning one face permanently to its star, as the Moon does to Earth. Expected for planets in the habitable zones of red dwarfs.',
  },

  /* Nebulae -------------------------------------------------------- */

  'emission-nebula': {
    title: 'Emission nebula',
    body: 'A cloud of gas made to glow by the ultraviolet light of hot stars inside it. The Orion Nebula is one; astronomers call them H II regions.',
  },
  'h-ii-region': {
    title: 'H II region',
    body: 'The astronomers’ name for an emission nebula: a region where hydrogen is ionized (H II, as against neutral H I). Wherever massive stars have just formed.',
  },
  ionization: {
    title: 'Ionization',
    body: 'Knocking the electron off an atom. Ultraviolet light shorter than 91.2 nm can do it to hydrogen; only stars hotter than about 25 000 K make much of it.',
  },
  'stromgren-sphere': {
    title: 'Strömgren sphere',
    body: 'The sphere of ionized gas a hot star can maintain: the size at which atoms recombine exactly as fast as the star’s ultraviolet re-ionizes them.',
  },
  'forbidden-line': {
    title: 'Forbidden line',
    body: 'Light from an atomic transition so slow that in any laboratory the atom is bumped out of the state first. In a nebula, nothing bumps it, so the line shines: the green of oxygen is one.',
  },
  'reflection-nebula': {
    title: 'Reflection nebula',
    body: 'A cloud that shines only by scattering the light of nearby stars, and so shows their colour, usually blue. The haze around the Pleiades is one.',
  },
  'dark-nebula': {
    title: 'Dark nebula',
    body: 'A cloud dense and dusty enough to block the stars behind it. The Horsehead is one; new stars form inside them.',
  },

  /* Distance ladder ------------------------------------------------ */

  'cosmic-distance-ladder': {
    title: 'Cosmic distance ladder',
    body: 'The chain of methods for measuring distances in space, each calibrated by the one below it, from parallax in our neighbourhood to supernovae billions of light-years away.',
  },
  parallax: {
    title: 'Parallax',
    body: 'The shift of a nearby star against the distant background as Earth moves around the Sun. One arcsecond of shift means one parsec, 3.26 light-years, away.',
  },
  'leavitt-law': {
    title: 'Leavitt law',
    body: 'The rule, noticed by Henrietta Swan Leavitt in 1908 and published in 1912, that brighter Cepheid variables pulse more slowly. Timing one gives its true brightness.',
  },
  'absolute-magnitude': {
    title: 'Absolute magnitude',
    body: 'How bright a star would look from a standard distance of 10 parsecs. The Sun’s is +4.8; a 30-day Cepheid’s is about −5.2.',
  },
  'distance-modulus': {
    title: 'Distance modulus',
    body: 'Apparent minus absolute magnitude, 5 log₁₀(d / 10 pc). Each 5 magnitudes is a factor of ten in distance.',
  },
  'hubble-flow': {
    title: 'Hubble flow',
    body: 'Distances great enough that a galaxy’s recession swamps its own motion, so that speed tracks distance: beyond about 50 megaparsecs.',
  },

  /* Time dilation -------------------------------------------------- */

  'time-dilation': {
    title: 'Time dilation',
    body: 'Clocks running at different rates for different observers: slower when moving fast, and slower deep in gravity. Measured with atomic clocks on aircraft, satellites and a staircase.',
  },
  'lorentz-factor': {
    title: 'Lorentz factor',
    body: 'γ = 1/√(1 − v²/c²): how much slower a moving clock runs. 1.000000000000005 at motorway speed, 1.67 at 80 percent of light speed, and without limit as speed nears c.',
  },
  'twin-paradox': {
    title: 'Twin paradox',
    body: 'A twin who travels and returns is younger than the one who stayed. Not a contradiction: only the traveller changed direction, so the two paths through spacetime differ.',
  },
  'gravitational-time-dilation': {
    title: 'Gravitational time dilation',
    body: 'Clocks deeper in gravity run slower. A clock on the ground loses about 60 microseconds a day against one far out in space.',
  },
  'closed-timelike-curve': {
    title: 'Closed timelike curve',
    body: 'A path through spacetime that returns to its own past. Some solutions of general relativity contain them; none has ever been found in nature.',
  },

  /* Hawking radiation ---------------------------------------------- */

  'hawking-radiation': {
    title: 'Hawking radiation',
    body: 'Faint thermal glow predicted from every black hole by quantum theory. The smaller the hole, the hotter the glow; for any known black hole it is far too faint to detect.',
  },
  'hawking-temperature': {
    title: 'Hawking temperature',
    body: 'The temperature of a black hole’s glow, inversely proportional to its mass: 60 billionths of a kelvin for the Sun’s mass, a hundred billion kelvin for a mountain’s.',
  },
  'primordial-black-hole': {
    title: 'Primordial black hole',
    body: 'A black hole that might have formed in the first second of the universe, from a dense clump rather than a dying star, and could have any mass. None has been found.',
  },
  'negative-heat-capacity': {
    title: 'Negative heat capacity',
    body: 'Getting hotter by losing energy. Black holes do it: as one radiates it shrinks, and as it shrinks it heats up, so evaporation runs faster and faster.',
  },
  'analogue-gravity': {
    title: 'Analogue gravity',
    body: 'Laboratory systems, such as a flowing fluid with a point sound cannot escape, that mimic a black hole’s horizon closely enough to show Hawking-like radiation.',
  },

  /* Wormholes ------------------------------------------------------ */

  wormhole: {
    title: 'Wormhole',
    body: 'A tunnel through space joining two distant places, allowed by general relativity. None has ever been observed, and holding one open would need matter with negative energy.',
  },
  'einstein-rosen-bridge': {
    title: 'Einstein–Rosen bridge',
    body: 'The wormhole hidden in the mathematics of a simple black hole, first glimpsed by Ludwig Flamm in 1916 and made explicit by Einstein and Rosen in 1935. It pinches shut faster than light can cross it.',
  },
  'exotic-matter': {
    title: 'Exotic matter',
    body: 'Matter with negative energy density, the ingredient a traversable wormhole needs. Tiny amounts appear in quantum effects; the large amounts a wormhole would need have never been seen.',
  },
  'casimir-effect': {
    title: 'Casimir effect',
    body: 'A small attraction between two metal plates very close together, caused by the vacuum between them having slightly less energy than the vacuum outside. Measured since 1997.',
  },
  'white-hole': {
    title: 'White hole',
    body: 'A black hole run backwards in time: a region nothing can enter and from which things can only leave. Allowed by the equations, unstable, and never observed.',
  },
  'energy-condition': {
    title: 'Energy condition',
    body: 'A rule that ordinary matter obeys, such as never having negative energy density. Wormholes need these rules broken.',
  },
};

/** The entry a `term` node points at, or undefined if the id is unknown. */
export function lookup(ref: string): GlossaryEntry | undefined {
  return glossary[ref];
}

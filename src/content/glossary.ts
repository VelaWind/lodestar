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
    body: 'A region just outside a spinning hole’s horizon where space itself is dragged around; orbital energy can be extracted there.',
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
    body: 'The shell of sky, at redshift about 1090, from which the microwave background light set out. Not an edge of the universe; the farthest point light can come from.',
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
    body: 'A swirl pattern in the polarization of the microwave background that gravitational waves from the first instant would leave. Searched for; not yet found.',
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
    body: 'Redshift caused by space stretching while the light travels: the wave grows by the same factor the universe grew. Distinct from a Doppler shift.',
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
    body: 'The shared centre of mass two bodies actually orbit; for a star and planet it sits just off the star’s centre.',
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
    body: 'The churning of a planet’s molten interior that generates its magnetic field and shields its air.',
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
    body: 'The statistician’s yardstick for surprise; five of them makes chance a one-in-a-million explanation.',
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
};

/** The entry a `term` node points at, or undefined if the id is unknown. */
export function lookup(ref: string): GlossaryEntry | undefined {
  return glossary[ref];
}

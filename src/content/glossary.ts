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
 *   - No math, no exponents beyond a written-out power, no symbols. This is the
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
};

/** The entry a `term` node points at, or undefined if the id is unknown. */
export function lookup(ref: string): GlossaryEntry | undefined {
  return glossary[ref];
}

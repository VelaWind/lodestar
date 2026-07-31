---
name: physics-accuracy
description: Physical constants, unit handling, formula conventions, and number formatting for Lodestar. Use this whenever writing or reviewing simulation code, defining a Param, adding any constant or equation, converting between astronomical units, or displaying a numeric value to the reader. Trigger it for anything involving a physical quantity — including tasks that look like plain UI work, such as "add a distance slider" or "format this readout" — since those are exactly where unit bugs get introduced.
---

# Physics accuracy in Lodestar

Lodestar's central promise is that the visualizations are not decorative. A
reader who drags a slider is driving a real calculation. Break that and the math
layer becomes a lie the reader can check.

## The one non-negotiable rule

**Everything internal is SI base units.** Metres, kilograms, seconds, kelvin.

Astronomical units, light-years, parsecs, solar masses, and years are
**presentation formats only**. They are applied at the moment of display and
never stored, never passed between functions, never used in a calculation.

```ts
// Correct
const distance = 4.0175e16;          // m
display(formatDistance(distance));    // "4.24 light-years"

// Wrong — unit ambiguity will spread through the codebase
const distance = 4.24;                // light-years? AU? parsecs?
```

If a function takes a physical quantity, its parameter name or a comment states
the unit. No exceptions.

## Canonical constants

Define these once in `src/physics/constants.ts` and import from there. Never
inline a constant, and never round one at the point of use.

```ts
// Exact by definition
export const C = 299_792_458;              // m/s, speed of light
export const AU = 1.495_978_707e11;        // m
export const LIGHT_YEAR = 9.460_730_472_5808e15;  // m (c × Julian year)
export const JULIAN_YEAR = 3.155_76e7;     // s
export const H = 6.626_070_15e-34;         // J·s, Planck
export const K_B = 1.380_649e-23;          // J/K, Boltzmann

// Measured
export const G = 6.674_30e-11;             // m³ kg⁻¹ s⁻², gravitational
export const PARSEC = 3.085_677_581e16;    // m
export const SIGMA_SB = 5.670_374_419e-8;  // W m⁻² K⁻⁴, Stefan–Boltzmann

// Bodies
export const M_SUN = 1.988_4e30;           // kg
export const R_SUN = 6.957e8;              // m
export const L_SUN = 3.828e26;             // W
export const M_EARTH = 5.972_2e24;         // kg
export const R_EARTH = 6.371e6;            // m, mean radius

// Scale
export const OBSERVABLE_UNIVERSE_RADIUS = 4.4e26;  // m, ≈46.5 billion ly
```

Never hardcode a derived number. If a module needs Earth's orbital period, it
computes it from `G`, `M_SUN`, and the semi-major axis — it does not paste in
365.25.

## Formatting for display

Readers are beginners. Raw scientific notation is a wall.

- Below 10 000 and above 0.01: plain decimal, sensible significant figures.
- Outside that: pick the natural astronomical unit and name it. Metres for
  human scales, kilometres up to planetary, AU within a solar system,
  light-years beyond, parsecs only in layers 4 and 5.
- Scientific notation only when no named unit helps, and always with a
  human comparison alongside on first use.
- **Round every displayed number.** JS float arithmetic leaks artifacts;
  `Math.round`, `toFixed(n)`, or `Intl.NumberFormat` before anything reaches
  the screen.
- Significant figures should reflect real precision. Do not print
  `1.4959787070000002e11` — and do not print six figures for a quantity known
  to two.

## Formula conventions

- **Angles are radians internally.** Convert to degrees or arcseconds only at
  display. This is the second most common bug after unit mixing.
- Write formulas in the standard physics form, then translate to code directly
  below, so the math layer and the implementation are visibly the same thing.
- Keep the simulation's calculation and the math layer's displayed equation
  reading from one shared function. If they can drift apart, they will.

Common ones for early modules:

```
Light travel time      t = d / c
Angular size           θ = 2 · arctan(r / d)
Parallax distance      d[pc] = 1 / p[arcsec]
Orbital period         T² = 4π²a³ / (G·M)
Escape velocity        v = √(2GM / r)
Schwarzschild radius   r_s = 2GM / c²
Inverse square law     F = L / (4π d²)
Stefan–Boltzmann       L = 4π R² σ T⁴
```

## Logarithmic scales

Most astronomical ranges are logarithmic. When a slider uses `scale: 'log'`:

- The slider position maps to `log10(value)`, not to `value`.
- Interpolate in log space. Linear interpolation across 20 orders of magnitude
  produces a control where 99.99% of the travel is one decade.
- Guard against zero and negative inputs before taking a log.

## Approximation disclosure

Simplifying is allowed. Hiding it is not. Lodestar serves readers who already
know the field, and an undisclosed simplification is the fastest way to be
written off as toy-grade.

If a simulation uses circular orbits instead of elliptical, ignores relativistic
effects, treats a body as a point mass, assumes a flat geometry, or drops a
term:

- **Disclose it beside the simulation itself**, in one line, not buried in
  prose further down the page. "Orbits are circular here; real ones are
  ellipses." An expert spots the simplification within seconds and should find
  that Lodestar said it first.
- **Say what it costs.** Which regime the approximation holds in, and roughly
  where the error becomes significant.
- **Consider a precision toggle.** Where the exact version is tractable —
  elliptical orbits, a relativistic correction, a finite-size body — offer it
  as a switch rather than shipping only the simplified model. Default to
  simplified; let the reader turn on the real thing.

The going-deeper layer is where the full treatment lives. The disclosure beside
the sim is the pointer to it.

## Sanity checks

Before considering any simulation correct, verify against a known value:

- Earth's orbital period from `T² = 4π²a³/(G·M_SUN)` → 365.25 days (±0.1%)
- Sun's angular size from Earth → about 0.53°
- Escape velocity from Earth's surface → 11.2 km/s
- Schwarzschild radius of one solar mass → about 2.95 km
- Light travel time, Sun to Earth → about 8 minutes 20 seconds
- If a sim cannot reproduce these, the sim is wrong — not the constants.

## Sources

Constants follow CODATA and the IAU. When adding a new one, cite the source in
a comment. When a figure is uncertain or disputed (Hubble constant, exoplanet
masses), note the uncertainty rather than picking a number and presenting it as
settled.

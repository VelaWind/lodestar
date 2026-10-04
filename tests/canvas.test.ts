/**
 * Every sim's drawing, replayed at every width the shell can produce and at each
 * parameter's extremes.
 *
 * This is the harness that found four real defects during the mobile pass — a
 * clipped axis label, two apsis labels off both edges, a caption wider than the
 * frame — none of which a typecheck, a build or a screenshot at one width would
 * have caught. It is committed here so those defects cannot come back, and so a
 * new sim inherits the check for free.
 *
 * The widths are the canvas widths the layout actually yields: a 375 px phone
 * gives the sim panel 301 px (viewport − main px-5 − panel p-4 − border), a
 * 390 px phone 316, and so on up to a wide desktop. Heights are the fixed
 * `h-[…]` on each sim's canvas box.
 */
import { describe, expect, it } from 'vitest';

import blackHoles from '@/content/modules/black-holes';
import exoplanets from '@/content/modules/exoplanets';
import cosmicMicrowaveBackground from '@/content/modules/cosmic-microwave-background';
import earlyUniverse from '@/content/modules/early-universe';
import stellarFusion from '@/content/modules/stellar-fusion';
import supernovae from '@/content/modules/supernovae';
import habitableZone from '@/content/modules/habitable-zone';
import nebulae from '@/content/modules/nebulae';
import cosmicDistanceLadder from '@/content/modules/cosmic-distance-ladder';
import timeDilation from '@/content/modules/time-dilation';
import hawkingRadiation from '@/content/modules/hawking-radiation';
import wormholes from '@/content/modules/wormholes';
import escapeVelocity from '@/content/modules/escape-velocity';
import expansionOfTheUniverse from '@/content/modules/expansion-of-the-universe';
import gravitationalWaves from '@/content/modules/gravitational-waves';
import keplerOrbits from '@/content/modules/kepler-orbits';
import planetaryAtmospheres from '@/content/modules/planetary-atmospheres';
import scaleOfTheUniverse, { scaleAnchors } from '@/content/modules/scale-of-the-universe';

import { __internals as bh } from '@/sims/black-holes';
import { __internals as ep } from '@/sims/exoplanets';
import { __internals as cmb } from '@/sims/cosmic-microwave-background';
import { __internals as early } from '@/sims/early-universe';
import { __internals as fusion } from '@/sims/stellar-fusion';
import { __internals as sn } from '@/sims/supernovae';
import { __internals as hz } from '@/sims/habitable-zone';
import { __internals as neb } from '@/sims/nebulae';
import { __internals as cdl } from '@/sims/cosmic-distance-ladder';
import { __internals as td } from '@/sims/time-dilation';
import { __internals as hr } from '@/sims/hawking-radiation';
import { __internals as wh } from '@/sims/wormholes';
import { __internals as ns } from '@/sims/neutron-stars';
import neutronStars from '@/content/modules/neutron-stars';
import { beamVisibility, equatorialSpeedFraction, surfaceGravity } from '@/physics/neutronstar';
import { __internals as dm } from '@/sims/dark-matter';
import darkMatter from '@/content/modules/dark-matter';
import { markerReadout, rotationCurve } from '@/physics/darkmatter';
import { __internals as gx } from '@/sims/galaxies';
import galaxiesModule from '@/content/modules/galaxies';
import { MAIN_STARS, encounterSteps, endTime, simulateEncounter, type Encounter } from '@/physics/galaxies';
import { massEvaporatingIn, massForHawkingTemperature, netWithCMB } from '@/physics/hawking';
import { __internals as ev } from '@/sims/escape-velocity';
import { __internals as eu } from '@/sims/expansion-of-the-universe';
import { __internals as gw } from '@/sims/gravitational-waves';
import { __internals as ko } from '@/sims/kepler-orbits';
import { __internals as pa } from '@/sims/planetary-atmospheres';
import { __internals as su } from '@/sims/scale-of-the-universe';

import { apexAltitude, integrateFlight, timestepForFlight, vEsc } from '@/physics/escape';
import { chirpMass, fCutoff } from '@/physics/gw';
import { orbitGeometry, period, stateAt } from '@/physics/kepler';
import { transitShape } from '@/physics/transit';
import { GASES, retentionVerdict } from '@/physics/atmosphere';
import {
  dipoleAmplitude,
  lineOfSightVelocity,
  observedWavelength,
  redshiftFromVelocity,
} from '@/physics/cosmology';
import {
  AGE_UNIVERSE,
  AU,
  C,
  EV,
  H_ALPHA_AIR,
  JULIAN_YEAR,
  KM_S_PER_MPC,
  LIGHT_YEAR,
  L_SUN,
  MEGAPARSEC,
  M_EARTH,
  M_MOON,
  M_SUN,
  PARSEC,
  R_EARTH,
  R_SUN,
  T_CMB,
} from '@/physics/constants';
import {
  hawkingTemperature,
  iscoRadius,
  photonSphereRadius,
  schwarzschildRadius,
} from '@/physics/blackhole';

import type { Param } from '@/content/types';
import { MAX_TRAIL_ALPHA, createTrail, pushTrail } from '@/visual/trail';
import {
  describeRecord,
  alphasOutOfRange,
  badGlowRadii,
  nonFiniteDraws,
  recordingContext,
  textCollisions,
  textOutsideFrame,
} from './helpers/recordingContext';

/** 246 and 301 are a 320 px and a 375 px phone; 900 is a wide desktop. */
const WIDTHS = [246, 301, 316, 375, 660, 700, 900];

/** One scene to draw, with a label that says which slider settings made it. */
interface Case {
  label: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

/** min, default and max for a param — the three settings most likely to break. */
function extremes(param: Param): { stop: string; value: number }[] {
  return [
    { stop: 'min', value: param.min },
    { stop: 'default', value: param.default },
    { stop: 'max', value: param.max },
  ];
}

function paramOf(params: Param[], id: string): Param {
  const found = params.find((p) => p.id === id);
  if (!found) throw new Error(`no param "${id}"`);
  return found;
}

/* ------------------------------- escape velocity ------------------------------ */

function escapeCases(): Case[] {
  const params = escapeVelocity.layers.play.params;
  const cases: Case[] = [];

  for (const m of extremes(paramOf(params, 'M'))) {
    for (const r of extremes(paramOf(params, 'R'))) {
      for (const v of extremes(paramOf(params, 'v0'))) {
        const apex = apexAltitude(m.value, r.value, v.value);
        const escaping = v.value >= vEsc(m.value, r.value);
        const axis = ev.makeAxis(r.value, apex, escaping);
        // One integration per parameter combination, reused across widths.
        const flight = integrateFlight(
          m.value,
          r.value,
          v.value,
          timestepForFlight(m.value, r.value, v.value, axis.hTop),
          axis.hTop,
        );
        const end = flight.samples[flight.samples.length - 1];
        const stem = `M=${m.stop} R=${r.stop} v0=${v.stop}`;

        cases.push({
          label: `${stem} ready`,
          draw: (ctx, w, h) =>
            ev.drawScene(ctx, w, h, {
              apex,
              escaping,
              axis,
              flight: null,
              cursor: 0,
              altitude: 0,
              phase: 'ready',
              staticPath: false,
            }),
        });
        cases.push({
          label: `${stem} flown`,
          draw: (ctx, w, h) =>
            ev.drawScene(ctx, w, h, {
              apex,
              escaping,
              axis,
              flight,
              cursor: flight.samples.length - 1,
              altitude: end?.altitude ?? 0,
              phase: ev.endPhaseFor(escaping, apex, axis.hTop),
              staticPath: true,
            }),
        });
      }
    }
  }

  /**
   * Near the threshold the outcome comes from the closed forms, not the step cap.
   *
   * At 11.1 km/s on Earth the apex is about 409,000 km and the frame holds it,
   * but the flight takes about eleven days, more than the integrator's step
   * budget at Earth's natural timestep. The cap used to be reported as "left the
   * frame", so the status said "apex is above the frame" over a drawn apex.
   */
  it('lands at 11.0 and 11.1 km/s and escapes at 11.2 on Earth, with no step cap', () => {
    const cases: [number, string][] = [
      [11_000, 'landed'],
      [11_100, 'landed'],
      [11_200, 'escaped'],
    ];
    for (const [v0, expected] of cases) {
      const apex = apexAltitude(M_EARTH, R_EARTH, v0);
      const escaping = v0 >= vEsc(M_EARTH, R_EARTH);
      const axis = ev.makeAxis(R_EARTH, apex, escaping);
      const flight = integrateFlight(
        M_EARTH,
        R_EARTH,
        v0,
        timestepForFlight(M_EARTH, R_EARTH, v0, axis.hTop),
        axis.hTop,
      );
      expect(ev.endPhaseFor(escaping, apex, axis.hTop), `${v0} m/s`).toBe(expected);
      expect(flight.stepCapped, `${v0} m/s ran out of steps`).toBe(false);
      if (expected === 'landed') {
        expect(apex, `${v0} m/s apex inside the frame`).toBeLessThan(axis.hTop);
        expect(flight.samples.at(-1)?.landed, `${v0} m/s path reaches the ground`).toBe(true);
        // The drawn path's peak, against the closed form. Near the threshold the
        // apex is very sensitive to energy, 1/(1 − v₀²/v_esc²), and the old
        // semi-implicit Euler start's launch-step energy offset showed up
        // magnified, 3.5% at 11.1 km/s. The velocity-Verlet step's half kick
        // removes it: 0.001% now, held here to a hundredth of a percent.
        expect(Math.abs(flight.peakAltitude / apex - 1), `${v0} m/s integrated apex`).toBeLessThan(1e-4);
      } else {
        expect(flight.leftFrame, `${v0} m/s leaves through the top`).toBe(true);
      }
    }
    // The case the review found: 409,000 km, drawn and reported as landing.
    expect(apexAltitude(M_EARTH, R_EARTH, 11_100) / 1e3).toBeCloseTo(409_000, -4);
  });

  /** One flight as the sim runs it: its axis, its timestep, its integration. */
  function simFlight(M: number, R: number, v0: number) {
    const apex = apexAltitude(M, R, v0);
    const escaping = v0 >= vEsc(M, R);
    const axis = ev.makeAxis(R, apex, escaping);
    const flight = integrateFlight(M, R, v0, timestepForFlight(M, R, v0, axis.hTop), axis.hTop);
    return { apex, top: axis.hTop, flight };
  }

  /**
   * A flight whose closed-form apex is just above the frame top climbs out.
   *
   * At 11,131 m/s on Earth the apex is 641,168 km against a 637,100 km frame
   * top. The old start lost enough energy that the drawn path turned back at
   * 618,795 km, and the old timestep ran out of steps at 616,731 km; the
   * half-kick start and a dt sized from the closed-form time to the frame top
   * fix both.
   */
  it('lets 11,131 m/s on Earth leave the frame, with no step cap', () => {
    const { apex, top, flight } = simFlight(M_EARTH, R_EARTH, 11_131);
    expect(apex).toBeGreaterThan(top);
    expect(flight.leftFrame).toBe(true);
    expect(flight.stepCapped).toBe(false);
  });

  /**
   * Near the threshold, across Earth and a coarse grid of the M and R sliders:
   * the step cap is never hit, and a flight whose closed-form apex is above the
   * frame top always leaves it, so the drawn path agrees with the status.
   */
  it('never runs out of steps near the threshold, and leaves the frame whenever the apex is above it', () => {
    const ratios: number[] = [];
    for (let i = 0; i <= 18; i += 1) ratios.push(0.99 + i * 0.0005);
    const grid: [number, number][] = [[M_EARTH, R_EARTH]];
    const M = paramOf(params, 'M');
    const R = paramOf(params, 'R');
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        grid.push([
          10 ** (Math.log10(M.min) + ((Math.log10(M.max) - Math.log10(M.min)) * i) / 3),
          10 ** (Math.log10(R.min) + ((Math.log10(R.max) - Math.log10(R.min)) * j) / 3),
        ]);
      }
    }
    const vMax = paramOf(params, 'v0').max;
    let flights = 0;
    for (const [m, r] of grid) {
      const ve = vEsc(m, r);
      for (const x of ratios) {
        const v0 = x * ve;
        if (v0 > vMax) continue;
        const { apex, top, flight } = simFlight(m, r, v0);
        const label = `M=${m.toExponential(2)} R=${r.toExponential(2)} v0/v_esc=${x.toFixed(4)}`;
        expect(flight.stepCapped, `${label} ran out of steps`).toBe(false);
        if (apex > top) expect(flight.leftFrame, `${label} apex above the frame but path turned back`).toBe(true);
        flights += 1;
      }
    }
    expect(flights, 'the sweep reached the near-threshold band').toBeGreaterThan(100);
    // Each near-threshold flight is up to 1.5 million integration steps.
  }, 60_000);

  /**
   * The altitude axis must never label two ticks the same.
   *
   * At the heaviest body and the smallest radius, surface gravity is enormous
   * and an 8 km/s launch barely leaves the ground: the whole axis spans about a
   * metre and a half, and rounded to whole metres its four ticks read
   * "1 m / 1 m / 1 m / 0 m". An axis that repeats itself is worse than no axis,
   * because it looks like a working one.
   *
   * Asserted against what was drawn rather than against the tick generator.
   * The labels all share one x — they are right-aligned in the axis gutter — so
   * the biggest group of text records at a common x is the axis, and every
   * string in it has to be distinct.
   */
  it('labels every altitude tick differently at the steepest corner', () => {
    const M = paramOf(params, 'M').max;
    const R = paramOf(params, 'R').min;

    for (const v of extremes(paramOf(params, 'v0'))) {
      const apex = apexAltitude(M, R, v.value);
      const escaping = v.value >= vEsc(M, R);
      const axis = ev.makeAxis(R, apex, escaping);

      for (const width of [390, 900]) {
        const { ctx, records } = recordingContext();
        ev.drawScene(ctx, width, 352, {
          apex,
          escaping,
          axis,
          flight: null,
          cursor: 0,
          altitude: 0,
          phase: 'ready',
          staticPath: false,
        });

        const byColumn = new Map<number, string[]>();
        for (const record of records) {
          if (record.kind !== 'text' || record.text === undefined) continue;
          const column = Math.round(record.x1);
          byColumn.set(column, [...(byColumn.get(column) ?? []), record.text]);
        }
        const axisColumn = [...byColumn.values()]
          .filter((texts) => texts.includes('surface'))
          .sort((a, b) => b.length - a.length)[0];

        expect(axisColumn, `M=max R=min v0=${v.stop} at ${width}px: no axis labels drawn`).toBeDefined();
        expect(
          axisColumn!.length,
          `M=max R=min v0=${v.stop} at ${width}px: expected more than one tick`,
        ).toBeGreaterThan(1);
        expect(
          [...axisColumn!].sort(),
          `M=max R=min v0=${v.stop} at ${width}px: repeated altitude tick labels — ${axisColumn!.join(' / ')}`,
        ).toEqual([...new Set(axisColumn!)].sort());
      }
    }
  });

  return cases;
}

/* ---------------------------------- kepler ----------------------------------- */

function keplerCases(): Case[] {
  const params = keplerOrbits.layers.play.params;
  const cases: Case[] = [];

  for (const m of extremes(paramOf(params, 'M'))) {
    for (const a of extremes(paramOf(params, 'a'))) {
      for (const e of extremes(paramOf(params, 'e'))) {
        const T = period(m.value, a.value);
        const geom = orbitGeometry(a.value, e.value);
        const wedges = ko.buildWedges(m.value, a.value, e.value, T);
        const stem = `M=${m.stop} a=${a.stop} e=${e.stop}`;

        for (const sweep of [false, true]) {
          cases.push({
            label: `${stem} sweep=${sweep}`,
            draw: (ctx, w, h) =>
              ko.drawScene(ctx, w, h, {
                M: m.value,
                a: a.value,
                e: e.value,
                T,
                geom,
                t: T * 0.37,
                rate: T / 12,
                wedges: sweep ? wedges : [],
                sweep,
                frozen: false,
              }),
          });
        }
      }
    }
  }
  return cases;
}

/* ------------------------------- scale ladder -------------------------------- */

function scaleCases(): Case[] {
  const param = paramOf(scaleOfTheUniverse.layers.play.params, 's');
  const cases: Case[] = [];

  scaleAnchors.forEach((anchor, index) => {
    // Resting on the rung, and halfway through the zoom onto it.
    cases.push({
      label: `${anchor.id} resting`,
      draw: (ctx, w, h) =>
        su.drawScene(ctx, w, h, { index, from: null, started: 0, s: anchor.size }, param, 0),
    });
    cases.push({
      label: `${anchor.id} mid-transition`,
      draw: (ctx, w, h) =>
        su.drawScene(
          ctx,
          w,
          h,
          { index, from: Math.max(0, index - 1), started: 0, s: anchor.size },
          param,
          260,
        ),
    });
  });
  return cases;
}

/* -------------------------------- black holes -------------------------------- */

function blackHoleCases(): Case[] {
  const param = paramOf(blackHoles.layers.play.params, 'M');
  // The three stops, plus four masses chosen to land on each comparison
  // silhouette and on the crossovers between them.
  const masses = [
    { stop: 'min', value: param.min },
    { stop: 'default', value: param.default },
    { stop: '1e2 M_SUN', value: 1.9884e32 },
    { stop: '2e4 M_SUN', value: 3.9768e34 },
    { stop: '4.15e6 M_SUN', value: 8.2519e36 },
    { stop: '6.5e9 M_SUN', value: 1.2925e40 },
    { stop: 'max', value: param.max },
  ];

  return masses.map(({ stop, value }) => ({
    label: `M=${stop}`,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const rs = schwarzschildRadius(value);
      bh.drawScene(ctx, w, h, {
        rs,
        rPhoton: photonSphereRadius(value),
        rIsco: iscoRadius(value),
        comparison: bh.chooseComparison(2 * rs),
      });
    },
  }));
}

/* ---------------------------- gravitational waves ---------------------------- */

function gravitationalWaveCases(): Case[] {
  const params = gravitationalWaves.layers.play.params;
  const cases: Case[] = [];

  for (const a of extremes(paramOf(params, 'm1'))) {
    for (const b of extremes(paramOf(params, 'm2'))) {
      for (const d of extremes(paramOf(params, 'd'))) {
        const mc = chirpMass(a.value, b.value);
        const win = gw.windowFor(mc, d.value, fCutoff(a.value, b.value));
        const stem = `m1=${a.stop} m2=${b.stop} d=${d.stop}`;

        it(`${stem} has a drawable window`, () => {
          expect(win, `${stem}: no trace window`).not.toBeNull();
          expect(win && win.duration > 0).toBe(true);
          expect(win && Number.isFinite(win.peak) && win.peak > 0).toBe(true);
        });

        if (!win) continue;
        for (const progress of [0.01, 0.08, 0.5, 1]) {
          cases.push({
            label: `${stem} p=${progress}`,
            draw: (ctx, w, h) =>
              gw.drawScene(ctx, w, h, { mc, d: d.value, window: win, progress, samples: null }),
          });
        }
      }
    }
  }
  return cases;
}

/* -------------------------------- exoplanets --------------------------------- */

function exoplanetCases(): Case[] {
  const params = exoplanets.layers.play.params;
  const cases: Case[] = [];

  const masses = extremes(paramOf(params, 'Mstar'));
  const radii = extremes(paramOf(params, 'Rstar'));
  const planets = extremes(paramOf(params, 'Rp'));
  const distances = extremes(paramOf(params, 'a'));

  // The full cartesian is 81 scenes per width, which is more than the check
  // needs; sweeping each param against the others' defaults plus the two corners
  // that matter covers the same ground.
  const combinations: { label: string; ms: number; rs: number; rp: number; a: number }[] = [];
  for (const ms of masses) {
    for (const rs of radii) {
      for (const rp of planets) {
        for (const a of distances) {
          const varied = [ms.stop, rs.stop, rp.stop, a.stop].filter((s) => s !== 'default').length;
          if (varied > 2) continue;
          combinations.push({
            label: `M=${ms.stop} Rs=${rs.stop} Rp=${rp.stop} a=${a.stop}`,
            ms: ms.value,
            rs: rs.value,
            rp: rp.value,
            a: a.value,
          });
        }
      }
    }
  }

  // The degenerate corner the module documents: a planet twice Jupiter's radius
  // around a tenth-solar-radius star, where the depth saturates at total.
  combinations.push({
    label: 'total eclipse (2 R_J around 0.1 R_sun at 0.01 AU)',
    ms: paramOf(params, 'Mstar').default,
    rs: paramOf(params, 'Rstar').min,
    rp: paramOf(params, 'Rp').max,
    a: paramOf(params, 'a').min,
  });

  // And the corner where there is no transit at all: the orbit lies inside the
  // star, transitShape reports it, and the sim must draw a message rather than
  // a NaN coordinate.
  combinations.push({
    label: 'no transit (orbit inside the star)',
    ms: paramOf(params, 'Mstar').default,
    rs: paramOf(params, 'Rstar').max,
    rp: paramOf(params, 'Rp').default,
    a: paramOf(params, 'a').min,
  });

  for (const combination of combinations) {
    const shape = transitShape(combination.ms, combination.rs, combination.rp, combination.a);
    for (const progress of [0, 0.5, 1]) {
      cases.push({
        label: `${combination.label} p=${progress}`,
        draw: (ctx, w, h) =>
          ep.drawScene(ctx, w, h, {
            rs: combination.rs,
            rp: combination.rp,
            a: combination.a,
            shape,
            progress,
          }),
      });
    }
  }

  it('reaches both documented corners', () => {
    const total = transitShape(
      paramOf(params, 'Mstar').default,
      paramOf(params, 'Rstar').min,
      paramOf(params, 'Rp').max,
      paramOf(params, 'a').min,
    );
    expect(total.depth, 'depth should saturate at total eclipse').toBe(1);
    expect(total.transits).toBe(true);

    const none = transitShape(
      paramOf(params, 'Mstar').default,
      paramOf(params, 'Rstar').max,
      paramOf(params, 'Rp').default,
      paramOf(params, 'a').min,
    );
    expect(none.transits, 'orbit inside the star should report no transit').toBe(false);
    expect(Number.isNaN(none.total)).toBe(true);
  });

  return cases;
}

/* --------------------------- planetary atmospheres --------------------------- */

function atmosphereCases(): Case[] {
  const params = planetaryAtmospheres.layers.play.params;
  const masses = extremes(paramOf(params, 'M'));
  const radii = extremes(paramOf(params, 'R'));
  const temperatures = extremes(paramOf(params, 'T'));
  const cases: Case[] = [];

  const add = (label: string, m: number, r: number, t: number, gas: (typeof GASES)[number]) => {
    const escapeSpeed = vEsc(m, r);
    const verdict = retentionVerdict(m, r, t, gas.mass).verdict;
    cases.push({
      label: `${label} ${gas.id}`,
      draw: (ctx, w, h) =>
        pa.drawScene(ctx, w, h, { escapeSpeed, temperature: t, gas, verdict }),
    });
  };

  // Every gas at the defaults, then each parameter swept against the others'
  // defaults — the full cartesian across three sliders and six gases is 162
  // scenes per width, and sweeping one at a time covers the same ground.
  const dm = paramOf(params, 'M').default;
  const dr = paramOf(params, 'R').default;
  const dt = paramOf(params, 'T').default;

  for (const gas of GASES) {
    add('defaults', dm, dr, dt, gas);
    for (const m of masses) add(`M=${m.stop}`, m.value, dr, dt, gas);
    for (const r of radii) add(`R=${r.stop}`, dm, r.value, dt, gas);
    for (const t of temperatures) add(`T=${t.stop}`, dm, dr, t.value, gas);
  }

  // The two corners the axis has to stretch hardest for: a wide, fast
  // distribution against a near-origin escape line, and a spike against a line
  // far to the right.
  const h2 = GASES[0]!;
  const co2 = GASES[GASES.length - 1]!;
  add('lightest gas at max T on the smallest world', paramOf(params, 'M').min, paramOf(params, 'R').max, 2500, h2);
  add('heaviest gas at min T on the largest world', paramOf(params, 'M').max, paramOf(params, 'R').min, 50, co2);

  /*
   * The corner where the chart title and the escape label shared a line.
   *
   * Lightest world, hottest exosphere: the escape line lands far enough left
   * that the label centred on it clamps to the frame's left edge, which is
   * where the title is left-aligned. The two rendered interleaved —
   * "CO₂ æescapet 0.458 km/s". The sweeps above vary one slider against the
   * others' defaults and never put mass and temperature at opposite extremes
   * together, so none of them reached it.
   */
  for (const gas of GASES) {
    add(
      'collision corner: lightest world, hottest exosphere',
      paramOf(params, 'M').min,
      dr,
      paramOf(params, 'T').max,
      gas,
    );
  }

  it('keeps the chart title clear of the escape label at the light-and-hot corner', () => {
    // The specific pair that overprinted, asserted directly rather than only
    // through the sweep above, so a failure names the two labels involved.
    const escapeSpeed = vEsc(paramOf(params, 'M').min, dr);
    for (const gas of GASES) {
      for (const width of [390, 900]) {
        const { ctx, records } = recordingContext();
        pa.drawScene(ctx, width, 304, {
          escapeSpeed,
          temperature: paramOf(params, 'T').max,
          gas,
          verdict: retentionVerdict(paramOf(params, 'M').min, dr, paramOf(params, 'T').max, gas.mass)
            .verdict,
        });

        const collisions = textCollisions(records);
        expect(
          collisions.map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
          `${gas.id} at ${width}px: the title and the escape label overlap`,
        ).toEqual([]);
      }
    }
  });

  it('stretches the speed axis to hold both the curve and the threshold', () => {
    // Hydrogen at 2500 K on a small world: the escape line sits left of the peak.
    const wide = pa.speedAxisMax(vEsc(paramOf(params, 'M').min, paramOf(params, 'R').max), 4541);
    expect(wide).toBeGreaterThan(4 * 4541 * 0.99);

    // Carbon dioxide at 50 K on a heavy world: the line is far to the right, and
    // the axis has to follow it rather than clipping it off the frame.
    const narrow = pa.speedAxisMax(vEsc(paramOf(params, 'M').max, paramOf(params, 'R').min), 137);
    expect(narrow).toBeGreaterThan(vEsc(paramOf(params, 'M').max, paramOf(params, 'R').min));
  });

  return cases;
}

/* ------------------------- expansion of the universe ------------------------- */

const EXPANSION_HEIGHT = 400;

function expansionCases(): Case[] {
  const params = expansionOfTheUniverse.layers.play.params;
  const dMax = paramOf(params, 'd').max;
  const H0Max = paramOf(params, 'H0').max;
  const cases: Case[] = [];

  const scene = (d: number, H0: number, vPec: number, units: 'friendly' | 'technical', shown = 1) => {
    const vLos = lineOfSightVelocity(H0, d, vPec);
    const target = observedWavelength(H_ALPHA_AIR, redshiftFromVelocity(vLos));
    // `shown` < 1 is the observed line part-way through its slide from the lab.
    const lambdaShown = H_ALPHA_AIR + (target - H_ALPHA_AIR) * shown;
    return { d, H0, vPec, vLos, dMax, H0Max, lambdaShown, units };
  };

  for (const d of extremes(paramOf(params, 'd'))) {
    for (const H0 of extremes(paramOf(params, 'H0'))) {
      for (const v of extremes(paramOf(params, 'vPec'))) {
        for (const units of ['friendly', 'technical'] as const) {
          const stem = `d=${d.stop} H0=${H0.stop} vPec=${v.stop} ${units}`;
          for (const shown of [1, 0.4]) {
            cases.push({
              label: `${stem} shown=${shown}`,
              draw: (ctx, w, h) => eu.drawScene(ctx, w, h, scene(d.value, H0.value, v.value, units, shown)),
            });
          }
        }
      }
    }
  }

  /*
   * The crowded corner, asserted by name.
   *
   * At the far end of the distance slider the galaxy sits at the right edge of
   * the diagram, which is exactly where both reference lines are labelled. A
   * nonzero peculiar velocity then adds "its own motion" beside the dot, and it
   * has to find room without landing on "Planck 2018: 67.4" or "SH0ES 2022:
   * 73.0" — at every H₀, because the dot's height follows the slider through the
   * band both labels occupy.
   */
  it('keeps "its own motion" clear of both reference labels at the far edge', () => {
    for (const H0 of [60, 67.4, 70, 73.04, 76, 80]) {
      for (const vPec of [-1e6, -3e5, 3e5, 1e6]) {
        for (const units of ['friendly', 'technical'] as const) {
          for (const width of [246, 390, 900]) {
            const { ctx, records } = recordingContext();
            const H0s = H0 * KM_S_PER_MPC;
            eu.drawScene(ctx, width, EXPANSION_HEIGHT, scene(dMax, H0s, vPec, units));

            const texts = records.filter((r) => r.kind === 'text').map((r) => r.text);
            expect(texts, `H0=${H0} vPec=${vPec} ${units} @${width}: tick label missing`).toContain(
              'its own motion',
            );
            expect(
              textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
              `H0=${H0} vPec=${vPec} ${units} @${width}: labels overlap`,
            ).toEqual([]);
            expect(
              textOutsideFrame(records, width, EXPANSION_HEIGHT).map(describeRecord),
              `H0=${H0} vPec=${vPec} ${units} @${width}: text outside the frame`,
            ).toEqual([]);
          }
        }
      }
    }
  });

  it('prints a blueshift and an approach speed with a true minus, never a hyphen', () => {
    expect(eu.formatRedshift(-0.0033)).toBe('−0.0033');
    expect(eu.formatRedshift(0.0230)).toBe('0.0230');
    expect(eu.formatRedshift(-0.00001)).toBe('0.0000');
    expect(eu.formatKmS(-110_000)).toBe('−110 km/s');
    for (const text of [eu.formatRedshift(-0.0033), eu.formatKmS(-110_000)]) {
      expect(text).not.toContain('-');
    }
  });

  it('names the shift by its sign, and draws no motion tick when there is none', () => {
    const text = (d: number, vPec: number) => {
      const { ctx, records } = recordingContext();
      eu.drawScene(ctx, 700, EXPANSION_HEIGHT, scene(d, paramOf(params, 'H0').default, vPec, 'friendly'));
      return records.filter((r) => r.kind === 'text').map((r) => r.text);
    };
    // Coma: well into the Hubble flow, redshifted, no peculiar velocity.
    const coma = text(paramOf(params, 'd').default, 0);
    expect(coma).toContain('redshift');
    expect(coma).not.toContain('its own motion');
    // Andromeda's distance and approach: its own motion wins.
    const andromeda = text(2.4e22, -1.1e5);
    expect(andromeda).toContain('blueshift');
    expect(andromeda).toContain('its own motion');
  });

  return cases;
}

/* ------------------------ cosmic microwave background ------------------------ */

const CMB_HEIGHT = 416;

function cmbCases(): Case[] {
  const params = cosmicMicrowaveBackground.layers.play.params;
  const TMax = paramOf(params, 'T').max;
  const vMax = paramOf(params, 'v').max;
  const cases: Case[] = [];

  const scene = (T: number, lambda: number, v: number, units: 'friendly' | 'technical') => ({
    T,
    lambda,
    v,
    vMax,
    TMax,
    units,
  });

  // The three slider stops each, plus the temperatures where the moving labels
  // crowd the fixed ones: just above today (the live and "today" peaks nearly
  // coincide), mid-slide in log T, and last scattering itself.
  const temperatures = [
    ...extremes(paramOf(params, 'T')),
    { stop: 'T0+0.1%', value: T_CMB * 1.001 },
    { stop: '90 K', value: 90 },
    { stop: '2973 K', value: 2973 },
  ];
  for (const T of temperatures) {
    for (const lambda of extremes(paramOf(params, 'lambda'))) {
      for (const v of extremes(paramOf(params, 'v'))) {
        for (const units of ['friendly', 'technical'] as const) {
          cases.push({
            label: `T=${T.stop} lambda=${lambda.stop} v=${v.stop} ${units}`,
            draw: (ctx, w, h) => cmb.drawScene(ctx, w, h, scene(T.value, lambda.value, v.value, units)),
          });
        }
      }
    }
  }

  /*
   * The peak label, asserted by name at every temperature a reader can reach.
   *
   * It is the one label that moves across the whole spectrum panel, from the
   * millimetre range at T₀ to just past the visible band at 3000 K, so it is
   * the one most likely to land on "visible light", "today" or "Penzias &
   * Wilson, 1965" — and the one whose disappearance would matter most.
   */
  it('always labels the peak, clear of every other label', () => {
    for (let e = Math.log10(T_CMB); e <= Math.log10(TMax) + 1e-9; e += 0.05) {
      const T = Math.min(TMax, 10 ** e);
      for (const units of ['friendly', 'technical'] as const) {
        for (const width of [246, 390, 900]) {
          const { ctx, records } = recordingContext();
          cmb.drawScene(ctx, width, CMB_HEIGHT, scene(T, paramOf(params, 'lambda').default, vMax / 2, units));
          const where = `T=${T.toFixed(2)} ${units} @${width}`;

          const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
          expect(
            texts.some((t) => t.startsWith('peak ')),
            `${where}: no peak label`,
          ).toBe(true);
          expect(
            textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
            `${where}: labels overlap`,
          ).toEqual([]);
          expect(
            textOutsideFrame(records, width, CMB_HEIGHT).map(describeRecord),
            `${where}: text outside the frame`,
          ).toEqual([]);
        }
      }
    }
  });

  it('draws "today" only once the reader has left it, and a uniform sky at rest', () => {
    const texts = (T: number, v: number) => {
      const { ctx, records } = recordingContext();
      cmb.drawScene(ctx, 700, CMB_HEIGHT, scene(T, paramOf(params, 'lambda').default, v, 'friendly'));
      return records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    };
    expect(texts(T_CMB, paramOf(params, 'v').default)).not.toContain('today');
    expect(texts(3000, paramOf(params, 'v').default)).toContain('today');

    const moving = texts(T_CMB, paramOf(params, 'v').default);
    expect(moving).toContain('hotter, ahead');
    expect(moving).toContain('cooler, behind');
    const still = texts(T_CMB, 0);
    expect(still).toContain('the same in every direction');
    expect(still).not.toContain('hotter, ahead');
    expect(still.some((t) => t.includes('0.00 mK'))).toBe(true);
  });

  it('quotes the dipole in mK, and in K once it reaches a whole kelvin', () => {
    expect(cmb.formatDipole(0)).toBe('0.00 mK');
    expect(cmb.formatDipole(3.3621e-3)).toBe('3.36 mK');
    expect(cmb.formatDipole(0.99999)).toBe('999.99 mK');
    expect(cmb.formatDipole(3.70076)).toBe('3.70 K');
    // At every speed and temperature the slider reaches, never a four-digit mK.
    const vParam = paramOf(params, 'v');
    const tParam = paramOf(params, 'T');
    for (const T of [tParam.min, tParam.default, tParam.max]) {
      for (const v of [vParam.min, vParam.default, vParam.max]) {
        expect(cmb.formatDipole(dipoleAmplitude(T, v))).not.toMatch(/\d{4,}\.\d+ mK/);
      }
    }
  });

  it('formats the peak wavelength in the unit the value warrants', () => {
    expect(cmb.formatWavelength(1.0632e-3)).toBe('1.06 mm');
    expect(cmb.formatWavelength(9.66e-7)).toBe('966 nm');
    expect(cmb.formatWavelength(1.06e-5)).toBe('10.6 µm');
  });

  return cases;
}

/* ------------------------------ early universe ------------------------------- */

const EARLY_HEIGHT = 416;

function earlyUniverseCases(): Case[] {
  const params = earlyUniverse.layers.play.params;
  const tParam = paramOf(params, 't');
  const EParam = paramOf(params, 'E');
  const curve = early.curveFor(tParam.min, tParam.max);
  const cases: Case[] = [];

  const scene = (t: number, E: number, units: 'friendly' | 'technical') => ({
    t,
    E,
    tMin: tParam.min,
    tMax: tParam.max,
    curve,
    units,
  });

  // A time inside every epoch, and the two ends of the slider.
  const times = [
    { stop: 'min', value: tParam.min },
    { stop: '20 µs', value: 2e-5 },
    { stop: '1 s', value: tParam.default },
    { stop: '3 min', value: 180 },
    { stop: '1 h', value: 3600 },
    { stop: '50 kyr', value: 5e4 * JULIAN_YEAR },
    { stop: '380 kyr', value: 3.8e5 * JULIAN_YEAR },
    { stop: '1e13 s', value: 1e13 },
    { stop: 'max', value: tParam.max },
  ];
  // The ends of the energy slider, the electron, and a particle whose line
  // crosses the curve among the crowded early epochs.
  const energies = [
    ...extremes(EParam),
    { stop: '100 MeV', value: 100e6 * EV },
  ];
  for (const t of times) {
    for (const E of energies) {
      for (const units of ['friendly', 'technical'] as const) {
        cases.push({
          label: `t=${t.stop} E=${E.stop} ${units}`,
          draw: (ctx, w, h) => early.drawScene(ctx, w, h, scene(t.value, E.value, units)),
        });
      }
    }
  }

  /*
   * The two moving labels, asserted by name.
   *
   * The particle's energy and "stops being made" follow the E slider across the
   * whole temperature axis, through the band titles along the top and the dot
   * riding the curve. Swept a twentieth of a decade at a time, each must be
   * drawn, clear of every other label, and inside the frame; and a particle
   * heavier than the chart must say so rather than vanish.
   */
  it('keeps the particle labels drawn and clear at every energy', () => {
    for (let e = Math.log10(EParam.min); e <= Math.log10(EParam.max) + 1e-9; e += 0.05) {
      const E = Math.min(EParam.max, 10 ** e);
      for (const units of ['friendly', 'technical'] as const) {
        for (const width of [246, 390, 900]) {
          const { ctx, records } = recordingContext();
          early.drawScene(ctx, width, EARLY_HEIGHT, scene(tParam.default, E, units));
          const where = `E=${(E / EV / 1e6).toPrecision(3)} MeV ${units} @${width}`;
          const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
          expect(
            texts.some((t) => t.endsWith('MeV') || t.endsWith('MeV ↑') || t.includes('above this chart')),
            `${where}: no energy label`,
          ).toBe(true);
          expect(
            textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
            `${where}: labels overlap`,
          ).toEqual([]);
          expect(
            textOutsideFrame(records, width, EARLY_HEIGHT).map(describeRecord),
            `${where}: text outside the frame`,
          ).toEqual([]);
        }
      }
    }
  });

  it('marks the crossing for a particle on the chart, and says when it is off the top', () => {
    const texts = (E: number) => {
      const { ctx, records } = recordingContext();
      early.drawScene(ctx, 900, EARLY_HEIGHT, scene(tParam.default, E, 'friendly'));
      return records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    };
    expect(texts(EParam.default)).toContain('stops being made');
    expect(texts(EParam.max).some((t) => t.includes('above this chart'))).toBe(true); // 900 px: the full sentence fits
    expect(texts(EParam.max)).not.toContain('stops being made');
  });

  it('formats time and scale factor the way the readouts promise', () => {
    expect(early.formatTime(1)).toBe('1 s');
    expect(early.formatTime(2e-5)).toBe('20 µs');
    expect(early.formatTime(180)).toBe('3 min');
    expect(early.formatTime(3.8e5 * JULIAN_YEAR)).toBe('380 kyr');
    expect(early.formatTime(13.8e9 * JULIAN_YEAR)).toBe('13.8 Gyr');
    expect(early.formatScaleFactor(1)).toBe('1 (today)');
    expect(early.formatScaleFactor(0.9996)).toBe('1 (today)');
    expect(early.formatScaleFactor(0.25)).toBe('1 / 4');
    expect(early.formatScaleFactor(0.7)).toBe('0.7');
  });

  return cases;
}

/* ------------------------------- stellar fusion ------------------------------ */

const FUSION_HEIGHT = 416;

function stellarFusionCases(): Case[] {
  const TParam = paramOf(stellarFusion.layers.play.params, 'T');
  const cases: Case[] = [];

  // The slider's ends and default, the review's screenshot temperatures, and
  // the corner where the Gamow peak drops under the barrier panel's 1 keV floor.
  const temperatures = [
    ...extremes(TParam),
    { stop: '1.05e6 K (peak at the floor)', value: 1.05e6 },
    { stop: '3e6 K', value: 3e6 },
    { stop: '3e7 K', value: 3e7 },
    { stop: '6e7 K', value: 6e7 },
  ];
  for (const T of temperatures) {
    for (const units of ['friendly', 'technical'] as const) {
      cases.push({
        label: `T=${T.stop} ${units}`,
        draw: (ctx, w, h) => fusion.drawScene(ctx, w, h, { T: T.value, units }),
      });
    }
  }

  /*
   * Every label, at every temperature a reader can reach.
   *
   * Four curve labels ride the top panel and move with T: the Boltzmann label
   * sits near kT, which runs from the left edge to a fifth of the axis; the
   * peak label follows E₀ from 1 keV to 21 keV; "typical proton" sits on kT.
   * Below, the Gamow line's label and "must tunnel across this" move with E₀.
   * Swept a twentieth of a decade at a time, all of them must be drawn, clear of
   * each other and inside the frame.
   */
  it('keeps every label drawn and clear across the temperature slider', () => {
    const expected = [
      'how many protons have this energy',
      'chance of tunnelling',
      'fusion happens here',
      'typical proton',
      'nuclear well',
    ];
    for (let e = Math.log10(TParam.min); e <= Math.log10(TParam.max) + 1e-9; e += 0.05) {
      const T = Math.min(TParam.max, 10 ** e);
      for (const units of ['friendly', 'technical'] as const) {
        for (const width of [246, 390, 900]) {
          const { ctx, records } = recordingContext();
          fusion.drawScene(ctx, width, FUSION_HEIGHT, { T, units });
          const where = `T=${T.toPrecision(3)} K ${units} @${width}`;
          const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
          for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
          expect(
            textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
            `${where}: labels overlap`,
          ).toEqual([]);
          expect(
            textOutsideFrame(records, width, FUSION_HEIGHT).map(describeRecord),
            `${where}: text outside the frame`,
          ).toEqual([]);
        }
      }
    }
  });

  it('shades the tunnelling gap on the chart, and says so when the peak is below it', () => {
    const texts = (T: number) => {
      const { ctx, records } = recordingContext();
      fusion.drawScene(ctx, 900, FUSION_HEIGHT, { T, units: 'friendly' });
      return records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    };
    expect(texts(TParam.default)).toContain('must tunnel across this');
    expect(texts(TParam.default)).toContain('1.03 MeV');
    const coldest = texts(TParam.min);
    expect(coldest.some((t) => t.includes('below this chart'))).toBe(true);
    expect(coldest).not.toContain('must tunnel across this');
  });

  it('formats the readouts the way the brief promises', () => {
    expect(fusion.scientific(1.234e-4, 2)).toBe('1.2 × 10⁻⁴');
    expect(fusion.scientific(9.152e-4, 2)).toBe('9.2 × 10⁻⁴');
    expect(fusion.formatKelvin2(1.19e10)).toBe('1.2 × 10¹⁰ K');
  });

  return cases;
}

/* --------------------------------- supernovae -------------------------------- */

const SN_HEIGHT = 544;

function supernovaeCases(): Case[] {
  const params = supernovae.layers.play.params;
  const MParam = paramOf(params, 'M');
  const dParam = paramOf(params, 'd');
  const cases: Case[] = [];

  // Each slider's ends and default with the other at its default, plus the
  // review's screenshot stops: the fate boundaries' neighbours, Betelgeuse, and
  // the distances either side of the naked-eye limit.
  const masses = [
    ...extremes(MParam),
    { stop: '7.9 M☉', value: 7.9 * M_SUN },
    { stop: '18 M☉', value: 18 * M_SUN },
    { stop: '16 M☉', value: 16 * M_SUN },
    { stop: '20 M☉', value: 20 * M_SUN },
  ];
  const distances = [
    ...extremes(dParam),
    { stop: '10 pc', value: 10 * PARSEC },
    { stop: '2.5 Mly', value: 2.5e6 * LIGHT_YEAR },
    { stop: '1 Gpc', value: 1e3 * MEGAPARSEC },
  ];
  for (const units of ['friendly', 'technical'] as const) {
    for (const M of masses) {
      cases.push({
        label: `M=${M.stop} ${units}`,
        draw: (ctx, w, h) => sn.drawScene(ctx, w, h, { M: M.value, d: dParam.default, units }),
      });
    }
    for (const d of distances) {
      cases.push({
        label: `d=${d.stop} ${units}`,
        draw: (ctx, w, h) => sn.drawScene(ctx, w, h, { M: MParam.default, d: d.value, units }),
      });
    }
  }

  /*
   * Every label, at every mass and distance a reader can reach.
   *
   * The lifetime dot's label rides the curve across the top panel, down to
   * 1.73 Myr at the slider's 32 M☉; a fate name too wide for its band moves
   * above the ribbon, and the 16 tick gives up its label where it would touch
   * 20's. Below, the magnitude dot's label rides the line past all four
   * reference labels and the Andromeda note. Swept a tenth of a decade at a time
   * on each slider, and at each maximum, everything must be drawn, clear and
   * inside the frame.
   */
  it('keeps every label drawn and clear across both sliders', () => {
    const expected = [
      'white dwarf',
      'neutron star',
      'black hole',
      'full Moon, −12.7',
      'Venus, −4.6',
      'naked-eye limit, +6',
      'space-telescope limit, about +31',
    ];
    // Too wide for the narrowest plot, the Andromeda note breaks after its comma.
    const andromeda = 'Andromeda: SN 1885A, a faint one, reached +6';
    const andromedaWrapped = ['Andromeda: SN 1885A,', 'a faint one, reached +6'];
    const check = (M: number, d: number, units: 'friendly' | 'technical', width: number) => {
      const { ctx, records } = recordingContext();
      sn.drawScene(ctx, width, SN_HEIGHT, { M, d, units });
      const where = `M=${(M / M_SUN).toPrecision(3)} M☉ d=${d.toPrecision(3)} m ${units} @${width}`;
      const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
      for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
      expect(
        texts.includes(andromeda) || andromedaWrapped.every((line) => texts.includes(line)),
        `${where}: the Andromeda note is missing`,
      ).toBe(true);
      expect(
        textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
        `${where}: labels overlap`,
      ).toEqual([]);
      expect(
        textOutsideFrame(records, width, SN_HEIGHT).map(describeRecord),
        `${where}: text outside the frame`,
      ).toEqual([]);
    };
    for (const units of ['friendly', 'technical'] as const) {
      for (const width of [246, 390, 900]) {
        for (let e = Math.log10(MParam.min); e <= Math.log10(MParam.max) + 1e-9; e += 0.1) {
          check(Math.min(MParam.max, 10 ** e), dParam.default, units, width);
        }
        check(MParam.max, dParam.default, units, width);
        for (let e = Math.log10(dParam.min); e <= Math.log10(dParam.max) + 1e-9; e += 0.1) {
          check(MParam.default, Math.min(dParam.max, 10 ** e), units, width);
        }
        check(MParam.default, dParam.max, units, width);
      }
    }
  });

  it('keeps both dots on their charts across the whole of each slider', () => {
    const texts = (M: number, d: number) => {
      const { ctx, records } = recordingContext();
      sn.drawScene(ctx, 900, SN_HEIGHT, { M, d, units: 'friendly' });
      return records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    };
    expect(texts(MParam.default, dParam.default)).toContain('10 Gyr');
    expect(texts(MParam.default, dParam.default)).toContain('−13.2');
    expect(texts(MParam.max, dParam.default)).toContain('1.73 Myr');
    expect(texts(MParam.max, dParam.default).some((t) => t.includes('below the axis'))).toBe(false);
    expect(texts(MParam.default, dParam.min)).toContain('−21.7');
    expect(texts(MParam.default, dParam.max)).toContain('+20.6');
  });

  it('formats the readouts the way the brief promises', () => {
    expect(sn.formatYears(1e10 * JULIAN_YEAR)).toBe('10 Gyr');
    expect(sn.formatYears(7.29e6 * JULIAN_YEAR)).toBe('7.29 Myr');
    expect(sn.formatYears(1e5 * JULIAN_YEAR)).toBe('100 kyr');
    expect(sn.formatMagnitude(-13.173)).toBe('−13.2');
    expect(sn.formatMagnitude(20.64)).toBe('+20.6');
    expect(sn.formatMagnitude(-0.04)).toBe('0.0');
    expect(sn.scientific(2.586e46, 2)).toBe('2.6 × 10⁴⁶');
    expect(sn.brightnessWords(-13.2)).toBe('brighter than the full Moon');
    expect(sn.brightnessWords(-12.7)).toBe('brighter than Venus');
    expect(sn.brightnessWords(5.9)).toBe('visible to the naked eye');
    expect(sn.brightnessWords(6)).toBe('telescope only');
  });

  return cases;
}

/* ------------------------------- habitable zone ------------------------------ */

const HZ_HEIGHT = 480;

function habitableZoneCases(): Case[] {
  const params = habitableZone.layers.play.params;
  const LParam = paramOf(params, 'L');
  const dParam = paramOf(params, 'd');
  const AParam = paramOf(params, 'A');
  const cases: Case[] = [];

  // Each slider's ends and default with the others at their defaults, plus the
  // review's screenshot stops.
  const views: { stop: string; L: number; d: number; A: number }[] = [
    ...extremes(LParam).map((s) => ({ stop: `L=${s.stop}`, L: s.value, d: dParam.default, A: AParam.default })),
    ...extremes(dParam).map((s) => ({ stop: `d=${s.stop}`, L: LParam.default, d: s.value, A: AParam.default })),
    ...extremes(AParam).map((s) => ({ stop: `A=${s.stop}`, L: LParam.default, d: dParam.default, A: s.value })),
    { stop: 'L=0.01 L☉, d=0.1 AU', L: 0.01 * L_SUN, d: 0.1 * AU, A: AParam.default },
    { stop: 'L=100 L☉, d=10 AU', L: 100 * L_SUN, d: 10 * AU, A: AParam.default },
  ];
  for (const units of ['friendly', 'technical'] as const) {
    for (const v of views) {
      cases.push({
        label: `${v.stop} ${units}`,
        draw: (ctx, w, h) => hz.drawScene(ctx, w, h, { L: v.L, d: v.d, A: v.A, units }),
      });
    }
  }

  /*
   * Every label, at every setting a reader can reach.
   *
   * The zone slides across the top panel with L; the planet's temperature
   * label rides the solid curve below, and the dashed curve's label follows
   * that curve as L and A move it. Swept a tenth of a decade at a time on L
   * and d, and in tenths on A, everything must be drawn, clear and inside
   * the frame, and no text may sit under a drawn dot: the star, the planet in
   * the top panel (which the Deep edge labels once slid under) or the planet's
   * dot on the curve below.
   */
  it('keeps every label drawn and clear across all three sliders', () => {
    const expected = ['water freezes', 'water boils, at Earth’s pressure', 'with an Earth-like atmosphere'];
    const check = (L: number, d: number, A: number, units: 'friendly' | 'technical', width: number) => {
      const { ctx, records } = recordingContext();
      hz.drawScene(ctx, width, HZ_HEIGHT, { L, d, A, units });
      const where = `L=${(L / L_SUN).toPrecision(3)} L☉ d=${(d / AU).toPrecision(3)} AU A=${A.toFixed(2)} ${units} @${width}`;
      const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
      for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
      expect(
        textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
        `${where}: labels overlap`,
      ).toEqual([]);
      expect(
        textOutsideFrame(records, width, HZ_HEIGHT).map(describeRecord),
        `${where}: text outside the frame`,
      ).toEqual([]);
      const dots = records.filter((r) => r.kind === 'arc');
      const covered = records
        .filter((r) => r.kind === 'text')
        .flatMap((t) =>
          dots
            .filter((a) => Math.min(t.x1, a.x1) - Math.max(t.x0, a.x0) > 1 && Math.min(t.y1, a.y1) - Math.max(t.y0, a.y0) > 1)
            .map((a) => `${describeRecord(t)}  under  ${describeRecord(a)}`),
        );
      expect(covered, `${where}: text under a dot`).toEqual([]);
    };
    for (const units of ['friendly', 'technical'] as const) {
      for (const width of [246, 390, 900]) {
        for (let e = Math.log10(LParam.min); e <= Math.log10(LParam.max) + 1e-9; e += 0.1) {
          check(Math.min(LParam.max, 10 ** e), dParam.default, AParam.default, units, width);
        }
        check(LParam.max, dParam.default, AParam.default, units, width);
        for (let e = Math.log10(dParam.min); e <= Math.log10(dParam.max) + 1e-9; e += 0.1) {
          check(LParam.default, Math.min(dParam.max, 10 ** e), AParam.default, units, width);
        }
        check(LParam.default, dParam.max, AParam.default, units, width);
        for (let A = AParam.min; A <= AParam.max + 1e-9; A += 0.1) {
          check(LParam.default, dParam.default, Math.min(AParam.max, A), units, width);
        }
      }
    }
  });

  it('names the zone where it fits, and pins the dot when the planet is off the chart', () => {
    const texts = (L: number, d: number, units: 'friendly' | 'technical' = 'friendly') => {
      const { ctx, records } = recordingContext();
      hz.drawScene(ctx, 900, HZ_HEIGHT, { L, d, A: AParam.default, units });
      return records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    };
    expect(texts(LParam.default, dParam.default)).toContain('liquid water possible');
    expect(texts(LParam.default, dParam.default)).toContain('255 K');
    // At 0.01 AU from the Sun the planet is at 2 550 K, far above the 700 K axis.
    expect(texts(LParam.default, dParam.min)).toContain('2,550 K');
    // At Deep the conservative edges carry their distances.
    expect(texts(LParam.default, dParam.default, 'technical')).toEqual(expect.arrayContaining(['0.993', '1.71']));
  });

  it('formats the readouts the way the brief promises', () => {
    expect(hz.formatEdges(0.9931 * AU, 1.7075 * AU)).toBe('0.993 to 1.71 AU');
    expect(hz.formatFlux(1361.17)).toBe('1,360 W/m² (1.00 × Earth’s)');
    expect(hz.formatFlux(1.361e8)).toBe('1.36 × 10⁸ W/m² (1.0 × 10⁵ × Earth’s)');
    expect(hz.formatKelvinCelsius(254.59)).toBe('255 K (−18 °C)');
    expect(hz.formatKelvinCelsius(287.59)).toBe('288 K (15 °C)');
    expect(hz.formatKelvinCelsius(2546)).toBe('2,550 K (2,277 °C)');
    expect(hz.formatKelvinCelsius(45.26)).toBe('45.3 K (−227.9 °C)');
    expect(hz.formatPeriod(365.25 * 86_400)).toBe('1 year');
    expect(hz.formatPeriod(10 * 86_400)).toBe('10 days');
  });

  return cases;
}

/* ----------------------------------- nebulae ----------------------------------- */

const NEB_HEIGHT = 544;

function nebulaeCases(): Case[] {
  const params = nebulae.layers.play.params;
  const QParam = paramOf(params, 'Q');
  const nParam = paramOf(params, 'n');
  const cases: Case[] = [];

  // Each slider's ends and default with the other at its default, the review's
  // screenshot stops, and the two corners where the dot leaves the chart.
  const views: { stop: string; Q: number; n: number }[] = [
    ...extremes(QParam).map((s) => ({ stop: `Q=${s.stop}`, Q: s.value, n: nParam.default })),
    ...extremes(nParam).map((s) => ({ stop: `n=${s.stop}`, Q: QParam.default, n: s.value })),
    { stop: '(1e45, 1e6)', Q: 1e45, n: 1e6 },
    { stop: '(1e50, 1e11)', Q: 1e50, n: 1e11 },
    { stop: '(1e49, 1e10)', Q: 1e49, n: 1e10 },
    { stop: '(1e46, 1e8)', Q: 1e46, n: 1e8 },
    { stop: '(1e50, 1e6) off the top', Q: 1e50, n: 1e6 },
    { stop: '(1e45, 1e11) off the bottom', Q: 1e45, n: 1e11 },
  ];
  for (const units of ['friendly', 'technical'] as const) {
    for (const v of views) {
      cases.push({
        label: `${v.stop} ${units}`,
        draw: (ctx, w, h) => neb.drawScene(ctx, w, h, { Q: v.Q, n: v.n, units }),
      });
    }
  }

  /*
   * Every label, at every setting a reader can reach.
   *
   * The dot's radius label rides the live line; the faint lines' labels sit
   * mid-way along their visible stretch; the schematic's front label follows
   * the disc as it grows. Below, all eight line names stack above the bars.
   * Swept a tenth of a decade at a time on each slider, everything must be
   * drawn, clear and inside the frame, and no text may sit under a dot.
   */
  it('keeps every label drawn and clear across both sliders', () => {
    const expected = [
      'faintest star',
      'brightest star',
      'ionization front',
      'Hβ 486.1',
      '[O III] 495.9',
      '[O III] 500.7',
      '[N II] 654.8',
      'Hα 656.3',
      '[N II] 658.3',
      '[S II] 671.6',
      '[S II] 673.1',
    ];
    const check = (Q: number, n: number, units: 'friendly' | 'technical', width: number) => {
      const { ctx, records } = recordingContext();
      neb.drawScene(ctx, width, NEB_HEIGHT, { Q, n, units });
      const where = `Q=${Q.toPrecision(3)} n=${n.toPrecision(3)} ${units} @${width}`;
      const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
      for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
      expect(
        textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
        `${where}: labels overlap`,
      ).toEqual([]);
      expect(
        textOutsideFrame(records, width, NEB_HEIGHT).map(describeRecord),
        `${where}: text outside the frame`,
      ).toEqual([]);
      // Dots only: the schematic's ionized disc is a large arc a label may sit on.
      const dots = records.filter((r) => r.kind === 'arc' && r.x1 - r.x0 <= 12);
      const covered = records
        .filter((r) => r.kind === 'text')
        .flatMap((t) =>
          dots
            .filter((a) => Math.min(t.x1, a.x1) - Math.max(t.x0, a.x0) > 1 && Math.min(t.y1, a.y1) - Math.max(t.y0, a.y0) > 1)
            .map((a) => `${describeRecord(t)}  under  ${describeRecord(a)}`),
        );
      expect(covered, `${where}: text under a dot`).toEqual([]);
    };
    for (const units of ['friendly', 'technical'] as const) {
      for (const width of [246, 390, 900]) {
        for (let e = Math.log10(QParam.min); e <= Math.log10(QParam.max) + 1e-9; e += 0.1) {
          check(Math.min(QParam.max, 10 ** e), nParam.default, units, width);
        }
        for (let e = Math.log10(nParam.min); e <= Math.log10(nParam.max) + 1e-9; e += 0.1) {
          check(QParam.default, Math.min(nParam.max, 10 ** e), units, width);
        }
        check(QParam.max, nParam.min, units, width);
        check(QParam.min, nParam.max, units, width);
      }
    }
  });

  it('marks Orion’s core only for an O7-like star', () => {
    const texts = (Q: number) => {
      const { ctx, records } = recordingContext();
      neb.drawScene(ctx, 900, NEB_HEIGHT, { Q, n: nParam.default, units: 'friendly' });
      return records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    };
    expect(texts(QParam.default)).toContain('Orion’s core');
    expect(texts(QParam.default)).toContain('10.3 ly');
    expect(texts(1e46)).not.toContain('Orion’s core');
    expect(texts(1e50)).not.toContain('Orion’s core');
  });

  it('formats the readouts the way the brief promises', () => {
    const R = 3.1539 * PARSEC;
    expect(neb.formatRadius(R, 'friendly')).toBe('10.3 light-years');
    expect(neb.formatRadius(R, 'technical')).toBe('3.15 pc');
    expect(neb.formatSolarMasses(324.8 * M_SUN)).toBe('325 M☉');
    expect(neb.formatYears(1223.5 * JULIAN_YEAR)).toBe('1,220 years');
    expect(neb.formatFront(1.587e13, R)).toBe('1.6 × 10⁻⁴ of the radius (106 AU)');
    expect(neb.dominantLine()).toBe('green-teal, from oxygen at 500.7 nm');
  });

  return cases;
}

/* ---------------------------- cosmic distance ladder ---------------------------- */

const CDL_HEIGHT = 544;

function ladderCases(): Case[] {
  const params = cosmicDistanceLadder.layers.play.params;
  const dParam = paramOf(params, 'd');
  const deltaParam = paramOf(params, 'delta');
  const cases: Case[] = [];

  // Each slider's ends and default with the other at its default, and the
  // review's screenshot stops.
  const views: { stop: string; d: number; delta: number }[] = [
    ...extremes(dParam).map((s) => ({ stop: `d=${s.stop}`, d: s.value, delta: deltaParam.default })),
    ...extremes(deltaParam).map((s) => ({ stop: `δ=${s.stop}`, d: dParam.default, delta: s.value })),
    { stop: 'd=8.2 kpc', d: 8.2e3 * PARSEC, delta: 0 },
    { stop: 'd=16.5 Mpc', d: 16.5e6 * PARSEC, delta: 0 },
    { stop: 'δ=0.175', d: dParam.default, delta: 0.175 },
  ];
  for (const units of ['friendly', 'technical'] as const) {
    for (const v of views) {
      cases.push({
        label: `${v.stop} ${units}`,
        draw: (ctx, w, h) => cdl.drawScene(ctx, w, h, { d: v.d, delta: v.delta, units }),
      });
    }
  }

  /*
   * Every label, at every setting a reader can reach.
   *
   * The cursor sweeps the rungs and the landmarks as d moves, and a rung name
   * that does not fit inside its bar is placed beside it; below, the dot's
   * value rides the curve past both band labels. Swept a tenth of a decade at
   * a time in d and in 0.02 mag steps in δ, everything must be drawn, clear
   * and inside the frame, and no text may sit under the dot.
   */
  it('keeps every label drawn and clear across both sliders', () => {
    const expected = ['Parallax (Gaia)', 'Cepheids', 'Type Ia supernovae', 'Hubble flow', 'CMB (no ladder)', 'the ladder, 2022'];
    const check = (d: number, delta: number, units: 'friendly' | 'technical', width: number) => {
      const { ctx, records } = recordingContext();
      cdl.drawScene(ctx, width, CDL_HEIGHT, { d, delta, units });
      const where = `d=${(d / PARSEC).toPrecision(3)} pc δ=${delta.toFixed(3)} ${units} @${width}`;
      const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
      for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
      expect(
        textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
        `${where}: labels overlap`,
      ).toEqual([]);
      expect(
        textOutsideFrame(records, width, CDL_HEIGHT).map(describeRecord),
        `${where}: text outside the frame`,
      ).toEqual([]);
      const dots = records.filter((r) => r.kind === 'arc' && r.x1 - r.x0 <= 12);
      const covered = records
        .filter((r) => r.kind === 'text')
        .flatMap((t) =>
          dots
            .filter((a) => Math.min(t.x1, a.x1) - Math.max(t.x0, a.x0) > 1 && Math.min(t.y1, a.y1) - Math.max(t.y0, a.y0) > 1)
            .map((a) => `${describeRecord(t)}  under  ${describeRecord(a)}`),
        );
      expect(covered, `${where}: text under a dot`).toEqual([]);
    };
    for (const units of ['friendly', 'technical'] as const) {
      for (const width of [246, 390, 900]) {
        for (let e = Math.log10(dParam.min); e <= Math.log10(dParam.max) + 1e-9; e += 0.1) {
          check(Math.min(dParam.max, 10 ** e), deltaParam.default, units, width);
        }
        check(dParam.max, deltaParam.default, units, width);
        for (let delta = deltaParam.min; delta <= deltaParam.max + 1e-9; delta += 0.02) {
          check(dParam.default, Math.min(deltaParam.max, delta), units, width);
        }
      }
    }
  });

  it('names the landmarks where there is room', () => {
    const { ctx, records } = recordingContext();
    cdl.drawScene(ctx, 900, CDL_HEIGHT, { d: dParam.default, delta: 0, units: 'friendly' });
    const texts = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    for (const name of ['Proxima Centauri', 'Galactic centre', 'LMC', 'Andromeda', 'Virgo Cluster', 'Coma Cluster']) {
      expect(texts, `"${name}" should fit at 900 px`).toContain(name);
    }
    expect(texts).toContain('calibration passes up');
  });

  it('formats the readouts the way the brief promises', () => {
    expect(cdl.formatMethods(dParam.default)).toBe('Cepheids');
    expect(cdl.formatMethods(dParam.max)).toBe('Type Ia supernovae, Hubble flow');
    expect(cdl.formatParallax(AU / (49.59e3 * PARSEC))).toBe('20.2 µas');
    expect(cdl.formatParallax(AU / PARSEC)).toBe('1 arcsec');
    expect(cdl.formatPrecision(0.0202)).toBe('2.0 %');
    expect(cdl.formatPrecision(1.3)).toBe('worse than 100 %: too far');
    expect(cdl.formatOwnMotion(0.089)).toBe('8.9 %');
    expect(cdl.formatOwnMotion(90)).toBe('more than the expansion itself');
    expect(cdl.formatMagnitude(13.268)).toBe('+13.3');
    expect(cdl.formatMagnitude(-0.823)).toBe('−0.8');
    // The calibration slider's error as a brightness a reader can picture.
    expect(cdl.formatBrightnessError(0)).toBe('spot on');
    expect(cdl.formatBrightnessError(0.1)).toBe('assumed 9% too faint');
    expect(cdl.formatBrightnessError(-0.1)).toBe('assumed 10% too bright');
    expect(cdl.formatBrightnessError(0.17)).toBe('assumed 14% too faint');
    expect(cdl.formatH0(73.07 * KM_S_PER_MPC)).toBe('73.1 km/s/Mpc');
  });

  return cases;
}

/* -------------------------------- time dilation -------------------------------- */

const TD_HEIGHT = 544;

function timeDilationCases(): Case[] {
  const params = timeDilation.layers.play.params;
  const vParam = paramOf(params, 'v');
  const rParam = paramOf(params, 'r');
  const cases: Case[] = [];
  const rs = rParam.default / 1.5;

  // Each slider's ends and default with the other at its default, the review's
  // screenshot stops, and the looping clocks part-way and at the trip's end.
  const views: { stop: string; v: number; r: number; phase: number }[] = [
    ...extremes(vParam).map((s) => ({ stop: `v=${s.stop}`, v: s.value, r: rParam.default, phase: 1 })),
    ...extremes(rParam).map((s) => ({ stop: `r=${s.stop}`, v: vParam.default, r: s.value, phase: 1 })),
    { stop: 'v=0.001 c', v: 0.001 * C, r: rParam.default, phase: 1 },
    { stop: 'v=0.998 c', v: 0.998 * C, r: rParam.default, phase: 1 },
    { stop: 'at rest, mid-loop', v: 0, r: rParam.default, phase: 0.37 },
    { stop: 'r=3 r_s', v: vParam.default, r: 3 * rs, phase: 1 },
    { stop: 'mid-loop', v: vParam.default, r: rParam.default, phase: 0.37 },
    { stop: 'loop start', v: vParam.default, r: rParam.default, phase: 0 },
  ];
  for (const units of ['friendly', 'technical'] as const) {
    for (const v of views) {
      cases.push({
        label: `${v.stop} ${units}`,
        draw: (ctx, w, h) => td.drawScene(ctx, w, h, { v: v.v, r: v.r, phase: v.phase, units }),
      });
    }
  }

  /*
   * Every label, at every setting a reader can reach.
   *
   * The clocks' elapsed times change width with the speed, the bar's value
   * rides its fill, and below, the dot's label rides the curve past the three
   * guide labels. Swept a tenth of a decade at a time on each slider, at the
   * loop's end and part-way through, everything must be drawn, clear and
   * inside the frame, and no text may sit under a dot or a clock's hub.
   */
  it('keeps every label drawn and clear across both sliders', () => {
    const expected = ['Two clocks, one trip', 'at home', 'on the ship', 'Clocks near a black hole'];
    const check = (v: number, r: number, phase: number, units: 'friendly' | 'technical', width: number) => {
      const { ctx, records } = recordingContext();
      td.drawScene(ctx, width, TD_HEIGHT, { v, r, phase, units });
      const where = `v=${v.toPrecision(3)} r=${r.toPrecision(3)} phase=${phase} ${units} @${width}`;
      const texts = records.filter((rec) => rec.kind === 'text').map((rec) => rec.text ?? '');
      for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
      expect(
        texts.some((t) => t.startsWith('for every hour at home')),
        `${where}: the bar's caption is missing`,
      ).toBe(true);
      expect(
        textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
        `${where}: labels overlap`,
      ).toEqual([]);
      expect(
        textOutsideFrame(records, width, TD_HEIGHT).map(describeRecord),
        `${where}: text outside the frame`,
      ).toEqual([]);
      const dots = records.filter((rec) => rec.kind === 'arc' && rec.x1 - rec.x0 <= 12);
      const covered = records
        .filter((rec) => rec.kind === 'text')
        .flatMap((t) =>
          dots
            .filter((a) => Math.min(t.x1, a.x1) - Math.max(t.x0, a.x0) > 1 && Math.min(t.y1, a.y1) - Math.max(t.y0, a.y0) > 1)
            .map((a) => `${describeRecord(t)}  under  ${describeRecord(a)}`),
        );
      expect(covered, `${where}: text under a dot`).toEqual([]);
    };
    for (const units of ['friendly', 'technical'] as const) {
      for (const width of [246, 390, 900]) {
        for (const phase of [0.37, 1]) {
          // Rest to the maximum in hundredths of c, then the grid's first and top steps.
          for (let k = 0; k * 0.01 * C <= vParam.max; k++) check(k * 0.01 * C, rParam.default, phase, units, width);
          for (const beta of [0.001, 0.995, 0.998]) check(beta * C, rParam.default, phase, units, width);
          check(vParam.max, rParam.default, phase, units, width);
        }
        for (let e = Math.log10(rParam.min); e <= Math.log10(rParam.max) + 1e-9; e += 0.1) {
          check(vParam.default, Math.min(rParam.max, 10 ** e), 1, units, width);
        }
        check(vParam.default, rParam.max, 1, units, width);
      }
    }
  });

  it('names the marked radii where there is room', () => {
    const { ctx, records } = recordingContext();
    td.drawScene(ctx, 900, TD_HEIGHT, { v: vParam.default, r: rParam.default, phase: 1, units: 'friendly' });
    const texts = records.filter((rec) => rec.kind === 'text').map((rec) => rec.text ?? '');
    for (const name of ['event horizon', 'photon sphere', 'innermost stable orbit']) expect(texts).toContain(name);
    expect(texts).toContain('10.6 years');
    expect(texts).toContain('6.37 years');
  });

  it('stops both clocks together when the traveller is at rest', () => {
    const { ctx, records } = recordingContext();
    td.drawScene(ctx, 900, TD_HEIGHT, { v: 0, r: rParam.default, phase: 0.37, units: 'friendly' });
    const texts = records.filter((rec) => rec.kind === 'text').map((rec) => rec.text ?? '');
    expect(texts.filter((t) => t === 'never: not moving')).toHaveLength(2);
    // Neither face draws an elapsed wedge (one pixel inside the rim), so every
    // arc wider than a hub is a rim of the same size.
    const faces = records.filter((rec) => rec.kind === 'arc' && rec.x1 - rec.x0 > 12);
    expect(faces).toHaveLength(2);
    expect(faces[0]!.x1 - faces[0]!.x0).toBeCloseTo(faces[1]!.x1 - faces[1]!.x0, 6);
  });

  it('formats the readouts the way the brief promises', () => {
    expect(td.formatTrip(10.6163 * JULIAN_YEAR, true)).toBe('10.6 years');
    expect(td.formatTrip(Infinity, false)).toBe('never: not moving');
    expect(td.formatDailyLoss(0, false)).toBe('none: not moving');
    expect(td.formatDailyLoss(4.8e-13, true)).toBe('0.48 ps');
    expect(td.formatGamma(1)).toBe('1.000');
    expect(td.formatGamma(1.6666667)).toBe('1.667');
    expect(td.formatGamma(1 + 6e-18)).toBe('1.000');
    expect(td.formatDuration(4.8e-13)).toBe('0.48 ps');
    expect(td.formatDuration(7.21e-6)).toBe('7.21 µs');
    expect(td.formatDuration(36_180)).toBe('10.1 h');
    expect(td.formatTripTime(10.6163 * JULIAN_YEAR)).toBe('10.6 years');
    expect(td.formatTripTime(13.9 * 86_400)).toBe('13.9 days');
    expect(td.formatTripTime(8.05e8 * JULIAN_YEAR)).toBe('805 million years');
    expect(td.formatRate(0.57735)).toBe('0.5774');
    expect(td.formatRate(0)).toBe('stopped, seen from far away');
  });

  return cases;
}

/* ------------------------------- hawking radiation ----------------------------- */

const HR_HEIGHT = 544;

function hawkingRadiationCases(): Case[] {
  const mParam = paramOf(hawkingRadiation.layers.play.params, 'M');
  const cases: Case[] = [];

  // The slider's ends and default, and the review's stops: a second's hole, the
  // hole finishing now, the background crossover, the Moon and the Sun.
  const stops: { stop: string; M: number }[] = [
    ...extremes(mParam).map((s) => ({ stop: s.stop, M: s.value })),
    { stop: 'one second left', M: massEvaporatingIn(1) },
    { stop: 'finishing now', M: massEvaporatingIn(AGE_UNIVERSE) },
    { stop: 'as warm as the background', M: massForHawkingTemperature(T_CMB) },
    { stop: 'the Moon', M: M_MOON },
    { stop: 'the Sun', M: M_SUN },
  ];
  for (const units of ['friendly', 'technical'] as const) {
    for (const s of stops) {
      cases.push({
        label: `M=${s.stop} ${units}`,
        draw: (ctx, w, h) => hr.drawScene(ctx, w, h, { M: s.M, units }),
      });
    }
  }

  /*
   * Every label, at every mass a reader can reach.
   *
   * The two dots ride their curves across 26 decades, past the background and
   * age-of-the-universe lines and their labels, the named sides of the
   * crossover and the reference names under the axis. Swept a tenth of a decade
   * at a time, everything must be drawn clear and inside the frame, and no text
   * may sit under a dot.
   */
  it('keeps every label drawn and clear across the mass range', () => {
    const expected = ['How hot it glows', 'How long it lasts'];
    const check = (M: number, units: 'friendly' | 'technical', width: number) => {
      const { ctx, records } = recordingContext();
      hr.drawScene(ctx, width, HR_HEIGHT, { M, units });
      const where = `M=${M.toPrecision(3)} ${units} @${width}`;
      const texts = records.filter((rec) => rec.kind === 'text').map((rec) => rec.text ?? '');
      for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
      expect(
        texts.some((t) => t.includes('2.7 K')),
        `${where}: the background line is unlabelled`,
      ).toBe(true);
      expect(texts, `${where}: the age line is unlabelled`).toContain('the age of the universe');
      expect(
        textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
        `${where}: labels overlap`,
      ).toEqual([]);
      expect(
        textOutsideFrame(records, width, HR_HEIGHT).map(describeRecord),
        `${where}: text outside the frame`,
      ).toEqual([]);
      const dots = records.filter((rec) => rec.kind === 'arc' && rec.x1 - rec.x0 <= 12);
      const covered = records
        .filter((rec) => rec.kind === 'text')
        .flatMap((t) =>
          dots
            .filter((a) => Math.min(t.x1, a.x1) - Math.max(t.x0, a.x0) > 1 && Math.min(t.y1, a.y1) - Math.max(t.y0, a.y0) > 1)
            .map((a) => `${describeRecord(t)}  under  ${describeRecord(a)}`),
        );
      expect(covered, `${where}: text under a dot`).toEqual([]);
    };
    for (const units of ['friendly', 'technical'] as const) {
      for (const width of [246, 390, 900]) {
        for (let e = Math.log10(mParam.min); e <= Math.log10(mParam.max) + 1e-9; e += 0.1) {
          check(Math.min(mParam.max, 10 ** e), units, width);
        }
        check(mParam.max, units, width);
      }
    }
  });

  it('names the sides, the background and the reference masses where there is room', () => {
    const { ctx, records } = recordingContext();
    hr.drawScene(ctx, 900, HR_HEIGHT, { M: mParam.default, units: 'friendly' });
    const texts = records.filter((rec) => rec.kind === 'text').map((rec) => rec.text ?? '');
    for (const name of [
      'the microwave background, 2.7 K',
      'shrinking today',
      'growing today',
      'a mountain',
      'the Moon',
      'the Sun',
      'the age of the universe',
      'mass',
      'temperature',
      'time to evaporate, if left alone',
    ]) {
      expect(texts).toContain(name);
    }
    expect(texts).toContain('123 billion K');
    expect(texts).toContain('2.67 × 10¹² years');
  });

  it('formats the readouts the way the brief promises', () => {
    expect(hr.formatRadius(1.4852e-15)).toBe('1.49 fm');
    expect(hr.formatRadius(6.686e-5)).toBe('66.9 µm');
    expect(hr.formatRadius(2953)).toBe('2.95 km');
    expect(hr.formatRadius(1.4852e-22)).toBe('1.49 × 10⁻⁷ fm');
    expect(hr.formatTemperature(1.2269e11)).toBe('123 billion K');
    expect(hr.formatTemperature(6.1703e-8)).toBe('6.17 × 10⁻⁸ K');
    expect(hr.formatTemperature(2.7255)).toBe('2.73 K');
    expect(hr.formatEnergy(1.694e-12)).toBe('10.6 MeV');
    expect(hr.formatEnergy(1.694e-5)).toBe('106 TeV');
    expect(hr.formatEnergy(7.4e-6)).toBe('46.2 TeV');
    expect(hr.formatEnergy(1.6e-7)).toBe('999 GeV');
    expect(hr.formatEnergy(3.76e-23)).toBe('2.35 × 10⁻⁴ eV');
    expect(hr.formatPower(3.5616e8)).toBe('356 million W');
    expect(hr.formatLifetime(0.0841)).toBe('84.1 ms');
    expect(hr.formatLifetime(0.997)).toBe('997 ms');
    expect(hr.formatLifetime(13.8e9 * JULIAN_YEAR)).toBe('13.8 billion years');
    expect(hr.formatLifetime(2.665e12 * JULIAN_YEAR)).toBe('2.67 × 10¹² years');
    expect(hr.formatLifetime(2.1e67 * JULIAN_YEAR)).toBe('2.10 × 10⁶⁷ years');
    expect(hr.formatNet('shrinking')).toBe('hotter than the background: shrinking');
    expect(hr.formatNet('growing')).toBe('colder than the background: growing');
    expect(hr.formatNet('balanced')).toBe('as warm as the background: in balance');
  });

  it('names the nearest landmark for the mass, as a readable multiple', () => {
    expect(hr.formatLandmark(1e12)).toBe('1 × a mountain');
    expect(hr.formatLandmark(hr.M_CROSSOVER)).toBe('0.613 × the Moon');
    expect(hr.formatLandmark(M_EARTH)).toBe('1 × the Earth');
    expect(hr.formatLandmark(1e31)).toBe('5.03 × the Sun');
    expect(hr.formatLandmark(1e5)).toBe('about 10⁻⁷ × a mountain');
  });

  it('the crossover button sets a mass whose temperature reads as the CMB, and no slider stop does', () => {
    const M = paramOf(hawkingRadiation.layers.play.params, 'M');
    expect(hr.M_CROSSOVER).toBe(massForHawkingTemperature(T_CMB));
    expect(hr.formatTemperature(hawkingTemperature(hr.M_CROSSOVER))).toBe(
      hr.formatTemperature(T_CMB),
    );
    expect(netWithCMB(hr.M_CROSSOVER)).toBe('balanced');
    // The reason the button exists: the nearest stop reads a different temperature.
    const k = Math.round((Math.log10(hr.M_CROSSOVER) - Math.log10(M.min)) / M.step);
    const nearest = 10 ** (Math.log10(M.min) + k * M.step);
    expect(hr.formatTemperature(hawkingTemperature(nearest))).not.toBe(hr.formatTemperature(T_CMB));
  });

  return cases;
}

/* ---------------------------------- wormholes ---------------------------------- */

const WH_HEIGHT = 544;

function wormholeCases(): Case[] {
  const bParam = paramOf(wormholes.layers.play.params, 'b0');
  const cases: Case[] = [];

  // The slider's ends and default, and the review's stops: a doorway, a kilometre,
  // the Earth's radius and the Sun's.
  const stops: { stop: string; b0: number }[] = [
    ...extremes(bParam).map((s) => ({ stop: s.stop, b0: s.value })),
    { stop: 'a doorway', b0: 1.7 },
    { stop: 'a kilometre', b0: 1000 },
    { stop: 'the Earth', b0: R_EARTH },
    { stop: 'the Sun', b0: R_SUN },
  ];
  for (const units of ['friendly', 'technical'] as const) {
    for (const s of stops) {
      cases.push({
        label: `b0=${s.stop} ${units}`,
        draw: (ctx, w, h) => wh.drawScene(ctx, w, h, { b0: s.b0, units }),
      });
    }
  }

  /*
   * Every label, at every throat a reader can reach.
   *
   * The diagram keeps its shape while the ruler's label and the reference
   * beside the throat change with the scale; below, the dot rides the line past
   * the three named masses. Swept a tenth of a decade at a time, everything must
   * be drawn clear and inside the frame, and no text may sit under a dot.
   */
  it('keeps every label drawn and clear across the throat range', () => {
    const expected = [
      'The shape of the tunnel',
      'this mouth',
      'the other mouth',
      'The negative mass it needs',
      'the Earth',
      'Jupiter',
      'the Sun',
    ];
    const check = (b0: number, units: 'friendly' | 'technical', width: number) => {
      const { ctx, records } = recordingContext();
      wh.drawScene(ctx, width, WH_HEIGHT, { b0, units });
      const where = `b0=${b0.toPrecision(3)} ${units} @${width}`;
      const texts = records.filter((rec) => rec.kind === 'text').map((rec) => rec.text ?? '');
      for (const label of expected) expect(texts, `${where}: "${label}" missing`).toContain(label);
      // At every throat some reference is drawn beside it for scale. "the Earth",
      // "Jupiter" and "the Sun" also name the lower panel's lines, so count those
      // only when they appear twice.
      const once = ['a grain of sand', 'a coin', 'a person', 'a house', 'a football pitch', 'a mountain', 'a city', 'the Moon', 'Mercury’s orbit', 'Earth’s orbit', 'Neptune’s orbit'];
      const twice = ['the Earth', 'Jupiter', 'the Sun'];
      expect(
        texts.some((t) => once.includes(t)) || twice.some((name) => texts.filter((t) => t === name).length >= 2),
        `${where}: no reference drawn for scale`,
      ).toBe(true);
      expect(
        textCollisions(records).map(([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`),
        `${where}: labels overlap`,
      ).toEqual([]);
      expect(
        textOutsideFrame(records, width, WH_HEIGHT).map(describeRecord),
        `${where}: text outside the frame`,
      ).toEqual([]);
      const dots = records.filter((rec) => rec.kind === 'arc' && rec.x1 - rec.x0 <= 12);
      const covered = records
        .filter((rec) => rec.kind === 'text')
        .flatMap((t) =>
          dots
            .filter((a) => Math.min(t.x1, a.x1) - Math.max(t.x0, a.x0) > 1 && Math.min(t.y1, a.y1) - Math.max(t.y0, a.y0) > 1)
            .map((a) => `${describeRecord(t)}  under  ${describeRecord(a)}`),
        );
      expect(covered, `${where}: text under a dot`).toEqual([]);
    };
    for (const units of ['friendly', 'technical'] as const) {
      for (const width of [246, 390, 900]) {
        for (let e = Math.log10(bParam.min); e <= Math.log10(bParam.max) + 1e-9; e += 0.1) {
          check(Math.min(bParam.max, 10 ** e), units, width);
        }
        check(bParam.max, units, width);
      }
    }
  });

  it('labels the ruler and names the reference that suits the scale', () => {
    const texts = (b0: number, units: 'friendly' | 'technical') => {
      const { ctx, records } = recordingContext();
      wh.drawScene(ctx, 900, WH_HEIGHT, { b0, units });
      return records.filter((rec) => rec.kind === 'text').map((rec) => rec.text ?? '');
    };
    expect(texts(1, 'friendly')).toContain('1 m');
    expect(texts(1, 'friendly')).toContain('a person');
    expect(texts(1, 'technical')).toContain('b₀ = 1 m');
    expect(texts(R_EARTH, 'friendly')).toContain('the Earth');
    expect(texts(R_EARTH, 'friendly')).toContain('1 Earth radius');
    expect(texts(R_SUN, 'friendly')).toContain('109 Earth radii');
    expect(texts(1000, 'friendly')).not.toContain('a person');
    expect(texts(1000, 'friendly')).toContain('a mountain');
    expect(texts(1e-3, 'friendly')).toContain('a grain of sand');
    expect(texts(1e13, 'friendly')).toContain('Neptune’s orbit');
  });

  it('formats the readouts the way the brief promises', () => {
    expect(wh.formatLength(6.2832)).toBe('6.28 m');
    expect(wh.formatLength(6.2832e-3)).toBe('6.28 mm');
    expect(wh.formatLength(0.9983)).toBe('0.998 m');
    expect(wh.formatLength(0.0628)).toBe('0.0628 m');
    expect(wh.formatLength(4.0030e7)).toBe('40,000 km');
    expect(wh.formatLength(9.4248e13)).toBe('630 AU');
    expect(wh.formatExoticMass(-2.1152e27)).toBe('−2.12 × 10²⁷ kg (minus 1.11 Jupiters)');
    expect(wh.formatExoticMass(-2.1152e24)).toBe('−2.12 × 10²⁴ kg (minus 0.354 Earths)');
    expect(wh.formatExoticMass(-2.1152e30)).toBe('−2.12 × 10³⁰ kg (minus 1.06 Suns)');
    expect(wh.formatExoticMass(-3.1728e40)).toBe('−3.17 × 10⁴⁰ kg (minus 16 billion Suns)');
    expect(wh.formatDensity(-5.3579e25)).toBe('−5.36 × 10²⁵ kg/m³');
    expect(wh.formatDensity(-0.2381)).toBe('−0.238 kg/m³');
    expect(wh.formatCasimirGap(3.08e-18)).toBe('3.08 × 10⁻¹⁸ m (1/273 of a proton’s radius)');
    expect(wh.formatCasimirGap(9.74e-17)).toBe('9.74 × 10⁻¹⁷ m (0.116 times a proton’s radius)');
    expect(wh.formatRadius(1)).toBe('1 m');
    expect(wh.formatRadius(1e-3)).toBe('1 mm');
    expect(wh.formatRadius(R_EARTH)).toBe('1 Earth radius');
    expect(wh.formatRadius(R_SUN)).toBe('109 Earth radii');
    expect(wh.formatRadius(1e13)).toBe('66.8 AU');
    expect(wh.formatCasimirGap(7.774e-15)).toBe('7.77 × 10⁻¹⁵ m (9.24 times a proton’s radius)');
  });

  return cases;
}

/* ------------------------------- neutron stars ------------------------------- */

const NS_HEIGHT = 512;

function neutronStarCases(): Case[] {
  const params = neutronStars.layers.play.params;
  const cases: Case[] = [];

  // Each slider's ends and default, in pairs: mass with period, tilt with view.
  // Mass's max is past the collapse threshold, so the black-hole drawing is in.
  for (const units of ['friendly', 'technical'] as const) {
    for (const m of extremes(paramOf(params, 'M'))) {
      for (const p of extremes(paramOf(params, 'P'))) {
        for (const a of extremes(paramOf(params, 'alpha'))) {
          for (const z of extremes(paramOf(params, 'zeta'))) {
            for (const turn of [0, ns.STATIC_TURN, Math.PI, 3.3 * Math.PI]) {
              cases.push({
                label: `M=${m.stop} P=${p.stop} alpha=${a.stop} zeta=${z.stop} turn=${turn.toFixed(2)} ${units}`,
                draw: (ctx, w, h) =>
                  ns.drawScene(ctx, w, h, {
                    M: m.value,
                    P: p.value,
                    alpha: a.value,
                    zeta: z.value,
                    turn,
                    units,
                  }),
              });
            }
          }
        }
      }
    }
  }

  /*
   * The beam and its label at every tilt and view a reader can reach, and the
   * period dot along the whole strip past the fastest-pulsar and Crab marks.
   */
  const DEG = Math.PI / 180;
  for (let a = 0; a <= 90; a += 15) {
    for (let z = 0; z <= 90; z += 15) {
      for (const turn of [0.4, ns.STATIC_TURN, 2.9, 4.4, 9]) {
        cases.push({
          label: `alpha=${a}° zeta=${z}° turn=${turn}`,
          draw: (ctx, w, h) =>
            ns.drawScene(ctx, w, h, {
              M: paramOf(params, 'M').default,
              P: paramOf(params, 'P').default,
              alpha: a * DEG,
              zeta: z * DEG,
              turn,
              units: 'friendly',
            }),
        });
      }
    }
  }
  /* The review's settings: small tilts, where a beam lies close along the spin axis, and the beam edge. */
  for (const [a, z] of [[0, 0], [3, 5], [5, 5], [3, 0], [10, 0], [45, 35], [45, 55], [45, 20]] as const) {
    for (const turn of [0, ns.STATIC_TURN, Math.PI, 4.4]) {
      for (const units of ['friendly', 'technical'] as const) {
        cases.push({
          label: `review alpha=${a}° zeta=${z}° turn=${turn.toFixed(2)} ${units}`,
          draw: (ctx, w, h) =>
            ns.drawScene(ctx, w, h, {
              M: paramOf(params, 'M').default,
              P: paramOf(params, 'P').default,
              alpha: a * DEG,
              zeta: z * DEG,
              turn,
              units,
            }),
        });
      }
    }
  }

  const pParam = paramOf(params, 'P');
  for (let lp = Math.log10(pParam.min); lp <= Math.log10(pParam.max) + 1e-9; lp += 0.1) {
    cases.push({
      label: `P=10^${lp.toFixed(1)}`,
      draw: (ctx, w, h) =>
        ns.drawScene(ctx, w, h, {
          M: paramOf(params, 'M').default,
          P: 10 ** lp,
          alpha: 45 * DEG,
          zeta: 50 * DEG,
          turn: ns.STATIC_TURN,
          units: 'technical',
        }),
    });
  }

  it('formats the readouts at the defaults the way the module states them', () => {
    const M = paramOf(params, 'M').default;
    const P = paramOf(params, 'P').default;
    expect(ns.formatTime(P)).toBe('33.4 ms');
    expect(ns.formatFractionOfC(equatorialSpeedFraction(P))).toBe('0.753% of light speed');
    expect(ns.formatGravity(surfaceGravity(M))).toBe('163 billion × Earth’s');
    expect(ns.formatSpin(1 / P)).toBe('29.9 turns a second (33.4 ms)');
  });

  it('says what Earth sees, from the beam geometry', () => {
    const M = paramOf(params, 'M').default;
    const DEG2 = Math.PI / 180;
    expect(ns.verdictFor(M, 45 * DEG2, 50 * DEG2)).toBe('one');
    expect(ns.verdictFor(M, 90 * DEG2, 90 * DEG2)).toBe('both');
    expect(ns.verdictFor(M, 20 * DEG2, 70 * DEG2)).toBe('none');
    expect(ns.verdictFor(M, 0, 5 * DEG2)).toBe('steady');
    expect(ns.verdictFor(paramOf(params, 'M').max, 45 * DEG2, 50 * DEG2)).toBe('collapsed');
  });

  /*
   * The review's settings, tilt/view. 45°/35° and 45°/55° sit exactly on the
   * beam edge, a part in 10¹⁶ outside it in floating point; 3°/5° and 5°/5°
   * never leave the beam, so the signal is always on and brightens once a turn.
   */
  it('reads the review’s settings the way their traces look', () => {
    const M = paramOf(params, 'M').default;
    const DEG2 = Math.PI / 180;
    const expected: [number, number, string][] = [
      [3, 5, 'brightening'],
      [5, 5, 'brightening'],
      [45, 35, 'one'],
      [45, 55, 'one'],
      [45, 20, 'none'],
    ];
    for (const [a, z, verdict] of expected) {
      const view = { M, alpha: a * DEG2, zeta: z * DEG2 };
      const samples = ns.traceSamples(view);
      const label = `${a}°/${z}°`;
      expect(ns.verdictFor(M, view.alpha, view.zeta), label).toBe(verdict);
      if (verdict === 'brightening') {
        expect(Math.min(...samples), `${label} never drops to zero`).toBeGreaterThan(0);
        expect(Math.max(...samples) - Math.min(...samples), `${label} brightens and dims`).toBeGreaterThan(0.1);
      }
      if (verdict === 'one') {
        expect(Math.max(...samples), `${label} draws a pulse`).toBeGreaterThan(0);
        expect(Math.min(...samples), `${label} drops to zero between pulses`).toBe(0);
      }
      if (verdict === 'none') expect(Math.max(...samples), `${label} draws nothing`).toBe(0);
    }
  });

  /*
   * One rule, everywhere: at every whole degree of tilt and view, the verdict
   * agrees with the trace that is drawn. Pulses mean the trace reaches zero and
   * rises from it; always on means it never reaches zero; none means it is flat
   * at zero. And a beam reached at φ = 0 lights the line of sight in the drawing
   * at the static frame, which is drawn at that phase.
   */
  it('agrees with its drawn trace at every whole-degree tilt and view', () => {
    const M = paramOf(params, 'M').default;
    const DEG2 = Math.PI / 180;
    const mismatches: string[] = [];
    for (let a = 0; a <= 90; a += 1) {
      for (let z = 0; z <= 90; z += 1) {
        const view = { M, alpha: a * DEG2, zeta: z * DEG2 };
        const verdict = ns.verdictFor(M, view.alpha, view.zeta);
        const samples = ns.traceSamples(view);
        const lo = Math.min(...samples);
        const hi = Math.max(...samples);
        const ok =
          verdict === 'none'
            ? hi === 0
            : verdict === 'one' || verdict === 'both'
              ? lo === 0 && hi > 0
              : verdict === 'brightening'
                ? lo > 0 && hi > lo
                : lo > 0 && hi - lo < 1e-12;
        if (!ok) mismatches.push(`${a}°/${z}°: ${verdict}, trace ${lo.toFixed(3)}–${hi.toFixed(3)}`);
        // The static frame is drawn at φ = 0, sample 45 of the trace.
        const first = beamVisibility(view.alpha, view.zeta).first;
        if (first !== samples[ns.TRACE_STEPS / 8]! > 0 && !beamVisibility(view.alpha, view.zeta).alwaysOn) {
          mismatches.push(`${a}°/${z}°: beam 1 reached ${first}, trace at φ = 0 is ${samples[ns.TRACE_STEPS / 8]}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('never draws the spin faster than the star turns, and says which it is', () => {
    const pParam = paramOf(params, 'P');
    for (let lp = Math.log10(pParam.min); lp <= Math.log10(pParam.max) + 1e-9; lp += 0.05) {
      const P = 10 ** lp;
      expect(ns.shownTurnSeconds(P), `P = ${P}`).toBeGreaterThanOrEqual(P);
    }
    expect(ns.shownTurnSeconds(10)).toBe(10);
    expect(ns.shownTurnSeconds(pParam.default)).toBeGreaterThan(pParam.default);
  });

  return cases;
}

/* -------------------------------- dark matter -------------------------------- */

/** 512 px below the `sm` breakpoint, 600 above it; the sweep runs at the taller, the label checks at both. */
const DM_HEIGHT = 600;
const DM_HEIGHTS = [512, 600];

function darkMatterCases(): Case[] {
  const params = darkMatter.layers.play.params;
  const cases: Case[] = [];
  const MYR = 1e6 * JULIAN_YEAR;
  type DmView = Parameters<typeof dm.drawScene>[3];

  // Every slider's ends and default, against each other, in both label sets,
  // moving and still.
  const views: { label: string; view: DmView }[] = [];
  for (const units of ['friendly', 'technical'] as const) {
    for (const m of extremes(paramOf(params, 'M'))) {
      for (const rd of extremes(paramOf(params, 'Rd'))) {
        for (const v of extremes(paramOf(params, 'vInf'))) {
          for (const r of extremes(paramOf(params, 'R'))) {
            for (const still of [false, true]) {
              views.push({
                label: `M=${m.stop} Rd=${rd.stop} vInf=${v.stop} R=${r.stop} ${still ? 'still' : 't=37 Myr'} ${units}`,
                view: { M: m.value, Rd: rd.value, vInf: v.value, R: r.value, t: still ? 0 : 37 * MYR, still, units },
              });
            }
          }
        }
      }
    }
  }
  // The marker swept across the plot at the defaults, past every curve label.
  const rParam = paramOf(params, 'R');
  for (let r = rParam.min; r <= rParam.max + 1; r += (rParam.max - rParam.min) / 29) {
    for (const vInf of [0, paramOf(params, 'vInf').default, paramOf(params, 'vInf').max]) {
      views.push({
        label: `R=${(r / (1e3 * PARSEC)).toFixed(1)} kpc vInf=${vInf / 1e3} km/s`,
        view: {
          M: paramOf(params, 'M').default,
          Rd: paramOf(params, 'Rd').default,
          vInf,
          R: r,
          t: 0,
          still: false,
          units: 'friendly',
        },
      });
    }
  }
  for (const { label, view } of views) cases.push({ label, draw: (ctx, w, h) => void dm.drawScene(ctx, w, h, view) });

  /*
   * Labels against the curves and the galaxy, two ways. First by the sim's own
   * bookkeeping: no placed label overlaps any obstacle it recorded, the curve
   * segments, the marker and its dots, and the galaxy's disc. Then
   * independently, from what was drawn: no text box contains a star (a filled
   * rect) or a vertex of any line, and the curves are drawn with a vertex at
   * least every 3 px, so a line cannot cross a label between two vertices.
   */
  it('keeps every label off the curves, the marker and the galaxy', () => {
    const problems: string[] = [];
    for (const [width, height] of [...WIDTHS, 390].flatMap((w) => DM_HEIGHTS.map((h) => [w, h] as const))) {
      for (const { label: viewLabel, view } of views) {
        const label = `${viewLabel} h=${height}`;
        const { ctx, records } = recordingContext();
        const layout = dm.drawScene(ctx, width, height, view);
        for (const box of layout.labels) {
          const hit = layout.obstacles.find(
            (o) => Math.min(box.x1, o.x1) > Math.max(box.x0, o.x0) && Math.min(box.y1, o.y1) > Math.max(box.y0, o.y0),
          );
          if (hit) problems.push(`${label} @${width}: label at ${box.x0.toFixed(0)},${box.y0.toFixed(0)} on an obstacle`);
        }
        const texts = records.filter((r) => r.kind === 'text');
        const marks = records.filter((r) => r.kind === 'point' || r.kind === 'rect' || (r.kind === 'arc' && r.x1 - r.x0 <= 12));
        for (const t of texts) {
          const inside = marks.find((m) => m.x1 > t.x0 + 0.5 && m.x0 < t.x1 - 0.5 && m.y1 > t.y0 + 0.5 && m.y0 < t.y1 - 0.5);
          if (inside) problems.push(`${label} @${width}: "${t.text}" is drawn over a ${inside.kind}`);
        }
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
    // About 6 600 full scenes at two heights; well over the default 5 s on a busy runner.
  }, 60_000);

  // The drawing reads the disc's cached table; the readouts read the Bessel
  // functions. The two must agree far below anything visible or printed.
  it('moves every star at the total curve’s speed for its radius', () => {
    for (const { view } of views) {
      const model = dm.modelFor(view);
      for (const star of model.stars) {
        const exact = rotationCurve(star.R, view).total;
        expect(Math.abs((star.omega * star.R) / exact - 1), `R = ${star.R}`).toBeLessThan(1e-6);
      }
    }
  });

  it('puts tracer stars evenly from 10 kpc to the edge, where the curves part', () => {
    const model = dm.modelFor(views[0]!.view);
    const tracers = model.stars.filter((s) => s.tracer);
    expect(tracers).toHaveLength(dm.N_TRACERS);
    expect(Math.min(...tracers.map((s) => s.R))).toBeGreaterThanOrEqual(dm.TRACER_INNER);
    expect(Math.max(...tracers.map((s) => s.R))).toBeLessThanOrEqual(dm.R_VIEW);
    expect(tracers.filter((s) => s.R > 15 * 1e3 * PARSEC).length).toBeGreaterThanOrEqual(18);
  });

  it('uses more of a wide panel for the galaxy', () => {
    const { radius } = dm.galaxyGeometry(578, dm.galaxyBottomFor(600));
    expect(2 * radius).toBeGreaterThan(0.55 * 578);
  });

  it('never leaves the reduced-motion star more than half a lap ahead of its ring', () => {
    for (const { view } of views) {
      const r = markerReadout(view.R, view);
      const t = dm.stillTime(r.withHalo, r.visibleOnly, view.R);
      const lead = ((r.withHalo - r.visibleOnly) / view.R) * t;
      expect(lead, `lead at ${view.R}`).toBeLessThanOrEqual(Math.PI + 1e-9);
      expect(t).toBeLessThanOrEqual(dm.STATIC_TIME);
    }
  });

  it('fades only stars that would circle faster than twice a second on screen', () => {
    // The innermost star at the heaviest, most compact disc: 8.9 turns a second.
    const params2 = darkMatter.layers.play.params;
    const heavy = {
      M: paramOf(params2, 'M').max,
      Rd: paramOf(params2, 'Rd').min,
      vInf: paramOf(params2, 'vInf').default,
    };
    const fastest = Math.max(...dm.modelFor(heavy).stars.map((s) => s.omega));
    expect(1 / dm.screenPeriod(fastest)).toBeGreaterThan(8.5);
    expect(dm.screenPeriod(fastest)).toBeLessThan(dm.FADE_SCREEN_PERIOD);
    // At the defaults the Sun's-distance stars are far slower than the fade threshold.
    const sun = markerReadout(paramOf(params2, 'R').default, { ...heavy, M: paramOf(params2, 'M').default, Rd: paramOf(params2, 'Rd').default });
    expect(dm.screenPeriod(sun.withHalo / paramOf(params2, 'R').default)).toBeGreaterThan(dm.FADE_SCREEN_PERIOD);
  });

  it('names only the curves it draws', () => {
    const base = views.find((v) => v.view.units === 'friendly')!.view;
    const { ctx, records } = recordingContext();
    dm.drawScene(ctx, 900, DM_HEIGHT, { ...base, vInf: 0, R: paramOf(params, 'R').default });
    const words = records.filter((r) => r.kind === 'text').map((r) => r.text ?? '');
    expect(words.some((t) => /halo alone|with the dark halo/.test(t))).toBe(false);
    expect(words).toContain('visible matter only (no halo)');
  });

  it('formats the readouts at the defaults the way the module states them', () => {
    const galaxy = {
      M: paramOf(params, 'M').default,
      Rd: paramOf(params, 'Rd').default,
      vInf: paramOf(params, 'vInf').default,
    };
    const r = markerReadout(paramOf(params, 'R').default, galaxy);
    expect(dm.formatSpeed(r.withHalo)).toBe('227 km/s');
    expect(dm.formatSpeed(r.visibleOnly)).toBe('191 km/s');
    expect(dm.formatPeriod(r.period)).toBe('224 million years');
    expect(dm.formatMass(r.visibleMass)).toBe('52.1 billion Suns');
    expect(dm.formatMass(r.totalMass)).toBe('81.3 billion Suns');
    expect(dm.formatRatio(r.darkToVisible)).toBe('0.561 to 1');
    expect(dm.formatDistance(paramOf(params, 'R').default, false)).toBe('about 27,000 light-years');
    expect(dm.formatDistance(paramOf(params, 'Rd').default, false)).toBe('about 8,480 light-years');
    expect(dm.formatDistance(paramOf(params, 'R').default, true)).toBe('8.28 kpc');
  });

  it('speeds time up by one factor at every setting', () => {
    expect(dm.REAL_SECONDS_PER_SCREEN_SECOND).toBe(25 * MYR);
  });

  return cases;
}

/* --------------------------------- galaxies ---------------------------------- */

/** 416 px below the `sm` breakpoint, 512 above it; the sweep runs at the taller, the label checks at both. */
const GX_HEIGHT = 512;
const GX_HEIGHTS = [416, 512];

function galaxyCases(): Case[] {
  const params = galaxiesModule.layers.play.params;
  const cases: Case[] = [];
  const MYR = 1e6 * JULIAN_YEAR;

  // Every slider's ends and default against each other, each encounter shown
  // at its start, at closest approach, midway out and at its end.
  const views: { label: string; enc: Encounter; t: number; units: 'friendly' | 'technical' }[] = [];
  for (const m of extremes(paramOf(params, 'M2'))) {
    for (const r of extremes(paramOf(params, 'rp'))) {
      for (const i of extremes(paramOf(params, 'tilt'))) {
        const enc = simulateEncounter({ M2: m.value, rp: r.value, tilt: i.value });
        const times = [enc.t0, enc.tPeri, (enc.tPeri + endTime(enc)) / 2, endTime(enc)];
        for (const t of times) {
          for (const units of ['friendly', 'technical'] as const) {
            views.push({ label: `M2=${m.stop} rp=${r.stop} tilt=${i.stop} t=${Math.round(t / MYR)} Myr ${units}`, enc, t, units });
          }
        }
      }
    }
  }
  for (const { label, enc, t, units } of views) {
    cases.push({ label, draw: (ctx, w, h) => void gx.drawScene(ctx, w, h, { enc, t, units }) });
  }

  /*
   * Stars are drawn only inside the plot, and every word sits in the strips
   * above and below it: checked from the draw records, independently of the
   * sim's own bookkeeping. A star is a filled rect; the core dots are arcs.
   */
  it('keeps every star inside the plot and every label off the stars', () => {
    const problems: string[] = [];
    for (const [width, height] of [...WIDTHS, 390].flatMap((w) => GX_HEIGHTS.map((h) => [w, h] as const))) {
      for (const { label, enc, t, units } of views) {
        const { ctx, records } = recordingContext();
        const layout = gx.drawScene(ctx, width, height, { enc, t, units });
        const marks = records.filter((r) => r.kind === 'rect' || (r.kind === 'arc' && r.x1 - r.x0 <= 12));
        for (const m of marks) {
          const cxm = (m.x0 + m.x1) / 2;
          const cym = (m.y0 + m.y1) / 2;
          if (cxm < layout.plot.x0 - 0.5 || cxm > layout.plot.x1 + 0.5 || cym < layout.plot.y0 - 0.5 || cym > layout.plot.y1 + 0.5) {
            problems.push(`${label} @${width}×${height}: a ${m.kind} drawn outside the plot`);
          }
        }
        for (const text of records.filter((r) => r.kind === 'text')) {
          const hit = marks.find((m) => m.x1 > text.x0 && m.x0 < text.x1 && m.y1 > text.y0 && m.y0 < text.y1);
          if (hit) problems.push(`${label} @${width}×${height}: "${text.text}" drawn over a ${hit.kind}`);
        }
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
  }, 60_000);

  it('captions the moment from the same encounter it draws', () => {
    for (const { enc, t, units } of views.filter((_, k) => k % 7 === 0)) {
      const { ctx, records } = recordingContext();
      gx.drawScene(ctx, 900, GX_HEIGHT, { enc, t, units });
      const since = gx.formatSincePeri(t - enc.tPeri, units === 'technical');
      expect(records.some((r) => r.kind === 'text' && (r.text ?? '').includes(since))).toBe(true);
    }
  });

  it('shows Toomre’s result at the defaults: long tails prograde, few retrograde', () => {
    const base = {
      M2: paramOf(params, 'M2').default,
      rp: paramOf(params, 'rp').default,
      tilt: paramOf(params, 'tilt').default,
    };
    const pro = simulateEncounter(base);
    const retro = simulateEncounter({ ...base, tilt: paramOf(params, 'tilt').max });
    expect(gx.formatPercent(pro.tail[pro.steps]!)).toBe('36%');
    expect(gx.formatPercent(retro.tail[retro.steps]!)).toBe('3%');
    expect(gx.formatSpeed(pro.vPeri, false)).toBe('254 kilometres a second');
    expect(gx.formatDistance(pro.rPeri, true)).toBe('20 kpc');
  });

  it('keeps a drag’s draft within its budget, and never below a sixth of the stars', () => {
    const rp = paramOf(params, 'rp');
    for (const r of [rp.min, rp.default, rp.max]) {
      const settings = { M2: paramOf(params, 'M2').max, rp: r, tilt: 0 };
      const { nMain, nComp } = gx.draftCounts(settings);
      const steps = encounterSteps(settings);
      expect(steps * (nMain + nComp) <= gx.DRAFT_BUDGET * 1.02 || nMain === Math.round(MAIN_STARS / 6)).toBe(true);
      expect(nMain).toBeGreaterThanOrEqual(Math.round(MAIN_STARS / 6));
    }
  });

  it('runs time at one stated rate', () => {
    expect(gx.SIM_SECONDS_PER_SCREEN_SECOND).toBe(50 * MYR);
  });

  return cases;
}

/* ---------------------------------- the test --------------------------------- */

const SIMS: { name: string; height: number; cases: () => Case[] }[] = [
  { name: 'escape-velocity', height: 352, cases: escapeCases },
  { name: 'kepler-orbits', height: 384, cases: keplerCases },
  { name: 'scale-of-the-universe', height: 384, cases: scaleCases },
  { name: 'black-holes', height: 320, cases: blackHoleCases },
  { name: 'gravitational-waves', height: 288, cases: gravitationalWaveCases },
  { name: 'exoplanets', height: 352, cases: exoplanetCases },
  { name: 'planetary-atmospheres', height: 304, cases: atmosphereCases },
  { name: 'expansion-of-the-universe', height: EXPANSION_HEIGHT, cases: expansionCases },
  { name: 'cosmic-microwave-background', height: CMB_HEIGHT, cases: cmbCases },
  { name: 'early-universe', height: EARLY_HEIGHT, cases: earlyUniverseCases },
  { name: 'stellar-fusion', height: FUSION_HEIGHT, cases: stellarFusionCases },
  { name: 'supernovae', height: SN_HEIGHT, cases: supernovaeCases },
  { name: 'habitable-zone', height: HZ_HEIGHT, cases: habitableZoneCases },
  { name: 'nebulae', height: NEB_HEIGHT, cases: nebulaeCases },
  { name: 'cosmic-distance-ladder', height: CDL_HEIGHT, cases: ladderCases },
  { name: 'time-dilation', height: TD_HEIGHT, cases: timeDilationCases },
  { name: 'hawking-radiation', height: HR_HEIGHT, cases: hawkingRadiationCases },
  { name: 'wormholes', height: WH_HEIGHT, cases: wormholeCases },
  { name: 'neutron-stars', height: NS_HEIGHT, cases: neutronStarCases },
  { name: 'dark-matter', height: DM_HEIGHT, cases: darkMatterCases },
  { name: 'galaxies', height: GX_HEIGHT, cases: galaxyCases },
];

/**
 * Widths for the collision pass: a phone and a wide desktop.
 *
 * Both matter and they fail differently. Narrow is where two captions get
 * squeezed into the same place; wide is where a label anchored to the right edge
 * meets one anchored to a value — escape-velocity's apex annotation rides on a
 * line whose height is a slider reading, and at a high apex it arrives exactly
 * where the axis note sits, at any width.
 */
const COLLISION_WIDTHS = [390, 900];

/**
 * Sims whose labels are placed by measurement rather than by fixed offsets.
 *
 * Scoped rather than universal on purpose: this asserts a property the three
 * sims below were changed to hold, and listing a sim here is the claim that its
 * placement is measured. Adding the rest means fixing them first.
 */
const MEASURED_PLACEMENT = new Set([
  'escape-velocity',
  'black-holes',
  'gravitational-waves',
  'planetary-atmospheres',
  'expansion-of-the-universe',
  'cosmic-microwave-background',
  'early-universe',
  'stellar-fusion',
  'supernovae',
  'habitable-zone',
  'nebulae',
  'cosmic-distance-ladder',
  'time-dilation',
  'hawking-radiation',
  'wormholes',
  'neutron-stars',
  'dark-matter',
  'galaxies',
]);

for (const sim of SIMS) {
  describe(sim.name, () => {
    const cases = sim.cases();

    it('has cases to draw', () => {
      expect(cases.length).toBeGreaterThan(0);
    });

    for (const width of WIDTHS) {
      it(`draws cleanly at ${width}×${sim.height}`, () => {
        for (const testCase of cases) {
          const { ctx, records, glowRadii, alphas } = recordingContext();
          testCase.draw(ctx, width, sim.height);

          const overflowing = textOutsideFrame(records, width, sim.height);
          expect(
            overflowing.map(describeRecord),
            `${sim.name} · ${testCase.label} · ${width}×${sim.height}: text outside the frame`,
          ).toEqual([]);

          const broken = nonFiniteDraws(records);
          expect(
            broken.map(describeRecord),
            `${sim.name} · ${testCase.label} · ${width}×${sim.height}: non-finite coordinates`,
          ).toEqual([]);

          /*
           * Decoration, held to the same standard as geometry.
           *
           * A glow's radius comes from the body's drawn radius, which comes
           * from an auto-scale that divides by a span the sliders can drive to
           * zero — so it is on exactly the path that produces `NaN` at an
           * extreme. Canvas throws on a non-finite gradient in some engines and
           * silently draws nothing in others, which is the failure this catches
           * at a width and a slider stop rather than in a screenshot.
           */
          expect(
            badGlowRadii(glowRadii),
            `${sim.name} · ${testCase.label} · ${width}×${sim.height}: glow radius not finite and non-negative`,
          ).toEqual([]);

          /*
           * Every alpha, held to canvas's own range rather than to the trail's.
           *
           * Not every `globalAlpha` here belongs to a trail — scale-of-the-universe
           * washes its whole frame at 0.875 — so the bound that applies to all of
           * them is [0, 1]. Canvas clamps silently, so an out-of-range value is
           * invisible and still wrong, and a `NaN` is ignored outright, which
           * leaves the *previous* alpha applied to everything drawn after it. The
           * tighter trail bound is asserted below, where trails actually exist.
           */
          expect(
            alphasOutOfRange(alphas),
            `${sim.name} · ${testCase.label} · ${width}×${sim.height}: alpha outside [0, 1]`,
          ).toEqual([]);
        }
      });
    }

    if (MEASURED_PLACEMENT.has(sim.name)) {
      for (const width of COLLISION_WIDTHS) {
        it(`keeps its labels off each other at ${width}×${sim.height}`, () => {
          for (const testCase of cases) {
            const { ctx, records } = recordingContext();
            testCase.draw(ctx, width, sim.height);

            const collisions = textCollisions(records);
            expect(
              collisions.map(
                ([a, b]) => `${describeRecord(a)}  overprints  ${describeRecord(b)}`,
              ),
              `${sim.name} · ${testCase.label} · ${width}×${sim.height}: labels overlap`,
            ).toEqual([]);
          }
        });
      }
    }
  });
}

/* ------------------------------ trails and glow ------------------------------ */

/**
 * The decoration this pass added, checked where it actually lives.
 *
 * The per-sim loop above asserts the invariants that hold for every sim — glow
 * radii finite, alpha inside canvas's own range. These are the tighter ones, and
 * they only make sense on the two sims that carry a trail: that a trail never
 * reaches the opacity of the body it trails, and that a glow sized from a body
 * whose drawn radius is set by an auto-scale still fits the frame it is drawn
 * in. Both are asserted with the buffer *full*, because a trail with one point
 * in it exercises none of the decay arithmetic.
 */
describe('trails and glow', () => {
  const keplerParams = keplerOrbits.layers.play.params;
  const exoParams = exoplanets.layers.play.params;

  it('keeps trail alpha under the body it trails, at every extreme', () => {
    for (const m of extremes(paramOf(keplerParams, 'M'))) {
      for (const a of extremes(paramOf(keplerParams, 'a'))) {
        for (const e of extremes(paramOf(keplerParams, 'e'))) {
          const geom = orbitGeometry(a.value, e.value);
          const T = period(m.value, a.value);
          const trail = createTrail(90);
          // Fill it the way the loop does: real positions, all the way round.
          for (let i = 0; i < 200; i += 1) {
            const at = stateAt(m.value, a.value, e.value, (i / 200) * T);
            pushTrail(trail, at.x, at.y);
          }
          expect(trail.count, 'the buffer should be full').toBe(90);

          for (const width of WIDTHS) {
            const { ctx, records, glowRadii, alphas } = recordingContext();
            ko.drawScene(ctx, width, 384, {
              M: m.value,
              a: a.value,
              e: e.value,
              T,
              geom,
              t: T * 0.25,
              rate: T / 12,
              wedges: [],
              sweep: false,
              frozen: false,
              trail,
            });

            const label = `kepler M=${m.stop} a=${a.stop} e=${e.stop} @${width}`;
            // 1 is `drawTrail` restoring the context on its way out, not a
            // value any dot was drawn at; everything else is a trail alpha.
            const trailAlphas = alphas.filter((a) => a !== 1);
            expect(trailAlphas.length, `${label}: the trail drew nothing`).toBeGreaterThan(0);
            expect(
              alphasOutOfRange(trailAlphas, MAX_TRAIL_ALPHA),
              `${label}: trail alpha`,
            ).toEqual([]);
            expect(badGlowRadii(glowRadii), `${label}: glow radius`).toEqual([]);
            for (const r of glowRadii) {
              expect(r, `${label}: glow radius ${r} escapes the frame`).toBeLessThanOrEqual(
                Math.max(width, 384),
              );
            }
            expect(nonFiniteDraws(records).map(describeRecord), `${label}: geometry`).toEqual([]);
          }
        }
      }
    }
  });

  it('keeps the transit trail bounded at every extreme', () => {
    const ms = paramOf(exoParams, 'Mstar').default;
    for (const rs of extremes(paramOf(exoParams, 'Rstar'))) {
      for (const rp of extremes(paramOf(exoParams, 'Rp'))) {
        for (const a of extremes(paramOf(exoParams, 'a'))) {
          const shape = transitShape(ms, rs.value, rp.value, a.value);
          const trail = createTrail(60);

          for (const width of WIDTHS) {
            const { ctx, records, glowRadii, alphas } = recordingContext();
            // Ten frames so the buffer fills and the decay is exercised.
            for (let i = 0; i < 70; i += 1) {
              ep.drawScene(ctx, width, 352, {
                rs: rs.value,
                rp: rp.value,
                a: a.value,
                shape,
                progress: i / 70,
                trail,
              });
            }

            const label = `exoplanets Rs=${rs.stop} Rp=${rp.stop} a=${a.stop} @${width}`;
            // 1 is `drawTrail` restoring the context on its way out, not a
            // value any dot was drawn at; everything else is a trail alpha.
            const trailAlphas = alphas.filter((a) => a !== 1);
            /* The sliders reach a corner where the orbit lies inside the star.
               There is no transit to draw there, so `drawScene` bails to a
               message before it ever reaches the planet — and a trail that drew
               nothing is the correct outcome, not a missing one. */
            if (shape.transits) {
              expect(trailAlphas.length, `${label}: the trail drew nothing`).toBeGreaterThan(0);
            }
            expect(
              alphasOutOfRange(trailAlphas, MAX_TRAIL_ALPHA),
              `${label}: trail alpha`,
            ).toEqual([]);
            expect(badGlowRadii(glowRadii), `${label}: glow radius`).toEqual([]);
            expect(nonFiniteDraws(records).map(describeRecord), `${label}: geometry`).toEqual([]);
          }
        }
      }
    }
  });

  it('draws no trail at all when there is none to draw', () => {
    const geom = orbitGeometry(paramOf(keplerParams, 'a').default, 0.3);
    const T = period(paramOf(keplerParams, 'M').default, paramOf(keplerParams, 'a').default);
    const { ctx, alphas } = recordingContext();
    ko.drawScene(ctx, 660, 384, {
      M: paramOf(keplerParams, 'M').default,
      a: paramOf(keplerParams, 'a').default,
      e: 0.3,
      T,
      geom,
      t: 0,
      rate: 1,
      wedges: [],
      sweep: false,
      frozen: true,
      trail: null,
    });
    // Reduced motion and the parked planet both arrive here. Nothing should
    // have touched alpha, which is how "no trails" is observable from outside.
    expect(alphas).toEqual([]);
  });
});

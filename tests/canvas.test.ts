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
import { __internals as ev } from '@/sims/escape-velocity';
import { __internals as eu } from '@/sims/expansion-of-the-universe';
import { __internals as gw } from '@/sims/gravitational-waves';
import { __internals as ko } from '@/sims/kepler-orbits';
import { __internals as pa } from '@/sims/planetary-atmospheres';
import { __internals as su } from '@/sims/scale-of-the-universe';

import { apexAltitude, integrateFlight, timestepFor, vEsc } from '@/physics/escape';
import { chirpMass, fCutoff } from '@/physics/gw';
import { orbitGeometry, period, stateAt } from '@/physics/kepler';
import { transitShape } from '@/physics/transit';
import { GASES, retentionVerdict } from '@/physics/atmosphere';
import {
  lineOfSightVelocity,
  observedWavelength,
  redshiftFromVelocity,
} from '@/physics/cosmology';
import {
  AU,
  EV,
  H_ALPHA_AIR,
  JULIAN_YEAR,
  KM_S_PER_MPC,
  LIGHT_YEAR,
  L_SUN,
  MEGAPARSEC,
  M_SUN,
  PARSEC,
  T_CMB,
} from '@/physics/constants';
import {
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
          timestepFor(m.value, r.value),
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
              phase: escaping ? 'escaped' : flight.leftFrame ? 'offframe' : 'landed',
              staticPath: true,
            }),
        });
      }
    }
  }

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

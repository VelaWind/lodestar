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
import escapeVelocity from '@/content/modules/escape-velocity';
import gravitationalWaves from '@/content/modules/gravitational-waves';
import keplerOrbits from '@/content/modules/kepler-orbits';
import planetaryAtmospheres from '@/content/modules/planetary-atmospheres';
import scaleOfTheUniverse, { scaleAnchors } from '@/content/modules/scale-of-the-universe';

import { __internals as bh } from '@/sims/black-holes';
import { __internals as ep } from '@/sims/exoplanets';
import { __internals as ev } from '@/sims/escape-velocity';
import { __internals as gw } from '@/sims/gravitational-waves';
import { __internals as ko } from '@/sims/kepler-orbits';
import { __internals as pa } from '@/sims/planetary-atmospheres';
import { __internals as su } from '@/sims/scale-of-the-universe';

import { apexAltitude, integrateFlight, timestepFor, vEsc } from '@/physics/escape';
import { chirpMass, fCutoff } from '@/physics/gw';
import { orbitGeometry, period } from '@/physics/kepler';
import { transitShape } from '@/physics/transit';
import { GASES, retentionVerdict } from '@/physics/atmosphere';
import {
  iscoRadius,
  photonSphereRadius,
  schwarzschildRadius,
} from '@/physics/blackhole';

import type { Param } from '@/content/types';
import {
  describeRecord,
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

/* ---------------------------------- the test --------------------------------- */

const SIMS: { name: string; height: number; cases: () => Case[] }[] = [
  { name: 'escape-velocity', height: 352, cases: escapeCases },
  { name: 'kepler-orbits', height: 384, cases: keplerCases },
  { name: 'scale-of-the-universe', height: 384, cases: scaleCases },
  { name: 'black-holes', height: 320, cases: blackHoleCases },
  { name: 'gravitational-waves', height: 288, cases: gravitationalWaveCases },
  { name: 'exoplanets', height: 352, cases: exoplanetCases },
  { name: 'planetary-atmospheres', height: 304, cases: atmosphereCases },
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
          const { ctx, records } = recordingContext();
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

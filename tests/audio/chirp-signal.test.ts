/**
 * The chirp sonification, rendered and measured as a signal.
 *
 * The e2e suite proves the audio graph gets built, starts and tears itself
 * down. It cannot hear anything, so up to here nothing has checked that what
 * comes out is a rising chirp at the frequencies the module claims rather than a
 * buzz, a click, or silence — the one part of the site whose output no test had
 * ever looked at.
 *
 * So this renders it. The oscillator and gain curves come from
 * `@/sims/gw-audio`, the same two arrays the component hands to
 * `setValueCurveAtTime`, and the synthesis below is what a Web Audio sine
 * oscillator does with them: integrate the scheduled frequency into a phase,
 * multiply by the scheduled gain. Everything asserted is then measured back out
 * of the resulting buffer — the instantaneous frequency from zero crossings,
 * the continuity from sample-to-sample deltas — rather than read off the
 * schedule that produced it, so a schedule that renders to the wrong sound has
 * somewhere to fail.
 *
 * The two buffers are written to `qa-audio/` as WAVs so they can be listened to.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { M_SUN } from '@/physics/constants';
import { chirpMass, fCutoff, fOfTimeToMerger, timeToMerger } from '@/physics/gw';
import {
  AUDIBLE_FLOOR_HZ,
  AUDIO_GAIN,
  AUDIO_MAX_S,
  BAND_ENTRY_HZ,
  FADE_FRACTION,
  audioPlanFor,
  chirpCurves,
  sampleCurve,
  type AudioPlan,
  type ChirpCurves,
} from '@/sims/gw-audio';
import { __internals as gw } from '@/sims/gravitational-waves';

const SAMPLE_RATE = 44_100;
const OUT_DIR = 'qa-audio';

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * A sine oscillator driven by the two scheduled curves.
 *
 * Phase is integrated rather than computed from `sin(2πft)`: the frequency is
 * changing, and evaluating the closed form at each sample would produce a
 * different waveform from the one an oscillator produces — with discontinuities
 * wherever the frequency moved, which is exactly what the continuity assertions
 * below are looking for. An oscillator advances its phase by 2πf/sr each sample
 * and never jumps, so a jump in the render means a jump in the schedule.
 */
function render(curves: ChirpCurves, duration: number, sampleRate = SAMPLE_RATE): Float32Array {
  const count = Math.round(duration * sampleRate);
  const out = new Float32Array(count);
  let phase = 0;
  for (let i = 0; i < count; i += 1) {
    const fraction = i / (count - 1);
    const f = sampleCurve(curves.frequencies, fraction);
    const g = sampleCurve(curves.gains, fraction);
    out[i] = Math.sin(phase) * g;
    phase += (2 * Math.PI * f) / sampleRate;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

interface Crossing {
  /** Seconds from the start of the buffer, interpolated between samples. */
  t: number;
}

/**
 * Every sign change, up or down, located between samples.
 *
 * Half-periods rather than whole ones: the default chirp is a quarter of a
 * second and contains about eleven cycles, so counting only the upward
 * crossings would leave ten numbers to describe the whole sweep. A positive
 * gain envelope cannot move a zero crossing, so the fades at either end do not
 * bias this — but they do drive the signal to exactly zero at the edges, which
 * is why a crossing needs a strict sign change on both sides rather than a
 * `<= 0` test that a run of zeros would satisfy.
 */
function crossings(buffer: Float32Array): Crossing[] {
  const found: Crossing[] = [];
  for (let i = 1; i < buffer.length; i += 1) {
    const a = buffer[i - 1] ?? 0;
    const b = buffer[i] ?? 0;
    if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
      // Linear interpolation is exact enough here: a sine is straight through
      // its zero, and at these frequencies a half-period spans hundreds of
      // samples.
      const between = a / (a - b);
      found.push({ t: (i - 1 + between) / SAMPLE_RATE });
    }
  }
  return found;
}

interface FrequencyPoint {
  /** Midpoint of the interval this was measured over, s. */
  t: number;
  hz: number;
}

/**
 * Instantaneous frequency from consecutive crossings, averaged over a window.
 *
 * One half-period gives one estimate; a window of several smooths the estimate
 * without smearing a sweep that only spans a couple of octaves.
 */
function instantaneousFrequency(buffer: Float32Array, window: number): FrequencyPoint[] {
  const zeros = crossings(buffer);
  const points: FrequencyPoint[] = [];
  for (let i = 0; i + window < zeros.length; i += 1) {
    const from = zeros[i];
    const to = zeros[i + window];
    if (!from || !to) continue;
    const span = to.t - from.t;
    if (!(span > 0)) continue;
    // `window` half-periods across `span` seconds.
    points.push({ t: (from.t + to.t) / 2, hz: window / (2 * span) });
  }
  return points;
}

/** Largest jump between neighbouring samples. */
function maxStep(buffer: Float32Array): { value: number; at: number } {
  let value = 0;
  let at = 0;
  for (let i = 1; i < buffer.length; i += 1) {
    const step = Math.abs((buffer[i] ?? 0) - (buffer[i - 1] ?? 0));
    if (step > value) {
      value = step;
      at = i;
    }
  }
  return { value, at };
}

function peakOf(buffer: Float32Array): number {
  let peak = 0;
  for (const sample of buffer) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

/* ------------------------------------------------------------------ */
/* WAV                                                                 */
/* ------------------------------------------------------------------ */

/** Mono 16-bit PCM, at the amplitude the site actually plays. */
function toWav(buffer: Float32Array, sampleRate = SAMPLE_RATE): Buffer {
  const bytes = Buffer.alloc(44 + buffer.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + buffer.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16); // PCM header length
  bytes.writeUInt16LE(1, 20); // format: PCM
  bytes.writeUInt16LE(1, 22); // channels
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28); // byte rate
  bytes.writeUInt16LE(2, 32); // block align
  bytes.writeUInt16LE(16, 34); // bits per sample
  bytes.write('data', 36);
  bytes.writeUInt32LE(buffer.length * 2, 40);
  for (let i = 0; i < buffer.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, buffer[i] ?? 0));
    bytes.writeInt16LE(Math.round(clamped * 32_767), 44 + i * 2);
  }
  return bytes;
}

/* ------------------------------------------------------------------ */
/* The two binaries                                                    */
/* ------------------------------------------------------------------ */

/** Luminosity distance, m — the module's default, about 410 Mpc. */
const DISTANCE = 1.26e25;

interface Case {
  name: string;
  file: string;
  m1: number;
  m2: number;
  /**
   * How far the last measured window may sit from the true inspiral frequency.
   *
   * The automation curve is 512 points across the whole sweep, so its final
   * segment is duration/511 long, and inside that segment Web Audio interpolates
   * linearly between the two endpoints. For the default binary that segment is
   * half a millisecond and the true frequency crosses it from 67 to 68 Hz —
   * nothing is lost. For the neutron stars the same segment is 11.7 ms and the
   * true frequency crosses it from 678 Hz to 1570 Hz, which a straight line
   * cannot follow: the played sweep runs ahead of the physics over those last
   * few cycles.
   *
   * The number is what that costs, measured, and it is asserted rather than
   * waived so it cannot quietly get worse. Closing it means more curve points,
   * or points spaced in time-to-merger rather than evenly — a change to what
   * plays, which is the author's call and not this pass's.
   */
  endTolerance: number;
}

const CASES: Case[] = [
  {
    name: 'default (36 + 29 M☉)',
    file: 'chirp-default-36-29.wav',
    m1: 36 * M_SUN,
    m2: 29 * M_SUN,
    endTolerance: 0.05,
  },
  {
    name: 'BNS (1.4 + 1.4 M☉)',
    file: 'chirp-bns-1.4-1.4.wav',
    m1: 1.4 * M_SUN,
    m2: 1.4 * M_SUN,
    endTolerance: 0.1,
  },
];

interface Rendered {
  plan: AudioPlan;
  curves: ChirpCurves;
  buffer: Float32Array;
  mc: number;
}

function build({ m1, m2 }: Case): Rendered {
  const mc = chirpMass(m1, m2);
  const cutoff = fCutoff(m1, m2);
  const win = gw.windowFor(mc, DISTANCE, cutoff);
  expect(win, 'no drawn window for this binary').not.toBeNull();
  const plan = audioPlanFor(mc, win!);
  const curves = chirpCurves(plan, mc, DISTANCE);
  return { plan, curves, buffer: render(curves, plan.duration), mc };
}

/** What the schedule clamps a true frequency to before it reaches the ear. */
const audible = (hz: number): number => Math.max(AUDIBLE_FLOOR_HZ, hz);

/**
 * The mean of a frequency function across an interval.
 *
 * A window of zero crossings measures cycles divided by time, which is the
 * *mean* frequency over the interval it spans — not the frequency at its
 * midpoint. Where the sweep is steep those differ by a lot, so comparing a
 * measurement against an instantaneous value would be comparing two different
 * quantities and calling the difference an error.
 */
function meanBetween(from: number, to: number, at: (t: number) => number): number {
  const steps = 400;
  let sum = 0;
  for (let i = 0; i < steps; i += 1) sum += at(from + ((to - from) * (i + 0.5)) / steps);
  return sum / steps;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

mkdirSync(OUT_DIR, { recursive: true });

const rendered = new Map<string, Rendered>();

describe.each(CASES)('chirp signal: $name', (subject) => {
  const state = rendered.get(subject.name) ?? build(subject);
  rendered.set(subject.name, state);
  const { plan, curves, buffer, mc } = state;

  /** The first and last measured windows, with the interval each spans. */
  const edges = (): { what: 'start' | 'end'; span: [number, number]; hz: number }[] => {
    const window = 2;
    const zeros = crossings(buffer);
    const track = instantaneousFrequency(buffer, window);
    const last = track.length - 1;
    return [
      { what: 'start', span: [zeros[0]!.t, zeros[window]!.t], hz: track[0]!.hz },
      { what: 'end', span: [zeros[last]!.t, zeros[last + window]!.t], hz: track[last]!.hz },
    ];
  };

  it('writes the rendered chirp to qa-audio/', () => {
    writeFileSync(`${OUT_DIR}/${subject.file}`, toWav(buffer));
    expect(buffer.length, 'nothing was rendered').toBeGreaterThan(1_000);
  });

  it('lasts as long as the sim says it does', () => {
    const seconds = buffer.length / SAMPLE_RATE;
    expect(
      Math.abs(seconds - plan.duration) / plan.duration,
      `rendered ${seconds.toFixed(3)} s against a scheduled ${plan.duration.toFixed(3)} s`,
    ).toBeLessThan(0.05);
  });

  it('sweeps upward from end to end', () => {
    // A window of four half-periods: fine enough to follow a sweep that doubles
    // inside a quarter of a second, coarse enough that the last cycles of the
    // fade-out do not each become their own estimate.
    const track = instantaneousFrequency(buffer, 4);
    expect(track.length, 'too few cycles to measure a sweep').toBeGreaterThan(6);

    let worst = 0;
    for (let i = 1; i < track.length; i += 1) {
      const previous = track[i - 1]!;
      const current = track[i]!;
      worst = Math.min(worst, (current.hz - previous.hz) / previous.hz);
    }
    // Zero-crossing timing quantises the estimate, so a step can come out flat
    // or a hair negative where the sweep is slowest. A real fall — a schedule
    // that turned over — is a different order of magnitude.
    expect(
      worst,
      `instantaneous frequency fell by ${(worst * -100).toFixed(2)}% between windows`,
    ).toBeGreaterThan(-0.02);

    expect(track[track.length - 1]!.hz, 'the sweep did not rise overall').toBeGreaterThan(
      track[0]!.hz * 1.5,
    );
  });

  it('renders exactly the sweep it was scheduled', () => {
    // Separate from the physics comparison below on purpose: this asks whether
    // the waveform is the schedule, and that has to hold to a fraction of a per
    // cent whatever the schedule happens to be.
    for (const { span, hz, what } of edges()) {
      const scheduled = meanBetween(span[0], span[1], (t) =>
        sampleCurve(curves.frequencies, t / plan.duration),
      );
      expect(
        Math.abs(hz - scheduled) / scheduled,
        `${what}: rendered ${hz.toFixed(1)} Hz against a scheduled ${scheduled.toFixed(1)} Hz`,
      ).toBeLessThan(0.01);
    }
  });

  it('starts and ends on the frequencies the physics gives', () => {
    const trueAt = (t: number): number =>
      audible(fOfTimeToMerger(mc, Math.max(plan.tauEnd, plan.tauStart - t)));

    for (const { span, hz, what } of edges()) {
      const expected = meanBetween(span[0], span[1], trueAt);
      const tolerance = what === 'end' ? subject.endTolerance : 0.05;
      expect(
        Math.abs(hz - expected) / expected,
        `${what}: measured ${hz.toFixed(1)} Hz against ${expected.toFixed(1)} Hz from fOfTimeToMerger`,
      ).toBeLessThan(tolerance);
    }

    // And the band itself is the physics band, post-clamp, at both ends.
    expect(sampleCurve(curves.frequencies, 0)).toBeCloseTo(audible(plan.fStart), 4);
    expect(sampleCurve(curves.frequencies, 1)).toBeCloseTo(audible(plan.fEnd), 4);
  });

  it('has no discontinuity a sine at these frequencies could not produce', () => {
    // One sample of a sine of amplitude A at frequency f moves at most
    // A·2π·f/sr. The envelope adds its own slope: it climbs from nothing to the
    // ceiling across FADE_FRACTION of the sweep.
    // Bounded by the amplitude the signal actually reaches rather than by the
    // gain ceiling: a looser bound would pass a chirp that clicked. A click
    // between two samples of a signal peaking at A is a step of order A, which
    // is tens of times this bound at any frequency the ear can hear.
    const topFrequency = sampleCurve(curves.frequencies, 1);
    const peak = peakOf(buffer);
    const oscillator = (peak * 2 * Math.PI * topFrequency) / SAMPLE_RATE;
    const envelope = AUDIO_GAIN / (FADE_FRACTION * plan.duration * SAMPLE_RATE);
    const bound = (oscillator + envelope) * 1.05;

    const step = maxStep(buffer);
    expect(
      step.value,
      `largest sample-to-sample jump ${step.value.toFixed(5)} at sample ${step.at}, against a bound of ${bound.toFixed(5)}`,
    ).toBeLessThan(bound);

    // A click is what this is really looking for, and a click is orders of
    // magnitude above the bound rather than a few per cent.
    expect(buffer[0], 'the first sample is not silent — that is a click').toBe(0);
    expect(Math.abs(buffer[buffer.length - 1]!), 'the last sample is not silent').toBeLessThan(1e-6);
    expect(sampleCurve(curves.gains, 0), 'the envelope does not open at zero').toBe(0);
    expect(sampleCurve(curves.gains, 1), 'the envelope does not close at zero').toBe(0);
  });

  it('stays inside its level ceiling and never clips', () => {
    const peak = peakOf(buffer);
    expect(peak, 'the signal clips').toBeLessThanOrEqual(1);
    expect(peak, 'nothing is audible').toBeGreaterThan(0);
    // The ceiling is deliberate and low: this plays on one click, unannounced.
    expect(
      peak,
      `peak ${peak.toFixed(4)} against a gain ceiling of ${AUDIO_GAIN}`,
    ).toBeLessThanOrEqual(AUDIO_GAIN + 1e-6);

    // How close a chirp gets to that ceiling is not the same for every binary,
    // and the gap is real rather than slack in the test. The gain curve tracks
    // strain, which climbs as f^(2/3) and so does most of its climbing in the
    // last few per cent of the sweep — where the fade-out is already pulling it
    // down. A long sweep therefore peaks well below a short one: the neutron
    // stars reach about 29% of the ceiling against the default's 92%, and their
    // loudest moment is the one the fade is cutting. Bounded here so it is
    // recorded and cannot drift further without the suite noticing.
    expect(peak, 'the chirp barely rises above silence').toBeGreaterThan(AUDIO_GAIN * 0.25);
  });
});

/**
 * The measurements, printed.
 *
 * Not an assertion — everything here is asserted above. This is so a run of the
 * suite leaves the numbers behind rather than only a pass, because the useful
 * question about a sonification is not "did it pass" but "at what frequencies,
 * for how long, and how close to the physics".
 */
describe('chirp signal: measured', () => {
  it('reports what was rendered', () => {
    const rows: string[] = [];
    for (const subject of CASES) {
      const state = rendered.get(subject.name) ?? build(subject);
      const { plan, curves, buffer, mc } = state;
      const zeros = crossings(buffer);
      const track = instantaneousFrequency(buffer, 2);
      const last = track.length - 1;
      const trueAt = (t: number): number =>
        audible(fOfTimeToMerger(mc, Math.max(plan.tauEnd, plan.tauStart - t)));
      const spans: [number, number][] = [
        [zeros[0]!.t, zeros[2]!.t],
        [zeros[last]!.t, zeros[last + 2]!.t],
      ];
      const measured = [track[0]!.hz, track[last]!.hz];
      const physics = spans.map(([a, b]) => meanBetween(a, b, trueAt));
      const step = maxStep(buffer);
      const peak = peakOf(buffer);
      const bound =
        ((peak * 2 * Math.PI * sampleCurve(curves.frequencies, 1)) / SAMPLE_RATE +
          AUDIO_GAIN / (FADE_FRACTION * plan.duration * SAMPLE_RATE)) *
        1.05;
      const err = (i: number): string =>
        `${((100 * Math.abs(measured[i]! - physics[i]!)) / physics[i]!).toFixed(2)}%`;

      rows.push(
        [
          `  ${subject.name}`,
          `    band          ${audible(plan.fStart).toFixed(2)} Hz -> ${audible(plan.fEnd).toFixed(2)} Hz (clamped ${plan.clamped})`,
          `    measured      ${measured[0]!.toFixed(2)} Hz -> ${measured[1]!.toFixed(2)} Hz`,
          `    physics mean  ${physics[0]!.toFixed(2)} Hz -> ${physics[1]!.toFixed(2)} Hz   (error ${err(0)} -> ${err(1)})`,
          `    duration      rendered ${(buffer.length / SAMPLE_RATE).toFixed(4)} s against scheduled ${plan.duration.toFixed(4)} s`,
          `    max step      ${step.value.toFixed(6)} against a bound of ${bound.toFixed(6)} (${((100 * step.value) / bound).toFixed(1)}% of it)`,
          `    peak          ${peak.toFixed(4)} against a ceiling of ${AUDIO_GAIN} (${((100 * peak) / AUDIO_GAIN).toFixed(0)}%)`,
          `    file          ${OUT_DIR}/${subject.file}`,
        ].join('\n'),
      );
    }
    // eslint-disable-next-line no-console
    console.log(`\n${rows.join('\n')}\n`);
    expect(rows.length).toBe(CASES.length);
  });
});

describe('chirp signal: the two binaries against each other', () => {
  const [first, second] = CASES;
  const light = rendered.get(second!.name) ?? build(second!);
  const heavy = rendered.get(first!.name) ?? build(first!);

  it('gives the neutron stars a far longer sweep, for the reason the physics gives', () => {
    // A lighter binary spends longer in the detector band: τ ∝ M_c^(-5/3), so
    // 1.4+1.4 takes about fifty seconds from 30 Hz where 36+29 takes a third of
    // a second. The sonification plays the last AUDIO_MAX_S of that, which is
    // why the light case sits on the ceiling and the heavy one does not.
    const bandEntryLight = timeToMerger(light.mc, BAND_ENTRY_HZ);
    const bandEntryHeavy = timeToMerger(heavy.mc, BAND_ENTRY_HZ);
    expect(bandEntryLight, 'a neutron-star inspiral should be the long one').toBeGreaterThan(
      bandEntryHeavy * 100,
    );

    expect(light.plan.duration, 'the light binary should sit on the length ceiling').toBeCloseTo(
      AUDIO_MAX_S,
      6,
    );
    expect(heavy.plan.duration, 'the heavy binary should be shorter than the ceiling').toBeLessThan(
      AUDIO_MAX_S,
    );

    const ratio = light.buffer.length / heavy.buffer.length;
    const expected = AUDIO_MAX_S / heavy.plan.duration;
    expect(ratio, 'the rendered lengths do not stand in the ratio the plans do').toBeCloseTo(
      expected,
      1,
    );
    expect(ratio, 'the sweeps are not materially different in length').toBeGreaterThan(10);
  });

  it('puts the lighter binary higher at the top of its sweep', () => {
    // f_cut ∝ 1/M: the lighter pair merges at a higher frequency, and the whole
    // point of the sonification is that both land inside human hearing.
    const top = (state: Rendered): number => sampleCurve(state.curves.frequencies, 1);
    expect(top(light)).toBeGreaterThan(top(heavy));
    for (const state of [light, heavy]) {
      expect(top(state), 'the sweep ends outside human hearing').toBeLessThan(20_000);
      expect(sampleCurve(state.curves.frequencies, 0)).toBeGreaterThanOrEqual(AUDIBLE_FLOOR_HZ);
    }
  });
});

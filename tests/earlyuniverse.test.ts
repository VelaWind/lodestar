/**
 * The early-universe model's inverses and its epoch table.
 *
 * `physics.test.ts` runs the sanity block, which checks the model against the
 * landmarks it quotes. This checks the model against itself: the sim draws the
 * temperature curve from time and the readouts go the other way, so each
 * function and its inverse have to agree, and the epoch lookup has to walk the
 * table in order however finely the temperature is swept.
 */
import { describe, expect, it } from 'vitest';
import {
  EPOCHS,
  epochAt,
  lcdmScaleFactorAtTime,
  lcdmTimeAtScaleFactor,
  radiationTemperatureAtTime,
  radiationTimeAtTemperature,
} from '@/physics/earlyuniverse';

describe('early universe', () => {
  it('inverts the radiation-era time–temperature relation', () => {
    for (const T of [1e9, 1e11, 1e13]) {
      const back = radiationTemperatureAtTime(radiationTimeAtTemperature(T));
      expect(Math.abs(back / T - 1), `T = ${T} K came back as ${back}`).toBeLessThanOrEqual(1e-6);
    }
  });

  it('inverts the ΛCDM time–scale-factor relation', () => {
    for (const a of [1e-6, 1e-3, 0.5]) {
      const back = lcdmScaleFactorAtTime(lcdmTimeAtScaleFactor(a));
      expect(Math.abs(back / a - 1), `a = ${a} came back as ${back}`).toBeLessThanOrEqual(1e-6);
    }
  });

  it('never returns a later epoch for a hotter temperature', () => {
    // Swept from cold to hot, the row index can only stay or fall back toward
    // the start of the table, which runs hot to cold.
    let previous = EPOCHS.length;
    for (let e = 0; e <= 14; e += 0.01) {
      const index = EPOCHS.indexOf(epochAt(10 ** e));
      expect(index, `no epoch at T = 10^${e.toFixed(2)} K`).toBeGreaterThanOrEqual(0);
      expect(index, `T = 10^${e.toFixed(2)} K went to a later epoch`).toBeLessThanOrEqual(previous);
      previous = index;
    }
    // And the sweep reached both ends of the table.
    expect(epochAt(1).id).toBe('stars');
    expect(epochAt(1e14).id).toBe('quark-gluon-plasma');
  });
});

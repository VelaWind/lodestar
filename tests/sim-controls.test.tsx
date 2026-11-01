// @vitest-environment jsdom
/**
 * One simulation's controls, end to end: a slider moved, and every place on the
 * page that shows that quantity agreeing about it.
 *
 * The escape-velocity page is rendered as the app renders it. Its mass slider
 * drives three things at once: the slider's own label, the simulation's
 * "escape speed" readout, and the equation in the math layer with the Numbers
 * view on. The readout comes from `vEsc` in the physics layer and the equation
 * from `siValueToTex` in the formatter, two separate routes, so this test
 * recomputes the escape speed from the numbers the equation actually shows and
 * checks it against the readout. If the two ever disagree, a reader sees a
 * formula that does not produce the number beside it.
 */
import './helpers/dom';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '@/App';
import escapeVelocity from '@/content/modules/escape-velocity';
import type { Param } from '@/content/types';
import {
  formatWithUnit,
  siValueToTex,
  sliderInputAttrs,
  valueFromSliderPosition,
} from '@/lib/format';
import { G } from '@/physics/constants';
import { vEsc } from '@/physics/escape';
import { useAppStore } from '@/store/useAppStore';

const ID = 'escape-velocity';
const params = escapeVelocity.layers.play.params;
const param = (id: string): Param => {
  const found = params.find((p) => p.id === id);
  if (!found) throw new Error(`no param ${id}`);
  return found;
};

/** The student tier opens both the simulation and the math layer. */
async function renderPage() {
  act(() => useAppStore.setState({ tier: 'student' }));
  window.history.pushState({}, '', `/m/${ID}`);
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: escapeVelocity.title });
  return waitFor(() => {
    const dl = document.getElementById('escape-velocity-readouts');
    if (!dl) throw new Error('simulation not loaded yet');
    return dl;
  });
}

/** The value a readout shows, by its label. */
function readout(readouts: HTMLElement, label: string): string {
  const dt = within(readouts).getByText(label);
  return dt.nextElementSibling?.textContent ?? '';
}

/** The LaTeX source KaTeX rendered for an equation, from its MathML annotation. */
function equationTex(startsWith: string): string {
  const all = Array.from(document.querySelectorAll('annotation[encoding="application/x-tex"]'));
  const match = all.map((a) => a.textContent ?? '').find((tex) => tex.trim().startsWith(startsWith));
  if (!match) throw new Error(`no rendered equation starting ${startsWith}`);
  return match;
}

/** A value as `siValueToTex` writes it ("6.42 \times 10^{23}\,\mathrm{kg}"), back to a number. */
function texNumber(tex: string): number {
  const m = /(-?\d+(?:\.\d+)?)(?:\s*\\times\s*10\^\{(-?\d+)\})?/.exec(tex);
  if (!m) throw new Error(`no number in ${tex}`);
  return Number(m[1]) * 10 ** Number(m[2] ?? 0);
}

/** Moves a slider by setting its position, as dragging it does. */
function moveTo(p: Param, fraction: number): number {
  const input = document.getElementById(`p-${p.id}`) as HTMLInputElement;
  const attrs = sliderInputAttrs(p);
  const steps = Math.round(((attrs.max - attrs.min) * fraction) / attrs.step);
  const position = attrs.min + steps * attrs.step;
  fireEvent.change(input, { target: { value: String(position) } });
  return valueFromSliderPosition(p, position);
}

describe('escape velocity: slider, readout and equation agree', () => {
  it('moving the mass slider updates the label, the readout and the equation together', async () => {
    const readouts = await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'numbers' }));

    const M = param('M');
    const R = param('R');
    const mass = moveTo(M, 0.3);
    const radius = R.default;

    // The store holds what the slider set; every view below reads from it.
    expect(useAppStore.getState().params[ID]?.M).toBe(mass);
    expect(mass).not.toBe(M.default);

    // The slider's own label and its screen-reader text.
    const slider = screen.getByRole('slider', { name: new RegExp(M.friendlyLabel) });
    expect(slider.getAttribute('aria-valuetext')).toBe(formatWithUnit(M, mass));

    // The readout is the physics layer's escape speed for that mass.
    const shown = readout(readouts, 'escape speed');
    expect(shown).toMatch(/ km\/s$/);
    const kms = Number(shown.replace(/[^\d.]/g, ''));
    expect(kms).toBeCloseTo(vEsc(mass, radius) / 1000, 2);

    // The equation substitutes the same mass and radius, in SI.
    const tex = equationTex('v_{\\text{esc}}');
    expect(tex).toContain(siValueToTex(M, mass));
    expect(tex).toContain(siValueToTex(R, radius));

    // And the numbers in the equation produce the readout: √(2GM/R) from the
    // three-significant-figure values on screen lands within their rounding.
    const fromEquation =
      Math.sqrt((2 * G * texNumber(siValueToTex(M, mass))) / texNumber(siValueToTex(R, radius))) / 1000;
    expect(Math.abs(fromEquation - kms) / kms).toBeLessThan(0.01);
  });

  it('moving the launch-speed slider updates the apex equation and its "where" line', async () => {
    const readouts = await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'numbers' }));

    const v0 = param('v0');
    const before = readout(readouts, 'apex altitude');
    const speed = moveTo(v0, 0.2);
    expect(useAppStore.getState().params[ID]?.v0).toBe(speed);

    // The slider shows km/s; the equation substitutes m/s, and the "where" line
    // under it gives the slider's own reading, which must match the slider.
    const label = formatWithUnit(v0, speed);
    expect(label).toMatch(/km\/s$/);
    expect(screen.getByRole('slider', { name: new RegExp(v0.friendlyLabel) }).getAttribute('aria-valuetext')).toBe(label);

    const tex = equationTex('r_{\\max}');
    expect(tex).toContain(siValueToTex(v0, speed));

    const where = document.querySelector('[data-equation-where="apex"]');
    expect(where?.textContent).toContain(label);

    // A slower launch peaks lower, so the readout has changed with it.
    expect(readout(readouts, 'apex altitude')).not.toBe(before);
  });

  it('Reset puts every view back on the defaults', async () => {
    const readouts = await renderPage();
    const M = param('M');
    const atDefault = readout(readouts, 'escape speed');
    moveTo(M, 0.8);
    expect(readout(readouts, 'escape speed')).not.toBe(atDefault);

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(useAppStore.getState().params[ID]?.M).toBe(M.default);
    expect(readout(readouts, 'escape speed')).toBe(atDefault);
  });
});

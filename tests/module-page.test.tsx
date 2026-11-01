// @vitest-environment jsdom
/**
 * The module page shell, rendered as the app renders it.
 *
 * `App` mounts at a module's address with its real router, store, lazy content
 * and lazy simulation. Nothing is mocked except the browser APIs jsdom lacks
 * (`tests/helpers/dom.ts`). The checks are what a reader relies on before they
 * touch anything: the right title, all seven layers in order, the right ones
 * open for the depth they chose, the controls, and the step on the learning path.
 */
import './helpers/dom';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '@/App';
import { getModuleSummary } from '@/content/catalog';
import { LAYER_META, LAYER_ORDER, defaultOpenFor, type DepthTier } from '@/lib/layers';
import { pathPlace } from '@/content/path';
import { useAppStore } from '@/store/useAppStore';

const ID = 'escape-velocity';

/** Renders the whole app at a module's address, at a given depth. */
async function renderModule(tier: DepthTier, id = ID) {
  act(() => useAppStore.setState({ tier }));
  window.history.pushState({}, '', `/m/${id}`);
  const view = render(<App />);
  const title = getModuleSummary(id)?.title ?? '';
  await screen.findByRole('heading', { level: 1, name: title });
  return { view, title };
}

/** The seven layer toggles, in page order. */
function layerToggles(): HTMLButtonElement[] {
  return LAYER_ORDER.map(
    (layer) =>
      screen.getByRole('button', {
        name: new RegExp(`^${String(LAYER_META[layer].index).padStart(2, '0')}\\s*${LAYER_META[layer].title}`),
      }) as HTMLButtonElement,
  );
}

describe('module page shell', () => {
  it('shows the module title, in the heading and the tab', async () => {
    const { title } = await renderModule('curious');
    expect(title).toBe('Escape Velocity');
    expect(document.title).toBe(`${title} · Lodestar`);
  });

  it('lists all seven layers in order', async () => {
    await renderModule('curious');
    const toggles = layerToggles();
    expect(toggles).toHaveLength(7);
    const order = toggles.map((t) => t.compareDocumentPosition(toggles[0]!));
    // Every toggle after the first follows it in the document.
    expect(order.slice(1).every((pos) => pos & Node.DOCUMENT_POSITION_PRECEDING)).toBe(true);
  });

  /*
   * Written out rather than read from `defaultOpenFor`, so a change to that
   * table fails here too: these are the promises the depth control's own
   * blurbs make to the reader.
   */
  const OPEN_AT: Record<DepthTier, boolean[]> = {
    curious: [true, true, true, false, false, false, false],
    student: [true, true, true, true, true, false, false],
    deep: [false, false, false, true, true, true, true],
  };

  for (const tier of ['curious', 'student', 'deep'] as const) {
    it(`opens the layers the ${tier} tier promises, and no others`, async () => {
      await renderModule(tier);
      const expanded = layerToggles().map((t) => t.getAttribute('aria-expanded') === 'true');
      expect(expanded).toEqual(OPEN_AT[tier]);
      // And the page agrees with the table the rest of the app reads.
      expect(expanded).toEqual(LAYER_ORDER.map((layer) => defaultOpenFor(tier).has(layer)));
    });
  }

  it('opens and closes a layer from its header', async () => {
    await renderModule('curious');
    const deeper = layerToggles()[LAYER_ORDER.indexOf('deeper')]!;
    expect(deeper.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(deeper);
    expect(deeper.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(deeper);
    expect(deeper.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders one labelled slider per parameter, with its value in words and units', async () => {
    await renderModule('curious');
    const sliders = await screen.findAllByRole('slider');
    expect(sliders.map((s) => s.id)).toEqual(['p-M', 'p-R', 'p-v0']);
    for (const slider of sliders) {
      expect(slider.getAttribute('aria-label')).toBeTruthy();
      expect(slider.getAttribute('aria-valuetext')).toMatch(/\d/);
    }
    expect(screen.getByLabelText(/How fast do you throw it/)).toHaveProperty('id', 'p-v0');
  });

  it('shows the simulation’s readouts once it has loaded', async () => {
    await renderModule('curious');
    const readouts = await waitFor(() => {
      const dl = document.getElementById('escape-velocity-readouts');
      if (!dl) throw new Error('readouts not rendered yet');
      return dl;
    });
    expect(within(readouts).getByText('escape speed')).toBeTruthy();
    expect(within(readouts).getByText('apex altitude')).toBeTruthy();
  });

  it('ends with its step on the learning path', async () => {
    await renderModule('curious');
    const place = pathPlace(ID);
    expect(place).toBeTruthy();
    const steps = screen.getAllByText(`Step ${place!.step} of ${place!.total}`);
    expect(steps.length).toBeGreaterThan(0);
  });

  it('says so when the address names no module', async () => {
    act(() => useAppStore.setState({ tier: 'curious' }));
    window.history.pushState({}, '', '/m/not-a-topic');
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: /No module called/ });
    expect(document.title).toBe('Nothing here · Lodestar');
  });
});

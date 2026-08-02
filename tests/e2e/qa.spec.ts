/**
 * End-to-end QA against the live deployment.
 *
 * Everything else in this repo verifies source: the physics blocks assert
 * numbers, the canvas replay asserts a drawing function, the content tests
 * assert a data file. None of them can see a page that shipped with a broken
 * bundle, a 404 on a favicon, a slider that will not take a drag, a canvas that
 * renders blank, or a layout that scrolls sideways on a phone. This is the pass
 * that looks at the site.
 *
 * It runs at two viewports, mobile and desktop, over the five published modules.
 * Screenshots land in `qa-screenshots/<project>/` (gitignored) as the evidence.
 *
 * Conventions used throughout:
 *   - Console `error` messages and uncaught page errors are collected per page
 *     and asserted to be empty. Warnings are recorded but not failed on.
 *   - Horizontal overflow is checked as `scrollingElement.scrollWidth <=
 *     innerWidth`, re-checked after every interaction that could widen the page.
 *   - Canvas content is sampled from the backing store rather than compared to a
 *     reference image: "is anything drawn" and "did this change" are the two
 *     questions, and both survive antialiasing differences between machines.
 */
import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

const MODULES = [
  'escape-velocity',
  'kepler-orbits',
  'scale-of-the-universe',
  'black-holes',
  'gravitational-waves',
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface Watcher {
  errors: string[];
  warnings: string[];
  pageErrors: string[];
  /** Everything, in order, for the report. */
  all: string[];
}

/** Collects console output and uncaught exceptions for the life of the page. */
function watch(page: Page): Watcher {
  const w: Watcher = { errors: [], warnings: [], pageErrors: [], all: [] };

  page.on('console', (message: ConsoleMessage) => {
    const line = `${message.type()}: ${message.text()}`;
    w.all.push(line);
    if (message.type() === 'error') w.errors.push(message.text());
    if (message.type() === 'warning') w.warnings.push(message.text());
  });
  page.on('pageerror', (error) => {
    w.pageErrors.push(error.message);
    w.all.push(`pageerror: ${error.message}`);
  });

  return w;
}

/**
 * Reports what the page said, then asserts it said nothing broken.
 *
 * The tally is printed rather than merely asserted because "no console errors"
 * is only half the question — the other half is what *did* come out, which is
 * how you find out that a warning has appeared since the last QA pass.
 */
function assertClean(w: Watcher, where: string): void {
  const summary =
    w.all.length === 0
      ? 'silent'
      : `${w.errors.length} error / ${w.warnings.length} warning / ${w.all.length} total`;
  // eslint-disable-next-line no-console
  console.log(`  console[${where}]: ${summary}`);
  for (const line of w.all.slice(0, 8)) console.log(`      ${line}`);

  expect(w.pageErrors, `${where}: uncaught exceptions`).toEqual([]);
  expect(w.errors, `${where}: console errors`).toEqual([]);
}

/** The page must never be wider than the window it is in. */
async function assertNoOverflow(page: Page, where: string): Promise<void> {
  const measured = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
    innerWidth: window.innerWidth,
  }));
  expect(
    measured.scrollWidth,
    `${where}: horizontal overflow — scrollWidth ${measured.scrollWidth} > innerWidth ${measured.innerWidth}`,
  ).toBeLessThanOrEqual(measured.innerWidth);
}

interface CanvasStats {
  width: number;
  height: number;
  /** Sampled pixels with any alpha at all. */
  painted: number;
  /** Sampled pixels total. */
  sampled: number;
  /** Cheap fingerprint of the sampled pixels, for before/after comparison. */
  checksum: number;
}

/**
 * Samples the canvas backing store. Every sixteenth pixel: enough to prove a
 * frame is not blank and to notice a redraw, cheap enough to run repeatedly.
 */
async function canvasStats(page: Page, index = 0): Promise<CanvasStats> {
  const stats = await page.evaluate((i) => {
    const canvas = document.querySelectorAll('canvas')[i] as HTMLCanvasElement | undefined;
    if (!canvas || canvas.width === 0) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let painted = 0;
    let sampled = 0;
    let checksum = 0;
    for (let p = 0; p < data.length; p += 4 * 16) {
      sampled += 1;
      const alpha = data[p + 3] ?? 0;
      if (alpha > 0) painted += 1;
      checksum = (checksum + (data[p] ?? 0) * 3 + (data[p + 1] ?? 0) * 5 + alpha * 7) % 2_147_483_647;
    }
    return { width: canvas.width, height: canvas.height, painted, sampled, checksum };
  }, index);

  expect(stats, `canvas ${index} is missing or has no backing store`).not.toBeNull();
  return stats as CanvasStats;
}

/** Drags a range input to one end with real mouse events, and reports the value. */
async function dragSliderToEnd(
  page: Page,
  slider: Locator,
  end: 'min' | 'max',
): Promise<{ value: number; min: number; max: number; step: number }> {
  // `page.mouse` works in viewport coordinates, and a module page is several
  // screens tall — without scrolling first, the drag is aimed at empty space
  // below the fold and silently does nothing.
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  expect(box, 'slider has no layout box').not.toBeNull();
  const { x, y, width, height } = box!;
  const midY = y + height / 2;

  await page.mouse.move(x + width / 2, midY);
  await page.mouse.down();
  // Well past the end stop: the input clamps, which is what we want to prove.
  await page.mouse.move(end === 'min' ? x - 80 : x + width + 80, midY, { steps: 12 });
  await page.mouse.up();

  return {
    value: Number(await slider.inputValue()),
    min: Number(await slider.getAttribute('min')),
    max: Number(await slider.getAttribute('max')),
    step: Number(await slider.getAttribute('step')),
  };
}

/**
 * Sets a controlled React range input to an exact value.
 *
 * Used only where the *value* is the point — 8 km/s, 1.4 solar masses — because
 * a mouse drag cannot land on a specific number on a logarithmic slider. The
 * native setter plus a bubbling `input` event is what React's synthetic onChange
 * listens for; the tests that exercise dragging use real mouse events instead.
 */
async function setSliderValue(page: Page, id: string, value: number): Promise<void> {
  await page.evaluate(
    ({ id: elementId, value: next }) => {
      const input = document.getElementById(elementId) as HTMLInputElement | null;
      if (!input) throw new Error(`no slider #${elementId}`);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, String(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { id, value },
  );
}

/**
 * The sim's own control, not the parameters panel's.
 *
 * Layer 3 contains two buttons that can both read "Reset": the sim's
 * Launch/Reset and the ParamControls link that restores the sliders. The sim
 * panel is rendered first inside the layer, so the first match is the sim's.
 */
function simButton(page: Page, name: string): Locator {
  return page.locator('#layer-panel-play').getByRole('button', { name, exact: true }).first();
}

/** Opens a collapsed layer by its header id. */
async function openLayer(page: Page, layer: string): Promise<void> {
  const header = page.locator(`#layer-header-${layer}`);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}

async function shot(page: Page, name: string): Promise<string> {
  const project = test.info().project.name;
  const path = `qa-screenshots/${project}/${name}.png`;
  await page.screenshot({ path });
  return path;
}

/** Settles the page: fonts done, first frames painted. */
async function settle(page: Page, ms = 900): Promise<void> {
  await page.waitForTimeout(ms);
}

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

test('landing page', async ({ page }) => {
  const w = watch(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const cards = page.locator('main ul > li > a[href^="/m/"]');
  await expect(cards).toHaveCount(5);

  // Every published module is linked, exactly once.
  const hrefs = await cards.evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href')),
  );
  for (const id of MODULES) expect(hrefs, `card for ${id}`).toContain(`/m/${id}`);

  await expect(
    page.locator('footer a[href="https://github.com/VelaWind/lodestar"]'),
  ).toHaveCount(1);

  await assertNoOverflow(page, 'landing');
  await settle(page);
  await shot(page, '01-landing');
  assertClean(w, 'landing');
});

/* ------------------------------------------------------------------ */
/* Every module: loads, draws, takes a drag, never overflows           */
/* ------------------------------------------------------------------ */

for (const [index, id] of MODULES.entries()) {
  test(`module ${id}`, async ({ page }) => {
    const w = watch(page);
    await page.goto(`/m/${id}`, { waitUntil: 'domcontentloaded' });

    // Layer 3 is open at the default (Curious) tier, so the sim mounts on load.
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await settle(page);

    const stats = await canvasStats(page);
    expect(stats.width, `${id}: canvas has no backing width`).toBeGreaterThan(0);
    expect(
      stats.painted / stats.sampled,
      `${id}: canvas looks blank — ${stats.painted}/${stats.sampled} sampled pixels painted`,
    ).toBeGreaterThan(0.01);

    await assertNoOverflow(page, `${id} at rest`);
    await shot(page, `${String(index + 2).padStart(2, '0')}-${id}`);

    // Every slider, to both ends, with the mouse.
    const sliders = page.locator('input[type="range"]');
    const count = await sliders.count();
    expect(count, `${id}: no sliders found`).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const slider = sliders.nth(i);
      const paramId = await slider.getAttribute('id');

      const atMin = await dragSliderToEnd(page, slider, 'min');
      // A range input snaps to a step boundary, so the last reachable value can
      // sit one step short of the declared end. That still proves the drag.
      expect(
        atMin.value,
        `${id}/${paramId}: drag to min landed at ${atMin.value}, min is ${atMin.min}`,
      ).toBeLessThanOrEqual(atMin.min + atMin.step + 1e-9);
      await assertNoOverflow(page, `${id}/${paramId} at min`);

      const atMax = await dragSliderToEnd(page, slider, 'max');
      expect(
        atMax.value,
        `${id}/${paramId}: drag to max landed at ${atMax.value}, max is ${atMax.max}`,
      ).toBeGreaterThanOrEqual(atMax.max - atMax.step - 1e-9);
      await assertNoOverflow(page, `${id}/${paramId} at max`);
    }

    // A touch tap on the track, on the viewport that has touch.
    if (test.info().project.name.startsWith('mobile')) {
      await sliders.first().scrollIntoViewIfNeeded();
      const box = await sliders.first().boundingBox();
      if (box) await page.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height / 2);
      await assertNoOverflow(page, `${id} after touch tap`);
    }

    await settle(page, 400);
    const afterDragging = await canvasStats(page);
    expect(
      afterDragging.painted,
      `${id}: canvas blank after driving the sliders`,
    ).toBeGreaterThan(0);

    assertClean(w, `module ${id}`);
  });
}

/* ------------------------------------------------------------------ */
/* Escape velocity: the threshold behaviour                            */
/* ------------------------------------------------------------------ */

test('escape-velocity launch below and above the threshold', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/escape-velocity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas').first()).toBeVisible();
  await settle(page);

  // Earth's threshold is 11.19 km/s, so 8 km/s must fall back.
  await setSliderValue(page, 'p-v0', 8000);
  await expect(page.getByText('below escape speed')).toBeVisible();

  // Both readouts carry "km", so the apex is located by its own label.
  const apex = page.locator('dt:text-is("apex altitude") + dd');
  await simButton(page, 'Launch').click();
  // Playback is a few seconds; the end state is what matters.
  await expect(simButton(page, 'Reset')).toBeVisible({ timeout: 20_000 });
  await settle(page, 6_000);

  const apexText = (await apex.textContent()) ?? '';
  expect(apexText, 'apex readout should be a finite altitude below the threshold').not.toContain(
    '∞',
  );
  await assertNoOverflow(page, 'escape-velocity after launch');
  await shot(page, '07-escape-velocity-suborbital');

  // Above the threshold the same readout must say it escapes.
  await simButton(page, 'Reset').click();
  await setSliderValue(page, 'p-v0', 15_000);
  await expect(page.getByText('at or above escape speed')).toBeVisible();
  await expect(page.getByText('∞ — escapes')).toBeVisible();

  await simButton(page, 'Launch').click();
  await expect(simButton(page, 'Reset')).toBeVisible({ timeout: 20_000 });
  await settle(page, 4_000);
  await shot(page, '08-escape-velocity-escaping');

  await assertNoOverflow(page, 'escape-velocity escaping');
  assertClean(w, 'escape-velocity launch');
});

/* ------------------------------------------------------------------ */
/* Kepler: the sweep overlay actually draws                            */
/* ------------------------------------------------------------------ */

test('kepler sweep overlay changes the drawing', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/kepler-orbits', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas').first()).toBeVisible();
  await settle(page);

  // The orbit animates, so a single before/after pair proves nothing on its own.
  // Instead: how much do two frames differ *without* the overlay, against how
  // much a frame with the overlay differs from one without.
  const before = await canvasStats(page);
  await settle(page, 250);
  const beforeAgain = await canvasStats(page);
  const animationDrift = Math.abs(beforeAgain.checksum - before.checksum);

  const toggle = page.getByRole('button', { name: 'Sweep equal areas' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await settle(page, 250);

  const swept = await canvasStats(page);
  const sweepDelta = Math.abs(swept.checksum - beforeAgain.checksum);
  expect(
    swept.painted,
    'kepler: canvas blank with the sweep overlay on',
  ).toBeGreaterThan(beforeAgain.painted * 0.5);
  expect(
    sweepDelta,
    `kepler: sweep overlay changed the canvas by ${sweepDelta}, animation alone drifts ${animationDrift}`,
  ).toBeGreaterThan(0);

  await shot(page, '09-kepler-sweep');
  await assertNoOverflow(page, 'kepler with sweep');
  assertClean(w, 'kepler sweep');
});

/* ------------------------------------------------------------------ */
/* Depth control                                                       */
/* ------------------------------------------------------------------ */

test('depth tiers change which layers are open', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await settle(page);

  const EXPECTED: Record<string, string[]> = {
    Curious: ['hook', 'intuition', 'play'],
    Student: ['hook', 'intuition', 'play', 'real', 'math'],
    Deep: ['real', 'math', 'deeper', 'connections'],
  };
  const ALL = ['hook', 'intuition', 'play', 'real', 'math', 'deeper', 'connections'];

  for (const [tier, open] of Object.entries(EXPECTED)) {
    await page.getByRole('radio', { name: tier }).click();
    await expect(page.getByRole('radio', { name: tier })).toHaveAttribute('aria-checked', 'true');
    await page.waitForTimeout(500);

    for (const layer of ALL) {
      const shouldBeOpen = open.includes(layer);
      await expect(
        page.locator(`#layer-header-${layer}`),
        `${tier}: layer ${layer} should be ${shouldBeOpen ? 'open' : 'closed'}`,
      ).toHaveAttribute('aria-expanded', String(shouldBeOpen));
    }
    await assertNoOverflow(page, `black-holes at ${tier}`);
  }

  await shot(page, '10-depth-deep');
  assertClean(w, 'depth control');
});

/* ------------------------------------------------------------------ */
/* Equation mode                                                       */
/* ------------------------------------------------------------------ */

test('equation toggle substitutes live values', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/escape-velocity', { waitUntil: 'domcontentloaded' });
  await settle(page);
  await openLayer(page, 'math');

  const equation = page.locator('.katex-display').first();
  await expect(equation).toBeVisible();
  const symbols = (await equation.textContent()) ?? '';

  await page.getByRole('button', { name: 'numbers', exact: true }).click();
  await page.waitForTimeout(400);
  const numbers = (await equation.textContent()) ?? '';

  expect(numbers, 'equation did not change when switched to numbers').not.toBe(symbols);
  // Earth's mass at the default, as the formatter renders it.
  expect(numbers, `numbers mode should contain the substituted mass; saw "${numbers}"`).toContain(
    '5.97',
  );

  await assertNoOverflow(page, 'escape-velocity math layer in numbers mode');
  await shot(page, '11-equation-numbers');
  assertClean(w, 'equation toggle');
});

/* ------------------------------------------------------------------ */
/* Gravitational waves: the Web Audio path                             */
/* ------------------------------------------------------------------ */

test('gravitational-waves audio schedules without throwing', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/gravitational-waves', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('canvas').first()).toBeVisible();
  await settle(page, 1_500);

  const hear = page.getByRole('button', { name: 'Hear it' });
  await expect(hear).toBeVisible();

  // The default binary sonifies 0.25 s of inspiral. The button flipping to
  // "Stop" proves the AudioContext was created and the oscillator scheduled;
  // it flipping back proves `onended` fired, i.e. playback actually ran.
  await hear.click();
  const stop = page.getByRole('button', { name: 'Stop' });
  await expect(stop, 'audio never started for the default binary').toBeVisible({ timeout: 5_000 });
  await expect(
    page.getByRole('button', { name: 'Hear it' }),
    'audio started but never ended for the default binary',
  ).toBeVisible({ timeout: 15_000 });

  // eslint-disable-next-line no-console
  console.log(`  audio[default binary]: ${w.all.length === 0 ? 'silent' : w.all.join(' | ')}`);
  expect(w.pageErrors, 'exceptions from the Web Audio path (default binary)').toEqual([]);

  // Two neutron stars: a 6 s sonification, and the band no longer starts at 30 Hz.
  const M_SUN = 1.9884e30;
  await setSliderValue(page, 'p-m1', Math.log10(1.4 * M_SUN));
  await setSliderValue(page, 'p-m2', Math.log10(1.4 * M_SUN));
  await page.waitForTimeout(600);
  // Chrome snaps a programmatically-set value onto the input's step grid, and
  // the step here is 0.01 decades — so "1.4 solar masses" lands on 1.41. Close
  // enough for a neutron-star pair, and the assertion says so rather than
  // pretending the slider is continuous.
  await expect(page.locator('label span').filter({ hasText: /^1\.4\d? M☉$/ }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Hear it' }).click();
  await expect(stop, 'audio never started for the neutron-star binary').toBeVisible({
    timeout: 5_000,
  });
  await page.waitForTimeout(1_500);
  // eslint-disable-next-line no-console
  console.log(`  audio[neutron stars]: ${w.all.length === 0 ? 'silent' : w.all.join(' | ')}`);
  expect(w.pageErrors, 'exceptions from the Web Audio path (neutron stars)').toEqual([]);

  await shot(page, '12-gravitational-waves-audio');
  // Stop it rather than waiting out six seconds, which also exercises teardown.
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'Hear it' })).toBeVisible();

  await assertNoOverflow(page, 'gravitational-waves after audio');
  assertClean(w, 'gravitational-waves audio');
});

/* ------------------------------------------------------------------ */
/* Reduced motion                                                      */
/* ------------------------------------------------------------------ */

test.describe('prefers-reduced-motion', () => {
  for (const id of ['kepler-orbits', 'gravitational-waves'] as const) {
    test(`${id} draws statically`, async ({ page }) => {
      const w = watch(page);
      // Emulated on the page rather than through `test.use`, so the media query
      // is in place before the first paint and framer-motion's
      // `useReducedMotion` sees it on mount.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/m/${id}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('canvas').first()).toBeVisible();
      await settle(page, 1_500);

      const first = await canvasStats(page);
      expect(first.painted, `${id}: nothing drawn under reduced motion`).toBeGreaterThan(0);

      await page.waitForTimeout(500);
      const second = await canvasStats(page);

      expect(
        second.checksum,
        `${id}: canvas changed between two frames 500 ms apart — an animation is running`,
      ).toBe(first.checksum);

      // The content is still there, not merely still.
      await expect(page.locator('input[type="range"]').first()).toBeVisible();
      await expect(page.locator('dd').first()).toBeVisible();

      await assertNoOverflow(page, `${id} reduced motion`);
      await shot(page, `13-${id}-reduced-motion`);
      assertClean(w, `${id} reduced motion`);
    });
  }
});

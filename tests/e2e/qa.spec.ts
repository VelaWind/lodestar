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
import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type APIResponse,
  type ConsoleMessage,
  type Locator,
  type Page,
} from '@playwright/test';

const MODULES = [
  'escape-velocity',
  'kepler-orbits',
  'scale-of-the-universe',
  'black-holes',
  'gravitational-waves',
  'exoplanets',
  'planetary-atmospheres',
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

/**
 * The log-slider keyboard contract, identical on every module.
 *
 * Arrow moves a twentieth of a decade, Shift+arrow and PageUp/PageDown a whole
 * one, Home and End reach the stops. The steps are applied in a key handler
 * rather than through the input's `step` — `step` also governs dragging, and a
 * keyboard-sized step would have made the 0.6-decade sliders twelve stops wide
 * for pointer users — so nothing about this is guaranteed by the element and all
 * of it has to be exercised through real key presses.
 */
async function assertLogSliderKeys(page: Page, selector: string, name: string): Promise<void> {
  const slider = page.locator(selector);
  const at = async (): Promise<number> => Number(await slider.inputValue());

  await slider.focus();
  await expect(slider, `${name}: not focusable`).toBeFocused();

  // Start from a spot with a decade of room on both sides.
  await page.keyboard.press('Home');
  const min = await at();
  await page.keyboard.press('End');
  const max = await at();
  expect(max, `${name}: Home and End should reach different stops`).toBeGreaterThan(min);

  // Every check starts from the same place. On a 0.6-decade slider a coarse key
  // lands on a stop, so without resetting, the next check would be measuring
  // from wherever the last one clamped to.
  const middle = (min + max) / 2;
  const reset = async (): Promise<number> => {
    await slider.evaluate((el: HTMLInputElement, v: number) => {
      // Native setter, then an input event, so React's state follows the DOM.
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      set?.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, middle);
    return at();
  };

  let base = await reset();
  await page.keyboard.press('ArrowRight');
  expect((await at()) - base, `${name}: arrow should move a twentieth of a decade`).toBeCloseTo(
    0.05,
    3,
  );
  await page.keyboard.press('ArrowLeft');
  expect(await at(), `${name}: arrow left should undo arrow right`).toBeCloseTo(base, 3);

  base = await reset();
  await page.keyboard.press('Shift+ArrowRight');
  expect(await at(), `${name}: Shift+arrow should move a whole decade`).toBeCloseTo(
    Math.min(max, base + 1),
    3,
  );

  base = await reset();
  await page.keyboard.press('PageUp');
  expect(await at(), `${name}: PageUp should move a whole decade`).toBeCloseTo(
    Math.min(max, base + 1),
    3,
  );

  base = await reset();
  await page.keyboard.press('PageDown');
  expect(await at(), `${name}: PageDown should move a whole decade back`).toBeCloseTo(
    Math.max(min, base - 1),
    3,
  );

  // Key repeat delivers keydowns faster than React re-renders. Dispatching them
  // in one task is that case at its worst: a handler reading its rendered prop
  // would compute every one of these from the same starting point and move a
  // single step for ten presses. Ten arrows are half a decade or nothing.
  const base10 = await reset();
  await slider.evaluate((el: HTMLInputElement) => {
    for (let i = 0; i < 10; i += 1) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    }
  });
  expect((await at()) - base10, `${name}: a burst of arrows lost presses`).toBeCloseTo(0.5, 3);

  // The coarse key stops at the stop rather than running past it or refusing.
  await reset();
  const toTheTop = Math.ceil(max - min) + 2;
  for (let i = 0; i < toTheTop; i += 1) await page.keyboard.press('PageUp');
  expect(await at(), `${name}: PageUp should clamp to the maximum`).toBeCloseTo(max, 3);
  await page.keyboard.press('Home');
  expect(await at(), `${name}: Home should return to the minimum`).toBeCloseTo(min, 3);
}

/**
 * Writes a slider directly, the way a drag would leave it.
 *
 * The native setter plus an `input` event is the only way to move a controlled
 * React range input from outside: assigning `.value` alone updates the DOM and
 * leaves React's state behind it. Log sliders take a position in decades, which
 * is what the element itself holds — see `sliderBounds`.
 */
/**
 * Indexed access that fails where the mistake is, not three assertions later.
 *
 * `noUncheckedIndexedAccess` is on, so every array read is `T | undefined`. In
 * product code that is answered with a fallback; in a test a missing element
 * means the page is not what the test thought, and the useful behaviour is to
 * say so at the read rather than to carry a zero forward into an assertion.
 */
function at<T>(items: ArrayLike<T>, index: number, what: string): T {
  const value = items[index];
  if (value === undefined) throw new Error(`${what}: nothing at index ${index}`);
  return value;
}

async function setSlider(page: Page, id: string, value: number): Promise<void> {
  await page.locator(`#p-${id}`).evaluate((el: HTMLInputElement, v: number) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    set?.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/**
 * A sim's own control, found through its readouts.
 *
 * `simButton` matches by name and takes the first hit, which is ambiguous when
 * the sim's button and the parameters panel's Reset share a word. Every sim puts
 * its controls in the same flex row as its readout list, so a sibling of the
 * readouts `dl` is unambiguously the sim's.
 */
function simControl(page: Page, module: string, index = 0): Locator {
  return page.locator(`xpath=//dl[@id="${module}-readouts"]/following-sibling::button`).nth(index);
}

/** Readout values by their label, lowercased. */
async function readouts(page: Page, module: string): Promise<Record<string, string>> {
  return page.locator(`#${module}-readouts`).evaluate((dl) => {
    const out: Record<string, string> = {};
    const terms = [...dl.querySelectorAll('dt')];
    const values = [...dl.querySelectorAll('dd')];
    terms.forEach((dt, i) => {
      out[(dt.textContent ?? '').trim().toLowerCase()] = (values[i]?.textContent ?? '').trim();
    });
    return out;
  });
}

/**
 * Remembers the sim canvas as it stands, for a later comparison.
 *
 * The frame is stashed on the page rather than returned. A mobile canvas is
 * around a million numbers once it is serialised, and moving several of those
 * across the bridge is the difference between a test that takes seconds and one
 * that takes minutes — so every comparison below happens where the pixels
 * already are, and only the answer travels.
 */
async function rememberFrame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector('#layer-panel-play canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    (window as unknown as { __frame: ImageData }).__frame = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
  });
}

/** Pixels that differ from the remembered frame. */
async function pixelsChangedSince(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#layer-panel-play canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    const before = (window as unknown as { __frame?: ImageData }).__frame;
    if (!before) throw new Error('no remembered frame');
    const after = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let changed = 0;
    for (let i = 0; i < after.data.length; i += 4) {
      if (Math.abs((after.data[i] ?? 0) - (before.data[i] ?? 0)) > 12) changed += 1;
    }
    (window as unknown as { __frame: ImageData }).__frame = after;
    return changed;
  });
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

/**
 * Waits until a locator's count stops changing, rather than sleeping and hoping.
 *
 * The landing page renders its cards from an eagerly globbed registry, so they
 * arrive with the first paint — but the fonts, the radial wash and the lazy
 * chunks all settle around them, and a fixed wait before the screenshot is the
 * kind of assertion that fails once a month on a slow network and reproduces for
 * nobody. Two consecutive equal counts, 250ms apart, is the condition that
 * actually matters.
 */
async function waitForStableCount(
  locator: Locator,
  label: string,
  timeoutMs = 10_000,
): Promise<number> {
  const started = Date.now();
  let previous = -1;

  while (Date.now() - started < timeoutMs) {
    const count = await locator.count();
    if (count > 0 && count === previous) return count;
    previous = count;
    await locator.page().waitForTimeout(250);
  }

  throw new Error(`${label}: count never settled within ${timeoutMs}ms (last saw ${previous})`);
}

/**
 * Fetches with three attempts and a widening gap between them.
 *
 * This suite runs against a real host over a real network. A single failed GET
 * of the preview image says nothing about whether the image is broken, and a
 * red build that goes green on a rerun teaches everyone to ignore red builds.
 */
async function fetchWithRetry(page: Page, url: string, attempts = 3): Promise<APIResponse> {
  let lastProblem = 'no attempt made';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await page.request.get(url, { timeout: 15_000 });
      if (response.ok()) return response;
      lastProblem = `status ${response.status()}`;
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) await page.waitForTimeout(500 * 2 ** (attempt - 1));
  }

  throw new Error(`${url}: ${attempts} attempts failed, last was ${lastProblem}`);
}

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

test('landing page', async ({ page }) => {
  const w = watch(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const cards = page.locator('main ul > li > a[href^="/m/"]');
  const settled = await waitForStableCount(cards, 'landing cards');
  expect(settled, 'card count settled at the wrong number').toBe(MODULES.length);
  await expect(cards).toHaveCount(MODULES.length);

  // Every published module is linked, exactly once.
  const hrefs = await cards.evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href')),
  );
  for (const id of MODULES) expect(hrefs, `card for ${id}`).toContain(`/m/${id}`);

  await expect(
    page.locator('footer a[href="https://github.com/VelaWind/lodestar"]'),
  ).toHaveCount(1);

  await assertNoOverflow(page, 'landing');
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
  await shot(page, '08-escape-velocity-suborbital');

  // Above the threshold the same readout must say it escapes.
  await simButton(page, 'Reset').click();
  await setSliderValue(page, 'p-v0', 15_000);
  await expect(page.getByText('at or above escape speed')).toBeVisible();
  await expect(page.getByText('∞ — escapes')).toBeVisible();

  await simButton(page, 'Launch').click();
  await expect(simButton(page, 'Reset')).toBeVisible({ timeout: 20_000 });
  await settle(page, 4_000);
  await shot(page, '09-escape-velocity-escaping');

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

  await shot(page, '10-kepler-sweep');
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

  await shot(page, '11-depth-deep');
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

  // Inline math in the note, not just the equation above it. These four are the
  // damage signatures of the String.raw bug that shipped for five passes: `\text{esc}`
  // rendering as "extesc", `\varepsilon` as "arepsilon", `\infty` as "infty",
  // `\sqrt{` as "sqrt{". One cheap assertion, and the site says so directly.
  const note = (await page.locator('figcaption').first().textContent()) ?? '';
  expect(
    note,
    'inline math is rendering LaTeX macro names as literal text — see rich.ts and String.raw',
  ).not.toMatch(/extesc|arepsilon|infty|sqrt\{/);
  expect(note, 'the first note should render v_esc').toContain('esc');

  await assertNoOverflow(page, 'escape-velocity math layer in numbers mode');
  await shot(page, '12-equation-numbers');
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

  await shot(page, '13-gravitational-waves-audio');
  // Stop it rather than waiting out six seconds, which also exercises teardown.
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'Hear it' })).toBeVisible();

  await assertNoOverflow(page, 'gravitational-waves after audio');
  assertClean(w, 'gravitational-waves audio');
});

/* ------------------------------------------------------------------ */
/* About page and social preview                                       */
/* ------------------------------------------------------------------ */

test('about page is reachable and renders', async ({ page }) => {
  const w = watch(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page, 600);

  // The header link is hidden below the sm breakpoint, where 375px leaves it
  // 2px of room; the footer carries it at every width. Either route works, and
  // at least one has to be visible wherever the test is running.
  const header = page.locator('header a[href="/about"]');
  const footer = page.locator('footer a[href="/about"]');
  const viaHeader = await header.isVisible();
  const viaFooter = await footer.isVisible();
  expect(viaHeader || viaFooter, 'no reachable About link at this viewport').toBe(true);
  expect(viaFooter, 'the footer link should be present at every width').toBe(true);

  await (viaHeader ? header : footer).click();
  await expect(page).toHaveURL(/\/about$/);

  await expect(page.getByRole('heading', { level: 1, name: 'How Lodestar is built' })).toBeVisible();
  for (const heading of [
    'One module, three readers',
    'The honesty rule',
    'Built solo, with an AI pair',
    'The stack',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }

  await assertNoOverflow(page, 'about page');
  await settle(page, 300);
  await shot(page, '15-about');
  assertClean(w, 'about page');
});

test('social preview image is declared absolutely and resolves', async ({ page }) => {
  const w = watch(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  const url = await page.locator('meta[property="og:url"]').getAttribute('content');
  const card = await page.locator('meta[name="twitter:card"]').getAttribute('content');
  const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute('content');

  // A relative og:image is the classic reason a shared link renders blank: the
  // crawler has no page to resolve it against.
  expect(image, 'og:image must be an absolute URL').toMatch(/^https:\/\//);
  expect(url, 'og:url must be an absolute URL').toMatch(/^https:\/\//);
  expect(twitterImage).toBe(image);
  expect(card).toBe('summary_large_image');

  const response = await fetchWithRetry(page, image!);
  expect(response.status(), `${image} did not return 200`).toBe(200);
  expect(
    response.headers()['content-type'],
    `${image} is not served as a PNG`,
  ).toContain('image/png');

  const bytes = (await response.body()).length;
  // eslint-disable-next-line no-console
  console.log(`  og:image ${image} — ${response.status()}, ${(bytes / 1024).toFixed(1)} kB`);
  expect(bytes, 'og:image looks empty').toBeGreaterThan(5_000);

  assertClean(w, 'social preview');
});

/* ------------------------------------------------------------------ */
/* Accessibility                                                       */
/* ------------------------------------------------------------------ */

/**
 * Every page, both viewports, zero serious or critical violations.
 *
 * The threshold is deliberate rather than "zero violations of any kind": axe's
 * moderate and minor findings include judgement calls a rule cannot make, and a
 * suite that fails on those gets muted. Serious and critical are the ones that
 * stop somebody using the site, so they are the ones that fail the build.
 * Anything moderate or minor is printed, so it is visible without being fatal.
 */
const A11Y_PAGES: [string, string][] = [
  ['landing', '/'],
  ['about', '/about'],
  ...MODULES.map((id) => [id, `/m/${id}`] as [string, string]),
];

for (const [name, path] of A11Y_PAGES) {
  test(`accessibility: ${name}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await settle(page, 1_200);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const advisory = results.violations.filter(
      (v) => v.impact !== 'serious' && v.impact !== 'critical',
    );

    if (advisory.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `  a11y[${name}] advisory: ` +
          advisory.map((v) => `${v.impact}/${v.id} x${v.nodes.length}`).join(', '),
      );
    }

    expect(
      blocking.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`),
      `${name}: serious or critical accessibility violations`,
    ).toEqual([]);
  });
}

/**
 * The same audit, on a page that has been opened up.
 *
 * The per-page pass above sees each page in its default state, which is most of
 * it collapsed — and a collapsed layer is not in the DOM, so axe never looked at
 * it. Two elements that only exist once a reader expands something were failing
 * contrast the whole time the suite was green: the "planned" connection chip in
 * layer 7, and the approximations summary beside the sim. Anything a reader can
 * reveal by clicking has to be audited in the state they reveal it in.
 */
test('accessibility: a module page with every layer expanded', async ({ page }) => {
  // This module links to `cosmic-distance-ladder`, which is backlog rather than
  // draft, so the chip does not vanish the day another module is published.
  await page.goto('/m/gravitational-waves', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);

  await page.getByRole('button', { name: /expand all/i }).click();
  await page.getByRole('button', { name: /^approximations/i }).click();
  await settle(page, 700);

  // Assert the two elements are actually here, or this test passes by auditing
  // a page that happens not to contain what it was written for.
  const planned = page.getByText('planned', { exact: true });
  await expect(planned, 'no planned connection chip on this page').toBeVisible();
  await expect(
    page.getByRole('button', { name: /^approximations/i }),
    'no approximations summary on this page',
  ).toBeVisible();
  await expect(page.locator('#layer-panel-deeper')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(
    blocking.flatMap((v) => v.nodes.map((n) => `${v.impact} ${v.id}: ${n.failureSummary ?? n.html}`)),
    'expanded module page: serious or critical accessibility violations',
  ).toEqual([]);
});

test('keyboard: the whole sim is operable without a pointer', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/scale-of-the-universe', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);

  // The skip link is the first thing focus reaches, and it goes somewhere.
  await page.keyboard.press('Tab');
  const first = page.locator(':focus');
  await expect(first, 'first tab stop should be the skip link').toHaveText(/skip to content/i);
  await first.press('Enter');
  await expect(page.locator('#main')).toBeFocused();

  // The log-slider keyboard contract, checked on the longest slider in the app
  // and again below on the shortest, because the whole point of it is that the
  // keys mean the same thing on both. Positions are decades.
  await assertLogSliderKeys(page, '#p-s', 'scale-of-the-universe/s');

  // 0.6 decades end to end — a whole-decade key has to clamp here, not refuse.
  await page.goto('/m/exoplanets', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);
  await assertLogSliderKeys(page, '#p-Rp', 'exoplanets/Rp');

  // Every stateful sim control reports its state, and every one is a real button.
  await page.goto('/m/planetary-atmospheres', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);
  const chips = page.locator('#layer-panel-play button[aria-pressed]');
  expect(await chips.count(), 'gas chips should expose pressed state').toBeGreaterThanOrEqual(6);
  await chips.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');

  assertClean(w, 'keyboard');
});

test('screen reader: canvases are labelled and described', async ({ page }) => {
  const w = watch(page);

  for (const id of MODULES) {
    await page.goto(`/m/${id}`, { waitUntil: 'domcontentloaded' });
    await settle(page, 900);

    const described = await page.locator('canvas').first().evaluate((canvas) => {
      const describedBy = canvas.getAttribute('aria-describedby');
      const target = describedBy ? document.getElementById(describedBy) : null;
      return {
        role: canvas.getAttribute('role'),
        label: (canvas.getAttribute('aria-label') ?? '').length,
        describedBy,
        describedText: (target?.textContent ?? '').trim().length,
      };
    });

    expect(described.role, `${id}: canvas needs an image role`).toBe('img');
    expect(described.label, `${id}: canvas needs a real label`).toBeGreaterThan(40);
    expect(
      described.describedText,
      `${id}: aria-describedby should point at the readouts, which must have text`,
    ).toBeGreaterThan(10);
  }

  // KaTeX has to keep emitting MathML, or every equation becomes a wall of
  // meaningless glyph spans to a screen reader.
  await page.goto('/m/escape-velocity', { waitUntil: 'domcontentloaded' });
  await settle(page, 800);
  await openLayer(page, 'math');
  const math = await page.locator('.katex-display').first().evaluate((el) => ({
    mathml: !!el.querySelector('math'),
    annotation: el.querySelector('annotation')?.textContent?.length ?? 0,
    visualHidden: el.querySelector('.katex-html')?.getAttribute('aria-hidden'),
  }));
  expect(math.mathml, 'KaTeX MathML annotation is missing').toBe(true);
  expect(math.annotation).toBeGreaterThan(5);
  expect(math.visualHidden, 'the glyph layer should be hidden from assistive tech').toBe('true');

  assertClean(w, 'screen reader');
});

/* ------------------------------------------------------------------ */
/* Behaviour                                                           */
/* ------------------------------------------------------------------ */

/**
 * What the sims actually do, rather than that they came up.
 *
 * Everything above this point asks whether the page works: it loaded, it did not
 * overflow, axe is happy, the keyboard reaches the controls. None of it asks
 * whether the physics on the screen is the physics the module claims. These do —
 * a projectile below escape speed has to come back down, a wedge near periapsis
 * has to match one near apoapsis, a tidal stretch has to stop being lethal
 * somewhere specific. Where a threshold is checked it is computed here, from
 * constants, rather than copied from the source it is checking.
 */

/* 1 ---------------------------------------------------------------- */

test('behaviour: a projectile below escape speed comes back, above it leaves', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/escape-velocity', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  const status = page.locator('#layer-panel-play [role="status"]');
  const launch = simControl(page, 'escape-velocity');

  // 8 km/s against Earth's 11.2: a real apex, and a fall back to the surface.
  await setSlider(page, 'v0', 8_000);
  await expect(status).toHaveText('Ready to launch.');

  const sub = await readouts(page, 'escape-velocity');
  expect(sub['escape speed'], 'escape speed at Earth defaults').toMatch(/^11\.\d+ km\/s$/);
  expect(sub['apex altitude'], 'a sub-escape launch must have a finite apex').toMatch(
    /^[\d,]+(\.\d+)? (m|km)$/,
  );
  await expect(page.locator('#layer-panel-play')).toContainText('below escape speed');

  await launch.click();
  await expect(status, 'the flight should announce itself').toHaveText('In flight.');
  await expect(status, 'a sub-escape projectile must fall back').toHaveText(
    /falls back to the surface|apex is above the frame/,
    { timeout: 30_000 },
  );
  // The end state is reachable again: the control returns to a launchable sim.
  await expect(simControl(page, 'escape-velocity')).toHaveText('Reset');
  await simControl(page, 'escape-velocity').click();
  await expect(status).toHaveText('Ready to launch.');

  // Above escape speed the apex stops being a number at all.
  await setSlider(page, 'v0', 25_000);
  const over = await readouts(page, 'escape-velocity');
  expect(over['apex altitude'], 'above escape speed there is no apex').toContain('escapes');
  await expect(page.locator('#layer-panel-play')).toContainText('at or above escape speed');

  await simControl(page, 'escape-velocity').click();
  await expect(status, 'an escaping projectile must never return').toHaveText(
    'The projectile escapes and never returns.',
    { timeout: 30_000 },
  );

  await assertNoOverflow(page, 'escape-velocity behaviour');
  assertClean(w, 'escape-velocity behaviour');
});

/* 2 ---------------------------------------------------------------- */

/**
 * Kepler's second law, read off the canvas.
 *
 * Two independent readings of the same claim. The wedges are equal-*area*
 * slices of equal time, so the overlay has to put shading on both sides of the
 * focus — a sweep that only shaded the fast end would be drawing something
 * else. And the planet itself has to move through those wedges non-uniformly:
 * at e = 0.97 the angular rate at periapsis is ((1+e)/(1-e))^2 ~ 4300 times the
 * rate at apoapsis, so sampling the position on a fixed clock must show steps
 * that differ by orders of magnitude, not by noise.
 */
test('behaviour: kepler sweeps equal areas and moves non-uniformly', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/kepler-orbits', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);

  // The equal-area half of this is checked at a middling eccentricity, not at
  // the maximum. At e = 0.97 periapsis sits 0.03 AU from the focus against an
  // apoapsis of 1.97, so the wedge covering the periapsis passage is about seven
  // pixels wide and is drawn underneath the star's own disc — nothing is wrong
  // with the drawing, there is simply nothing left to sample. The non-uniform
  // motion below is then measured at the maximum, where it is most pronounced.
  await setSlider(page, 'e', 0.6);
  await settle(page, 500);

  // The star is the only fully opaque patch of star-blue on the canvas: the
  // orbit is stroked in grey and the wedges are painted at 4-30% alpha, so
  // neither survives an alpha-255 test. That patch is the focus.
  const focus = await page.evaluate(() => {
    const canvas = document.querySelector('#layer-panel-play canvas') as HTMLCanvasElement;
    const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < d.length; i += 4) {
      if ((d[i + 3] ?? 0) < 250) continue;
      const r = d[i] ?? 0;
      const g = d[i + 1] ?? 0;
      const b = d[i + 2] ?? 0;
      if (Math.abs(r - 157) > 10 || Math.abs(g - 180) > 10 || Math.abs(b - 255) > 10) continue;
      n += 1;
      sx += (i / 4) % canvas.width;
      sy += Math.floor(i / 4 / canvas.width);
    }
    return n > 0 ? { x: sx / n, y: sy / n, n } : null;
  });
  expect(focus, 'could not find the star on the canvas').not.toBeNull();
  const star = focus as { x: number; y: number; n: number };
  expect(star.n, 'the star should be a small disc, not a field of pixels').toBeLessThan(4_000);

  const spread = await readouts(page, 'kepler-orbits');
  // eslint-disable-next-line no-console
  console.log(`  kepler: periapsis ${spread['periapsis']}, apoapsis ${spread['apoapsis']}`);

  await rememberFrame(page);
  await page.locator('#layer-panel-play').getByRole('button', { name: 'Sweep equal areas' }).click();
  await expect(
    page.locator('#layer-panel-play').getByRole('button', { name: 'Sweep equal areas' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await settle(page, 600);

  // Everything the overlay added, split by side of the focus. Periapsis is the
  // near side; the further side is apoapsis, and the reach of each is what the
  // eccentricity is.
  const { near, far, nearReach, farReach } = await page.evaluate((focusX: number) => {
    const canvas = document.querySelector('#layer-panel-play canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const before = (window as unknown as { __frame: ImageData }).__frame;
    const after = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let near = 0;
    let far = 0;
    let nearReach = 0;
    let farReach = 0;
    for (let i = 0; i < after.data.length; i += 4) {
      const delta =
        Math.abs((before.data[i] ?? 0) - (after.data[i] ?? 0)) +
        Math.abs((before.data[i + 1] ?? 0) - (after.data[i + 1] ?? 0)) +
        Math.abs((before.data[i + 2] ?? 0) - (after.data[i + 2] ?? 0));
      if (delta <= 24) continue;
      const x = (i / 4) % canvas.width;
      if (x > focusX + 8) {
        near += 1;
        nearReach = Math.max(nearReach, x - focusX);
      } else if (x < focusX - 8) {
        far += 1;
        farReach = Math.max(farReach, focusX - x);
      }
    }
    return { near, far, nearReach, farReach };
  }, star.x);
  // eslint-disable-next-line no-console
  console.log(`  kepler: wedge pixels near ${near} / far ${far}, reach ${nearReach.toFixed(0)} / ${farReach.toFixed(0)}`);
  expect(near, 'no wedge shading on the periapsis side of the focus').toBeGreaterThan(200);
  expect(far, 'no wedge shading on the apoapsis side of the focus').toBeGreaterThan(200);
  expect(
    farReach,
    'the apoapsis side must reach further from the focus than the periapsis side',
  ).toBeGreaterThan(nearReach * 1.8);

  // Now the fast case, where the angular rate at periapsis is
  // ((1+e)/(1-e))^2 ~ 4300 times the rate at apoapsis.
  await page.locator('#p-e').focus();
  await page.keyboard.press('End');
  const e = Number(await page.locator('#p-e').inputValue());
  expect(e, 'End should take eccentricity to its maximum').toBeGreaterThan(0.9);
  await settle(page, 600);

  // The star is redrawn wherever the new geometry puts it.
  const movedFocus = await page.evaluate(() => {
    const canvas = document.querySelector('#layer-panel-play canvas') as HTMLCanvasElement;
    const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < d.length; i += 4) {
      if ((d[i + 3] ?? 0) < 250) continue;
      const r = d[i] ?? 0;
      const g = d[i + 1] ?? 0;
      const b = d[i + 2] ?? 0;
      if (Math.abs(r - 157) > 10 || Math.abs(g - 180) > 10 || Math.abs(b - 255) > 10) continue;
      n += 1;
      sx += (i / 4) % canvas.width;
      sy += Math.floor(i / 4 / canvas.width);
    }
    return n > 0 ? { x: sx / n, y: sy / n, n } : null;
  });
  expect(movedFocus, 'lost the star after changing eccentricity').not.toBeNull();
  const centre = movedFocus as { x: number; y: number; n: number };

  // The planet is the only opaque ember blob; the radius line to it is drawn at
  // 35% alpha and the live wedge at 30%, so neither reaches alpha 255.
  const track = await page.evaluate(async () => {
    const canvas = document.querySelector('#layer-panel-play canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const find = (): { x: number; y: number } | null => {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < d.length; i += 4) {
        if ((d[i + 3] ?? 0) < 250) continue;
        const r = d[i] ?? 0;
        const g = d[i + 1] ?? 0;
        const b = d[i + 2] ?? 0;
        if (r < 225 || g < 178 || g > 200 || b < 108 || b > 142) continue;
        n += 1;
        sx += (i / 4) % canvas.width;
        sy += Math.floor(i / 4 / canvas.width);
      }
      return n > 0 ? { x: sx / n, y: sy / n } : null;
    };
    const points: ({ x: number; y: number } | null)[] = [];
    // One orbit is 12 s on screen; 70 samples at 180 ms covers it with room over.
    for (let i = 0; i < 70; i += 1) {
      points.push(find());
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return points;
  });

  const found = track.filter((q): q is { x: number; y: number } => q !== null);
  expect(found.length, 'lost the planet on the canvas').toBe(track.length);

  const steps: number[] = [];
  for (let i = 1; i < found.length; i += 1) {
    const from = at(found, i - 1, 'planet track');
    const to = at(found, i, 'planet track');
    const a = Math.atan2(from.y - centre.y, from.x - centre.x);
    const b = Math.atan2(to.y - centre.y, to.x - centre.x);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    steps.push(d);
  }
  const sorted = [...steps].sort((a, b) => a - b);
  const median = at(sorted, Math.floor(sorted.length / 2), 'angular steps');
  const largest = at(sorted, sorted.length - 1, 'angular steps');
  // eslint-disable-next-line no-console
  console.log(
    `  kepler: angular step median ${median.toFixed(4)} rad, max ${largest.toFixed(4)} rad, ratio ${(largest / median).toFixed(0)}x`,
  );
  expect(median, 'the planet never moved').toBeGreaterThan(0);
  expect(
    largest / median,
    'the planet swept the orbit at a near-constant angular rate — the second law is not being drawn',
  ).toBeGreaterThan(20);

  assertClean(w, 'kepler behaviour');
});

/* 3 ---------------------------------------------------------------- */

/**
 * The ten rungs of the ladder, in order.
 *
 * Walked with PageUp, one decade a press, which is not where the anchors are —
 * they sit at the real sizes of real things. What the walk checks is that the
 * scene the reader lands on is always the nearest rung and that the rungs come
 * in size order with none skipped or repeated, which is the claim the ladder
 * makes. The rung is identified by the readout naming the one below it.
 */
const LADDER = [
  'decades below',
  'powers of 10 above proton',
  'powers of 10 above hydrogen atom',
  'powers of 10 above red blood cell',
  'powers of 10 above human',
  'powers of 10 above earth',
  'powers of 10 above sun',
  'powers of 10 above neptune’s orbit',
  'powers of 10 above distance to proxima centauri',
  'powers of 10 above milky way disc',
];

/** Coarsest-to-finest, as the crossing time climbs. */
const TIME_UNITS = ['ys', 'zs', 'as', 'fs', 'ps', 'ns', 'µs', 'ms', 's', 'min', 'hours', 'days', 'years'];

test('behaviour: the scale ladder walks ten rungs in size order', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/scale-of-the-universe', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  await page.locator('#p-s').focus();
  await page.keyboard.press('Home');
  await settle(page, 400);

  const rungs: { label: string; light: string }[] = [];
  // 42 decades, one per press, plus enough overrun to land on the last rung.
  for (let i = 0; i < 46; i += 1) {
    const row = await page.evaluate(() => {
      const dl = document.querySelector('#scale-of-the-universe-readouts')!;
      const terms = [...dl.querySelectorAll('dt')].map((el) => (el.textContent ?? '').trim());
      const values = [...dl.querySelectorAll('dd')].map((el) => (el.textContent ?? '').trim());
      return { label: (terms[1] ?? '').toLowerCase(), light: values[0] ?? '' };
    });
    if (rungs.length === 0 || at(rungs, rungs.length - 1, 'rungs').label !== row.label) rungs.push(row);
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(220);
  }

  expect(
    rungs.map((r) => r.label),
    'the ladder should pass through every rung once, in order',
  ).toEqual(LADDER);
  expect(rungs.length, 'exactly ten distinct scenes').toBe(10);

  // Light takes longer to cross a bigger thing, and the unit has to climb with
  // it: a rung whose crossing time reads in a smaller unit than the rung below
  // is either mis-ordered or mis-formatted.
  const classOf = (value: string): number => {
    const unit = value.replace(/^[\d.,]+\s*/, '').replace(/^(billion|million) /, '');
    const index = TIME_UNITS.indexOf(unit);
    expect(index, `unrecognised crossing-time unit in "${value}"`).toBeGreaterThanOrEqual(0);
    return /billion/.test(value) ? index + 2 : /million/.test(value) ? index + 1 : index;
  };
  const classes = rungs.map((r) => classOf(r.light));
  const classAt = (i: number): number => at(classes, i, 'crossing-time classes');
  // eslint-disable-next-line no-console
  console.log(`  ladder: ${rungs.map((r) => r.light).join(' -> ')}`);
  for (let i = 1; i < classes.length; i += 1) {
    expect(
      classAt(i),
      `crossing time went backwards between rung ${i} and ${i + 1}: ` +
        `${at(rungs, i - 1, 'rungs').light} then ${at(rungs, i, 'rungs').light}`,
    ).toBeGreaterThan(classAt(i - 1));
  }

  assertClean(w, 'scale ladder');
});

/* 4 ---------------------------------------------------------------- */

/**
 * Where the tidal stretch stops killing you.
 *
 *     Δa = 2GMh / r_s³  and  r_s = 2GM/c²   ⟹   Δa = h c⁶ / (4 G² M²)
 *
 * so the stretch falls as M⁻², and the mass at which it drops through a given
 * number of g is
 *
 *     M = √( h c⁶ / (4 G² · n · g₀) )
 *
 * Both the height and the threshold are read off the page rather than assumed:
 * the height is in the readout's own label, and the threshold is whatever the
 * last lethal reading and the first survivable one bracket. The test then checks
 * the flip lands where that physics says it must.
 */
test('behaviour: the tidal verdict flips where the physics says it does', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  await page.locator('#p-M').focus();
  await page.keyboard.press('Home');
  await settle(page, 400);

  const walk: { mass: number; g: number; verdict: string }[] = [];
  for (let i = 0; i < 14; i += 1) {
    const row = await page.evaluate(() => {
      const dl = document.querySelector('#black-holes-readouts')!;
      const term = [...dl.querySelectorAll('dt')][1]?.textContent ?? '';
      const value = [...dl.querySelectorAll('dd')][1]?.textContent ?? '';
      return { term, value };
    });
    const position = Number(await page.locator('#p-M').inputValue());
    // "7.06 × 10⁹ g" / "70.6 g", then the verdict word run on to the unit.
    const text = row.value.replace(/\s+/g, ' ');
    const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const exponent = /10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/.exec(text);
    const mantissa = Number(/^[\d.,]+/.exec(text)?.[0].replace(/,/g, '') ?? 'NaN');
    const digits = exponent?.[1] ?? '';
    const power = digits
      ? Number(
          (digits.startsWith('⁻') ? '-' : '') +
            [...digits.replace('⁻', '')].map((c) => superscripts.indexOf(c)).join(''),
        )
      : 0;
    walk.push({
      mass: 10 ** position,
      g: mantissa * 10 ** power,
      verdict: /survivable/.test(text) ? 'survivable' : 'lethal',
    });
    await page.keyboard.press('PageUp');
    await page.waitForTimeout(170);
  }

  // textContent, not innerText: the label is uppercased in CSS and innerText
  // reports the transformed text, which turns "1.7 m" into "1.7 M".
  const height = Number(/\(([\d.]+) m\)/.exec(
    await page.locator('#black-holes-readouts dt').nth(1).evaluate((el) => el.textContent ?? ''),
  )?.[1] ?? 'NaN');
  expect(height, 'the readout label should name the height it assumes').toBeGreaterThan(0.5);

  const flip = walk.findIndex((r) => r.verdict === 'survivable');
  expect(flip, 'the verdict never flipped across the mass range').toBeGreaterThan(0);
  expect(
    walk.slice(flip).every((r) => r.verdict === 'survivable'),
    'the verdict flipped back — the stretch is not monotonic in mass',
  ).toBe(true);

  const lastLethal = at(walk, flip - 1, 'mass walk');
  const firstSurvivable = at(walk, flip, 'mass walk');
  expect(lastLethal.g, 'the last lethal reading should be the harsher one').toBeGreaterThan(
    firstSurvivable.g,
  );

  const G = 6.674_30e-11;
  const C = 299_792_458;
  const G0 = 9.806_65;
  const massAt = (g: number): number => Math.sqrt((height * C ** 6) / (4 * G ** 2 * g * G0));
  // The threshold sits between the two readings that straddle the flip, so the
  // mass it corresponds to sits between the masses those readings came from.
  const expected = massAt(Math.sqrt(lastLethal.g * firstSurvivable.g));
  // eslint-disable-next-line no-console
  console.log(
    `  black holes: flip between ${lastLethal.mass.toExponential(2)} kg (${lastLethal.g.toPrecision(3)} g) and ${firstSurvivable.mass.toExponential(2)} kg (${firstSurvivable.g.toPrecision(3)} g); tidal physics puts it at ${expected.toExponential(2)} kg`,
  );
  expect(expected, 'the flip is not where the tidal formula puts it').toBeGreaterThan(lastLethal.mass);
  expect(expected, 'the flip is not where the tidal formula puts it').toBeLessThan(
    firstSurvivable.mass,
  );
  // And it is the crossover the module is about: ten thousand solar masses or so.
  expect(expected).toBeGreaterThan(1e34);
  expect(expected).toBeLessThan(1e36);

  assertClean(w, 'black holes behaviour');
});

/* 5 ---------------------------------------------------------------- */

const M_SUN_KG = 1.988_4e30;
const G_SI = 6.674_30e-11;
const C_SI = 299_792_458;

/**
 *     τ = (5/256) · (GM_c/c³)^(-5/3) · (πf)^(-8/3)
 *
 * Time from a given frequency to merger for a circular inspiral at leading
 * post-Newtonian order — the inverse of `fOfTimeToMerger`, written out here so
 * the expected sonification length is derived rather than copied.
 */
function timeToMerger(chirpMass: number, frequency: number): number {
  const m = (G_SI * chirpMass) / C_SI ** 3;
  return (5 / 256) * m ** (-5 / 3) * (Math.PI * frequency) ** (-8 / 3);
}

function chirpMass(m1: number, m2: number): number {
  return (m1 * m2) ** (3 / 5) / (m1 + m2) ** (1 / 5);
}

/** Seconds from a duration string: "254 ms", "6 s", "52.8 s". */
function seconds(text: string): number {
  const value = Number(/[\d.,]+/.exec(text)?.[0].replace(/,/g, '') ?? 'NaN');
  if (/\bms\b/.test(text)) return value / 1000;
  if (/\bmin\b/.test(text)) return value * 60;
  return value;
}

test('behaviour: the chirp sonification runs and tears itself down', async ({ page }) => {
  const w = watch(page);

  // Records what the page builds without changing what it builds. No launch
  // flag is needed for any of this: the context is created inside the click
  // handler, so it starts from a real user gesture and headless Chromium lets
  // it run against a null sink.
  await page.addInitScript(() => {
    interface AudioProbe {
      contexts: number;
      nodes: string[];
      last: AudioContext | null;
    }
    const probe: AudioProbe = { contexts: 0, nodes: [], last: null };
    (window as unknown as { __audio: AudioProbe }).__audio = probe;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof Native>) {
        super(...args);
        probe.contexts += 1;
        probe.last = this;
        for (const name of ['createOscillator', 'createGain'] as const) {
          const original = this[name].bind(this);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (this as any)[name] = (...rest: unknown[]) => {
            probe.nodes.push(name);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (original as any)(...rest);
          };
        }
      }
    } as typeof Native;
  });

  await page.goto('/m/gravitational-waves', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);

  const sentence = page.locator('#layer-panel-play p').last();
  const hear = page.locator('#layer-panel-play').getByRole('button', { name: 'Hear it' });
  await expect(hear, 'the sonification control should be present').toHaveCount(1);

  const defaultText = await sentence.innerText();
  const defaultLength = seconds(/over ([\d.,]+ ?(?:ms|s))/.exec(defaultText)?.[1] ?? '');
  expect(defaultLength, 'no scheduled sweep length in the copy').toBeGreaterThan(0);

  await hear.click();
  const started = await page.evaluate(() => {
    const probe = (window as unknown as { __audio: { contexts: number; nodes: string[]; last: AudioContext | null } }).__audio;
    return { contexts: probe.contexts, nodes: probe.nodes, state: probe.last?.state };
  });
  expect(started.contexts, 'no AudioContext was created').toBe(1);
  expect(started.state, 'the context should be running, not suspended').toBe('running');
  expect(started.nodes, 'the graph should be an oscillator through a gain').toEqual([
    'createOscillator',
    'createGain',
  ]);

  // It closes itself when the chirp ends; an AudioContext left open holds a
  // device. Allowed a second beyond the scheduled sweep.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            (window as unknown as { __audio: { last: AudioContext | null } }).__audio.last?.state,
        ),
      { timeout: (defaultLength + 1) * 1000, message: 'the AudioContext outlived the chirp' },
    )
    .toBe('closed');

  // A neutron-star pair: four hundred times lighter, and a chirp that lasts.
  const mc = chirpMass(1.4 * M_SUN_KG, 1.4 * M_SUN_KG);
  await setSlider(page, 'm1', Math.log10(1.4 * M_SUN_KG));
  await setSlider(page, 'm2', Math.log10(1.4 * M_SUN_KG));
  await settle(page, 600);

  const bnsReadouts = await readouts(page, 'gravitational-waves');
  const inspiral = bnsReadouts['from 30 hz to merger'] ?? '';
  const observed30 = seconds(inspiral);
  const predicted30 = timeToMerger(mc, 30);
  // eslint-disable-next-line no-console
  console.log(
    `  gravitational waves: 30 Hz to merger reads ${inspiral}, quadrupole formula gives ${predicted30.toFixed(1)} s`,
  );
  expect(
    Math.abs(observed30 - predicted30) / predicted30,
    'the inspiral time does not match the leading-order formula',
  ).toBeLessThan(0.02);

  const bnsText = await sentence.innerText();
  const bnsLength = seconds(/over ([\d.,]+ ?(?:ms|s))/.exec(bnsText)?.[1] ?? '');
  expect(
    bnsLength,
    'a binary with a fifty-second inspiral should not schedule the same sweep as one with a quarter-second inspiral',
  ).toBeGreaterThan(defaultLength * 5);
  // The band-entry-to-merger time is far longer than anything worth playing, so
  // the sweep is the sim's own ceiling rather than the physics. Whatever that
  // ceiling is, the scheduled sweep cannot exceed the inspiral it comes from.
  expect(bnsLength).toBeLessThanOrEqual(predicted30);

  // The clamp note is a claim about where the sweep starts, so it has to track
  // the frequency the copy itself reports, in both directions.
  const startsAt = (text: string): number =>
    Number((/unshifted — ([\d.,]+) Hz/.exec(text)?.[1] ?? 'NaN').replace(/,/g, ''));
  const CLAMP = /below about 20 Hz/;
  expect(startsAt(bnsText), 'a neutron-star chirp starts well inside the audible band').toBeGreaterThan(20);
  expect(CLAMP.test(bnsText), 'clamp note shown for a sweep that never leaves the audible band').toBe(false);

  // A hundred solar masses each: the sweep starts below hearing and is held.
  await setSlider(page, 'm1', Math.log10(100 * M_SUN_KG));
  await setSlider(page, 'm2', Math.log10(100 * M_SUN_KG));
  await settle(page, 600);
  const heavyText = await sentence.innerText();
  expect(startsAt(heavyText), 'the reported start should be the audible floor').toBe(20);
  expect(CLAMP.test(heavyText), 'no clamp note on a sweep that runs below hearing').toBe(true);

  assertClean(w, 'gravitational waves behaviour');
});

/* 6 ---------------------------------------------------------------- */

test('behaviour: transit depth changes units and clamps at totality', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/exoplanets', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  const R_SUN_M = 6.957e8;
  const AU_M = 1.495_978_707e11;

  const start = await readouts(page, 'exoplanets');
  expect(start['transit depth'], 'a Jupiter across a Sun is a per-cent transit').toMatch(/%$/);

  // Half an Earth radius across a Sun is 21 parts per million: too small for
  // per cent to say anything, which is what the format switch is for.
  await page.locator('#p-Rp').focus();
  await page.keyboard.press('Home');
  await settle(page, 500);
  const tiny = await readouts(page, 'exoplanets');
  expect(tiny['transit depth'], 'a rocky planet needs ppm, not per cent').toMatch(/ ppm$/);
  const ppm = Number((tiny['transit depth'] ?? '').replace(/[^\d.]/g, ''));
  expect(ppm, 'depth should stay a real number in ppm').toBeGreaterThan(0);
  expect(ppm).toBeLessThan(1_000);

  // A planet wider than its star: the depth is a ratio of areas and cannot pass
  // one, so it has to clamp rather than report a transit deeper than the star.
  await page.keyboard.press('End');
  await setSlider(page, 'Rstar', Math.log10(0.1 * R_SUN_M));
  await settle(page, 600);
  const clamped = await readouts(page, 'exoplanets');
  expect(clamped['transit depth'], 'depth must clamp at totality').toBe('100%');
  expect(clamped['duration'], 'a clamped transit still has a duration').not.toBe('—');

  // The degenerate corner is a different one: an orbit inside the star, where
  // there is no transit to describe and the sim says so instead of drawing one.
  await setSlider(page, 'Rstar', Math.log10(10 * R_SUN_M));
  await setSlider(page, 'a', Math.log10(0.01 * AU_M));
  await settle(page, 600);
  const degenerate = await readouts(page, 'exoplanets');
  expect(degenerate['transit depth'], 'no transit, so no depth').toBe('—');
  expect(degenerate['chance of alignment'], 'no transit, so no alignment figure').toBe('—');
  await expect(
    page.locator('#layer-panel-play'),
    'the no-transit corner must explain itself',
  ).toContainText('the orbit lies inside the star, so there is nothing to transit');

  await assertNoOverflow(page, 'exoplanets degenerate');
  assertClean(w, 'exoplanets behaviour');
});

/* 7 ---------------------------------------------------------------- */

/**
 * Every gas, and what Earth keeps.
 *
 * The verdicts are the module's whole argument, so they are checked against what
 * Earth actually has: hydrogen gone, the heavy molecules kept. Helium is the
 * interesting one and it is asserted as what it is — marginal, not lost. Earth
 * does lose helium, continuously, and it is the only gas here that sits in the
 * band where the rule stops answering.
 */
const GAS_VERDICTS: [string, string][] = [
  ['H₂', 'lost'],
  ['He', 'marginal'],
  ['H₂O', 'retained'],
  ['N₂', 'retained'],
  ['O₂', 'retained'],
  ['CO₂', 'retained'],
];

test('behaviour: every gas chip selects, redraws and keeps its verdict', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/planetary-atmospheres', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  const chips = page.locator('#layer-panel-play button[aria-pressed]');
  await expect(chips, 'six gases').toHaveCount(6);

  const labels = await chips.evaluateAll((els) =>
    els.map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()),
  );
  expect(
    labels.map((text) => {
      const [gas, verdict] = text.split('—');
      return [(gas ?? '').trim(), (verdict ?? '').trim()];
    }),
    'each chip should name its gas and, to a screen reader, its fate',
  ).toEqual(GAS_VERDICTS);

  await rememberFrame(page);
  for (let i = 0; i < GAS_VERDICTS.length; i += 1) {
    const [gas, verdict] = at(GAS_VERDICTS, i, 'gas verdicts');
    await chips.nth(i).click();
    await settle(page, 450);

    const pressed = await chips.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-pressed')),
    );
    expect(
      pressed,
      `selecting ${gas} should press exactly that chip`,
    ).toEqual(GAS_VERDICTS.map((_, j) => String(j === i)));

    const moved = await pixelsChangedSince(page);
    // The first click may land on the gas already selected, which redraws
    // nothing — every later one changes the curve.
    if (i > 0) {
      expect(moved, `selecting ${gas} did not redraw the distribution`).toBeGreaterThan(100);
    }

    const values = await readouts(page, 'planetary-atmospheres');
    expect(
      values['over geologic time'],
      `${gas}: the readout should agree with the chip`,
    ).toBe(verdict);
  }

  assertClean(w, 'atmospheres behaviour');
});

/* 8 ---------------------------------------------------------------- */

/**
 * What the registry publishes, and what it does not.
 *
 * Three counts that are cheap to state and expensive to get wrong: the landing
 * page shows every published module and nothing else, every connection to a
 * module that is not published degrades to a chip rather than a dead link, and
 * no draft is reachable from anywhere a reader looks.
 *
 * The planned chips are three, and it is worth writing down why, because the
 * number moves when the backlog does: they point at `cosmic-distance-ladder`
 * twice and `expansion-of-the-universe` once, neither of which is written. Two
 * further chips existed until `planetary-atmospheres` was published — a module
 * that was finished and registered but still carried a draft flag, so the index
 * hid it and every link to it degraded to a chip.
 *
 * Every target here is a module nobody has written. A chip pointing at a module
 * that *exists* is the failure this pairs with `tests/content.test.ts`, which
 * asserts the same rule against the registry rather than the rendered page.
 */
const PLANNED_TARGETS = ['cosmic-distance-ladder', 'expansion-of-the-universe'];

/** The same rule `src/lib/titles.ts` applies, restated so the page is checked
 *  against an expectation rather than against its own implementation. */
const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);
function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((word, i) => (i > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

test('behaviour: the registry publishes seven modules and leaks no drafts', async ({ page }) => {
  const w = watch(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page, 700);

  const cards = page.locator('a[href^="/m/"]');
  const hrefs = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  expect(
    [...hrefs].sort(),
    'the landing page should link every published module, once',
  ).toEqual(MODULES.map((id) => `/m/${id}`).sort());

  let planned = 0;
  for (const id of MODULES) {
    await page.goto(`/m/${id}`, { waitUntil: 'domcontentloaded' });
    await settle(page, 600);
    await openLayer(page, 'connections');

    const chips = page.locator('#layer-panel-connections li.border-dashed');
    const count = await chips.count();
    planned += count;

    for (let i = 0; i < count; i += 1) {
      const named = ((await chips.nth(i).innerText()).split('\n')[0] ?? '').trim();
      // A title, never the id it was built from: "Cosmic Distance Ladder", not
      // "cosmic-distance-ladder". A reader should never meet a filename.
      expect(named, `${id}: planned chip shows a raw slug — "${named}"`).not.toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)+$/,
      );
      expect(
        PLANNED_TARGETS.map(titleCase),
        `${id}: "${named}" is a planned chip for a module nobody plans to write`,
      ).toContain(named);
    }

    // Nothing anywhere on a reader's page may reach an unpublished module.
    const leaks = await page.locator('a[href^="/m/"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href') ?? ''),
    );
    for (const href of leaks) {
      expect(
        MODULES.map((m) => `/m/${m}`),
        `${id}: link to ${href}, which is not a published module`,
      ).toContain(href);
    }
    await expect(
      page.locator('#layer-panel-connections'),
      `${id}: a draft badge is showing to readers`,
    ).not.toContainText('draft');
  }

  // eslint-disable-next-line no-console
  console.log(`  registry: ${hrefs.length} published cards, ${planned} planned chips`);
  expect(planned, 'planned-chip total across every published page').toBe(3);

  assertClean(w, 'registry');
});

/* ------------------------------------------------------------------ */
/* Reduced motion                                                      */
/* ------------------------------------------------------------------ */

test.describe('prefers-reduced-motion', () => {
  // Every sim, not a sample: the preference has to hold across all of them,
  // and a new sim that animates through it should fail here.
  for (const id of MODULES) {
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

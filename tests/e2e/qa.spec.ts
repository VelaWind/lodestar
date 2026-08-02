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

  // A log slider spans forty-two decades. One arrow press has to move it by
  // something a person could walk the range with: 0.01 decades meant 4,194
  // presses end to end, which is operable only in the sense that a keyboard can
  // physically produce that many.
  const slider = page.locator('#p-s');
  await slider.focus();
  const bounds = await slider.evaluate((el: HTMLInputElement) => ({
    min: Number(el.min),
    max: Number(el.max),
    step: Number(el.step),
  }));
  const presses = (bounds.max - bounds.min) / bounds.step;
  expect(presses, 'arrow-key presses to cross the range').toBeLessThanOrEqual(220);
  expect(presses, 'so coarse that a press skips visible detail').toBeGreaterThanOrEqual(100);

  const before = Number(await slider.inputValue());
  await page.keyboard.press('ArrowRight');
  const after = Number(await slider.inputValue());
  expect(after, 'arrow key did not move the slider').toBeGreaterThan(before);

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

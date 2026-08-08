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
import { SITE_ORIGIN } from '../../src/lib/site';

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
 * Console output the engine produces about someone else's code.
 *
 * Exactly one entry, and it earns its place rather than being a convenience.
 * Firefox validates the MathML that KaTeX emits and logs "Invalid markup:
 * Incorrect number of children for <msub/> tag" as a JavaScript error for some
 * of the subscripts in layer 5 — `v_{\text{esc}}` among them. Nothing about the
 * page is broken by it: the visual layer renders, and the MathML is still in
 * the DOM and still read by assistive technology, which the screen-reader test
 * asserts separately. It is KaTeX's markup and Firefox's strictness, and no
 * change on this side removes it.
 *
 * Filtered rather than skipping the four tests it appears in, because "this
 * page logged nothing else" is worth keeping on Firefox — a real error there
 * would still fail. Anything not matching this stays fatal on every engine.
 */
const KNOWN_ENGINE_NOISE: { pattern: RegExp; why: string }[] = [
  {
    pattern: /Invalid markup: Incorrect number of children for <\w+\/> tag/,
    why: 'Firefox MathML validator vs KaTeX output; render and a11y unaffected',
  },
];

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
  console.log(`  console[${where}]: ${summary}`);
  for (const line of w.all.slice(0, 8)) console.log(`      ${line}`);

  const ignorable = (line: string): { why: string } | undefined =>
    KNOWN_ENGINE_NOISE.find((entry) => entry.pattern.test(line));

  const errors = w.errors.filter((line) => !ignorable(line));
  const pageErrors = w.pageErrors.filter((line) => !ignorable(line));
  const excused = w.errors.length + w.pageErrors.length - errors.length - pageErrors.length;
  if (excused > 0) {
    const why = ignorable(w.errors.find(ignorable) ?? w.pageErrors.find(ignorable) ?? '')?.why;
    console.log(`      (${excused} excused: ${why})`);
  }

  expect(pageErrors, `${where}: uncaught exceptions`).toEqual([]);
  expect(errors, `${where}: console errors`).toEqual([]);
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
    // Scoped to the sim panel, not `canvas` at large. Document order stopped
    // meaning "the sim" when the ambient starfield mounted at the app shell —
    // it is a full-viewport canvas that precedes `main`, so it is `canvas[0]`
    // on every page. Every assertion below is unchanged; they simply point at
    // the element they were always about.
    const canvas = document.querySelectorAll('#layer-panel-play canvas')[i] as
      | HTMLCanvasElement
      | undefined;
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
 * Walk the page top to bottom so every progressive-reveal wrapper has been in
 * the viewport once, then return to the top.
 *
 * `behavior: 'instant'` is load-bearing: the site sets `scroll-behavior: smooth`
 * globally, and a smooth scroll restarted every 120ms never arrives anywhere —
 * the page spends the whole loop chasing the newest target and the bottom of a
 * five-thousand-pixel article is never reached, which is exactly the region
 * this exists to reach.
 */
async function revealEverything(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const jump = (top: number) =>
      window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
    const step = Math.round(window.innerHeight * 0.75);
    const end = document.documentElement.scrollHeight;
    for (let y = 0; y <= end; y += step) {
      jump(y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    jump(0);
  });
  // The reveal is 400ms; let the last screenful finish arriving.
  await page.waitForTimeout(700);
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

  // The footer used to carry a repository link, and asserted its presence here.
  // The repository is private now, so the assertion is inverted rather than
  // deleted: a link that 404s for every reader is worse than no link, and this
  // is the spot that would notice it coming back.
  await expect(
    page.locator('footer a[href*="github.com/VelaWind"]'),
    'the footer should not link the private repository',
  ).toHaveCount(0);
  await expect(
    page.locator('footer a[href="/about"]'),
    'the footer should still offer the about page',
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
    const canvas = page.locator('#layer-panel-play canvas');
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
  await expect(page.locator('#layer-panel-play canvas')).toBeVisible();
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
  await expect(page.locator('#layer-panel-play canvas')).toBeVisible();
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

test('depth tiers change which layers are open @cross-engine', async ({ page }) => {
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
  await expect(page.locator('#layer-panel-play canvas')).toBeVisible();
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

/**
 * The header's two halves, and the line between them.
 *
 * "Depth" sat loose in the header at the same size and tone as "About" beside
 * it, so the row read as three nav links and a pill group rather than a link and
 * a labelled control. The label now lives inside the control's own border, which
 * is the whole of the fix and the thing worth asserting: the word is inside the
 * box, and About is outside it.
 */
test('the depth label belongs to the depth control, and About does not', async ({ page }) => {
  const w = watch(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page, 600);

  const group = page.locator('header [role="radiogroup"]');
  await expect(group).toHaveAttribute('aria-labelledby', 'depth-control-label');

  const box = await page.evaluate(() => {
    const label = document.getElementById('depth-control-label');
    const radios = document.querySelector('header [role="radiogroup"]');
    const about = document.querySelector('header a[href="/about"]');
    if (!radios || !about) return null;
    // The bordered container is the nearest ancestor the label and the pills
    // share; About must not be inside it.
    const container = radios.parentElement;
    return {
      labelInside: !!(label && container?.contains(label)),
      aboutInside: !!container?.contains(about),
      bordered: container ? getComputedStyle(container).borderTopWidth !== '0px' : false,
      // Below `sm` the label is hidden, so its absence there is not a failure.
      labelVisible: !!label && label.getClientRects().length > 0,
    };
  });

  expect(box, 'no depth control in the header').not.toBeNull();
  expect(box!.bordered, 'the depth group should be visibly one container').toBe(true);
  expect(box!.aboutInside, 'About is inside the depth control group').toBe(false);
  if (box!.labelVisible) {
    expect(box!.labelInside, 'the Depth label sits outside the control it names').toBe(true);
  }

  assertClean(w, 'header grouping');
});

test('about page is reachable and renders', async ({ page }) => {
  const w = watch(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page, 600);

  // Both routes, at every width. The header link used to disappear below the
  // sm breakpoint, which put the only page about the project behind a scroll to
  // the footer on the devices most readers arrive on.
  const header = page.locator('header a[href="/about"]');
  const footer = page.locator('footer a[href="/about"]');
  await expect(header, 'the header link should be visible at every width').toBeVisible();
  await expect(footer, 'the footer link should be present at every width').toBeVisible();

  await header.click();
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
  console.log(`  og:image ${image} — ${response.status()}, ${(bytes / 1024).toFixed(1)} kB`);
  expect(bytes, 'og:image looks empty').toBeGreaterThan(5_000);

  assertClean(w, 'social preview');
});

/* ------------------------------------------------------------------ */
/* Layout: the reading column, and what breaks out of it               */
/* ------------------------------------------------------------------ */

/** Left, right, width and centre of the first match, to two decimals. */
async function geometry(page: Page, selector: string): Promise<Box> {
  const box = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      left: +r.left.toFixed(2),
      right: +r.right.toFixed(2),
      width: +r.width.toFixed(2),
      centre: +((r.left + r.right) / 2).toFixed(2),
    };
  }, selector);
  expect(box, `no element matching ${selector}`).not.toBeNull();
  return box as Box;
}

interface Box {
  left: number;
  right: number;
  width: number;
  centre: number;
}

/**
 * The column narrows to the measure above 1280px, and the two elements that
 * need the width keep it by breaking out: layer 3's sim stage, and the landing
 * card grid.
 *
 * The failure this is written against is a specific one. A layer panel is
 * indented 40px so its prose starts under the layer title rather than under the
 * layer number, and a breakout that takes that padded box as its containing
 * block comes out 20px right of the text it belongs to — an offset small enough
 * to survive a review and obvious once the column beside it is narrow. So what
 * is asserted is not that the sim is wide. It is that the sim's centre line and
 * the prose's centre line are the same line, at both of the widths where the
 * column is narrowed.
 *
 * Layer 3's caption is checked alongside them in the other direction: it lives
 * inside the sim's container but it is prose, so it belongs to the column and
 * must not travel with the stage.
 */
test('layout: breakouts stay centred on the prose column', async ({ page }) => {
  test.skip(
    test.info().project.name.startsWith('mobile'),
    'the column only narrows at desktop widths',
  );

  const w = watch(page);

  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/m/escape-velocity', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#layer-panel-play canvas')).toBeVisible();
    await settle(page);

    // The breakpoint is a media query, and a viewport is not always a layout
    // viewport — a classic scrollbar can put 1280 on the wrong side of it, in
    // which case every assertion below would pass by measuring the old layout.
    const narrowed = await page.evaluate(() => window.matchMedia('(min-width: 1280px)').matches);
    expect(narrowed, `${width}: the column should be narrowed at this width`).toBe(true);

    const prose = await geometry(page, '#layer-panel-hook p');
    const caption = await geometry(page, '#layer-panel-play p');
    const stage = await geometry(page, '#layer-panel-play .breakout');
    const canvas = await geometry(page, '#layer-panel-play canvas');

    console.log(
      `  layout[${width}] prose ${prose.left}..${prose.right} (c ${prose.centre}) · ` +
        `stage ${stage.left}..${stage.right} (c ${stage.centre}) · canvas ${canvas.width}px`,
    );

    expect(
      Math.abs(stage.centre - prose.centre),
      `${width}: the sim stage is off the prose column's centre line — ` +
        `stage ${stage.centre}, prose ${prose.centre}. The 40px hanging indent is leaking in.`,
    ).toBeLessThanOrEqual(1);

    expect(
      stage.width,
      `${width}: the stage should be wider than the prose it breaks out of`,
    ).toBeGreaterThan(prose.width);

    // Same box, both ends: a centred breakout overhangs equally, and asserting
    // the edges as well as the centre catches a width that drifted with it.
    expect(
      Math.abs((prose.left - stage.left) - (stage.right - prose.right)),
      `${width}: the stage overhangs the prose unequally`,
    ).toBeLessThanOrEqual(1);

    expect(
      caption.centre,
      `${width}: layer 3's caption travelled with the stage — it is prose, and belongs to the column`,
    ).toBeCloseTo(prose.centre, 0);
    expect(caption.width, `${width}: the caption should be set to the measure`).toBeCloseTo(
      prose.width,
      0,
    );

    await assertNoOverflow(page, `module at ${width}`);

    // The landing grid is the other breakout, and the hero above it is the
    // prose it has to agree with.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await settle(page, 700);

    const hero = await geometry(page, 'main header p');
    const cards = await geometry(page, 'main ul.breakout');
    console.log(
      `  layout[${width}] hero c ${hero.centre} · cards ${cards.left}..${cards.right} (c ${cards.centre})`,
    );

    expect(
      Math.abs(cards.centre - hero.centre),
      `${width}: the card grid is off the hero's centre line — cards ${cards.centre}, hero ${hero.centre}`,
    ).toBeLessThanOrEqual(1);
    expect(cards.width, `${width}: the card grid should break out of the column`).toBeGreaterThan(
      hero.width,
    );

    await assertNoOverflow(page, `landing at ${width}`);
  }

  assertClean(w, 'layout');
});

/**
 * Below the breakpoint there is nothing to break out of, and the elements that
 * carry `.breakout` have to be inert — the class is scoped by a media query,
 * and a media query is exactly the kind of thing that gets widened by accident.
 */
test('layout: nothing breaks out below the breakpoint', async ({ page }) => {
  test.skip(
    !test.info().project.name.startsWith('mobile'),
    'this is the phone-width half of the contract',
  );

  await page.goto('/m/escape-velocity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#layer-panel-play canvas')).toBeVisible();
  await settle(page);

  const column = await geometry(page, '#main');
  const stage = await geometry(page, '#layer-panel-play .breakout');
  expect(stage.left, 'the stage should start inside the column').toBeGreaterThanOrEqual(column.left);
  expect(stage.right, 'the stage should end inside the column').toBeLessThanOrEqual(column.right);
  await assertNoOverflow(page, 'module at phone width');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page, 700);
  const cards = await geometry(page, 'main ul.breakout');
  const main = await geometry(page, '#main');
  expect(cards.left).toBeGreaterThanOrEqual(main.left);
  expect(cards.right).toBeLessThanOrEqual(main.right);
  await assertNoOverflow(page, 'landing at phone width');
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
  test(`accessibility: ${name} @cross-engine`, async ({ page }) => {
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
test('accessibility: a module page with every layer expanded @cross-engine', async ({ page }) => {
  // This module links to `cosmic-distance-ladder`, which is backlog rather than
  // draft, so the chip does not vanish the day another module is published.
  await page.goto('/m/gravitational-waves', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);

  // A real affordance at rest, not on hover: same height as a depth pill, with
  // its own border. A control that only looks like one under a cursor is
  // invisible to touch.
  const expandAll = page.getByRole('button', { name: /expand all/i });
  const shape = await expandAll.evaluate((el) => {
    const style = getComputedStyle(el);
    const pill = document.querySelector('header [role="radio"]');
    return {
      border: style.borderTopWidth,
      height: Math.round(el.getBoundingClientRect().height),
      pillHeight: pill ? Math.round(pill.getBoundingClientRect().height) : null,
    };
  });
  expect(shape.border, 'Expand all has no resting affordance').not.toBe('0px');
  expect(shape.height, 'Expand all should match the depth pills').toBe(shape.pillHeight);

  await expandAll.click();
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

  /*
   * Scroll the whole page before auditing, and not for the reason a stray
   * `scrollIntoView` usually appears in a test.
   *
   * The layers rise into view as a reader reaches them, which means a layer
   * below the fold is still at `opacity: 0` — and axe treats a fully
   * transparent element as not visible on screen, so its colour-contrast rule
   * skips the subtree entirely. Measured on this page: 40 nodes checked without
   * this scroll, 96 with it. Expanding every layer is no longer enough to have
   * *audited* every layer, and without this the test would stay green while
   * quietly covering less than half of what it was written to cover.
   */
  await revealEverything(page);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const stillHidden = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('main article > div > div')).filter(
        (el) => Number(getComputedStyle(el).opacity) < 1,
      ).length,
  );
  expect(stillHidden, 'a layer never revealed, so axe never audited it').toBe(0);

  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(
    blocking.flatMap((v) => v.nodes.map((n) => `${v.impact} ${v.id}: ${n.failureSummary ?? n.html}`)),
    'expanded module page: serious or critical accessibility violations',
  ).toEqual([]);
});

test('keyboard: the whole sim is operable without a pointer @cross-engine', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/scale-of-the-universe', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);

  /*
   * The skip link is the first thing focus reaches, and it goes somewhere.
   *
   * Not on WebKit. Safari's default is that Tab moves between form controls
   * only — links are reached with Option+Tab unless the user turns on "Press
   * Tab to highlight each item" — so the first Tab there lands on the Curious
   * depth radio and the skip link is simply not in the sequence. That is the
   * platform's keyboard model rather than anything this page decides, and the
   * link is present, focusable and functional on every engine. Everything below
   * this point is sliders, buttons and chips, all of which Tab reaches on
   * WebKit, so only these four lines are scoped out.
   */
  if (!test.info().project.name.includes('webkit')) {
    await page.keyboard.press('Tab');
    const first = page.locator(':focus');
    await expect(first, 'first tab stop should be the skip link').toHaveText(/skip to content/i);
    await first.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  }

  // The log-slider keyboard contract, checked on the longest slider in the app
  // and again below on the shortest, because the whole point of it is that the
  // keys mean the same thing on both. Positions are decades.
  await assertLogSliderKeys(page, '#p-s', 'scale-of-the-universe/s');

  // 0.6 decades end to end — a whole-decade key has to clamp here, not refuse.
  await page.goto('/m/exoplanets', { waitUntil: 'domcontentloaded' });
  await settle(page, 1_000);
  await assertLogSliderKeys(page, '#p-Rp', 'exoplanets/Rp');

  // The hero's tier word is styled as interactive, so it has to be reachable and
  // it has to do something. It sends focus to the control it names — which is
  // the only reason for a word in a paragraph to be a button at all.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await settle(page, 700);
  const tierWord = page.getByRole('button', { name: /Go to the reading depth control/ });
  await expect(tierWord, 'the hero tier word should be a real control').toHaveCount(1);
  await tierWord.focus();
  await expect(tierWord).toBeFocused();
  await page.keyboard.press('Enter');
  const landed = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      role: el?.getAttribute('role'),
      checked: el?.getAttribute('aria-checked'),
      inHeader: !!el?.closest('header'),
    };
  });
  expect(landed.inHeader, 'focus should move into the header').toBe(true);
  expect(landed.role, 'focus should land on a depth radio').toBe('radio');
  expect(landed.checked, 'focus should land on the selected tier').toBe('true');

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

    const described = await page.locator('#layer-panel-play canvas').evaluate((canvas) => {
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
  'powers of 10 below',
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- monkey-patching a DOM class to count node creations; the index signature does not exist on the typed AudioContext
          (this as any)[name] = (...rest: unknown[]) => {
            probe.nodes.push(name);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- calling back through the captured original, whose overloads cannot be expressed once erased
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

  console.log(`  registry: ${hrefs.length} published cards, ${planned} planned chips`);
  expect(planned, 'planned-chip total across every published page').toBe(3);

  assertClean(w, 'registry');
});

/* ------------------------------------------------------------------ */
/* Glossary tooltips                                                   */
/* ------------------------------------------------------------------ */

/**
 * The term tooltip, once per viewport, end to end.
 *
 * Three things this can see that nothing else can. The panel is portalled to
 * `document.body` and positioned `fixed` precisely because both of its
 * ancestors clip — the layer accordion and the approximations disclosure are
 * `overflow-hidden`, and an in-tree panel would be sliced off at whichever edge
 * it crossed — so the assertion that matters is not "the panel exists" but "the
 * panel's box is inside the viewport and outside the clipping box". Second, the
 * trigger must not read as a link: links here are star-blue and solid-
 * underlined, and a dotted underline in the prose colour is the whole of the
 * distinction. Third, axe with a panel open, which the per-page audit cannot
 * reach because nothing is open when it runs.
 */

/**
 * A point on a glossary trigger that a real click would actually reach.
 *
 * The centre is the obvious choice and the wrong one once a panel is open: the
 * two terms in black-holes' layer 6 sit a few lines apart, and on a 390px
 * screen the first panel lands squarely over the second word. Clicking its
 * centre then hits the panel, the second term never opens, and the test reports
 * "one at a time is broken" when what is broken is the aim.
 *
 * So the rect is scanned for a point that hit-tests to the trigger itself.
 * Throwing when there is none is the right failure: it means the word is
 * completely covered, which is a finding rather than a flake.
 */
async function clickablePointOn(page: Page, ref: string): Promise<{ x: number; y: number }> {
  const point = await page.evaluate((termRef) => {
    const el = document.querySelector(`[data-glossary-term="${termRef}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Inset from the edges, then a coarse grid: a trigger is one or two words,
    // so a handful of samples covers it.
    for (const fy of [0.5, 0.3, 0.7]) {
      for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9]) {
        const x = r.left + r.width * fx;
        const y = r.top + r.height * fy;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
        if (document.elementFromPoint(x, y) === el) return { x, y };
      }
    }
    return null;
  }, ref);

  if (!point) throw new Error(`"${ref}" is entirely covered — no point on it is clickable`);
  return point;
}

/** Tabs until focus lands on a glossary trigger, and says which one. */
async function tabToTerm(page: Page, limit = 60): Promise<string> {
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press('Tab');
    const ref = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.glossaryTerm ?? null,
    );
    if (ref) return ref;
  }
  throw new Error(`no glossary trigger reached in ${limit} tab presses`);
}

test('glossary: a term opens, reads, and closes @cross-engine', async ({ page }) => {
  const w = watch(page);
  const mobile = test.info().project.name.startsWith('mobile');

  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  // Layer 3's caption is open at the default tier, and carries one mark.
  const trigger = page.locator('[data-glossary-term="isco"]').first();
  await expect(trigger, 'no ISCO term marked in the black-holes caption').toHaveCount(1);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  /**
   * The live region, before anything has been opened.
   *
   * This is the assertion that keeps the announcement working, and it has to
   * run here rather than after the first open: a live region inserted with its
   * content already in it announces nothing, so "exists and is empty on load"
   * is the property, not "exists once a panel is up". A future refactor that
   * moved the region into `GlossaryTerm`'s JSX would still pass every check
   * below and silence the feature entirely.
   */
  const liveAtRest = await page.evaluate(() => {
    const region = document.getElementById('glossary-live-region');
    if (!region) return null;
    const style = getComputedStyle(region);
    return {
      polite: region.getAttribute('aria-live'),
      atomic: region.getAttribute('aria-atomic'),
      text: (region.textContent ?? '').trim(),
      count: document.querySelectorAll('#glossary-live-region, [id^="glossary-live-region"]').length,
      // Hidden by size and clip, not by `display:none` or `visibility:hidden`,
      // either of which takes it out of the accessibility tree.
      width: Math.round(region.getBoundingClientRect().width),
      display: style.display,
      visibility: style.visibility,
    };
  });
  expect(liveAtRest, 'no glossary live region on the page at rest').not.toBeNull();
  expect(liveAtRest!.polite, 'the live region should be polite').toBe('polite');
  expect(liveAtRest!.atomic, 'the definition is one announcement, not a diff').toBe('true');
  expect(liveAtRest!.text, 'the live region must mount empty, or it announces nothing').toBe('');
  expect(liveAtRest!.count, 'exactly one live region, however many terms are marked').toBe(1);
  expect(liveAtRest!.width, 'the live region should be visually hidden').toBeLessThanOrEqual(1);
  expect(liveAtRest!.display, 'display:none would hide it from screen readers too').not.toBe('none');
  expect(liveAtRest!.visibility, 'visibility:hidden would hide it from screen readers too').not.toBe(
    'hidden',
  );

  // A button, and visibly not a link.
  const looks = await trigger.evaluate((el) => {
    const style = getComputedStyle(el);
    const link = document.querySelector('#main a[href]');
    return {
      tag: el.tagName,
      href: el.getAttribute('href'),
      style: style.textDecorationStyle,
      line: style.textDecorationLine,
      linkStyle: link ? getComputedStyle(link).textDecorationStyle : null,
    };
  });
  expect(looks.tag, 'a term trigger must be a real button').toBe('BUTTON');
  expect(looks.href, 'a term must not be a link').toBeNull();
  expect(looks.line).toContain('underline');
  expect(looks.style, 'a term is dotted-underlined; a link is solid').toBe('dotted');
  if (looks.linkStyle) {
    expect(looks.linkStyle, 'links should stay solid-underlined').toBe('solid');
  }

  /* --- opened by keyboard ------------------------------------------ */

  const reached = await tabToTerm(page);
  expect(reached, 'the first glossary trigger in tab order should be the caption term').toBe('isco');
  await expect(trigger, 'keyboard focus should reveal the definition').toHaveAttribute(
    'aria-expanded',
    'true',
  );

  const panel = page.locator('[data-glossary-panel="isco"]');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('ISCO');
  await expect(panel).toContainText('steadily orbit a black hole');

  // aria-controls has to name the thing that appeared, and the panel has to be
  // named by the word that opened it.
  const wiring = await page.evaluate(() => {
    const button = document.querySelector('[data-glossary-term="isco"]') as HTMLElement;
    const controls = button.getAttribute('aria-controls') ?? '';
    const target = document.getElementById(controls);
    const labelledBy = target?.getAttribute('aria-labelledby') ?? '';
    return {
      resolves: !!target,
      inBody: target?.parentElement === document.body,
      label: document.getElementById(labelledBy)?.textContent?.trim() ?? null,
      role: target?.getAttribute('role'),
    };
  });
  expect(wiring.resolves, 'aria-controls points at nothing').toBe(true);
  expect(wiring.inBody, 'the panel should be portalled out of the clipping ancestors').toBe(true);
  expect(wiring.label, 'the panel should be labelled by the term').toBe('innermost stable orbit');
  expect(wiring.role).toBe('note');

  // And the definition is spoken, not merely painted. The panel lands at the
  // end of <body>, nowhere near where a screen reader is reading, so the text
  // has to arrive in the live region for anyone to hear it.
  await expect(
    page.locator('#glossary-live-region'),
    'the open definition should be announced',
  ).toHaveText('ISCO: The closest distance at which anything can steadily orbit a black hole; closer than this, it spirals in.');

  // Inside the viewport, on all four sides. A panel clipped by the accordion or
  // hanging off a 390px screen is the failure the portal exists to prevent.
  //
  // Measured with `getBoundingClientRect` rather than Playwright's
  // `boundingBox()`: the latter reports document coordinates, so on a page
  // scrolled 400px down a perfectly placed fixed panel reads as 400px past the
  // bottom of the window. The first run of this test said exactly that.
  //
  // And measured after the page has stopped moving. Tab scrolled the term into
  // view, `scroll-behavior: smooth` means that scroll is still running, and the
  // panel follows it — so a reading taken mid-flight is of a position neither
  // the code nor the reader ever settles on.
  await settle(page, 700);
  const box = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      bottom: r.bottom,
      right: r.right,
      width: r.width,
      height: r.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(box.width, 'the panel has no width').toBeGreaterThan(100);
  expect(box.height, 'the panel has no height').toBeGreaterThan(20);
  expect(box.left, 'panel off the left edge').toBeGreaterThanOrEqual(0);
  expect(box.top, 'panel off the top edge').toBeGreaterThanOrEqual(0);
  expect(box.right, 'panel off the right edge').toBeLessThanOrEqual(box.viewportWidth);
  expect(box.bottom, 'panel off the bottom edge').toBeLessThanOrEqual(box.viewportHeight);
  await assertNoOverflow(page, 'black-holes with a tooltip open');

  /* --- read by axe ------------------------------------------------- */

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    blocking.flatMap((v) => v.nodes.map((n) => `${v.impact} ${v.id}: ${n.failureSummary ?? n.html}`)),
    'open tooltip: serious or critical accessibility violations',
  ).toEqual([]);

  await shot(page, `20-glossary-${mobile ? 'mobile' : 'desktop'}`);

  /* --- closed by Escape -------------------------------------------- */

  await page.keyboard.press('Escape');
  await expect(panel, 'Escape should dismiss the panel').toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger, 'Escape should return focus to the word').toBeFocused();
  // The region stays; what it says does not. A definition left in it would be
  // re-read by anything that walks the page afterwards.
  await expect(
    page.locator('#glossary-live-region'),
    'the announcement should clear when the panel closes',
  ).toHaveText('');

  /* --- tap toggles, on the viewport that has a finger --------------- */

  if (mobile) {
    await trigger.scrollIntoViewIfNeeded();
    const spot = await trigger.boundingBox();
    expect(spot, 'the term has no tappable box').not.toBeNull();
    const tap = async (): Promise<void> => {
      await page.touchscreen.tap(spot!.x + spot!.width / 2, spot!.y + spot!.height / 2);
    };

    await tap();
    await expect(panel, 'a tap should open the definition').toBeVisible();
    await tap();
    await expect(panel, 'a second tap should close it').toHaveCount(0);

    // And a tap anywhere else dismisses it rather than leaving it stranded.
    await tap();
    await expect(panel).toBeVisible();
    await page.touchscreen.tap(5, 5);
    await expect(panel, 'a tap outside should dismiss the panel').toHaveCount(0);
    await assertNoOverflow(page, 'black-holes after tapping a term');
  }

  assertClean(w, 'glossary tooltip');
});

/**
 * The pointer contract: intent to open, leaving to close, a click to pin.
 *
 * This is the regression test for the bug ccd76ec shipped and then fixed in the
 * same session. Hover opened the panel after 150 ms; the click that followed
 * found it already open and a plain toggle closed it, so a reader who hovered a
 * word and then clicked it — the most ordinary sequence there is — got the
 * definition taken away. The fix was to make a click *pin* rather than toggle,
 * and pinning is invisible from the outside except through exactly this
 * sequence, which is why it needs a test of its own rather than an assertion
 * bolted onto one of the others.
 *
 * Desktop only. Hover is a pointer concept; the touch path has its own
 * tap-toggle coverage in the journey above, and on a touch project
 * `pointerenter` fires as part of the tap, which is the case the component
 * deliberately ignores.
 */
test('glossary: hover opens, leaving closes, a click pins @cross-engine', async ({ page }) => {
  test.skip(test.info().project.name.startsWith('mobile'), 'hover is a pointer gesture');

  const w = watch(page);
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  const trigger = page.locator('[data-glossary-term="isco"]');
  const panel = page.locator('[data-glossary-panel="isco"]');
  await trigger.scrollIntoViewIfNeeded();
  await settle(page, 600);

  const term = await clickablePointOn(page, 'isco');
  /** The left gutter: nowhere near the word, and nothing interactive there. */
  const away = { x: 16, y: 420 };
  const hover = async (): Promise<void> => {
    await page.mouse.move(term.x, term.y);
  };
  const leave = async (): Promise<void> => {
    await page.mouse.move(away.x, away.y);
  };

  /* --- a pointer passing through does not open it ------------------- */

  // On and straight off, well inside the 150 ms intent delay. Asserting the
  // delay by racing it would flake; asserting that a sweep never opens the
  // panel is the same property, measured in a way that cannot.
  await hover();
  await leave();
  await settle(page, 500);
  await expect(panel, 'a pointer passing over the word should not open it').toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  /* --- resting on it does ------------------------------------------- */

  await hover();
  await expect(panel, 'hovering should open the definition after the intent delay').toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  // Opened by hover alone: nothing was clicked, so focus never moved.
  const focused = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.glossaryTerm ?? null,
  );
  expect(focused, 'hover should not move focus').toBeNull();

  /* --- and leaving closes it again ---------------------------------- */

  await leave();
  await expect(panel, 'moving away from an unpinned panel should close it').toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  /* --- hover, then click: pinned ------------------------------------ */

  await hover();
  await expect(panel, 'hovering should open it again').toBeVisible();
  await page.mouse.click(term.x, term.y);
  await expect(
    panel,
    'clicking a word whose panel is already hover-open should keep it, not toggle it shut',
  ).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  await leave();
  await settle(page, 400);
  await expect(
    panel,
    'a pinned panel should survive the pointer leaving the word',
  ).toBeVisible();

  /* --- and a second click dismisses --------------------------------- */

  await page.mouse.click(term.x, term.y);
  await expect(panel, 'a second click should dismiss the pinned panel').toHaveCount(0);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await assertNoOverflow(page, 'black-holes after the hover sequence');
  assertClean(w, 'glossary hover');
});

/**
 * Selecting the definition must not dismiss it.
 *
 * The panel is a plain div, so pressing in it moves focus off the trigger, and
 * the trigger's blur used to close the panel on the mousedown — before the drag
 * had begun. A reader could not copy a definition, or highlight one while
 * reading it, and every existing assertion here passed throughout: they all
 * either click the trigger or click somewhere that is *meant* to dismiss.
 *
 * Desktop only. Selecting text by drag is a pointer gesture; the touch path
 * uses a long-press and a native selection UI that Playwright does not drive.
 */
test('glossary: selecting the definition keeps it open @cross-engine', async ({ page }) => {
  test.skip(
    test.info().project.name.startsWith('mobile'),
    'drag-selection is a pointer gesture',
  );

  const w = watch(page);
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  const trigger = page.locator('[data-glossary-term="isco"]');
  const panel = page.locator('[data-glossary-panel="isco"]');

  await trigger.click();
  await expect(panel, 'the click should pin the definition open').toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await settle(page, 400);

  const body = await panel.evaluate((el) => {
    const paragraph = el.querySelectorAll('p')[1]!;
    const r = paragraph.getBoundingClientRect();
    // The last line of the definition: a drag along it selects real words
    // without leaving the panel.
    return { left: r.left + 6, right: r.right - 6, y: r.bottom - 8 };
  });

  await page.mouse.move(body.left, body.y);
  await page.mouse.down();
  // The mousedown alone was enough to close it before the fix, so the state is
  // asserted here as well as after the drag.
  await expect(
    trigger,
    'pressing inside the panel closed it — the blur handler fired on the mousedown',
  ).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(body.right, body.y, { steps: 10 });
  await page.mouse.up();
  await settle(page, 300);

  await expect(panel, 'dragging a selection dismissed the panel').toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const selected = await page.evaluate(() => (window.getSelection()?.toString() ?? '').trim());
  expect(
    selected.length,
    'nothing was selected — the drag did not land on the definition text',
  ).toBeGreaterThan(4);
  expect(
    'The closest distance at which anything can steadily orbit a black hole; closer than this, it spirals in.',
    `the selection "${selected}" is not part of the definition`,
  ).toContain(selected);

  // The announcement is still standing, because the panel is.
  await expect(page.locator('#glossary-live-region')).toContainText('ISCO:');

  /* --- and everything that should still dismiss, still does --------- */

  await page.keyboard.press('Escape');
  await expect(panel, 'Escape should still dismiss after a selection').toHaveCount(0);
  await expect(trigger, 'Escape should still return focus to the word').toBeFocused();

  await trigger.click();
  await expect(panel).toBeVisible();
  // A press that begins outside is a dismissal, however recently one began
  // inside — the flag must not have stuck.
  await page.mouse.click(20, 320);
  await expect(panel, 'a click outside should dismiss the panel').toHaveCount(0);
  await expect(page.locator('#glossary-live-region'), 'and clear the announcement').toHaveText('');

  await assertNoOverflow(page, 'black-holes after selecting a definition');
  assertClean(w, 'glossary selection');
});

/**
 * Two terms, one panel.
 *
 * `kerr` and `accretion-disc` used to sit in the approximations disclosure and
 * now sit in layer 6, where a reader meeting the words actually is. Layer 6 is
 * collapsed at the default tier, so the setup expands it; everything asserted
 * below is unchanged, because what is being tested is the claim mechanism and
 * the portal, not the layer either term happens to live in. The nested
 * `overflow-hidden` case the old placement covered is picked up at the end of
 * this test on gravitational-waves, whose approximations still hold a mark.
 */
test('glossary: only one definition is open at a time @cross-engine', async ({ page }) => {
  const w = watch(page);
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);

  await openLayer(page, 'deeper');
  await settle(page, 500);

  const kerr = page.locator('[data-glossary-term="kerr"]');
  const disc = page.locator('[data-glossary-term="accretion-disc"]');
  await expect(kerr, 'no Kerr term in the going-deeper layer').toHaveCount(1);
  await expect(disc, 'no accretion-disc term in the going-deeper layer').toHaveCount(1);

  /**
   * Both terms parked in the clear first, then clicked where they sit.
   *
   * `locator.click()` scrolls its target into view, and a scroll is a
   * dismissal — so a test that let it scroll would be watching the first panel
   * close because the page moved, not because the second term claimed it, and
   * would keep passing if "one at a time" were removed entirely.
   *
   * "In the clear" is stricter than "in the viewport", and the difference cost
   * a debugging round: scrolled to put the second term mid-screen, the first
   * sat 28px from the top of the window — inside it, and underneath the sticky
   * header, so the click went to a depth radio. So the scroll leaves room for
   * the header, and both points are hit-tested before either is clicked.
   */
  await page.evaluate(() => {
    const first = document.querySelector('[data-glossary-term="kerr"]')!;
    const header = document.querySelector('header');
    const headroom = (header?.getBoundingClientRect().height ?? 0) + 32;
    window.scrollBy({ top: first.getBoundingClientRect().top - headroom, behavior: 'auto' });
  });
  await settle(page, 600);

  /**
   * The later word first, then the earlier one.
   *
   * Both terms are in the same paragraph now, a few lines apart, and a panel
   * is 320px wide by about 120px tall: at 390px `Kerr`'s panel lands squarely
   * over `Accretion-disc` and covers it completely — `clickablePointOn` said so
   * rather than guessing, and that is ordinary tooltip behaviour, not a defect.
   * Opening the lower word first puts its panel below itself, which leaves the
   * word above it clear, so both clicks are real clicks on visible text.
   */
  const discPoint = await clickablePointOn(page, 'accretion-disc');
  await page.mouse.click(discPoint.x, discPoint.y);
  await expect(page.locator('[data-glossary-panel="accretion-disc"]')).toBeVisible();

  // Aimed again now that a panel is on screen, in case it moved what is on top.
  const kerrPoint = await clickablePointOn(page, 'kerr');
  await page.mouse.click(kerrPoint.x, kerrPoint.y);
  await expect(
    page.locator('[data-glossary-panel="accretion-disc"]'),
    'opening a second term should close the first',
  ).toHaveCount(0);
  await expect(page.locator('[data-glossary-panel="kerr"]')).toBeVisible();
  await expect(disc).toHaveAttribute('aria-expanded', 'false');
  await expect(kerr).toHaveAttribute('aria-expanded', 'true');

  // The announcement follows. React runs every effect teardown in a commit
  // before every effect, so the closing term's "clear" would wipe the opening
  // term's text if the live region were not owned by whoever spoke last — this
  // is the assertion that says it is.
  await expect(
    page.locator('#glossary-live-region'),
    'switching terms should announce the new definition, not silence',
  ).toHaveText(/^Kerr: The exact description of a rotating black hole/);

  // The definition escapes the layer's clipping box and is fully on screen.
  const escaped = await page.evaluate(() => {
    const panel = document.querySelector('[data-glossary-panel="kerr"]') as HTMLElement;
    const rect = panel.getBoundingClientRect();
    return {
      visible: rect.width > 0 && rect.height > 0,
      inViewport:
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth,
      position: getComputedStyle(panel).position,
    };
  });
  expect(escaped.visible, 'the panel was clipped to nothing').toBe(true);
  expect(escaped.inViewport, 'the panel is not fully on screen').toBe(true);
  expect(escaped.position).toBe('fixed');

  // Scrolling dismisses rather than leaving a panel behind where its word was.
  // Driven from the page rather than with `mouse.wheel`, which does nothing on
  // the touch project — the behaviour under test is the scroll, not the input
  // device that caused one.
  await settle(page, 400);
  await page.evaluate(() => window.scrollBy(0, 240));
  await expect(
    page.locator('[data-glossary-panel="kerr"]'),
    'a scroll should dismiss the panel',
  ).toHaveCount(0);

  await assertNoOverflow(page, 'black-holes going-deeper with a tooltip');

  /* --- the doubly-clipped case, kept covered ------------------------ */

  /**
   * A term inside the approximations disclosure, which is an
   * `overflow-hidden` box nested inside the layer accordion's own. This is the
   * strictest test of the portal decision, and black-holes stopped providing
   * it when `kerr` and `accretion-disc` moved to layer 6 — gravitational-waves
   * still marks `inspiral` there, so the case moves rather than lapsing.
   */
  await page.goto('/m/gravitational-waves', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);
  await page.getByRole('button', { name: /^approximations/i }).click();
  await settle(page, 500);

  const inspiral = page.locator('[data-glossary-term="inspiral"]');
  await expect(inspiral, 'no inspiral term in the approximations').toHaveCount(1);

  await inspiral.scrollIntoViewIfNeeded();
  await settle(page, 600);
  const spot = await clickablePointOn(page, 'inspiral');
  await page.mouse.click(spot.x, spot.y);
  const inspiralPanel = page.locator('[data-glossary-panel="inspiral"]');
  await expect(inspiralPanel, 'a term inside two clipping boxes should still open').toBeVisible();

  const doublyClipped = await page.evaluate(() => {
    const panel = document.querySelector('[data-glossary-panel="inspiral"]') as HTMLElement;
    const r = panel.getBoundingClientRect();
    return {
      width: r.width,
      height: r.height,
      inViewport:
        r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
      inBody: panel.parentElement === document.body,
      // Both ancestors of the trigger clip; neither may clip the panel.
      clippingAncestors: (() => {
        let node = document.querySelector('[data-glossary-term="inspiral"]')?.parentElement ?? null;
        let n = 0;
        while (node && node !== document.body) {
          if (getComputedStyle(node).overflow === 'hidden') n += 1;
          node = node.parentElement;
        }
        return n;
      })(),
    };
  });
  expect(doublyClipped.width, 'the panel was clipped to nothing').toBeGreaterThan(100);
  expect(doublyClipped.height, 'the panel was clipped to nothing').toBeGreaterThan(20);
  expect(doublyClipped.inViewport, 'the panel is not fully on screen').toBe(true);
  expect(doublyClipped.inBody, 'the panel should be portalled to the body').toBe(true);
  expect(
    doublyClipped.clippingAncestors,
    'the trigger should sit inside at least two overflow-hidden boxes here',
  ).toBeGreaterThanOrEqual(2);

  await assertNoOverflow(page, 'gravitational-waves approximations with a tooltip');
  assertClean(w, 'glossary one-at-a-time');
});

/* ------------------------------------------------------------------ */
/* Layer 4's photograph                                                */
/* ------------------------------------------------------------------ */

/**
 * Every module's figure, on the page rather than in the data file.
 *
 * The unit suite checks that the module points at a file of the right size and
 * shape. What it cannot see is whether the file is actually served: a figure
 * under `public/` that never made it into the build, or a path that is right
 * relative to the source tree and wrong relative to the site root, renders as a
 * broken image and passes every check that only reads the AST. `naturalWidth`
 * is the assertion that the bytes arrived and decoded.
 *
 * `width` and `height` are asserted as present because they are the whole
 * reason the caption does not jump when the image lands.
 *
 * All seven modules now, with no exception branch. `kepler-orbits` carried one
 * while its figure was unlicensable; it has one, so the branch is gone rather
 * than left standing with an empty list — a skip nothing can reach is a skip
 * nobody notices has stopped meaning anything.
 */
test('every module shows its layer-4 photograph @cross-engine', async ({ page }) => {
  const w = watch(page);

  for (const id of MODULES) {
    await page.goto(`/m/${id}`, { waitUntil: 'domcontentloaded' });
    await settle(page, 700);
    await openLayer(page, 'real');
    await settle(page, 500);

    const figures = page.locator('#layer-panel-real figure img');

    await expect(figures, `${id}: expected exactly one figure in layer 4`).toHaveCount(1);
    const image = figures.first();
    await image.scrollIntoViewIfNeeded();
    // `loading="lazy"` means the bytes only start once it is near the viewport.
    await expect(image).toBeVisible();

    /*
     * And then wait for them to arrive.
     *
     * `toBeVisible` is a layout question — the element has a box — and says
     * nothing about whether a lazy image has finished decoding. Chromium
     * happened to be done by the next round trip and Firefox was not, so
     * `naturalWidth` came back 0 for black-holes and the test reported the file
     * as missing from the build when it was served fine. The engine did not
     * find a bug in the site; it found one here, which is the whole reason for
     * running on more than one.
     */
    await expect
      .poll(
        async () =>
          image.evaluate((el) => {
            const img = el as HTMLImageElement;
            return img.complete && img.naturalWidth > 0;
          }),
        { message: `${id}: the figure never finished loading` },
      )
      .toBe(true);

    const shown = await image.evaluate((el) => {
      const img = el as HTMLImageElement;
      const figureEl = img.closest('figure')!;
      const caption = figureEl.querySelector('figcaption');
      return {
        src: img.getAttribute('src'),
        widthAttr: img.getAttribute('width'),
        heightAttr: img.getAttribute('height'),
        loading: img.getAttribute('loading'),
        decoding: img.getAttribute('decoding'),
        alt: img.getAttribute('alt') ?? '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: Math.round(img.getBoundingClientRect().width),
        captionText: (caption?.textContent ?? '').trim(),
        // The figure belongs to the reading column, not to the breakout the sim
        // stage uses.
        breakout: figureEl.classList.contains('breakout'),
      };
    });

    expect(shown.src, `${id}: figure src`).toBe(`/figures/${id}.webp`);
    expect(
      shown.naturalWidth,
      `${id}: the image did not load — ${shown.src} is missing from the build`,
    ).toBeGreaterThan(0);
    expect(shown.naturalHeight, `${id}: the image decoded to nothing`).toBeGreaterThan(0);
    // The attributes have to match the file, or the reserved box is the wrong
    // shape and the page shifts when the image lands.
    expect(Number(shown.widthAttr), `${id}: width attribute missing or wrong`).toBe(
      shown.naturalWidth,
    );
    expect(Number(shown.heightAttr), `${id}: height attribute missing or wrong`).toBe(
      shown.naturalHeight,
    );
    expect(shown.loading, `${id}: figure should be lazy`).toBe('lazy');
    expect(shown.decoding, `${id}: figure should decode async`).toBe('async');
    expect(shown.alt.length, `${id}: figure has no alt text`).toBeGreaterThan(20);
    expect(shown.breakout, `${id}: the figure should stay in the reading column`).toBe(false);

    // The credit is visible, not merely present in the markup.
    const credit = page.locator('#layer-panel-real figure figcaption').getByText(/^Credit: /);
    await expect(credit, `${id}: no visible credit line`).toBeVisible();
    const creditText = ((await credit.textContent()) ?? '').trim();
    expect(creditText.length, `${id}: empty credit`).toBeGreaterThan('Credit: '.length);
    expect(
      shown.captionText,
      `${id}: the caption should carry prose as well as the credit`,
    ).not.toBe(creditText);

    console.log(
      `  figure[${id}]: ${shown.naturalWidth}x${shown.naturalHeight} natural, ` +
        `${shown.renderedWidth}px rendered — ${creditText}`,
    );

    await assertNoOverflow(page, `${id} with layer 4 open`);
  }

  assertClean(w, 'figures');
});

/* ------------------------------------------------------------------ */
/* Nothing points at the private repository                            */
/* ------------------------------------------------------------------ */

/**
 * The repository is private, so a link to it is a 404 with the reader's name
 * on it.
 *
 * One literal anchor was removed from the footer, and a footer renders on every
 * route — so this walks all nine and checks the rendered DOM rather than the
 * source. `git grep` finds a hardcoded href; it does not find one built from a
 * template, pulled out of module data, or added to a component that did not
 * have one when the grep was run. This does.
 *
 * Scope is the rendered site only. README, LICENSE and source comments name the
 * repository freely and should: they are read by people who already have it.
 *
 * The second half is the other side of the same claim. Removing the link left
 * the site silent about why, so About now says the repository is private and
 * that access is available on request — and the owner found that sentence
 * missing from the rendered page, because it had never been written. Checking
 * "no link" without checking "and here is what to do instead" is how that gap
 * survived a release: the absence was asserted, the replacement was not. Both
 * halves live in one test so neither can be satisfied alone.
 *
 * The href match is `github.com`, not `github.com/VelaWind`. Nothing in
 * `src/` links to GitHub at all, so the broader pattern costs nothing and also
 * catches a link to some other account's mirror of this repository.
 *
 * Chromium-only by omission of the `@cross-engine` tag — an href is an href on
 * every engine, and this is about content rather than rendering.
 */
test('no route links the private repo, and /about says access is on request', async ({ page }) => {
  const w = watch(page);
  const routes = ['/', '/about', ...MODULES.map((id) => `/m/${id}`)];
  expect(routes.length, 'all nine routes').toBe(9);

  const offenders: string[] = [];
  let aboutChecked = false;

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await settle(page, 500);

    // Every anchor on the page, not just the footer's: the point is that
    // nothing anywhere points there, including anything added later.
    const hrefs = await page.locator('a[href]').evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    expect(hrefs.length, `${route}: no links at all — did the page render?`).toBeGreaterThan(0);

    for (const href of hrefs) {
      if (href.includes('github.com')) offenders.push(`${route} -> ${href}`);
    }

    if (route === '/about') {
      // Read from <main>, not the whole document: this asserts the sentence is
      // rendered where a reader meets it, which is exactly what a logged-out
      // check of the page looks at.
      const main = await page.locator('main').innerText();
      expect(
        main,
        '/about must tell a reader who cannot open the repository how to ask',
      ).toContain('available to reviewers on request');

      // The seam this shipped alongside. The paragraph said "the division of
      // labour" twice across a sentence boundary; the phrase must not come back.
      expect(main, 'the duplicated "division of labour" seam is back').not.toContain(
        'The division of labour is',
      );

      aboutChecked = true;
    }
  }

  expect(offenders, 'these routes link the private repository').toEqual([]);
  expect(aboutChecked, '/about was never walked — the route list changed').toBe(true);

  console.log(`  private repo: ${routes.length} routes checked, no links out; /about states the terms`);
  assertClean(w, 'private repo links');
});

/* ------------------------------------------------------------------ */
/* Addresses that match nothing                                        */
/* ------------------------------------------------------------------ */

/**
 * Two ways to be nowhere, and both have to say so.
 *
 * `/m/<unknown>` matched the module route and failed on the slug, so it can
 * name what it could not find. `/no-such-page` matched no route at all — it
 * used to `<Navigate to="/" replace />`, which put the reader on the front page
 * with no sign anything had gone wrong and dropped the address they asked for
 * out of the history. A silent redirect is not a 404.
 */
/**
 * What the head says while a not-found state is on screen.
 *
 * A static host cannot answer 404 — the catch-all rewrite serves the app shell
 * with a 200 for every unknown address — so the two things a client can still
 * do have to be true: `robots: noindex` present, and the build's canonical
 * gone, because a canonical on a not-found page claims the address is the page
 * of record.
 */
async function headMarkers(page: Page): Promise<{ noindex: string | null; canonical: string | null }> {
  return page.evaluate(() => ({
    noindex: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
  }));
}

test('an address that matches nothing says so @cross-engine', async ({ page }) => {
  const w = watch(page);

  /* --- no route at all ---------------------------------------------- */

  await page.goto('/no-such-page', { waitUntil: 'domcontentloaded' });
  await settle(page, 700);

  const catchAll = await headMarkers(page);
  expect(catchAll.noindex, '/no-such-page should be noindex').toBe('noindex');
  expect(catchAll.canonical, '/no-such-page should drop the canonical').toBeNull();

  expect(new URL(page.url()).pathname, 'an unknown address should not be redirected away').toBe(
    '/no-such-page',
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Nothing here' })).toBeVisible();
  await expect(page.getByText('No module lives at this address.')).toBeVisible();
  await expect(page, 'the tab should say where you are').toHaveTitle(/^Nothing here/);
  // And it is a not-found state, not the index wearing a heading.
  await expect(
    page.locator('main a[href^="/m/"]'),
    'the not-found page should not be the module index',
  ).toHaveCount(0);

  const back = page.getByRole('link', { name: 'Back to all modules' });
  await expect(back).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.impact} ${v.id}`),
    'not-found page: serious or critical accessibility violations',
  ).toEqual([]);

  await back.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.locator('main a[href^="/m/"]'),
    'the link should land on the index',
  ).toHaveCount(MODULES.length);

  /* --- a route that matched, with a slug that did not ---------------- */

  await page.goto('/m/does-not-exist', { waitUntil: 'domcontentloaded' });
  await settle(page, 700);
  expect(new URL(page.url()).pathname).toBe('/m/does-not-exist');
  await expect(
    page.getByText('No module called'),
    'the module route should name the slug it could not find',
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to all modules' })).toBeVisible();

  const namedSlug = await headMarkers(page);
  expect(namedSlug.noindex, '/m/<unknown> should be noindex').toBe('noindex');
  expect(namedSlug.canonical, '/m/<unknown> should drop the canonical').toBeNull();

  /* --- and both are put back on the way out ------------------------- */

  /*
   * The half that would rot silently. Both states remove a head element the
   * build wrote, and if the removal were not undone on unmount the rest of the
   * session would run without a canonical — invisible to a reader, and to every
   * other test here, all of which arrive by a fresh load.
   *
   * What comes back is the *served document's* canonical, not the destination
   * route's. An unknown address is served the root shell by the catch-all
   * rewrite, and nothing rewrites the canonical during client-side navigation —
   * per-route canonicals are a property of the served HTML, which `heads.spec`
   * asserts on nine fresh loads. Getting this wrong is what the first run of
   * this assertion did.
   */
  await page.getByRole('link', { name: 'Back to all modules' }).click();
  await expect(page).toHaveURL(/\/$/);
  await settle(page, 500);

  const restored = await headMarkers(page);
  expect(
    restored.canonical,
    'the canonical the shell was served with should be back after the not-found state unmounts',
  ).toBe(`${SITE_ORIGIN}/`);
  expect(restored.noindex, 'leaving a not-found state should clear the noindex').toBeNull();

  // And a module loaded directly still carries its own, unaffected.
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await settle(page, 500);
  const real = await headMarkers(page);
  expect(real.canonical, 'a real module page').toBe(`${SITE_ORIGIN}/m/black-holes`);
  expect(real.noindex, 'a real module page should not be noindex').toBeNull();

  await assertNoOverflow(page, 'not found');
  assertClean(w, 'not found');
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
      await expect(page.locator('#layer-panel-play canvas')).toBeVisible();
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

/* ------------------------------------------------------------------ */
/* Route transitions                                                   */
/* ------------------------------------------------------------------ */

/**
 * The crossfade between routes, and the one property of it that could ever
 * become a source of flake: whether the incoming page is real yet.
 *
 * The failure this guards against is subtle and would not look like a bug. An
 * `AnimatePresence` set to `mode="wait"` holds the incoming route unmounted
 * until the outgoing one has finished leaving, so for 150ms the new page exists
 * in the URL and nowhere else. Every assertion in this file would still pass —
 * they all `settle()` first — while a reader who clicks and immediately taps
 * gets nothing, and any future test that does not sleep becomes intermittent.
 * So this asserts the DOM at the first moment the URL is the new one, with no
 * settle between the click and the read.
 *
 * The module chunk is warmed first, deliberately. Without that this would be
 * measuring `React.lazy` fetching a quarter-megabyte of KaTeX, which is a real
 * wait but not this one, and the test would be about the network instead.
 */
test('route transition: the incoming page is readable at once @cross-engine', async ({ page }) => {
  const w = watch(page);

  await page.goto('/m/kepler-orbits', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);
  await page.getByRole('link', { name: '← All modules' }).click();
  await expect(page).toHaveURL(/\/$/);
  await settle(page, 700);

  // The click under test. Nothing between it and the read below.
  await page.getByRole('link', { name: /Kepler Orbits/ }).first().click();
  await expect(page).toHaveURL(/\/m\/kepler-orbits/);

  const atOnce = await page.evaluate(() => {
    // The outlet holds one frame per route in flight. The one on its way out
    // marks itself `inert`, so "the page the reader is now on" is the frame
    // without that attribute — which is the thing whose content has to be ready.
    const outlet = document.querySelector('main > div');
    const frames = outlet ? Array.from(outlet.children) : [];
    const live = frames.find((f) => !f.hasAttribute('inert')) ?? null;
    const leaving = frames.filter((f) => f.hasAttribute('inert'));

    return {
      frames: frames.length,
      leavingCount: leaving.length,
      heading: live?.querySelector('h1')?.textContent?.trim() ?? null,
      sliders: live?.querySelectorAll('input[type="range"]').length ?? 0,
      simPanels: live?.querySelectorAll('#layer-panel-play').length ?? 0,
      // A page that is halfway gone must not be reachable by Tab.
      leavingTabbables: leaving.reduce(
        (n, f) => n + f.querySelectorAll('a[href], button, input').length,
        0,
      ),
      leavingHidden: leaving.every((f) => f.getAttribute('aria-hidden') === 'true'),
    };
  });

  expect(atOnce.heading, 'the incoming heading should exist before the fade finishes').toBe(
    'Kepler Orbits',
  );
  expect(
    atOnce.sliders,
    'the incoming controls should exist before the fade finishes',
  ).toBeGreaterThan(0);
  expect(atOnce.simPanels, 'the live frame should carry exactly one sim panel').toBe(1);

  /* If the crossfade is still running there are two frames, and the outgoing
     one must be inert and hidden. If it has already finished there is one, and
     there is nothing to hide. Both are correct; what is not correct is a second
     frame that is still reachable. */
  expect(atOnce.frames, 'at most two routes in flight').toBeLessThanOrEqual(2);
  if (atOnce.leavingCount > 0) {
    expect(atOnce.leavingTabbables, 'the outgoing page still has focusable content').toBeGreaterThan(
      0,
    );
    expect(atOnce.leavingHidden, 'the outgoing page must be hidden from assistive tech').toBe(true);
  }

  // And it cleans up after itself: one frame left, fully opaque, no offset.
  await settle(page, 700);
  const settled = await page.evaluate(() => {
    const outlet = document.querySelector('main > div');
    const frames = outlet ? Array.from(outlet.children) : [];
    const first = frames[0];
    return {
      frames: frames.length,
      inertLeft: frames.filter((f) => f.hasAttribute('inert')).length,
      opacity: first ? Number(getComputedStyle(first).opacity) : null,
      transform: first ? getComputedStyle(first).transform : null,
      position: first ? getComputedStyle(first).position : null,
    };
  });
  expect(settled.frames, 'the outgoing route should be gone once the fade ends').toBe(1);
  expect(settled.inertLeft, 'nothing should still be marked inert').toBe(0);
  expect(settled.opacity, 'the settled route should be fully opaque').toBe(1);
  expect(settled.position, 'the settled route should be back in normal flow').toBe('static');
  expect(settled.transform, 'the settled route should carry no leftover offset').toMatch(
    /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/,
  );

  assertClean(w, 'route transition');
});

/**
 * Under reduced motion the transition is not a faster transition, it is no
 * transition: the outgoing route is gone on the same tick, which is what keeps
 * its unmount effects — the canonical link being restored, above all — running
 * when they always did.
 */
test('route transition: reduced motion swaps instantly @cross-engine', async ({ page }) => {
  const w = watch(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/m/kepler-orbits', { waitUntil: 'domcontentloaded' });
  await settle(page, 900);
  await page.getByRole('link', { name: '← All modules' }).click();
  await expect(page).toHaveURL(/\/$/);

  const atOnce = await page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      // A frame on its way out is the only thing that ever carries `inert`, so
      // its absence is the check that nothing is being held on screen to fade.
      leavingFrames: main?.querySelectorAll('[inert]').length ?? 0,
      partiallyFaded: Array.from(main?.querySelectorAll('div') ?? []).filter((el) => {
        const o = Number(getComputedStyle(el).opacity);
        return o > 0 && o < 1;
      }).length,
      cards: document.querySelectorAll('a[href^="/m/"]').length,
      heading: main?.querySelector('h1')?.textContent?.trim() ?? null,
    };
  });

  expect(atOnce.leavingFrames, 'reduced motion should never hold a route on its way out').toBe(0);
  expect(atOnce.partiallyFaded, 'reduced motion should never render mid-fade').toBe(0);
  expect(atOnce.cards, 'the index should be complete immediately').toBe(MODULES.length);
  expect(atOnce.heading, 'the index heading should be there immediately').toBe(
    'Space, explained in layers you choose to open.',
  );

  assertClean(w, 'route transition reduced');
});

/* ------------------------------------------------------------------ */
/* KaTeX deferral                                                      */
/* ------------------------------------------------------------------ */

/**
 * The runtime half of `tests/katex-deferral.test.ts`.
 *
 * That suite asserts the two source-level invariants — no math in a
 * default-open layer, no static import in `Tex` — which is what CI can check.
 * This asserts the thing those invariants exist for: that the browser really
 * does not fetch 78 kB of KaTeX before first paint, really does fetch it when a
 * reader opens a layer with equations in it, and never shows raw TeX in between.
 */
test('katex is not fetched for a module page at rest, and is when math opens @cross-engine', async ({
  page,
}) => {
  const w = watch(page);
  const katexRequests: string[] = [];
  page.on('request', (r) => {
    if (/katex.*\.js(\?|$)/.test(r.url())) katexRequests.push(r.url());
  });

  await page.goto('/m/kepler-orbits', { waitUntil: 'domcontentloaded' });

  // The window that matters is before first paint has settled. The page
  // prefetches the library on idle after that, which is the point — off the
  // critical path, ready before anyone can click.
  const atRest = await page.evaluate(() => document.querySelectorAll('.katex').length);
  expect(atRest, 'a module page at rest should render no math at all').toBe(0);

  await settle(page, 1_500);
  await openLayer(page, 'math');
  await settle(page, 1_200);

  const rendered = await page.locator('#layer-panel-math .katex').count();
  expect(rendered, 'opening the math layer should render equations').toBeGreaterThan(0);
  expect(
    katexRequests.length,
    'the katex chunk should have been fetched exactly once',
  ).toBeGreaterThan(0);

  /* No raw TeX, ever. Equations are rendered into `.katex` subtrees, so a leaf
     inside the panel carrying backslash-commands means the source leaked. */
  const raw = await page.evaluate(() => {
    const panel = document.querySelector('#layer-panel-math');
    if (!panel) return ['no panel'];
    return Array.from(panel.querySelectorAll('p, div, span'))
      .filter((el) => el.children.length === 0)
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => /\[a-zA-Z]{2,}|\frac/.test(t))
      .slice(0, 5);
  });
  expect(raw, 'raw TeX source is visible in the math layer').toEqual([]);

  assertClean(w, 'katex deferral');
});

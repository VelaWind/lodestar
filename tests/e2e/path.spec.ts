/**
 * The learning path in a browser: the "Start here" section on the front page
 * and the "On the learning path" footer on module pages.
 *
 * The order itself is pinned by `tests/path.test.ts`; this checks that the
 * pages show it, that it can be operated by keyboard, and that it does not
 * widen the page or bury the topic grid on a phone.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LEARNING_PATH, PATH_STEPS } from '../../src/content/path';

const ORDER = PATH_STEPS.map((s) => s.id);
const START_HERE = 'section[aria-labelledby="start-here"]';

async function noOverflow(page: Page, where: string): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.scrollingElement?.scrollWidth ?? 0,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${where}: horizontal overflow`).toBeLessThanOrEqual(innerWidth);
}

/** Opens every closed stage by keyboard, the way a reader without a pointer would. */
async function openAllStages(page: Page): Promise<void> {
  const summaries = page.locator(`${START_HERE} details > summary`);
  const count = await summaries.count();
  for (let i = 0; i < count; i += 1) {
    const details = page.locator(`${START_HERE} details`).nth(i);
    if (await details.evaluate((d) => (d as HTMLDetailsElement).open)) continue;
    await summaries.nth(i).focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
  }
}

test('learning path: Start here lists every topic in order, 1 to 22 @cross-engine', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const section = page.locator(START_HERE);
  await expect(section.getByRole('heading', { name: 'Start here' })).toBeVisible();
  await expect(section).toContainText('A suggested order for beginners; every topic stands on its own.');

  // Compact on a phone: the whole section within about a screen, so the grid is not buried.
  const viewport = page.viewportSize()!;
  if (viewport.width < 640) {
    const box = (await section.boundingBox())!;
    expect(box.height, 'Start here is taller than a phone screen').toBeLessThanOrEqual(viewport.height);
  }

  await openAllStages(page);
  const links = section.locator('ol ol > li > a');
  await expect(links).toHaveCount(ORDER.length);
  const hrefs = await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')));
  expect(hrefs).toEqual(ORDER.map((id) => `/m/${id}`));
  const numbers = await links.evaluateAll((nodes) => nodes.map((n) => n.firstElementChild?.textContent?.trim()));
  expect(numbers).toEqual(ORDER.map((_, i) => String(i + 1)));
  for (const link of await links.all()) await expect(link).toBeVisible();

  // The stages, in order, each with its heading.
  const headings = section.locator('h3');
  await expect(headings).toHaveCount(LEARNING_PATH.length);
  for (const [i, stage] of LEARNING_PATH.entries()) {
    await expect(headings.nth(i)).toHaveText(`Stage ${i + 1} ${stage.title}`);
  }

  await noOverflow(page, 'landing with every stage open');

  // The topic grid is still there, below.
  await expect(page.locator('main ul.breakout > li > a[href^="/m/"]')).toHaveCount(ORDER.length);

  // A link is reachable and followable by keyboard.
  await links.first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/m/${ORDER[0]}$`));
});

test('learning path: Start here passes axe with every stage open @cross-engine', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await openAllStages(page);
  const results = await new AxeBuilder({ page })
    .include(START_HERE)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});

test('learning path: a module page says where it sits before the first layer @cross-engine', async ({ page }) => {
  const index = ORDER.indexOf('black-holes');
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  const line = page.locator('header').getByText('Seven layers, from plain words to the equations');
  await expect(line).toBeVisible();
  await expect(line).toContainText(`Step ${index + 1} of ${ORDER.length}`);
  // On the first screen, even on a phone.
  const box = (await line.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await line.getByRole('link', { name: `Step ${index + 1} of ${ORDER.length}` }).click();
  await expect(page.locator('#path-footer')).toBeInViewport();
});

/*
 * A wide equation on a phone scrolls sideways inside its box; a keyboard has
 * to be able to reach it to scroll it. Only boxes that overflow become stops.
 */
test('equations that scroll sideways can be reached by keyboard @cross-engine', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/m/dark-matter', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Expand all' }).click();
  const boxes = page.locator('#layer-panel-math .overflow-x-auto');
  await expect(boxes.first()).toBeVisible();
  await expect(async () => {
    const states = await boxes.evaluateAll((els) =>
      els.map((el) => ({ overflows: el.scrollWidth > el.clientWidth, focusable: el.getAttribute('tabindex') === '0' })),
    );
    expect(states.some((s) => s.overflows), 'expected at least one wide equation at 390 px').toBe(true);
    for (const s of states) expect(s.focusable).toBe(s.overflows);
  }).toPass();
});

/*
 * A link opens its page at the top. Without this a module reached from a card
 * low on the index opened thousands of pixels down, past its title and hook,
 * and the footer's Next (pressed at the bottom of a page) did the same. Back
 * still returns the reader to where they were.
 */
test('navigation: a link opens the page at its top @cross-engine', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const card = page.locator('main ul.breakout a[href="/m/wormholes"]');
  await card.scrollIntoViewIfNeeded();
  const onIndex = await page.evaluate(() => window.scrollY);
  expect(onIndex, 'the card should be well down the index').toBeGreaterThan(1000);
  await card.click();
  await expect(page).toHaveURL(/\/m\/wormholes$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Wormholes and White Holes' })).toBeInViewport();

  // Followed by keyboard: the stylesheet's smooth scrolling can still be moving
  // the footer when a pointer click lands, and Enter on a focused link cannot miss.
  const next = page.locator('[data-path-next]');
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/\/m\/wormholes$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  // Back is the browser's: the app does not touch scroll on it. Whether the
  // browser lands exactly where the reader was depends on when the lazily
  // loaded page is tall enough to scroll, so only the route is asserted here.
  await page.goBack();
  await expect(page).toHaveURL(/\/m\/wormholes$/);
});

/*
 * Back snaps to the reader's place. Smooth scrolling on the whole document used
 * to animate the browser's own restoration, so Back glided down from the top
 * for most of a second; it is now scoped to in-page jumps. Measured from the
 * popstate: by the second animation frame the page is where the reader left it.
 * The position is kept well inside the index's height so no engine has to
 * clamp it while the page re-renders.
 */
test('navigation: Back returns to the saved position at once, not by gliding @cross-engine', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main ul.breakout a[href^="/m/"]')).toHaveCount(ORDER.length);
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
  const card = page.locator('main ul.breakout a[href^="/m/"]').nth(4);
  await card.focus();
  // Focusing can scroll the card into view, a frame or more later on mobile
  // WebKit; the place to return to is wherever the page settles before the
  // link is followed.
  let saved = -1;
  await expect
    .poll(async () => {
      const now = await page.evaluate(
        () => new Promise<number>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY)))),
      );
      const settled = now === saved;
      saved = now;
      return settled;
    })
    .toBe(true);
  expect(saved, 'the index should be scrolled well down').toBeGreaterThan(500);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/m\//);
  await expect(page.locator('h1')).toHaveCount(1);
  await page.evaluate(() => {
    (window as unknown as { __afterBack: Promise<number> }).__afterBack = new Promise((resolve) =>
      addEventListener('popstate', () => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY))), { once: true }),
    );
  });
  await page.goBack();
  const atSecondFrame = await page.evaluate(() => (window as unknown as { __afterBack: Promise<number> }).__afterBack);
  expect(Math.abs(atSecondFrame - saved), `scrollY ${atSecondFrame} two frames after Back, saved ${saved}`).toBeLessThanOrEqual(2);
});

/*
 * A fresh visit starts at the top. Every fresh document load shares the
 * history key "default"; positions saved for one page must not be applied to
 * the next page loaded fresh.
 */
test('navigation: a fresh visit to another page is not scrolled to an old place @cross-engine', async ({ page }) => {
  await page.goto('/m/kepler-orbits', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-path-footer]')).toHaveCount(1);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200);
  await page.goto('/m/escape-velocity', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-path-footer]')).toHaveCount(1);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

/*
 * In-page jumps still arrive: the skip link and the step link under a title.
 */
test('navigation: the skip link and the step link still reach their targets @cross-engine', async ({ page }) => {
  await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#path-footer')).toHaveCount(1);
  const step = page.locator('header').getByRole('link', { name: /^Step \d+ of \d+$/ });
  await step.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#path-footer')).toBeInViewport();

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.keyboard.press('Shift+Tab'); // leave the step link
  await page.locator('a[href="#main"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await expect(page.locator('#main')).toBeInViewport();
  // The keyboard's place moves with the jump: the next Tab continues in the content.
  await expect(page.locator('#main')).toBeFocused();
});

/*
 * The smooth jump ends where it should, and smooth scrolling ends with it.
 * On the longest module page at 390px (dark-matter, measured across all 22),
 * the step link's glide is the longest the site has; the class that switches
 * smooth scrolling on must outlast it and come off promptly after.
 */
test('navigation: the step link glides to the footer, and smooth scrolling ends with it @cross-engine', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/m/dark-matter', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#path-footer')).toHaveCount(1);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const w = window as unknown as { __track: [number, number, boolean][] };
    w.__track = [];
    const t0 = performance.now();
    const tick = () => {
      w.__track.push([performance.now() - t0, window.scrollY, document.documentElement.classList.contains('smooth-jump')]);
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.locator('header').getByRole('link', { name: /^Step \d+ of \d+$/ }).click();
  await page.waitForTimeout(4200);
  const track = await page.evaluate(() => (window as unknown as { __track: [number, number, boolean][] }).__track);
  const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const final = track[track.length - 1]![1];
  // The last frame on which the page moved, and the first after it with the class gone.
  let stopped = 0;
  for (let i = 1; i < track.length; i += 1) if (track[i]![1] !== track[i - 1]![1]) stopped = track[i]![0];
  const classOff = track.find(([t, , on]) => t >= stopped && !on)?.[0] ?? Infinity;
  await expect(page.locator('#path-footer')).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY), 'the page should rest where the jump ended').toBe(final);
  expect(final, 'the jump should have gone down the page').toBeGreaterThan(1000);
  if (!reduced) expect(track.some(([, , on]) => on), 'smooth scrolling should have been on for the jump').toBe(true);
  expect(classOff - stopped, `smooth-jump came off ${Math.round(classOff - stopped)} ms after the scroll stopped`).toBeLessThanOrEqual(300);
});

/*
 * Back after an in-page jump returns to where the reader was. Followed
 * natively, the jump's history entry shared the key "default" with the one
 * before it, so their saved positions overwrote each other and Back stayed at
 * the target. Each jump now has its own entry.
 */
for (const width of [390, 1280]) {
  test(`navigation: Back after an in-page jump returns to the place before it, at ${width}px @cross-engine`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto('/m/black-holes', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#path-footer')).toHaveCount(1);
    const step = page.locator('header').getByRole('link', { name: /^Step \d+ of \d+$/ });
    // Scrolled down by up to 500px, with the step link still on screen to click.
    const linkTop = await step.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const want = Math.max(0, Math.min(500, Math.floor(linkTop - 120)));
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), want);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(want);
    await expect(step).toBeInViewport();
    const before = await page.evaluate(() => window.scrollY);

    await step.click();
    await expect(page).toHaveURL(/#path-footer$/);
    await expect(page.locator('#path-footer')).toBeInViewport();
    // Let the glide finish before going back.
    await expect(page.locator('html')).not.toHaveClass(/smooth-jump/);

    const twoFramesAfterPop = () =>
      page.evaluate(() => {
        const w = window as unknown as { __afterPop: Promise<number> };
        w.__afterPop = new Promise((resolve) =>
          addEventListener('popstate', () => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY))), { once: true }),
        );
      });
    const readAfterPop = () => page.evaluate(() => (window as unknown as { __afterPop: Promise<number> }).__afterPop);

    await twoFramesAfterPop();
    await page.goBack();
    const back = await readAfterPop();
    expect(Math.abs(back - before), `Back: scrollY ${back}, before the jump ${before}`).toBeLessThanOrEqual(2);
    await expect(page).not.toHaveURL(/#path-footer$/);

    await twoFramesAfterPop();
    await page.goForward();
    await readAfterPop();
    await expect(page).toHaveURL(/#path-footer$/);
    await expect(page.locator('#path-footer')).toBeInViewport();
  });
}

/*
 * A direct load of a hash URL. The browser's own jump runs before the module's
 * content has loaded, finds no element, and leaves the page at the top; the app
 * waits for the element and scrolls to it once.
 */
for (const width of [390, 1280]) {
  test(`navigation: a direct load of #path-footer lands on the footer at ${width}px @cross-engine`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto('/m/black-holes#path-footer', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#path-footer')).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY), 'the page should have scrolled down to the footer').toBeGreaterThan(500);
  });
}

const MIDDLE = Math.floor(ORDER.length / 2);

for (const index of [0, MIDDLE, ORDER.length - 1]) {
  const id = ORDER[index]!;
  test(`learning path: the footer on ${id} shows its step and neighbours @cross-engine`, async ({ page }) => {
    await page.goto(`/m/${id}`, { waitUntil: 'domcontentloaded' });
    const footer = page.locator('[data-path-footer]');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole('heading', { name: 'On the learning path' })).toBeVisible();

    const step = PATH_STEPS[index]!;
    await expect(footer.locator('[data-path-step]')).toHaveText(`Step ${index + 1} of ${ORDER.length}`);
    await expect(footer.locator('[data-path-stage]')).toHaveText(LEARNING_PATH[step.stageIndex]!.title);

    const previous = footer.locator('[data-path-previous]');
    if (index === 0) await expect(previous).toHaveCount(0);
    else await expect(previous).toHaveAttribute('href', `/m/${ORDER[index - 1]}`);

    const last = index === ORDER.length - 1;
    const nextId = last ? ORDER[0]! : ORDER[index + 1]!;
    const next = footer.locator('[data-path-next]');
    await expect(next).toHaveAttribute('href', `/m/${nextId}`);
    if (last) await expect(next).toContainText('Back to the start of the path');
    else await expect(next).toContainText('Next');

    await noOverflow(page, `${id} footer`);

    // The next link navigates, and the page it lands on knows its own step.
    await next.click();
    await expect(page).toHaveURL(new RegExp(`/m/${nextId}$`));
    const nextIndex = last ? 0 : index + 1;
    // For the length of the route crossfade both pages are in the document: wait
    // for the new page's footer, then for the old page to leave.
    const steps = page.locator('[data-path-footer] [data-path-step]');
    await expect(steps.filter({ hasText: `Step ${nextIndex + 1} of ${ORDER.length}` })).toHaveCount(1);
    await expect(steps).toHaveCount(1);
  });
}

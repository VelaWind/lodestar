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

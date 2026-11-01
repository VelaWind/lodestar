/**
 * The statistics question: asked once, nothing from Google before "Allow",
 * page views after it, and the About page can take it back.
 *
 * Every request to Google is intercepted and answered locally, so the suite
 * records what the site tries to send without anything reaching Google.
 */
import { expect, test } from '@playwright/test';
import { GA_MEASUREMENT_ID } from '../../src/lib/site';

test.skip(GA_MEASUREMENT_ID === '', 'no measurement ID configured, so there is no banner to test');

// A first-time reader: no stored answer.
test.use({ storageState: { cookies: [], origins: [] } });

const GOOGLE = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/;

test('nothing reaches Google until the reader allows it @cross-engine', async ({ page }) => {
  const sent: string[] = [];
  await page.route(GOOGLE, (route) => {
    sent.push(route.request().url());
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/');
  const bar = page.getByRole('region', { name: 'Usage statistics' });
  await expect(bar).toBeVisible();
  await page.getByRole('link', { name: /Escape Velocity/i }).first().click();
  await page.waitForLoadState('networkidle');
  expect(sent, 'requests to Google before any answer').toEqual([]);

  await bar.getByRole('button', { name: 'No thanks' }).click();
  await expect(bar).toBeHidden();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Usage statistics' })).toBeHidden();
  await page.waitForLoadState('networkidle');
  expect(sent, 'requests to Google after "No thanks"').toEqual([]);
});

test('"Allow" loads gtag and sends a page view per route; About takes it back', async ({ page }) => {
  await page.route(GOOGLE, (route) => route.fulfill({ status: 204, body: '' }));

  await page.goto('/');
  await page.getByRole('region', { name: 'Usage statistics' }).getByRole('button', { name: 'Allow' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('script[src*="googletagmanager.com/gtag/js"]') !== null)).toBe(true);

  const pageViews = () =>
    page.evaluate(() =>
      (window.dataLayer ?? [])
        .map((entry) => Array.from(entry as ArrayLike<unknown>))
        .filter((args) => args[0] === 'event' && args[1] === 'page_view')
        .map((args) => (args[2] as { page_path: string }).page_path),
    );
  await expect.poll(pageViews).toEqual(['/']);

  await page.getByRole('link', { name: 'About' }).first().click();
  await expect.poll(pageViews).toEqual(['/', '/about']);

  const consentArgs = await page.evaluate(() =>
    (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>)).filter((args) => args[0] === 'consent'),
  );
  expect(consentArgs[0]?.[1]).toBe('default');
  expect(consentArgs[0]?.[2]).toMatchObject({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
  expect(consentArgs[1]).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);

  const setting = page.locator('#statistics');
  await expect(setting).toContainText('allowed');
  await setting.getByRole('button', { name: 'Stop counting my visits' }).click();
  await expect(setting).toContainText('not allowed');
  expect(await page.evaluate(() => localStorage.getItem('lodestar-analytics'))).toBe('denied');
});

test('"Details" opens About at the statistics section, in one move', async ({ page }) => {
  await page.route(GOOGLE, (route) => route.fulfill({ status: 204, body: '' }));
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as { __scrolls: number[] };
    w.__scrolls = [];
    addEventListener('scroll', () => w.__scrolls.push(Math.round(scrollY)), { passive: true });
  });
  await page.getByRole('region', { name: 'Usage statistics' }).getByRole('link', { name: 'Details' }).click();
  await expect(page).toHaveURL(/\/about#statistics$/);
  const section = page.locator('#statistics');
  await expect(section).toBeInViewport();
  // Settle past the crossfade, then check the reader is still there and that
  // the page did not jump to one place and get clamped back to another.
  await page.waitForTimeout(800);
  await expect(section).toBeInViewport();
  const distinct = await page.evaluate(() => [...new Set((window as unknown as { __scrolls: number[] }).__scrolls)].filter((y) => y > 0));
  expect(distinct.length, `scroll positions after the click: ${distinct.join(', ')}`).toBeLessThanOrEqual(1);
});

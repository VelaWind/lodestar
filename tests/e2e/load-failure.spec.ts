/**
 * A module whose chunks fail to arrive (a 502, a dropped connection) shows a
 * way back rather than a blank page, and "Try again" recovers once the network
 * does. Every `/assets/kepler-orbits-*.js` request is aborted: the module's own
 * data and its simulation share that name.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const BLOCKED = /\/assets\/kepler-orbits-[^/]*\.js(\?.*)?$/;

test('load failure: a module that fails to load says so, and Try again recovers it @cross-engine', async ({ page }) => {
  await page.route(BLOCKED, (route) => route.abort('failed'));
  await page.goto('/m/kepler-orbits', { waitUntil: 'domcontentloaded' });

  const message = page.getByText('This topic didn’t load. Check your connection and try again.');
  const retry = page.getByRole('button', { name: 'Try again' });
  await expect(message).toBeVisible();
  await expect(retry).toBeVisible();
  await expect(page.locator('header').getByRole('link', { name: /Lodestar/ })).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page).toHaveTitle('Couldn’t load · Lodestar');

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => `${v.impact} ${v.id}`)).toEqual([]);

  // The network is back.
  await page.unroute(BLOCKED);
  await retry.click();
  await expect(page.locator('main h1')).toHaveText('Kepler Orbits', { timeout: 20_000 });
  await expect(page.locator('#layer-panel-play canvas').first()).toBeAttached();
  await expect(page).toHaveTitle('Kepler Orbits · Lodestar');
});

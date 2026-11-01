/**
 * Global setup: every spec starts as a reader who has already answered the
 * statistics question with "No thanks".
 *
 * Without this, the consent bar would sit across the foot of every page in
 * every spec, over the controls those specs click. "Denied" rather than
 * "allowed" so the suite never loads Google's script or sends page views from
 * a test run. `consent.spec.ts` clears this state to test the bar itself.
 */
import { writeFileSync } from 'node:fs';
import type { FullConfig } from '@playwright/test';

export const CONSENT_STATE_FILE = 'test-results/consent-denied.json';

export default function globalSetup(config: FullConfig): void {
  const baseURL = config.projects[0]?.use.baseURL ?? 'https://lodestar-nu-six.vercel.app';
  const origin = new URL(baseURL).origin;
  writeFileSync(
    CONSENT_STATE_FILE,
    JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: 'lodestar-analytics', value: 'denied' }] }] }),
  );
}

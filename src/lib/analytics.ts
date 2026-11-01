/**
 * Anonymous usage statistics, behind an explicit choice.
 *
 * Nothing from Google loads until a reader allows it. The choice is kept in
 * localStorage under one key, so it is asked once per browser, and either
 * answer can be changed on the About page. With no measurement ID configured
 * (see `site.ts`) every function here does nothing.
 *
 * Google's Consent Mode is set to deny everything first, then analytics
 * storage alone is granted. Ad storage, ad user data and ad personalisation
 * stay denied: the site shows no advertising and needs none of them.
 *
 * Page views are sent by hand on each route change, because the site is a
 * single-page app and gtag's automatic page view only sees the first load.
 */
import { GA_MEASUREMENT_ID } from './site';

export type Consent = 'granted' | 'denied';

const STORAGE_KEY = 'lodestar-analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;
let current: Consent | null = readStored();
const listeners = new Set<() => void>();

function readStored(): Consent | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/** Whether statistics can be offered at all on this build. */
export function analyticsAvailable(): boolean {
  return GA_MEASUREMENT_ID !== '';
}

/** The reader's stored choice, or null when they have not been asked yet. */
export function getConsent(): Consent | null {
  return current;
}

/** For `useSyncExternalStore`. */
export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setConsent(choice: Consent): void {
  current = choice;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, choice);
  } catch {
    // Private mode or storage disabled: the choice holds for this visit only.
  }
  if (choice === 'granted') {
    loadAnalytics();
  } else {
    stopAnalytics();
  }
  listeners.forEach((listener) => listener());
}

function gtag(...args: unknown[]): void {
  // gtag.js reads the `arguments` object itself, not an array, so this pushes
  // `arguments` exactly as Google's own snippet does.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer!.push(arguments);
  void args;
}

function loadAnalytics(): void {
  if (loaded || !analyticsAvailable() || typeof document === 'undefined') return;
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });
  gtag('consent', 'update', { analytics_storage: 'granted' });
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);
  trackPageView(location.pathname);
}

/** Stops collection and removes the cookies gtag set on this site. */
function stopAnalytics(): void {
  if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' });
  if (typeof document === 'undefined') return;
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name && (name === '_ga' || name.startsWith('_ga_'))) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${location.hostname}`;
    }
  }
}

/** Sends one page view, only when the reader has allowed statistics. */
export function trackPageView(path: string): void {
  if (!loaded || current !== 'granted') return;
  gtag('event', 'page_view', {
    page_path: path,
    page_location: `${location.origin}${path}`,
    page_title: document.title,
  });
}

/** Call once at start-up: resumes statistics for a reader who already allowed them. */
export function initAnalytics(): void {
  if (current === 'granted') loadAnalytics();
}

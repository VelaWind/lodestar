/**
 * Browser APIs that jsdom does not provide, stubbed for the component tests.
 *
 * Imported first by every `*.test.tsx` file, which also opts into jsdom with an
 * `@vitest-environment` comment. The rest of the suite keeps running in Node.
 *
 * Each stub does the least that lets the real components render:
 *   - `matchMedia` answers "no" to every query, so the app renders as it does
 *     for a reader with motion on and a phone-width screen.
 *   - `ResizeObserver` and `IntersectionObserver` never fire. The sims size their
 *     canvas from them, and nothing here reads a canvas.
 *   - `getContext` returns null, which every sim already treats as "nothing to
 *     draw on". jsdom's own version logs "not implemented" instead.
 *   - `scrollTo` and `scrollIntoView` do nothing: jsdom has no layout to scroll.
 */
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

/*
 * The first render of a module page loads its content and simulation lazily.
 * Testing Library's default one-second wait is enough on an idle machine but
 * not on a busy one: with the CPU loaded, the first test in a file timed out
 * waiting for the heading. Ten seconds is ample, and only a real failure waits
 * that long; the per-test limit for these files is raised to match.
 */
configure({ asyncUtilTimeout: 10_000 });
vi.setConfig({ testTimeout: 20_000 });

class InertObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: InertObserver });
Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: InertObserver });
Object.defineProperty(window, 'scrollTo', { configurable: true, value: () => {} });
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null });

/*
 * The store is a module-level singleton, so without this a slider moved in one
 * test would still be moved in the next. Its initial state is taken once, here,
 * before any test has touched it.
 */
const initialStore = useAppStore.getState();

afterEach(() => {
  cleanup();
  useAppStore.setState(initialStore, true);
  window.localStorage.clear();
  window.sessionStorage.clear();
});

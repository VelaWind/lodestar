/**
 * The motion foundation, checked against the four promises the rest of the
 * visual work will be built on top of:
 *
 *   1. `Reveal` never withholds content. Its children are in the output on the
 *      first render, in every mode, whether or not anything ever animates.
 *   2. `useReducedMotion` fails towards *less* motion. An environment it cannot
 *      question is an environment it does not animate in.
 *   3. `useRafLoop` starts nothing it does not stop, and schedules nothing while
 *      the tab is hidden.
 *   4. The tokens are numbers — the one thing every later pass will assume
 *      without checking, since they end up interpolated into CSS strings where a
 *      `NaN` is silently swallowed by the parser and simply does nothing.
 *
 * The suite runs in a plain Node environment with no DOM, by design (see the
 * note in `vitest.config.ts`), and nothing here changes that. `Reveal` and
 * `useReducedMotion` are exercised through `react-dom/server`, which runs a
 * component's render pass — including `useState` initialisers, which is exactly
 * where both of them decide what to show on the first paint. The rAF loop has
 * no render pass to hook into, so its machinery is driven directly through
 * `__internals` with fakes standing on `globalThis`, the same way the sims
 * expose their drawing to `canvas.test.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DISTANCE, DURATION, EASE } from '@/motion/tokens';
import { Reveal } from '@/motion/Reveal';
import { useReducedMotion } from '@/motion/useReducedMotion';
import { __internals } from '@/motion/useRafLoop';

const { startRafLoop, MAX_DELTA_MS } = __internals;

/* ------------------------------------------------------------------ globals */

const globals = globalThis as unknown as Record<string, unknown>;
let restore: Array<() => void> = [];

/** Install a global for one test, remembering how to put it back. */
function stub(name: string, value: unknown): void {
  const had = name in globals;
  const previous = globals[name];
  restore.push(() => {
    if (had) globals[name] = previous;
    else delete globals[name];
  });
  globals[name] = value;
}

afterEach(() => {
  // Reverse order, so a name stubbed twice unwinds to what it started as.
  for (const undo of restore.reverse()) undo();
  restore = [];
});

/** A `window` whose only job is to answer the reduced-motion query. */
function stubWindow(prefersReduced: boolean): void {
  stub('window', {
    matchMedia: (media: string) => ({
      media,
      matches: prefersReduced,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

/** Enough of an `IntersectionObserver` to exist. Nothing here ever fires it. */
function stubIntersectionObserver(): void {
  stub(
    'IntersectionObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
}

interface FakeRaf {
  /** Frames the browser would still owe the loop. Cancelling removes one. */
  frames: Array<{ id: number; run: (now: number) => void }>;
  cancelled: number[];
  listeners: string[];
}

/** A hand-cranked `requestAnimationFrame` plus the `document` the loop asks. */
function stubRaf(visibilityState: 'visible' | 'hidden'): FakeRaf {
  const state: FakeRaf = { frames: [], cancelled: [], listeners: [] };
  let nextId = 1;

  stub('requestAnimationFrame', (run: (now: number) => void) => {
    const id = nextId++;
    state.frames.push({ id, run });
    return id;
  });
  stub('cancelAnimationFrame', (id: number) => {
    state.cancelled.push(id);
    // A real cancel drops the callback, so the fake has to as well — otherwise
    // "nothing is pending after teardown" is untestable.
    const at = state.frames.findIndex((frame) => frame.id === id);
    if (at >= 0) state.frames.splice(at, 1);
  });
  stub('document', {
    visibilityState,
    addEventListener: (type: string) => state.listeners.push(type),
    removeEventListener: (type: string) => {
      const at = state.listeners.indexOf(type);
      if (at >= 0) state.listeners.splice(at, 1);
    },
  });

  return state;
}

/** Run the pending frame at `now`, failing loudly if there wasn't one. */
function runFrame(state: FakeRaf, now: number): void {
  const frame = state.frames.shift();
  if (!frame) throw new Error(`no frame was scheduled to run at ${now}`);
  frame.run(now);
}

/* ------------------------------------------------------------------- Reveal */

describe('Reveal', () => {
  it('renders its children on the first render under reduced motion', () => {
    stubWindow(true);
    stubIntersectionObserver();

    const markup = renderToStaticMarkup(
      createElement(Reveal, null, createElement('p', null, 'Ganymede')),
    );

    expect(markup).toContain('<p>Ganymede</p>');
    // No transition, and no starting opacity to transition from: reduced motion
    // means the final state is the only state, from the very first paint.
    expect(markup).not.toContain('opacity:0');
    expect(markup).not.toContain('transition');
  });

  it('renders its children on the first render before the observer fires', () => {
    stubWindow(false);
    stubIntersectionObserver();

    const markup = renderToStaticMarkup(
      createElement(Reveal, null, createElement('p', null, 'Ganymede')),
    );

    // The point of the whole component: the text is present in the document
    // while it is still invisible, so nothing that reads the page rather than
    // looking at it is ever waiting on an animation.
    expect(markup).toContain('<p>Ganymede</p>');
    expect(markup).toContain('opacity:0');
    expect(markup).toContain(`translateY(${DISTANCE.rise}px)`);
  });

  it('animates nothing but opacity and transform', () => {
    stubWindow(false);
    stubIntersectionObserver();

    const markup = renderToStaticMarkup(
      createElement(Reveal, {
        distance: DISTANCE.drift,
        delay: DURATION.fast,
        children: 'Callisto',
      }),
    );

    const transition = /transition:([^;"]+)/.exec(markup)?.[1] ?? '';
    expect(transition).not.toBe('');
    const properties = transition.split(/,(?![^(]*\))/).map((part) => part.trim().split(' ')[0]);
    expect(properties.sort()).toEqual(['opacity', 'transform']);
    expect(markup).toContain(`translateY(${DISTANCE.drift}px)`);
    expect(markup).toContain(`${DURATION.fast}ms`);
  });

  it('renders as the element it is asked for, so a list stays a list', () => {
    stubWindow(false);
    stubIntersectionObserver();

    const markup = renderToStaticMarkup(
      createElement('ul', null, createElement(Reveal, { as: 'li', children: 'Io' })),
    );

    // No wrapper between the list and its item: a div there is invalid markup
    // and changes what the list means to a screen reader.
    expect(markup).toMatch(/^<ul><li[^>]*>Io<\/li><\/ul>$/);
    expect(markup).not.toContain('<div');
  });

  it('still animates when rendered as something other than a div', () => {
    stubWindow(false);
    stubIntersectionObserver();

    const markup = renderToStaticMarkup(createElement(Reveal, { as: 'li', children: 'Io' }));

    expect(markup).toContain('opacity:0');
    expect(markup).toContain(`translateY(${DISTANCE.rise}px)`);
  });

  it('falls back to the visible state when there is no IntersectionObserver', () => {
    stubWindow(false);

    const markup = renderToStaticMarkup(createElement(Reveal, null, 'Europa'));

    expect(markup).toContain('Europa');
    expect(markup).not.toContain('opacity:0');
  });
});

/* --------------------------------------------------------- useReducedMotion */

/**
 * Renders the hook's answer rather than assigning it to a variable the test can
 * read. Capturing out of a render pass is a side effect during render, which is
 * both what the hooks lint rule forbids and a genuinely unreliable way to
 * observe a component — reading it back out of the markup is neither.
 */
function Probe() {
  return createElement('i', null, String(useReducedMotion()));
}

function readPreference(): string {
  return renderToStaticMarkup(createElement(Probe));
}

describe('useReducedMotion', () => {
  it('returns true when matchMedia is absent', () => {
    // No `window` stub at all — this is the server-render and old-browser case.
    expect(readPreference()).toBe('<i>true</i>');
  });

  it('returns true when window exists but matchMedia does not', () => {
    stub('window', {});
    expect(readPreference()).toBe('<i>true</i>');
  });

  it('reports the query when matchMedia can answer it', () => {
    stubWindow(false);
    expect(readPreference()).toBe('<i>false</i>');

    stubWindow(true);
    expect(readPreference()).toBe('<i>true</i>');
  });
});

/* ----------------------------------------------------------------- rAF loop */

describe('useRafLoop', () => {
  it('does not schedule a frame while the document is hidden', () => {
    const raf = stubRaf('hidden');

    const stop = startRafLoop(() => {});

    expect(raf.frames).toHaveLength(0);
    // It is listening, though — this is a pause, not a refusal.
    expect(raf.listeners).toContain('visibilitychange');

    stop();
    expect(raf.cancelled).toHaveLength(0);
  });

  it('cancels its pending frame and its listener on teardown', () => {
    const raf = stubRaf('visible');

    const stop = startRafLoop(() => {});
    expect(raf.frames).toHaveLength(1);

    stop();

    expect(raf.cancelled).toEqual([1]);
    expect(raf.listeners).not.toContain('visibilitychange');
  });

  it('keeps exactly one frame in flight and stops scheduling once torn down', () => {
    const raf = stubRaf('visible');
    let ticks = 0;

    const stop = startRafLoop(() => {
      ticks += 1;
    });

    runFrame(raf, 0);
    expect(ticks).toBe(1);
    expect(raf.frames).toHaveLength(1);

    stop();
    // The frame that teardown cancelled must not be replaced by another.
    expect(raf.frames).toHaveLength(0);
  });

  it('clamps the delta so a resumed tab cannot jump', () => {
    const raf = stubRaf('visible');
    const deltas: number[] = [];

    const stop = startRafLoop((delta) => deltas.push(delta));

    runFrame(raf, 0);
    runFrame(raf, 16);
    // Ten minutes in a background tab.
    runFrame(raf, 600_016);

    stop();

    expect(deltas).toEqual([0, 16, MAX_DELTA_MS]);
  });
});

/* ------------------------------------------------------------------- tokens */

describe('motion tokens', () => {
  it('holds only finite, non-negative durations', () => {
    const values = Object.values(DURATION);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('holds only finite distances', () => {
    const values = Object.values(DISTANCE);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(Number.isFinite(value)).toBe(true);
  });

  it('holds four finite control points per easing curve', () => {
    const curves = Object.values(EASE);
    expect(curves.length).toBeGreaterThan(0);
    for (const curve of curves) {
      expect(curve).toHaveLength(4);
      for (const point of curve) expect(Number.isFinite(point)).toBe(true);
    }
  });
});

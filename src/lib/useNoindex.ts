/**
 * Tell a crawler that this address is not a page, on a host that cannot.
 *
 * A static single-page host has no way to answer 404. Every unknown address
 * falls through the catch-all rewrite and is served the app shell with a 200,
 * so `/m/typo` looks to a crawler exactly like a real module: same status, same
 * canonical pointing at a URL that does not exist, indexable. That is a soft
 * 404, and the usual consequence is a search engine carrying dead addresses for
 * a site that never had them.
 *
 * The two things a client can still do are done here: add
 * `<meta name="robots" content="noindex">`, and take away the canonical the
 * build wrote into every shell — a canonical on a not-found page is a claim
 * that the address is the page of record, which is the opposite of true.
 *
 * Both are undone on unmount, and the canonical goes back to the exact position
 * it held rather than being appended, so navigating from a bad address to a
 * real module leaves a head indistinguishable from one served directly. The
 * e2e asserts that round trip, because "restores on unmount" is the half of
 * this that would rot silently.
 */
import { useEffect } from 'react';

export function useNoindex(): void {
  useEffect(() => {
    const head = document.head;

    const meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    meta.setAttribute('content', 'noindex');
    head.appendChild(meta);

    const canonical = head.querySelector('link[rel="canonical"]');
    const parent = canonical?.parentNode ?? null;
    // Remembered before removal: `nextSibling` is null once the node is out.
    const nextSibling = canonical?.nextSibling ?? null;
    canonical?.remove();

    return () => {
      meta.remove();
      if (canonical && parent) parent.insertBefore(canonical, nextSibling);
    };
  }, []);
}

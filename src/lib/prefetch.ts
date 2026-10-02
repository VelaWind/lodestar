/**
 * Start fetching a module's data the moment a reader shows intent to follow a
 * link to it: pointer over, keyboard focus, or a finger down. That is usually
 * a few hundred milliseconds before the click, and the data is a few kilobytes,
 * so the next page is normally in memory when it is asked for, and the
 * navigation is as instant as it was when every module shipped in the entry.
 */
import { prefetchModule } from '@/content/catalog';

export function prefetchOnIntent(id: string) {
  const start = () => prefetchModule(id);
  return { onPointerEnter: start, onFocus: start, onTouchStart: start };
}

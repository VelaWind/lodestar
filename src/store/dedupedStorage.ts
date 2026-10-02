/**
 * A storage that writes only what differs from what it last read or wrote.
 *
 * Zustand's `persist` calls `setItem` after every state change, and the store
 * changes on every slider tick, though only the reading tier is persisted. The
 * persisted value is a few bytes of JSON, so comparing strings costs nothing,
 * while a localStorage write is synchronous and goes to disk.
 */
import type { StateStorage } from 'zustand/middleware';

export function dedupedStorage(storage: StateStorage<void>): StateStorage<void> {
  const last = new Map<string, string>();
  return {
    getItem: (name) => {
      const value = storage.getItem(name) as string | null;
      if (value !== null) last.set(name, value);
      return value;
    },
    setItem: (name, value) => {
      if (last.get(name) === value) return;
      last.set(name, value);
      storage.setItem(name, value);
    },
    removeItem: (name) => {
      last.delete(name);
      storage.removeItem(name);
    },
  };
}

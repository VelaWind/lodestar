/**
 * Global state. Two concerns only:
 *
 *   1. depth tier — a reading preference, so it persists across sessions.
 *   2. live param values per module — deliberately *not* persisted. Reloading
 *      a page and finding the planet at yesterday's mass is disorienting;
 *      sims should always open at the canonical defaults.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Param, ParamValues } from '@/content/types';
import { clampToParam } from '@/lib/format';
import type { DepthTier } from '@/lib/layers';

interface AppState {
  tier: DepthTier;
  setTier: (tier: DepthTier) => void;

  /** moduleId → paramId → SI value */
  params: Record<string, ParamValues>;
  /** Idempotent: seeds any param not already present. Safe to call every render. */
  ensureModuleParams: (moduleId: string, params: Param[]) => void;
  setParam: (moduleId: string, param: Param, value: number) => void;
  resetModuleParams: (moduleId: string, params: Param[]) => void;
}

export function defaultsOf(params: Param[]): ParamValues {
  return Object.fromEntries(params.map((p) => [p.id, p.default]));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tier: 'curious',
      setTier: (tier) => set({ tier }),

      params: {},

      ensureModuleParams: (moduleId, params) => {
        const existing = get().params[moduleId];
        const missing = params.filter((p) => existing?.[p.id] === undefined);
        if (existing && missing.length === 0) return;
        set((s) => ({
          params: {
            ...s.params,
            [moduleId]: { ...defaultsOf(missing), ...existing },
          },
        }));
      },

      setParam: (moduleId, param, value) =>
        set((s) => ({
          params: {
            ...s.params,
            [moduleId]: {
              ...s.params[moduleId],
              [param.id]: clampToParam(param, value),
            },
          },
        })),

      resetModuleParams: (moduleId, params) =>
        set((s) => ({ params: { ...s.params, [moduleId]: defaultsOf(params) } })),
    }),
    {
      name: 'lodestar:prefs',
      version: 1,
      // Only the reading preference survives a reload.
      partialize: (s) => ({ tier: s.tier }),
    },
  ),
);

export const useTier = () => useAppStore((s) => s.tier);

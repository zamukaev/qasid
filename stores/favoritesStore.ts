import { create } from "zustand";
import { Nasheed } from "../types/nasheed";
import {
  fetchFavoriteIds,
  toggleFavorite,
} from "../services/favorites-service";

interface FavoritesState {
  /** Favorited nasheed doc ids. */
  ids: Set<string>;
  /** Ids with a Firestore write in flight, so a double tap writes once. */
  pending: Set<string>;
  hydrated: boolean;
  hydrate: (force?: boolean) => Promise<void>;
  toggle: (nasheed: Nasheed) => Promise<void>;
  clear: () => void;
}

/**
 * Shared across every caller of `hydrate` so screens mounting at the same time
 * issue a single Firestore read instead of one each.
 */
let inFlightHydration: Promise<void> | null = null;

/**
 * Bumped by `clear()` so a read that was already in flight at sign-out cannot
 * repopulate the store with the previous user's favorites when it resolves.
 */
let generation = 0;

const withId = (source: Set<string>, id: string, present: boolean) => {
  const next = new Set(source);
  if (present) next.add(id);
  else next.delete(id);
  return next;
};

/**
 * Shared so a heart reflects the real state the moment a screen paints.
 * Screens used to each fetch their own id set after painting the list, which
 * left every heart rendering its stale mount-time value.
 *
 * `ids` and `pending` are always replaced with a new Set — Zustand compares
 * by reference, so mutating in place would not notify subscribers.
 */
export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set(),
  pending: new Set(),
  hydrated: false,

  hydrate: async (force = false) => {
    if (!force && get().hydrated) return;
    if (inFlightHydration) return inFlightHydration;

    const requestGeneration = generation;
    inFlightHydration = (async () => {
      try {
        const ids = await fetchFavoriteIds();
        if (requestGeneration !== generation) return;
        set({ ids, hydrated: true });
      } finally {
        if (requestGeneration === generation) inFlightHydration = null;
      }
    })();

    return inFlightHydration;
  },

  toggle: async (nasheed) => {
    const { ids, pending } = get();
    if (pending.has(nasheed.id)) return;

    const nextFavorited = !ids.has(nasheed.id);
    const requestGeneration = generation;

    // Optimistic, reconciled with the server result below.
    set({
      ids: withId(ids, nasheed.id, nextFavorited),
      pending: withId(pending, nasheed.id, true),
    });

    try {
      const favorited = await toggleFavorite(nasheed);
      if (requestGeneration !== generation) return;
      set((state) => ({ ids: withId(state.ids, nasheed.id, favorited) }));
    } catch (e) {
      console.warn("toggleFavorite failed", e);
      if (requestGeneration !== generation) return;
      set((state) => ({ ids: withId(state.ids, nasheed.id, !nextFavorited) }));
    } finally {
      set((state) => ({ pending: withId(state.pending, nasheed.id, false) }));
    }
  },

  clear: () => {
    generation += 1;
    inFlightHydration = null;
    set({ ids: new Set(), pending: new Set(), hydrated: false });
  },
}));

// Per-id subscription, so toggling one favorite re-renders one heart rather
// than every row of the list.
export const useIsFavorite = (nasheedId: string) =>
  useFavoritesStore((s) => s.ids.has(nasheedId));

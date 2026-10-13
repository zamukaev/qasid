import { create } from "zustand";

import {
  UserPlaylist,
  UserPlaylistDraft,
  UserPlaylistTrackInput,
} from "../types/userPlaylist";
import {
  BulkAddResult,
  addTrackToPlaylist,
  addTracksToPlaylist,
  createUserPlaylist,
  deletePlaylistImage,
  deleteUserPlaylist,
  fetchUserPlaylists,
  removeTrackFromPlaylist,
  updateUserPlaylist,
  uploadPlaylistImage,
} from "../services/user-playlists-service";

/** What the edit form hands over: `imageUri` is a new local pick, null removes. */
export type PlaylistEdit = UserPlaylistDraft & { imageUri?: string | null };

interface UserPlaylistsState {
  /** Most recently changed first, the order the rails show them in. */
  playlists: UserPlaylist[];
  hydrated: boolean;
  hydrate: (force?: boolean) => Promise<void>;
  create: (edit: PlaylistEdit) => Promise<UserPlaylist>;
  update: (playlistId: string, edit: PlaylistEdit) => Promise<void>;
  remove: (playlistId: string) => Promise<void>;
  /** Resolves false when the track was already in the playlist. */
  /** Adds what is not there yet and fits into `capacity`. */
  addTracks: (
    playlistId: string,
    items: readonly UserPlaylistTrackInput[],
    capacity: number,
  ) => Promise<BulkAddResult>;
  addTrack: (
    playlistId: string,
    item: UserPlaylistTrackInput,
  ) => Promise<boolean>;
  removeTrack: (playlistId: string, trackKey: string) => Promise<void>;
  clear: () => void;
}

let inFlightHydration: Promise<void> | null = null;

/**
 * Bumped by `clear()` so a write or read still in flight at sign-out cannot
 * put the previous user's playlists back into the store.
 */
let generation = 0;

const byRecency = (a: UserPlaylist, b: UserPlaylist) =>
  b.updatedAt - a.updatedAt;

const patched = (
  playlists: UserPlaylist[],
  playlistId: string,
  patch: Partial<UserPlaylist>,
) =>
  playlists
    .map((p) => (p.id === playlistId ? { ...p, ...patch } : p))
    .sort(byRecency);

export const useUserPlaylistsStore = create<UserPlaylistsState>((set, get) => ({
  playlists: [],
  hydrated: false,

  hydrate: async (force = false) => {
    if (!force && get().hydrated) return;
    if (inFlightHydration) return inFlightHydration;

    const requestGeneration = generation;
    inFlightHydration = (async () => {
      try {
        const playlists = await fetchUserPlaylists();
        if (requestGeneration !== generation) return;
        set({ playlists, hydrated: true });
      } finally {
        if (requestGeneration === generation) inFlightHydration = null;
      }
    })();

    return inFlightHydration;
  },

  create: async ({ title, description, image_path, imageUri }) => {
    const requestGeneration = generation;
    let playlist = await createUserPlaylist({ title, description, image_path });
    if (imageUri) {
      // The playlist exists either way; a failed upload just leaves the collage.
      try {
        const image_path = await uploadPlaylistImage(playlist.id, imageUri);
        await updateUserPlaylist(playlist.id, { image_path });
        playlist = { ...playlist, image_path };
      } catch (e) {
        console.warn("uploadPlaylistImage failed", e);
      }
    }
    if (requestGeneration === generation) {
      set((state) => ({ playlists: [playlist, ...state.playlists] }));
    }
    return playlist;
  },

  update: async (playlistId, { title, description, imageUri }) => {
    const requestGeneration = generation;
    let image_path: string | null | undefined;
    if (imageUri) {
      image_path = await uploadPlaylistImage(playlistId, imageUri);
    } else if (imageUri === null) {
      await deletePlaylistImage(playlistId);
      image_path = null;
    }
    await updateUserPlaylist(playlistId, {
      title,
      description: description ?? "",
      image_path,
    });
    if (requestGeneration !== generation) return;
    set((state) => ({
      playlists: patched(state.playlists, playlistId, {
        title,
        description: description || undefined,
        ...(image_path !== undefined
          ? { image_path: image_path ?? undefined }
          : {}),
        updatedAt: Date.now(),
      }),
    }));
  },

  remove: async (playlistId) => {
    const previous = get().playlists;
    set({ playlists: previous.filter((p) => p.id !== playlistId) });
    try {
      await deleteUserPlaylist(playlistId);
    } catch (e) {
      set({ playlists: previous });
      throw e;
    }
  },

  addTracks: async (playlistId, items, capacity) => {
    const requestGeneration = generation;
    const result = await addTracksToPlaylist(playlistId, items, capacity);
    if (result.added > 0 && requestGeneration === generation) {
      set((state) => ({
        playlists: patched(state.playlists, playlistId, result.next),
      }));
    }
    return result;
  },

  addTrack: async (playlistId, item) => {
    const requestGeneration = generation;
    const next = await addTrackToPlaylist(playlistId, item);
    if (!next) return false;
    if (requestGeneration === generation) {
      set((state) => ({
        playlists: patched(state.playlists, playlistId, next),
      }));
    }
    return true;
  },

  removeTrack: async (playlistId, trackKey) => {
    const requestGeneration = generation;
    const next = await removeTrackFromPlaylist(playlistId, trackKey);
    if (!next || requestGeneration !== generation) return;
    set((state) => ({ playlists: patched(state.playlists, playlistId, next) }));
  },

  clear: () => {
    generation += 1;
    inFlightHydration = null;
    set({ playlists: [], hydrated: false });
  },
}));

export const useUserPlaylist = (playlistId: string) =>
  useUserPlaylistsStore((s) => s.playlists.find((p) => p.id === playlistId));

import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {
  GeneratedPlaylist,
  RecommendedTrack,
  WeeklyMix,
} from "../types/nasheed";

const FIREBASE_PROJECT_ID = "qasid-fd80d";
const GENERATE_WEEKLY_MIX_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/generateWeeklyMix`;

// Triggers server-side (re)generation of the caller's weekly mix and returns
// the fresh tracks. Authenticated via the Firebase ID token.
export async function generateWeeklyMix(): Promise<RecommendedTrack[]> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Sign in required");

  const token = await user.getIdToken();
  const response = await fetch(GENERATE_WEEKLY_MIX_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to generate weekly mix (${response.status})`);
  }
  const data = (await response.json()) as { tracks?: RecommendedTrack[] };
  return data.tracks ?? [];
}

// Reads the last-generated weekly mix from Firestore (no recompute).
export async function fetchWeeklyMix(): Promise<WeeklyMix | null> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return null;

  const db = getFirestore(getApp());
  const snap = await getDoc(doc(db, "user_recommendations", userId));
  if (!snap.exists()) return null;
  const mix = snap.data()?.weekly_mix;
  if (!mix) return null;
  return {
    tracks: Array.isArray(mix.tracks) ? mix.tracks : [],
    track_count: mix.track_count ?? 0,
    seed: mix.seed,
  };
}

// The backend regenerates these once every 24 h, so a short in-memory TTL costs
// nothing in freshness and spares the home tab a ~200 KB re-download on every
// mount. Deliberately not persisted: 7 docs with ~400 embedded tracks between
// them is more JSON than is worth parsing on every cold start.
const GENERATED_PLAYLISTS_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  at: number;
  data: T;
}

let playlistsCache: CacheEntry<GeneratedPlaylist[]> | null = null;
const playlistByKeyCache = new Map<string, CacheEntry<GeneratedPlaylist>>();

const isFresh = (entry: { at: number } | null | undefined): boolean =>
  !!entry && Date.now() - entry.at < GENERATED_PLAYLISTS_TTL_MS;

export interface FetchOptions {
  /** Bypass the cache — pull-to-refresh passes this. */
  force?: boolean;
}

export async function fetchGeneratedPlaylists(
  options?: FetchOptions,
): Promise<GeneratedPlaylist[]> {
  if (!options?.force && isFresh(playlistsCache)) {
    return playlistsCache!.data;
  }

  const db = getFirestore(getApp());
  const q = query(
    collection(db, "generated_playlists"),
    where("is_active", "==", true),
  );
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(
    (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      ({ key: d.id, ...d.data() }) as GeneratedPlaylist,
  );

  const at = Date.now();
  playlistsCache = { at, data };
  // These docs already carry their full track arrays, so opening a playlist
  // from a home-screen rail needs no further reads at all.
  for (const playlist of data) {
    playlistByKeyCache.set(playlist.key, { at, data: playlist });
  }
  return data;
}

export async function fetchGeneratedPlaylistByKey(
  key: string,
  options?: FetchOptions,
): Promise<GeneratedPlaylist | null> {
  const cached = playlistByKeyCache.get(key);
  if (!options?.force && isFresh(cached)) {
    return cached!.data;
  }

  const db = getFirestore(getApp());
  const snap = await getDoc(doc(db, "generated_playlists", key));
  if (!snap.exists()) return null;
  const playlist = { key: snap.id, ...snap.data() } as GeneratedPlaylist;
  playlistByKeyCache.set(key, { at: Date.now(), data: playlist });
  return playlist;
}

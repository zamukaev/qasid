import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  query,
  collection,
  where,
  getDocs,
  getDoc,
  doc,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {
  CollectionDoc,
  freshTracks,
  isCollectionShelf,
} from "../utils/collections";

// Collections change only when `npm run collections:build` runs.
const COLLECTIONS_TTL_MS = 30 * 60 * 1000;

interface CacheEntry<T> {
  at: number;
  data: T;
}

let collectionsCache: CacheEntry<CollectionDoc[]> | null = null;
const collectionByIdCache = new Map<string, CacheEntry<CollectionDoc>>();

const isFresh = (entry: { at: number } | null | undefined): boolean =>
  !!entry && Date.now() - entry.at < COLLECTIONS_TTL_MS;

// Null for a shelf this build doesn't know, so a shelf added for a later
// release never shows up under the wrong title here.
const toCollectionDoc = (
  snap: FirebaseFirestoreTypes.DocumentSnapshot,
): CollectionDoc | null => {
  const data = snap.data() ?? {};
  if (!isCollectionShelf(data.shelf)) return null;
  const allTracks = Array.isArray(data.tracks) ? data.tracks : [];
  const freshDays =
    typeof data.fresh_days === "number" ? data.fresh_days : undefined;
  const tracks =
    freshDays === undefined ? allTracks : freshTracks(allTracks, freshDays);
  return {
    id: snap.id,
    name_en: typeof data.name_en === "string" ? data.name_en : "",
    name_ar: typeof data.name_ar === "string" ? data.name_ar : "",
    desc: typeof data.desc === "string" ? data.desc : "",
    image_path: typeof data.image_path === "string" ? data.image_path : "",
    shelf: data.shelf,
    sort_order: typeof data.sort_order === "number" ? data.sort_order : 0,
    is_active: data.is_active === true,
    tracks,
    track_count: tracks.length,
    fresh_days: freshDays,
  };
};

export interface FetchOptions {
  /** Bypass the cache — pull-to-refresh passes this. */
  force?: boolean;
}

export async function fetchCollections(
  options?: FetchOptions,
): Promise<CollectionDoc[]> {
  if (!options?.force && isFresh(collectionsCache)) {
    return collectionsCache!.data;
  }

  const db = getFirestore(getApp());
  const snapshot = await getDocs(
    query(collection(db, "collections"), where("is_active", "==", true)),
  );
  const data = snapshot.docs
    .map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => toCollectionDoc(d))
    .filter((c: CollectionDoc | null): c is CollectionDoc => c !== null);

  const at = Date.now();
  collectionsCache = { at, data };
  // Docs carry their full track arrays, so opening one from a rail needs no
  // further reads.
  for (const c of data) {
    collectionByIdCache.set(c.id, { at, data: c });
  }
  return data;
}

export async function fetchCollectionById(
  id: string,
  options?: FetchOptions,
): Promise<CollectionDoc | null> {
  const cached = collectionByIdCache.get(id);
  if (!options?.force && isFresh(cached)) {
    return cached!.data;
  }

  const db = getFirestore(getApp());
  const snap = await getDoc(doc(db, "collections", id));
  if (!snap.exists()) return null;
  const data = toCollectionDoc(snap);
  if (!data) return null;
  collectionByIdCache.set(id, { at: Date.now(), data });
  return data;
}

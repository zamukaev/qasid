import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  deleteField,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {
  getStorage,
  ref,
  putFile,
  deleteObject,
} from "@react-native-firebase/storage";

import { accountUid } from "../utils/accountUid";
import {
  COVER_COLLAGE_SIZE,
  MAX_PLAYLIST_TRACKS,
  BulkAddPlan,
  coverPathsAfterAdd,
  coverPathsFrom,
  normalizeDescription,
  planBulkAdd,
  trackKeyFor,
} from "../utils/user-playlists";
import {
  UserPlaylist,
  UserPlaylistDraft,
  UserPlaylistTrack,
  UserPlaylistTrackInput,
} from "../types/userPlaylist";

// Generous for a personal library, but keeps the list a single bounded read.
const MAX_PLAYLISTS = 100;

type DocData = FirebaseFirestoreTypes.DocumentData;

function requireUid(): string {
  const uid = accountUid();
  if (!uid) throw new Error("Sign in required");
  return uid;
}

function playlistsCollection(uid: string) {
  return collection(getFirestore(getApp()), "user_playlists", uid, "playlists");
}

function playlistDoc(uid: string, playlistId: string) {
  return doc(playlistsCollection(uid), playlistId);
}

function tracksCollection(uid: string, playlistId: string) {
  return collection(playlistDoc(uid, playlistId), "tracks");
}

function imageStoragePath(uid: string, playlistId: string) {
  return `users/${uid}/playlists/${playlistId}.jpg`;
}

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";
const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

function toPlaylist(id: string, data: DocData): UserPlaylist {
  return {
    id,
    title: asString(data.title),
    description: asString(data.description) || undefined,
    image_path: asString(data.image_path) || undefined,
    cover_paths: Array.isArray(data.cover_paths)
      ? data.cover_paths.filter(
          (p: unknown): p is string => typeof p === "string",
        )
      : [],
    track_count: asNumber(data.track_count),
    createdAt: asNumber(data.createdAt),
    updatedAt: asNumber(data.updatedAt),
  };
}

function toTrack(key: string, data: DocData): UserPlaylistTrack | null {
  const base = {
    key,
    addedAt: asNumber(data.addedAt),
    title: asString(data.title),
    subtitle: asString(data.subtitle),
    image_path: asString(data.image_path) || undefined,
    audio_path: asString(data.audio_path),
  };
  if (data.kind === "nasheed") {
    return {
      ...base,
      kind: "nasheed",
      nasheed_id: asString(data.nasheed_id),
      artist_id: asString(data.artist_id),
      moods: Array.isArray(data.moods) ? data.moods : [],
    };
  }
  if (data.kind === "surah") {
    return {
      ...base,
      kind: "surah",
      reciter_id: asString(data.reciter_id),
      surah_id: asString(data.surah_id),
      surah_number: asNumber(data.surah_number),
    };
  }
  return null;
}

/** Firestore rejects `undefined` values, so optional fields are left out. */
function trackDocData(item: UserPlaylistTrackInput, addedAt: number): DocData {
  const data: DocData = { ...item, addedAt };
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }
  return data;
}

export async function fetchUserPlaylists(): Promise<UserPlaylist[]> {
  const uid = accountUid();
  if (!uid) return [];
  const snapshot = await getDocs(
    query(
      playlistsCollection(uid),
      orderBy("updatedAt", "desc"),
      limit(MAX_PLAYLISTS),
    ),
  );
  return snapshot.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
    toPlaylist(d.id, d.data()),
  );
}

export async function fetchUserPlaylist(
  playlistId: string,
): Promise<UserPlaylist | null> {
  const uid = accountUid();
  if (!uid) return null;
  const snapshot = await getDoc(playlistDoc(uid, playlistId));
  return snapshot.exists()
    ? toPlaylist(snapshot.id, snapshot.data() ?? {})
    : null;
}

export async function fetchUserPlaylistTracks(
  playlistId: string,
): Promise<UserPlaylistTrack[]> {
  const uid = accountUid();
  if (!uid) return [];
  const snapshot = await getDocs(
    query(
      tracksCollection(uid, playlistId),
      orderBy("addedAt", "asc"),
      limit(MAX_PLAYLIST_TRACKS),
    ),
  );
  return snapshot.docs
    .map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      toTrack(d.id, d.data()),
    )
    .filter(
      (t: UserPlaylistTrack | null): t is UserPlaylistTrack => t !== null,
    );
}

/** Ids of the playlists that already contain `item`. */
export async function fetchMembership(
  playlistIds: readonly string[],
  item: UserPlaylistTrackInput,
): Promise<Set<string>> {
  const uid = accountUid();
  if (!uid) return new Set();
  const key = trackKeyFor(item);
  const results = await Promise.all(
    playlistIds.map(async (id) => {
      const snapshot = await getDoc(doc(tracksCollection(uid, id), key));
      return snapshot.exists() ? id : null;
    }),
  );
  return new Set(results.filter((id): id is string => id !== null));
}

export async function createUserPlaylist(
  draft: UserPlaylistDraft,
): Promise<UserPlaylist> {
  const uid = requireUid();
  const ref = doc(playlistsCollection(uid));
  const now = Date.now();
  const description = normalizeDescription(draft.description);
  const data: DocData = {
    title: draft.title,
    cover_paths: [],
    track_count: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (description) data.description = description;
  if (draft.image_path) data.image_path = draft.image_path;

  await setDoc(ref, data);
  return toPlaylist(ref.id, data);
}

export async function updateUserPlaylist(
  playlistId: string,
  changes: { title?: string; description?: string; image_path?: string | null },
): Promise<void> {
  const uid = requireUid();
  const data: DocData = { updatedAt: Date.now() };
  if (changes.title !== undefined) data.title = changes.title;
  if (changes.description !== undefined) {
    const description = normalizeDescription(changes.description);
    data.description = description || deleteField();
  }
  if (changes.image_path !== undefined) {
    data.image_path = changes.image_path ?? deleteField();
  }
  await updateDoc(playlistDoc(uid, playlistId), data);
}

/** Uploads the picked image and returns its Storage path. */
export async function uploadPlaylistImage(
  playlistId: string,
  localUri: string,
): Promise<string> {
  const uid = requireUid();
  const path = imageStoragePath(uid, playlistId);
  await putFile(ref(getStorage(getApp()), path), localUri, {
    contentType: "image/jpeg",
  });
  return path;
}

export async function deletePlaylistImage(playlistId: string): Promise<void> {
  const uid = requireUid();
  try {
    await deleteObject(
      ref(getStorage(getApp()), imageStoragePath(uid, playlistId)),
    );
  } catch {
    // Already gone, or never uploaded.
  }
}

export async function deleteUserPlaylist(playlistId: string): Promise<void> {
  const uid = requireUid();
  const tracks = await getDocs(tracksCollection(uid, playlistId));
  // Firestore allows 500 writes per batch; a playlist holds at most
  // MAX_PLAYLIST_TRACKS, so one batch covers every track plus the doc.
  const batch = writeBatch(getFirestore(getApp()));
  tracks.docs.forEach((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
    batch.delete(d.ref),
  );
  batch.delete(playlistDoc(uid, playlistId));
  await batch.commit();
  await deletePlaylistImage(playlistId);
}

export type BulkAddResult = Pick<BulkAddPlan, "overflow"> & {
  added: number;
  next: Pick<UserPlaylist, "track_count" | "cover_paths" | "updatedAt">;
};

/**
 * Adds every track of `items` not yet in the playlist, as many as fit into
 * `capacity`. One transaction, so counters and collage stay exact.
 */
export async function addTracksToPlaylist(
  playlistId: string,
  items: readonly UserPlaylistTrackInput[],
  capacity: number,
): Promise<BulkAddResult> {
  const uid = requireUid();
  const db = getFirestore(getApp());
  const playlistRef = playlistDoc(uid, playlistId);
  const tracksRef = tracksCollection(uid, playlistId);

  return runTransaction(db, async (tx) => {
    const playlistSnap = await tx.get(playlistRef);
    if (!playlistSnap.exists()) throw new Error("Playlist not found");
    const playlist = toPlaylist(playlistSnap.id, playlistSnap.data() ?? {});

    const keys = [...new Set(items.map(trackKeyFor))];
    const snaps = await Promise.all(
      keys.map((key) => tx.get(doc(tracksRef, key))),
    );
    const existingKeys = new Set(
      snaps.filter((snap) => snap.exists()).map((snap) => snap.id),
    );

    const { toAdd, overflow } = planBulkAdd({
      items,
      existingKeys,
      trackCount: playlist.track_count,
      capacity,
    });

    // Strictly increasing, so the playlist keeps the order they were given in.
    const startedAt = Date.now();
    let cover_paths = playlist.cover_paths;
    toAdd.forEach((item, index) => {
      tx.set(
        doc(tracksRef, trackKeyFor(item)),
        trackDocData(item, startedAt + index),
      );
      cover_paths = coverPathsAfterAdd(cover_paths, item.image_path);
    });
    const next = {
      track_count: playlist.track_count + toAdd.length,
      cover_paths,
      updatedAt: startedAt + toAdd.length,
    };
    if (toAdd.length > 0) tx.update(playlistRef, next);
    return { added: toAdd.length, overflow, next };
  });
}

/**
 * Adds `item` unless it is already there. Transactional so the stored
 * `track_count` and collage stay exact under double taps.
 * Returns the updated counters, or null when the track was already present.
 */
export async function addTrackToPlaylist(
  playlistId: string,
  item: UserPlaylistTrackInput,
): Promise<Pick<
  UserPlaylist,
  "track_count" | "cover_paths" | "updatedAt"
> | null> {
  const uid = requireUid();
  const db = getFirestore(getApp());
  const playlistRef = playlistDoc(uid, playlistId);
  const trackRef = doc(tracksCollection(uid, playlistId), trackKeyFor(item));

  return runTransaction(db, async (tx) => {
    const [playlistSnap, trackSnap] = await Promise.all([
      tx.get(playlistRef),
      tx.get(trackRef),
    ]);
    if (!playlistSnap.exists()) throw new Error("Playlist not found");
    if (trackSnap.exists()) return null;

    const playlist = toPlaylist(playlistSnap.id, playlistSnap.data() ?? {});
    if (playlist.track_count >= MAX_PLAYLIST_TRACKS) {
      throw new Error("Playlist is full");
    }
    const now = Date.now();
    const next = {
      track_count: playlist.track_count + 1,
      cover_paths: coverPathsAfterAdd(playlist.cover_paths, item.image_path),
      updatedAt: now,
    };
    tx.set(trackRef, trackDocData(item, now));
    tx.update(playlistRef, next);
    return next;
  });
}

/**
 * Removes the track and, when its artwork was part of the collage, rebuilds
 * the collage from the tracks that remain.
 */
export async function removeTrackFromPlaylist(
  playlistId: string,
  trackKey: string,
): Promise<Pick<
  UserPlaylist,
  "track_count" | "cover_paths" | "updatedAt"
> | null> {
  const uid = requireUid();
  const db = getFirestore(getApp());
  const playlistRef = playlistDoc(uid, playlistId);
  const trackRef = doc(tracksCollection(uid, playlistId), trackKey);

  const result = await runTransaction(db, async (tx) => {
    const [playlistSnap, trackSnap] = await Promise.all([
      tx.get(playlistRef),
      tx.get(trackRef),
    ]);
    if (!playlistSnap.exists() || !trackSnap.exists()) return null;

    const playlist = toPlaylist(playlistSnap.id, playlistSnap.data() ?? {});
    const removedImage = asString(trackSnap.data()?.image_path);
    const next = {
      track_count: Math.max(0, playlist.track_count - 1),
      cover_paths: playlist.cover_paths,
      updatedAt: Date.now(),
    };
    tx.delete(trackRef);
    tx.update(playlistRef, {
      track_count: next.track_count,
      updatedAt: next.updatedAt,
    });
    return { next, coverChanged: playlist.cover_paths.includes(removedImage) };
  });
  if (!result) return null;
  if (!result.coverChanged) return result.next;

  // A few spare rows, since several leading tracks may share one artwork.
  const remaining = await getDocs(
    query(
      tracksCollection(uid, playlistId),
      orderBy("addedAt", "asc"),
      limit(COVER_COLLAGE_SIZE * 3),
    ),
  );
  const cover_paths = coverPathsFrom(
    remaining.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
      image_path: asString(d.data().image_path) || undefined,
    })),
  );
  await updateDoc(playlistRef, { cover_paths });
  return { ...result.next, cover_paths };
}

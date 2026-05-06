import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  query,
  collection,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp,
  FirebaseFirestoreTypes,
  limit,
  startAfter,
  orderBy,
} from "@react-native-firebase/firestore";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import {
  NasheedArtist,
  ArtistCursor,
  ResponseArtists,
  Nasheed,
  NasheedCursor,
} from "../types/nasheed";

const FIREBASE_PROJECT_ID = "qasid-fd80d";
const SEARCH_ARTISTS_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/searchArtists`;
const SEARCH_BATCH_SIZE = 50;
const MAX_SEARCH_SCAN_PAGES = 10;
const NEW_ARTIST_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const toMillis = (value: unknown): number | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).toDate === "function"
  )
    return (value as any).toDate().getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const isRecentArtist = (data: {
  publishedAt?: unknown;
  createdAt?: unknown;
}) => {
  const t = toMillis(data.publishedAt ?? data.createdAt);
  return t !== undefined && Date.now() - t <= NEW_ARTIST_WINDOW_MS;
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

export async function fetchNasheedArtists(
  pageSize: number = 20,
  cursor?: ArtistCursor,
): Promise<ResponseArtists> {
  const db = getFirestore(getApp());
  const base = [
    collection(db, "artists"),
    where("is_active", "==", true),
    orderBy("name_en"),
    orderBy("__name__"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    q = query(...base, startAfter(cursor.name_en, cursor.id));
  } else {
    q = query(...base);
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const artists: NasheedArtist[] = docs.map(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }),
  ) as NasheedArtist[];

  const lastDoc = docs.length ? docs[docs.length - 1] : undefined;
  const nextCursor = lastDoc
    ? { name_en: (lastDoc.data() as any).name_en, id: lastDoc.id }
    : undefined;

  return { artists, nextCursor };
}

export async function fetchFilteredArtists(
  search: string,
  pageSize: number = 20,
  cursor?: ArtistCursor,
): Promise<ResponseArtists> {
  const trimmedSearch = search.trim();
  const params = new URLSearchParams({
    search: trimmedSearch,
    pageSize: String(pageSize),
  });

  if (cursor?.id && cursor?.name_en !== undefined) {
    params.set("cursorId", cursor.id);
    params.set("cursorNameEn", cursor.name_en);
  }

  try {
    const response = await fetch(`${SEARCH_ARTISTS_URL}?${params.toString()}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn("searchArtists HTTP fallback triggered:", errorBody);
      return fetchFilteredArtistsFallback(trimmedSearch, pageSize, cursor);
    }

    const payload = (await response.json()) as ResponseArtists;

    return {
      artists: Array.isArray(payload.artists) ? payload.artists : [],
      nextCursor: payload.nextCursor,
    };
  } catch (e) {
    console.warn("searchArtists fetch error, using fallback:", e);
    return fetchFilteredArtistsFallback(trimmedSearch, pageSize, cursor);
  }
}

export async function fetchPopularArtists(
  pageSize: number = 10,
): Promise<NasheedArtist[]> {
  const db = getFirestore(getApp());
  const q = query(
    collection(db, "artists"),
    orderBy("popularity_score", "desc"),
    limit(pageSize),
  );
  const snapshot = await getDocs(q);
  const mapped: NasheedArtist[] = snapshot.docs.map(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      ({ id: doc.id, ...doc.data() }) as NasheedArtist,
  );

  return mapped.filter((a: NasheedArtist) => (a.popularity_score ?? 0) > 0);
}

export async function fetchNewArtists(
  pageSize: number = 10,
): Promise<NasheedArtist[]> {
  const db = getFirestore(getApp());
  const q = query(
    collection(db, "artists"),
    orderBy("publishedAt", "desc"),
    limit(pageSize * 3),
  );
  const snapshot = await getDocs(q);
  const mapped: NasheedArtist[] = snapshot.docs.map(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      ({ id: doc.id, ...doc.data() }) as NasheedArtist,
  );
  return mapped
    .filter((a: NasheedArtist) =>
      isRecentArtist({ publishedAt: a.publishedAt, createdAt: a.createdAt }),
    )
    .slice(0, pageSize);
}

async function fetchFilteredArtistsFallback(
  search: string,
  pageSize: number = 20,
  cursor?: ArtistCursor,
): Promise<ResponseArtists> {
  const normalizedSearch = normalizeSearchText(search);
  const artists: NasheedArtist[] = [];
  let currentCursor = cursor;
  let pagesScanned = 0;
  let hasMore = true;

  while (
    artists.length < pageSize &&
    hasMore &&
    pagesScanned < MAX_SEARCH_SCAN_PAGES
  ) {
    const response = await fetchNasheedArtists(
      SEARCH_BATCH_SIZE,
      currentCursor,
    );

    const matching = response.artists.filter((artist) => {
      const nameEn = normalizeSearchText(artist.name_en ?? "");
      const nameAr = normalizeSearchText(artist.name_ar ?? "");
      return (
        nameEn.includes(normalizedSearch) || nameAr.includes(normalizedSearch)
      );
    });

    artists.push(...matching.slice(0, pageSize - artists.length));
    currentCursor = response.nextCursor;
    hasMore = Boolean(response.nextCursor);
    pagesScanned += 1;
  }

  return {
    artists,
    nextCursor: hasMore ? currentCursor : undefined,
  };
}

export async function fetchArtistById(
  id: string,
): Promise<NasheedArtist | null> {
  const app = getApp();
  const db = getFirestore(app);
  const docSnap = await getDoc(doc(db, "artists", id));
  if (!docSnap.exists()) return null;

  const data = docSnap.data() as any;
  let imagePath: string = data.image_path ?? "";

  if (imagePath && !imagePath.startsWith("http")) {
    try {
      imagePath = await getDownloadURL(ref(getStorage(app), imagePath));
    } catch {
      // keep original path
    }
  }
  return { id: docSnap.id, ...data, image_path: imagePath } as NasheedArtist;
}

export async function trackArtistPlayback({
  artistId,
  nasheedId,
  eventType,
  playedSeconds,
}: {
  artistId: string;
  nasheedId: string;
  eventType: "started" | "qualified" | "completed";
  playedSeconds: number;
}) {
  const db = getFirestore(getApp());
  const userId = getAuth().currentUser?.uid;

  if (!userId) {
    throw new Error("User must be signed in to track playback.");
  }

  await addDoc(collection(db, "artist_plays"), {
    artistId,
    nasheedId,
    userId,
    eventType,
    playedSeconds,
    completed: eventType === "completed",
    createdAt: serverTimestamp(),
  });
}

export async function fetchArtistNasheeds(
  artistId: string,
  pageSize = 20,
  cursor?: NasheedCursor,
): Promise<{ nasheeds: Nasheed[]; nextCursor?: NasheedCursor }> {
  const db = getFirestore(getApp());
  const base = [
    collection(db, "nasheeds"),
    where("artist_id", "==", artistId),
    orderBy("title_en"),
    orderBy("__name__"),
    limit(pageSize),
  ] as const;

  const q = cursor
    ? query(...base, startAfter(cursor.title, cursor.id))
    : query(...base);

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const nasheeds: Nasheed[] = docs.map(
    (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      ({ id: d.id, ...d.data() }) as Nasheed,
  );

  const lastDoc = docs.length === pageSize ? docs[docs.length - 1] : undefined;
  const nextCursor = lastDoc
    ? { title: (lastDoc.data() as any).title ?? "", id: lastDoc.id }
    : undefined;

  return { nasheeds, nextCursor };
}

import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  orderBy,
  limit,
  getDocs,
  query,
  startAfter,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { surahMetadata } from "../constants/surahMetadata";
import {
  FirebaseReciter,
  FirebaseSurah,
  ReciterPlaybackEventType,
  ReciterCursor,
  ResponseReciters,
  ResponseSurah,
  SurahCursor,
} from "../types/quran";

import {
  getDownloadURL,
  getStorage,
  ref,
} from "@react-native-firebase/storage";

const FIREBASE_PROJECT_ID = "qasid-fd80d";
const SEARCH_RECITERS_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/searchReciters`;
const SEARCH_SURAHS_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/searchSurahs`;
const SEARCH_BATCH_SIZE = 50;
const MAX_SEARCH_SCAN_PAGES = 10;
const NEW_RECITER_WINDOW_DAYS = 30;
const NEW_RECITER_WINDOW_MS = NEW_RECITER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const toMillis = (value: unknown): number | undefined => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
};

const getReciterPublishedAtMillis = (data: {
  publishedAt?: unknown;
  createdAt?: unknown;
}) => toMillis(data.publishedAt ?? data.createdAt);

const isRecentReciter = (data: {
  publishedAt?: unknown;
  createdAt?: unknown;
}) => {
  const reciterTime = getReciterPublishedAtMillis(data);

  if (reciterTime === undefined) {
    return false;
  }

  return Date.now() - reciterTime <= NEW_RECITER_WINDOW_MS;
};

const mapReciterDoc = (
  docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseReciter>,
): FirebaseReciter => {
  const data = docSnap.data() as any;

  return {
    id: docSnap.id,
    name_en: data.name_en,
    name_ar: data.name_ar,
    image_path: data.image_path,
    is_active: data.is_active,
    desc: data.desc,
    popularity_score: data.popularity_score ?? 0,
    play_count: data.play_count ?? 0,
    qualified_play_count: data.qualified_play_count ?? 0,
    completed_play_count: data.completed_play_count ?? 0,
    publishedAt: data.publishedAt,
    createdAt: data.createdAt,
    surah_count: data.surah_count,
  };
};

const matchesSurahSearch = (surah: FirebaseSurah, search: string) => {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) {
    return true;
  }

  const metadata = surahMetadata.find((m) => m.number === surah.surah_number);
  const englishName = normalizeSearchText(metadata?.englishName ?? "");
  const arabicName = normalizeSearchText(metadata?.arabicName ?? "");
  const surahNumber = String(surah.surah_number ?? "");
  const paddedSurahNumber = surahNumber.padStart(3, "0");

  return (
    englishName.includes(normalizedSearch) ||
    arabicName.includes(normalizedSearch) ||
    surahNumber.includes(normalizedSearch) ||
    paddedSurahNumber.includes(normalizedSearch)
  );
};

export async function fetchReciters(
  pageSize: number = 20,
  cursor?: any,
): Promise<ResponseReciters> {
  const db = getFirestore(getApp());
  const base = [
    collection(db, "reciters"),
    orderBy("name_en"),
    orderBy("__name__"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    if (cursor.id && cursor.name_en !== undefined && !cursor.data) {
      q = query(...base, startAfter(cursor.name_en, cursor.id));
    } else {
      q = query(...base, startAfter(cursor));
    }
  } else {
    q = query(...base);
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const reciters: FirebaseReciter[] = docs.map(mapReciterDoc);

  const lastDoc = docs.length ? docs[docs.length - 1] : undefined;
  const nextCursor = lastDoc
    ? { name_en: lastDoc.data().name_en, id: lastDoc.id }
    : undefined;

  return {
    reciters,
    nextCursor,
  };
}

export async function fetchPopularReciters(
  pageSize: number = 10,
): Promise<FirebaseReciter[]> {
  const db = getFirestore(getApp());
  const q = query(
    collection(db, "reciters"),
    orderBy("popularity_score", "desc"),
    limit(pageSize),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(
      (
        docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseReciter>,
      ) => mapReciterDoc(docSnap),
    )
    .filter((reciter: FirebaseReciter) => (reciter.popularity_score ?? 0) > 0);
}

export async function fetchNewReciters(
  pageSize: number = 10,
  cursor?: ReciterCursor,
): Promise<ResponseReciters> {
  const db = getFirestore(getApp());
  const base = [
    collection(db, "reciters"),
    orderBy("publishedAt", "desc"),
    orderBy("__name__", "desc"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    if (cursor.id && cursor.publishedAt !== undefined && !cursor.data) {
      q = query(...base, startAfter(cursor.publishedAt, cursor.id));
    } else {
      q = query(...base, startAfter(cursor));
    }
  } else {
    q = query(...base);
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const reciters: FirebaseReciter[] = docs
    .map(mapReciterDoc)
    .filter((reciter: FirebaseReciter) =>
      isRecentReciter({
        publishedAt: reciter.publishedAt,
        createdAt: reciter.createdAt,
      }),
    );

  const lastDoc = docs.length ? docs[docs.length - 1] : undefined;
  const nextCursor =
    lastDoc &&
    isRecentReciter({
      publishedAt: lastDoc.data().publishedAt,
      createdAt: lastDoc.data().createdAt,
    })
      ? { publishedAt: lastDoc.data().publishedAt, id: lastDoc.id }
      : undefined;

  return {
    reciters,
    nextCursor,
  };
}

export async function fetchFilteredReciters(
  search: string,
  pageSize: number = 20,
  cursor?: ReciterCursor,
): Promise<ResponseReciters> {
  const trimmedSearch = search.trim();
  const params = new URLSearchParams({
    search: trimmedSearch,
    pageSize: String(pageSize),
  });

  if (cursor?.id && cursor?.name_en !== undefined) {
    params.set("cursorId", cursor.id);
    params.set("cursorNameEn", cursor.name_en);
  }

  const response = await fetch(`${SEARCH_RECITERS_URL}?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text();
    console.warn("searchReciters HTTP fallback triggered:", errorBody);
    return fetchFilteredRecitersFallback(trimmedSearch, pageSize, cursor);
  }

  const payload = (await response.json()) as ResponseReciters;

  return {
    reciters: Array.isArray(payload.reciters) ? payload.reciters : [],
    nextCursor: payload.nextCursor,
  };
}

async function fetchFilteredRecitersFallback(
  search: string,
  pageSize: number = 20,
  cursor?: ReciterCursor,
): Promise<ResponseReciters> {
  const normalizedSearch = normalizeSearchText(search);
  const reciters: FirebaseReciter[] = [];
  let currentCursor = cursor;
  let pagesScanned = 0;
  let hasMore = true;

  while (
    reciters.length < pageSize &&
    hasMore &&
    pagesScanned < MAX_SEARCH_SCAN_PAGES
  ) {
    const response = await fetchReciters(SEARCH_BATCH_SIZE, currentCursor);

    const matchingReciters = response.reciters.filter((reciter) => {
      const nameEn = normalizeSearchText(reciter.name_en ?? "");
      const nameAr = normalizeSearchText(reciter.name_ar ?? "");

      return (
        nameEn.includes(normalizedSearch) || nameAr.includes(normalizedSearch)
      );
    });

    reciters.push(...matchingReciters.slice(0, pageSize - reciters.length));
    currentCursor = response.nextCursor;
    hasMore = Boolean(response.nextCursor);
    pagesScanned += 1;
  }

  return {
    reciters,
    nextCursor: hasMore ? currentCursor : undefined,
  };
}

export async function fetchReciterById(id: string): Promise<FirebaseReciter> {
  const app = getApp();
  const db = getFirestore(app);
  const docSnap = await getDoc(doc(db, "reciters", id));
  const storage = getStorage(app);
  if (!docSnap.exists()) {
    throw new Error("Reciter not found");
  }

  const data = docSnap.data() as any;
  const imageUrl = await getDownloadURL(ref(storage, data.image_path));
  return {
    ...mapReciterDoc(
      docSnap as FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseReciter>,
    ),
    image_path: imageUrl,
  };
}

export async function trackReciterPlayback({
  reciterId,
  surahId,
  eventType,
  playedSeconds,
}: {
  reciterId: string;
  surahId: string;
  eventType: ReciterPlaybackEventType;
  playedSeconds: number;
}) {
  const db = getFirestore(getApp());
  const userId = getAuth().currentUser?.uid;

  if (!userId) {
    throw new Error("User must be signed in to track playback.");
  }

  await addDoc(collection(db, "reciter_plays"), {
    reciterId,
    surahId,
    userId,
    eventType,
    playedSeconds,
    completed: eventType === "completed",
    createdAt: serverTimestamp(),
  });
}

export async function fetchSurahs(
  target: string,
  pageSize = 20,
  cursor?: any,
): Promise<ResponseSurah> {
  const db = getFirestore(getApp());
  const base = [
    collection(db, "reciters", target, "surahs"),
    orderBy("surah_number"),
    orderBy("__name__"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    if (cursor.id && cursor.surah_number !== undefined && !cursor.data) {
      q = query(...base, startAfter(cursor.surah_number, cursor.id));
    } else {
      q = query(...base, startAfter(cursor));
    }
  } else {
    q = query(...base);
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const surahs: FirebaseSurah[] = await Promise.all(
    snapshot.docs.map(async (docSnap: any) => {
      const data = docSnap.data() as any;

      return {
        audio_path: data.audio_path,
        surah_number: data.surah_number,
      };
    }),
  );

  const lastDoc = docs.length ? docs[docs.length - 1] : undefined;
  const nextCursor = lastDoc
    ? { surah_number: lastDoc.data().surah_number, id: lastDoc.id }
    : undefined;

  return {
    surahs,
    nextCursor: nextCursor as any,
  };
}

export async function fetchFilteredSurahs(
  target: string,
  search: string,
  pageSize: number = 20,
  cursor?: SurahCursor,
): Promise<ResponseSurah> {
  const trimmedSearch = search.trim();
  const params = new URLSearchParams({
    target,
    search: trimmedSearch,
    pageSize: String(pageSize),
    sourceType: "reciter",
  });

  if (cursor?.surah_number) {
    params.set("cursorId", cursor.surah_number.toString());
  }
  if (cursor?.surah_number !== undefined) {
    params.set("cursorSurahNumber", String(cursor.surah_number));
  }

  const response = await fetch(`${SEARCH_SURAHS_URL}?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text();
    console.warn("searchSurahs HTTP fallback triggered:", errorBody);
    return fetchFilteredSurahsFallback(target, trimmedSearch, pageSize, cursor);
  }

  const payload = (await response.json()) as ResponseSurah;

  return {
    surahs: Array.isArray(payload.surahs) ? payload.surahs : [],
    nextCursor: payload.nextCursor,
  };
}

async function fetchFilteredSurahsFallback(
  target: string,
  search: string,
  pageSize: number = 20,
  cursor?: SurahCursor,
): Promise<ResponseSurah> {
  const surahs: FirebaseSurah[] = [];
  let currentCursor = cursor;
  let pagesScanned = 0;
  let hasMore = true;

  while (
    surahs.length < pageSize &&
    hasMore &&
    pagesScanned < MAX_SEARCH_SCAN_PAGES
  ) {
    const response = await fetchSurahs(
      target,
      SEARCH_BATCH_SIZE,
      currentCursor,
    );

    const matchingSurahs = response.surahs.filter((surah) =>
      matchesSurahSearch(surah, search),
    );

    surahs.push(...matchingSurahs.slice(0, pageSize - surahs.length));
    currentCursor = response.nextCursor;
    hasMore = Boolean(response.nextCursor);
    pagesScanned += 1;
  }

  return {
    surahs,
    nextCursor: hasMore ? currentCursor : undefined,
  };
}

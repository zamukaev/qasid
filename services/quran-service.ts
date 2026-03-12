import {
  getFirestore,
  collection,
  orderBy,
  limit,
  getDocs,
  query,
  startAfter,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {
  FirebaseReciter,
  ReciterCursor,
  ResponseReciters,
  ResponseSurah,
  Surah,
} from "../types/quran";

import {
  getDownloadURL,
  getStorage,
  ref,
} from "@react-native-firebase/storage";

const FIREBASE_PROJECT_ID = "qasid-fd80d";
const SEARCH_RECITERS_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/searchReciters`;
const SEARCH_BATCH_SIZE = 50;
const MAX_SEARCH_SCAN_PAGES = 10;

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

export async function fetchReciters(
  pageSize: number = 20,
  cursor?: any,
): Promise<ResponseReciters> {
  const db = getFirestore();
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
  const reciters: FirebaseReciter[] = docs.map(
    (
      docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseReciter>,
    ) => {
      const data = docSnap.data() as any;

      return {
        id: docSnap.id,
        name_en: data.name_en,
        name_ar: data.name_ar,
        image_path: data.image_path,
        is_active: data.is_active,
        desc: data.desc,
      };
    },
  );

  const lastDoc = docs.length ? docs[docs.length - 1] : undefined;
  const nextCursor = lastDoc
    ? { name_en: lastDoc.data().name_en, id: lastDoc.id }
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
  const db = getFirestore();
  const docRef = collection(db, "reciters").doc(id);
  const docSnap = await docRef.get();
  const storage = getStorage();
  if (!docSnap.exists) {
    throw new Error("Reciter not found");
  }

  const data = docSnap.data() as any;
  const imageUrl = await getDownloadURL(ref(storage, data.image_path));
  return {
    id: docSnap.id,
    name_en: data.name_en,
    name_ar: data.name_ar,
    image_path: imageUrl,
    is_active: data.is_active,
    desc: data.desc,
  };
}

export async function fetchSurahs(
  target: string,
  pageSize = 20,
  cursor?: any,
): Promise<ResponseSurah> {
  const db = getFirestore();
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
  const surahs: Surah[] = await Promise.all(
    snapshot.docs.map(async (docSnap: any) => {
      const data = docSnap.data() as any;

      return {
        id: docSnap.id,
        title_en: data.title_en,
        title_ar: data.title_ar,
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

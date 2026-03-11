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
  ResponseReciters,
  ResponseSurah,
  Surah,
} from "../types/quran";

import {
  getDownloadURL,
  getStorage,
  ref,
} from "@react-native-firebase/storage";

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

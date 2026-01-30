import {
  getFirestore,
  query,
  collection,
  where,
  orderBy,
  getDocs,
  FirebaseFirestoreTypes,
  limit,
  startAfter,
} from "@react-native-firebase/firestore";

import {
  getDownloadURL,
  ref,
  getStorage,
} from "@react-native-firebase/storage";
import { MoodType, Nasheed, NasheedKind } from "../types/nasheed";

export const getMoods = async () => {
  const firestore = getFirestore();
  const moodsCollection = collection(firestore, "mood");
  const moodsQuery = query(moodsCollection, orderBy("title", "asc"));

  const querySnapshot = await getDocs(moodsQuery);
  const moods: MoodType[] = [];
  querySnapshot.forEach(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot<MoodType>) => {
      moods.push({ ...doc.data() } as MoodType);
    },
  );

  return moods;
};

export const getNasheedsByMood = async (
  moodKind: NasheedKind,
  pageSize = 20,
  cursor?: any,
) => {
  const db = getFirestore();
  const base = [
    collection(db, "nasheeds"),
    where("is_active", "==", true),
    where("kind", "array-contains", moodKind),
    orderBy("title_en", "asc"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    if (cursor.id && cursor.order !== undefined && !cursor.data) {
      q = query(...base, startAfter(cursor.order, cursor.id));
    } else {
      q = query(...base, startAfter(cursor));
    }
  } else {
    q = query(...base);
  }
  const snapshot = await getDocs(q);

  const docs = snapshot.docs;

  const nasheeds = docs.map(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot<Nasheed>) => {
      const data = doc.data() as Nasheed;

      return {
        id: doc.id,
        title_en: data.title_en,
        title_ar: data.title_ar,
        audio_path: data.audio_path,
        is_active: data.is_active,
        kind: data.kind,
        popularity_score: data.popularity_score,
        publishedAt: data.publishedAt,
      } as Nasheed;
    },
  );

  const nextCursor = docs.length === pageSize ? docs[docs.length - 1] : null;

  return { nasheeds, nextCursor };
};

export const getAllNasheeds = async (pageSize = 20, cursor?: any) => {
  const db = getFirestore();
  const base = [
    collection(db, "nasheeds"),
    where("is_active", "==", true),
    orderBy("title_en", "asc"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    if (cursor.id && cursor.order !== undefined && !cursor.data) {
      q = query(...base, startAfter(cursor.order, cursor.id));
    } else {
      q = query(...base, startAfter(cursor));
    }
  } else {
    q = query(...base);
  }
  const snapshot = await getDocs(q);

  const docs = snapshot.docs;

  const nasheeds = docs.map(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot<Nasheed>) => {
      const data = doc.data() as Nasheed;

      return {
        id: doc.id,
        title_en: data.title_en,
        title_ar: data.title_ar,
        audio_path: data.audio_path,
        is_active: data.is_active,
        kind: data.kind,
        popularity_score: data.popularity_score,
        publishedAt: data.publishedAt,
      } as Nasheed;
    },
  );

  const nextCursor = docs.length === pageSize ? docs[docs.length - 1] : null;

  return { nasheeds, nextCursor };
};

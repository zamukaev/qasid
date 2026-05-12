import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { NasheedArtist } from "../types/nasheed";
import { FirebaseReciter } from "../types/quran";

const RECENTS_LIMIT = 10;

export async function addRecentArtist(artist: NasheedArtist): Promise<void> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return;

  const db = getFirestore(getApp());
  const docRef = doc(db, "user_recents", userId, "artists", artist.id);

  await setDoc(docRef, {
    id: artist.id,
    name_en: artist.name_en,
    name_ar: artist.name_ar ?? null,
    image_path: artist.image_path ?? "",
    nasheed_count: artist.nasheed_count ?? null,
    viewedAt: serverTimestamp(),
  });
}

export async function addRecentReciter(reciter: FirebaseReciter): Promise<void> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return;

  const db = getFirestore(getApp());
  const docRef = doc(db, "user_recents", userId, "reciters", reciter.id);

  await setDoc(docRef, {
    id: reciter.id,
    name_en: reciter.name_en,
    name_ar: reciter.name_ar ?? null,
    image_path: reciter.image_path ?? "",
    surah_count: reciter.surah_count ?? null,
    viewedAt: serverTimestamp(),
  });
}

export async function fetchRecentReciters(): Promise<FirebaseReciter[]> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return [];

  const db = getFirestore(getApp());
  const q = query(
    collection(db, "user_recents", userId, "reciters"),
    orderBy("viewedAt", "desc"),
    limit(RECENTS_LIMIT),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      name_en: data.name_en ?? "",
      name_ar: data.name_ar ?? "",
      image_path: data.image_path ?? "",
      surah_count: data.surah_count ?? 0,
      is_active: true,
      desc: "",
    } as FirebaseReciter;
  });
}

export async function fetchRecentArtists(): Promise<NasheedArtist[]> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return [];

  const db = getFirestore(getApp());
  const q = query(
    collection(db, "user_recents", userId, "artists"),
    orderBy("viewedAt", "desc"),
    limit(RECENTS_LIMIT),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      name_en: data.name_en ?? "",
      name_ar: data.name_ar ?? undefined,
      image_path: data.image_path ?? "",
      nasheed_count: data.nasheed_count ?? undefined,
      is_active: true,
      is_known: false,
      language: "",
      play_count: 0,
      popularity_score: 0,
      qualified_play_count: 0,
      completed_play_count: 0,
      publishedAt: data.viewedAt,
      createdAt: data.viewedAt,
    } as NasheedArtist;
  });
}

import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { Nasheed } from "../types/nasheed";
import { fetchArtistImagePath } from "./nasheeds-service";

const FAVORITES_LIMIT = 200;

function favoritesCollection(userId: string) {
  const db = getFirestore(getApp());
  return collection(db, "user_favorites", userId, "nasheeds");
}

// Returns true if the nasheed is now favorited, false if it was removed.
export async function toggleFavorite(nasheed: Nasheed): Promise<boolean> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error("Sign in required");

  const db = getFirestore(getApp());
  const docRef = doc(db, "user_favorites", userId, "nasheeds", nasheed.id);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    await deleteDoc(docRef);
    return false;
  }

  // Moods are denormalized here so the weekly-mix Cloud Function can read them
  // without a second lookup.
  await setDoc(docRef, {
    id: nasheed.id,
    title_en: nasheed.title_en ?? "",
    name_en: nasheed.name_en ?? "",
    artist_id: nasheed.artist_id ?? "",
    audio_path: nasheed.audio_path ?? "",
    image_path: nasheed.image_path ?? "",
    moods: nasheed.moods ?? [],
    favoritedAt: serverTimestamp(),
  });
  return true;
}

export async function isFavorite(nasheedId: string): Promise<boolean> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return false;
  const db = getFirestore(getApp());
  const snap = await getDoc(
    doc(db, "user_favorites", userId, "nasheeds", nasheedId),
  );
  return snap.exists();
}

export async function fetchFavoriteIds(): Promise<Set<string>> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return new Set();
  const snapshot = await getDocs(favoritesCollection(userId));
  return new Set(
    snapshot.docs.map(
      (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => d.id,
    ),
  );
}

// Lightweight read for the home-screen Favorites tile: returns the artist
// image path for the most recently favorited nasheed's artist.
export async function fetchFavoriteCovers(max = 4): Promise<string[]> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return [];

  const q = query(
    favoritesCollection(userId),
    orderBy("favoritedAt", "desc"),
    limit(1),
  );
  const snapshot = await getDocs(q);
  const firstDoc = snapshot.docs[0];
  if (!firstDoc) return [];

  const artistId = String(firstDoc.data().artist_id ?? "");
  if (!artistId) return [];

  const imagePath = await fetchArtistImagePath(artistId);
  return imagePath ? [imagePath] : [];
}

export async function fetchFavorites(): Promise<Nasheed[]> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return [];

  const q = query(
    favoritesCollection(userId),
    orderBy("favoritedAt", "desc"),
    limit(FAVORITES_LIMIT),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
    const data = d.data();
    return {
      id: d.id,
      title_en: data.title_en ?? "",
      name_en: data.name_en ?? "",
      artist_id: data.artist_id ?? "",
      audio_path: data.audio_path ?? "",
      image_path: data.image_path ?? "",
      moods: data.moods ?? [],
    } as Nasheed;
  });
}

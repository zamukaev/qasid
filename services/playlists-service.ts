import { getApp } from "@react-native-firebase/app";
import {
  getFirestore,
  query,
  collection,
  where,
  getDocs,
  getDoc,
  doc,
  orderBy,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { Nasheed, Playlist } from "../types/nasheed";

export async function fetchPlaylists(): Promise<Playlist[]> {
  const db = getFirestore(getApp());
  const q = query(
    collection(db, "playlists"),
    where("is_active", "==", true),
    orderBy("name_en"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      ({ id: doc.id, ...doc.data() }) as Playlist,
  );
}

export async function fetchPlaylistById(id: string): Promise<Playlist | null> {
  const db = getFirestore(getApp());
  const docSnap = await getDoc(doc(db, "playlists", id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Playlist;
}

export async function fetchNasheedsForPlaylist(
  playlistId: string,
): Promise<Nasheed[]> {
  const db = getFirestore(getApp());
  const q = query(
    collection(db, "nasheeds"),
    where("playlist_id", "==", playlistId),
    orderBy("title_en"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      ({ id: d.id, ...d.data() }) as Nasheed,
  );
}

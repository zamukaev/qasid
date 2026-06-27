import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import {
  GeneratedPlaylist,
  RecommendedTrack,
  WeeklyMix,
} from "../types/nasheed";

const FIREBASE_PROJECT_ID = "qasid-fd80d";
const GENERATE_WEEKLY_MIX_URL = `https://us-central1-${FIREBASE_PROJECT_ID}.cloudfunctions.net/generateWeeklyMix`;

// Triggers server-side (re)generation of the caller's weekly mix and returns
// the fresh tracks. Authenticated via the Firebase ID token.
export async function generateWeeklyMix(): Promise<RecommendedTrack[]> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Sign in required");

  const token = await user.getIdToken();
  const response = await fetch(GENERATE_WEEKLY_MIX_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to generate weekly mix (${response.status})`);
  }
  const data = (await response.json()) as { tracks?: RecommendedTrack[] };
  return data.tracks ?? [];
}

// Reads the last-generated weekly mix from Firestore (no recompute).
export async function fetchWeeklyMix(): Promise<WeeklyMix | null> {
  const userId = getAuth().currentUser?.uid;
  if (!userId) return null;

  const db = getFirestore(getApp());
  const snap = await getDoc(doc(db, "user_recommendations", userId));
  if (!snap.exists()) return null;
  const mix = snap.data()?.weekly_mix;
  if (!mix) return null;
  return {
    tracks: Array.isArray(mix.tracks) ? mix.tracks : [],
    track_count: mix.track_count ?? 0,
    seed: mix.seed,
  };
}

export async function fetchGeneratedPlaylists(): Promise<GeneratedPlaylist[]> {
  const db = getFirestore(getApp());
  const q = query(
    collection(db, "generated_playlists"),
    where("is_active", "==", true),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
      ({ key: d.id, ...d.data() }) as GeneratedPlaylist,
  );
}

export async function fetchGeneratedPlaylistByKey(
  key: string,
): Promise<GeneratedPlaylist | null> {
  const db = getFirestore(getApp());
  const snap = await getDoc(doc(db, "generated_playlists", key));
  if (!snap.exists()) return null;
  return { key: snap.id, ...snap.data() } as GeneratedPlaylist;
}

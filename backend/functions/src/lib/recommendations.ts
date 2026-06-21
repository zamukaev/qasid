import {admin, db} from "./firebase";

export type Mood = "calm" | "motivational" | "sleep" | "focus";

export const MOODS: Mood[] = ["calm", "motivational", "sleep", "focus"];

export interface RecommendedTrack {
  id: string;
  title_en: string;
  artist_id: string;
  name_en: string;
  audio_path: string;
  image_path: string;
  moods: string[];
}

export const toRecommendedTrack = (
  doc: admin.firestore.DocumentSnapshot,
): RecommendedTrack | null => {
  const data = doc.data();
  if (!data || !data.audio_path) return null;
  return {
    id: doc.id,
    title_en: typeof data.title_en === "string" ? data.title_en : "",
    artist_id: typeof data.artist_id === "string" ? data.artist_id : "",
    name_en: typeof data.name_en === "string" ? data.name_en : "",
    audio_path: data.audio_path,
    image_path: typeof data.image_path === "string" ? data.image_path : "",
    moods: Array.isArray(data.moods) ? data.moods : [],
  };
};

// Resolve an ordered list of nasheed ids to denormalized tracks, preserving
// order and dropping missing/invalid docs. Reads are batched via getAll.
export const resolveTracks = async (
  ids: string[],
): Promise<RecommendedTrack[]> => {
  if (ids.length === 0) return [];
  const firestore = db();
  const col = firestore.collection("nasheeds");
  const chunkSize = 100;
  const byId = new Map<string, RecommendedTrack>();
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const refs = chunk.map((id) => col.doc(id));
    const snaps = await firestore.getAll(...refs);
    for (const snap of snaps) {
      const track = toRecommendedTrack(snap);
      if (track) byId.set(snap.id, track);
    }
  }
  // Preserve the requested ordering.
  return ids
    .map((id) => byId.get(id))
    .filter((t): t is RecommendedTrack => !!t);
};

export type GeneratedPlaylistType = "trending" | "top" | "mood";

export interface GeneratedPlaylistMeta {
  key: string;
  type: GeneratedPlaylistType;
  period?: "day" | "week";
  mood?: Mood;
  name_en: string;
  name_ar: string;
  desc: string;
}

// Static presentation metadata for every generated playlist.
export const GENERATED_PLAYLIST_META: GeneratedPlaylistMeta[] = [
  {
    key: "trending_today",
    type: "trending",
    period: "day",
    name_en: "Trending Today",
    name_ar: "الأكثر رواجًا اليوم",
    desc: "The nasheeds everyone is listening to right now.",
  },
  {
    key: "trending_week",
    type: "trending",
    period: "week",
    name_en: "Trending This Week",
    name_ar: "الأكثر رواجًا هذا الأسبوع",
    desc: "This week's most-played nasheeds.",
  },
  {
    key: "top_100",
    type: "top",
    name_en: "Top 100",
    name_ar: "أفضل 100",
    desc: "The all-time most popular nasheeds.",
  },
  {
    key: "mood_calm",
    type: "mood",
    mood: "calm",
    name_en: "Calm Nasheeds",
    name_ar: "أناشيد هادئة",
    desc: "Peaceful nasheeds to settle the heart.",
  },
  {
    key: "mood_motivational",
    type: "mood",
    mood: "motivational",
    name_en: "Motivational Nasheeds",
    name_ar: "أناشيد محفزة",
    desc: "Uplifting nasheeds to keep you going.",
  },
  {
    key: "mood_sleep",
    type: "mood",
    mood: "sleep",
    name_en: "Before Sleep",
    name_ar: "قبل النوم",
    desc: "Gentle nasheeds to wind down to.",
  },
  {
    key: "mood_focus",
    type: "mood",
    mood: "focus",
    name_en: "Study Focus",
    name_ar: "تركيز الدراسة",
    desc: "Nasheeds to help you concentrate.",
  },
];

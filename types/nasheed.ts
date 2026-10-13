import { Timestamp } from "firebase/firestore";

export interface NasheedArtist {
  id: string;
  image_path: string;
  is_active: boolean;
  is_known: boolean;
  name_ar?: string;
  name_en: string;
  desc?: string;
  language: string;
  publishedAt: Timestamp;
  createdAt: Timestamp;
  play_count: number;
  popularity_score: number;
  qualified_play_count: number;
  completed_play_count: number;
  nasheed_count?: number;
  /**
   * Whether the artist gets its own place in artist rails and lists. False for
   * the shared `unknown` artist and for artists with too few nasheeds; their
   * tracks surface through the "singles" collection instead. Written by
   * `npm run collections:build` (see utils/collections.ts).
   */
  is_listed?: boolean;
}

export interface Playlist extends Omit<
  NasheedArtist,
  | "language"
  | "is_known"
  | "play_count"
  | "popularity_score"
  | "qualified_play_count"
  | "completed_play_count"
> {}

export type Mood = "calm" | "motivational" | "sleep" | "focus";

export interface Nasheed {
  id: string;
  name_en: string;
  title_en: string;
  audio_path: string;
  image_path: string;
  artist_id: string;
  moods?: Mood[];
  /**
   * Curated playlist membership: the doc id of a `playlists` entry, or null
   * when unassigned. A nasheed belongs to at most one curated playlist — see
   * fetchNasheedsForPlaylist, which queries this field directly.
   */
  playlist_id?: string | null;
  favorite_count?: number;
  popularity_score?: number;
  tags?: string[];
  /** Release year, used by era collections ("Retro", "2025"). */
  year?: number;
}

// Denormalized track shape written by the recommendation Cloud Functions
// (see backend toRecommendedTrack). Used by weekly mix + generated playlists.
export interface RecommendedTrack {
  id: string;
  title_en: string;
  artist_id: string;
  name_en: string;
  audio_path: string;
  image_path: string;
  moods: string[];
  /** Set on `recent` collection tracks: when the nasheed was added, epoch ms. */
  added_at?: number;
}

export type GeneratedPlaylistType = "trending" | "top" | "mood";

export interface GeneratedPlaylist {
  key: string;
  type: GeneratedPlaylistType;
  period?: "day" | "week";
  name_en: string;
  name_ar: string;
  desc: string;
  image_path: string;
  tracks: RecommendedTrack[];
  track_count: number;
  is_active: boolean;
}

export interface WeeklyMix {
  tracks: RecommendedTrack[];
  track_count: number;
  seed?: { top_artist_ids: string[]; top_moods: string[] };
  /** Epoch ms. null while the server timestamp is still unresolved. */
  generated_at: number | null;
}

export interface NasheedCursor {
  title: string;
  id: string;
}

export interface ArtistCursor {
  name_en: string;
  id: string;
}

export interface ResponseArtists {
  artists: NasheedArtist[];
  nextCursor?: ArtistCursor;
}

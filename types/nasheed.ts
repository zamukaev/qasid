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

export interface Nasheed {
  id: string;
  name_en: string;
  title_en: string;
  audio_path: string;
  image_path?: string;
  artist_id: string;
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

type NasheedType = "nasheeds";
type NasheedStatus = "published";

export type NasheedKind =
  | "all"
  | "beautiful"
  | "night_reflection"
  | "kids"
  | "motivation";

export interface MoodType {
  id: string;
  title: string;
  subtitle: string;
  kind: NasheedKind;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  uri: string;
}

export interface Nasheed {
  id: string;
  title_en: string;
  title_ar: string;
  audio_path: string;
  is_active: boolean;
  kind: NasheedKind[];
  popularity_score: number;
  publishedAt: string;
}

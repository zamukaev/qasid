export interface FirebaseReciter {
  id: string;
  name_en: string;
  name_ar: string;
  image_path: string;
  is_active: boolean;
  desc: string;
  popularity_score?: number;
  play_count?: number;
  qualified_play_count?: number;
  completed_play_count?: number;
  publishedAt?: unknown;
  createdAt?: unknown;
  surah_count: number;
}

export type ReciterPlaybackEventType = "started" | "qualified" | "completed";

export interface ReciterCursor {
  id: string;
  name_en?: string;
  publishedAt?: unknown;
  data?: unknown;
}

export interface SurahCursor {
  surah_number: number;
}

export interface ResponseReciters {
  reciters: FirebaseReciter[];
  nextCursor?: ReciterCursor;
}

export interface FirebaseSurah {
  audio_path: string;
  surah_number: number;
  image_path?: string;
}

export interface Surah {
  audioPath: string;
  surahNumber: number;
  titleEn: string;
  titleAr: string;
  titleTranslation: string;
  artist?: string;
}

export interface ResponseSurah {
  surahs: FirebaseSurah[];
  nextCursor?: SurahCursor;
}

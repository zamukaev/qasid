export interface FirebaseReciter {
  id: string;
  name_en: string;
  name_ar: string;
  image_path: string;
  is_active: boolean;
  desc: string;
}

export interface ReciterCursor {
  id: string;
  name_en: string;
}

export interface SurahCursor {
  id: string;
  surah_number?: number;
  order?: number;
}

export interface ResponseReciters {
  reciters: FirebaseReciter[];
  nextCursor?: ReciterCursor;
}

export interface Surah {
  id: string;
  title_en: string;
  title_ar: string;
  audio_path: string;
  surah_number: number;
  image_path?: string;
}
export interface ResponseSurah {
  surahs: Surah[];
  nextCursor?: SurahCursor;
}

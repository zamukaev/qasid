export interface FirebaseReciter {
  id: string;
  name_en: string;
  name_ar: string;
  image_path: string;
  is_active: boolean;
  desc: string;
}

export interface ResponseReciters {
  reciters: FirebaseReciter[];
  nextCursor?: {
    current_page?: number;
    total_pages?: number;
    [k: string]: unknown;
  };
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
  nextCursor?: {
    current_page?: number;
    total_pages?: number;
    [k: string]: unknown;
  };
}

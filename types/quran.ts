export interface Chapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
  revelation_place: "meccan" | "medinan" | string;
  bismillah_pre?: boolean;
  [k: string]: unknown;
}

export interface ChaptersResponse {
  chapters: Chapter[];
  meta?: {
    current_page?: number;
    total_pages?: number;
    [k: string]: unknown;
  };
}

interface Moshaf {
  id: number;
  name: string;
  reciter_name?: string;
  server: string;
  surah_total: number;
  moshaf_type: number;
  surah_list: string;
}
export interface Reciter {
  id: number | string;
  data: string;
  name: string;
  letter: string;
  arabic_name?: string;
  photo_url?: string;
  moshaf: Moshaf[];
}

export interface firebaseReciter {
  id: string;
  name_en: string;
  name_ar: string;
  image_path: string;
  is_active: boolean;
}

export interface Surah {
  id: string;
  title_en: string;
  title_ar: string;
  order: number;
  audio_path: string;
  surah_number: number;
}

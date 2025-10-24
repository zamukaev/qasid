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

export interface Reciter {
  id: number;
  name: string;
  arabic_name: string;
  photo_url: string;
}

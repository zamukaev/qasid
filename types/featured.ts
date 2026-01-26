export interface BeautifulRecitation {
  id: string;
  title_en: string;
  title_ar: string;
  surah_number: number;
  name_ar: string;
  name_en: string;
  audio_path: string;
  order: number;
  tags: string[];
  is_active: boolean;
  image_path: string;
  description?: string;
}

export interface FeaturedItem {
  id: string;
  content_type: "collection" | "reciter";
  target: string;
  kind: "category" | "reciter";
  title_en: string;
  title_ar: string;
  image_path: string;
  is_active: boolean;
  order: number;
  featured: boolean;
  description: string;
}

import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { BeautifulRecitation, FeaturedItem } from "../types/featured";
import { Surah } from "../types/quran";

export async function loadFeaturedItems(): Promise<FeaturedItem[]> {
  const snapshot = await firestore()
    .collection("featuredItems")
    .where("is_active", "==", true)
    .orderBy("order")
    .get();
  const items: FeaturedItem[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    const imageUrl = await storage().ref(data.image_path).getDownloadURL();

    items.push({
      id: doc.id,
      kind: data?.kind,
      title_en: data.title_en,
      title_ar: data.title_ar,
      image_path: imageUrl,
      is_active: data.is_active,
      order: data.order,
      featured: data?.featured,
      content_type: data?.content_type,
      target: data?.target,
    });
  }
  return items;
}

export async function getFeaturedItemById(
  id: string
): Promise<FeaturedItem | null> {
  const doc = await firestore().collection("featuredItems").doc(id).get();
  if (!doc.exists) {
    return null;
  }
  const data = doc.data() as FeaturedItem;
  const imageUrl = await storage().ref(data.image_path).getDownloadURL();

  return {
    id: doc.id,
    kind: data?.kind,
    title_en: data.title_en,
    title_ar: data.title_ar,
    image_path: imageUrl,
    is_active: data.is_active,
    order: data.order,
    content_type: data?.content_type,
    target: data?.target,
    featured: data?.featured,
  };
}

export async function fetchBeautifulCollection(
  target: string
): Promise<BeautifulRecitation[]> {
  const snapshot = await firestore()
    .collection(target)
    .where("is_active", "==", true)
    .orderBy("order")
    .get();
  const items: BeautifulRecitation[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    const audioUrl = await storage().ref(data.audio_path).getDownloadURL();
    const reciterImageUrl = await storage()
      .ref(data.image_path)
      .getDownloadURL();

    items.push({
      id: doc.id,
      title_en: data.title_en,
      title_ar: data.title_ar,
      surah_number: data.surah_number,
      name_en: data.name_en,
      name_ar: data.name_ar,
      image_path: reciterImageUrl,
      audio_path: audioUrl,
      order: data.order,
      tags: data.tags ?? [],
      is_active: data.is_active,
    });
  }
  return items;
}
export async function fetchFeaturedSurahs(target: string): Promise<Surah[]> {
  const snapshot = await firestore()
    .collection("reciters")
    .doc(target)
    .collection("surahs")
    .orderBy("order")
    .get();
  const surahs: any[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    const audioUrl = await storage().ref(data.audio_path).getDownloadURL();
    surahs.push({
      id: doc.id,
      title_en: data.title_en,
      title_ar: data.title_ar,
      order: data.order,
      audio_path: audioUrl,
      surah_number: data.surah_number,
    });
  }

  console.log("Fetched Surahs:", surahs);
  return surahs;
}

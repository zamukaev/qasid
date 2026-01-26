import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  limit,
  startAfter,
} from "@react-native-firebase/firestore";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import { BeautifulRecitation, FeaturedItem } from "../types/featured";
import { RecitersImage, ResponseSurah, Surah } from "../types/quran";

export async function loadFeaturedItems(): Promise<FeaturedItem[]> {
  const db = getFirestore();
  const q = query(
    collection(db, "featuredItems"),
    where("is_active", "==", true),
    orderBy("order")
  );
  const snapshot = await getDocs(q);
  const items: FeaturedItem[] = [];
  const storage = getStorage();

  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    const imageUrl = await getDownloadURL(ref(storage, data.image_path));

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
      description: data?.description,
    });
  }
  return items;
}

export async function getFeaturedItemById(
  id: string
): Promise<FeaturedItem | null> {
  const db = getFirestore();
  const docSnap = await getDoc(doc(db, "featuredItems", id));
  if (!docSnap.exists()) {
    return null;
  }
  const data = docSnap.data() as FeaturedItem;
  const storage = getStorage();
  const imageUrl = await getDownloadURL(ref(storage, data.image_path));

  return {
    id: docSnap.id,
    kind: data?.kind,
    title_en: data.title_en,
    title_ar: data.title_ar,
    image_path: imageUrl,
    is_active: data.is_active,
    order: data.order,
    content_type: data?.content_type,
    target: data?.target,
    featured: data?.featured,
    description: data?.description,
  };
}

export async function fetchBeautifulCollection(
  target: string
): Promise<BeautifulRecitation[]> {
  const db = getFirestore();
  const q = query(
    collection(db, target),
    where("is_active", "==", true),
    orderBy("order")
  );
  const snapshot = await getDocs(q);
  const items: BeautifulRecitation[] = [];
  const storage = getStorage();
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as any;
    const audioUrl = await getDownloadURL(ref(storage, data.audio_path));
    const reciterImageUrl = await getDownloadURL(ref(storage, data.image_path));
    items.push({
      id: docSnap.id,
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
      description: data.description,
    });
  }
  return items;
}

export async function fetchFeaturedSurahs(
  target: string,
  pageSize = 20,
  cursor?: any
): Promise<ResponseSurah> {
  const db = getFirestore();
  const storage = getStorage();
  const base = [
    collection(db, "reciters", target, "surahs"),
    orderBy("surah_number"),
    orderBy("__name__"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    if (cursor.id && cursor.surah_number !== undefined && !cursor.data) {
      q = query(...base, startAfter(cursor.surah_number, cursor.id));
    } else {
      q = query(...base, startAfter(cursor));
    }
  } else {
    q = query(...base);
  }

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const surahs: Surah[] = await Promise.all(
    snapshot.docs.map(async (docSnap: any) => {
      const data = docSnap.data() as any;

      return {
        id: docSnap.id,
        title_en: data.title_en,
        title_ar: data.title_ar,
        order: data.order,
        audio_path: data.audio_path,
        surah_number: data.surah_number,
      };
    })
  );

  const lastDoc = docs.length ? docs[docs.length - 1] : undefined;
  const nextCursor = lastDoc
    ? { surah_number: lastDoc.data().surah_number, id: lastDoc.id }
    : undefined;

  return {
    surahs,
    nextCursor: nextCursor as any,
  };
}

export async function fetchBeautifulCollectionPage(
  target: string,
  pageSize = 20,
  cursor?: any // QueryDocumentSnapshot
): Promise<ResponseSurah> {
  const db = getFirestore();
  const storage = getStorage();

  const base = [
    collection(db, target),
    where("is_active", "==", true),
    orderBy("order"),
    orderBy("__name__"),
    limit(pageSize),
  ] as const;

  let q;
  if (cursor) {
    if (cursor.id && cursor.order !== undefined && !cursor.data) {
      q = query(...base, startAfter(cursor.order, cursor.id));
    } else {
      q = query(...base, startAfter(cursor));
    }
  } else {
    q = query(...base);
  }
  const snapshot = await getDocs(q);

  const docs = snapshot.docs;

  // URLs erstmal NICHT ziehen → nur Pfade returnen (siehe Punkt 2)
  const surahs = docs.map((docSnap: any) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      title_en: data.title_en,
      title_ar: data.title_ar,
      surah_number: data.surah_number,
      name_en: data.name_en,
      name_ar: data.name_ar,
      // erst mal nur paths
      image_path: data.image_path,
      audio_path: data.audio_path,
      order: data.order,
      tags: data.tags ?? [],
      is_active: data.is_active,
      description: data.description,
    } as BeautifulRecitation;
  });

  const lastDoc = docs.length ? docs[docs.length - 1] : undefined;
  const nextCursor = lastDoc
    ? { order: lastDoc.data().order, id: lastDoc.id }
    : undefined;

  return {
    surahs,
    nextCursor: nextCursor as any,
  };
}

// 1. Funktion, die Featured Items lädt
export async function loadRecitersImages(): Promise<RecitersImage[]> {
  const db = getFirestore();
  const q = query(collection(db, "recitersImages"));
  const snapshot = await getDocs(q);
  const items: RecitersImage[] = [];
  const storage = getStorage();
  for (const doc of snapshot.docs) {
    const data = doc.data() as any;
    const imageUrl = await getDownloadURL(ref(storage, data.image_path));

    items.push({
      id: data.id,
      image_path: imageUrl,
    });
  }
  return items;
}

export async function getRecitersImageById(
  id: number
): Promise<RecitersImage | null> {
  const db = getFirestore();
  const q = query(collection(db, "recitersImages"), where("id", "==", id));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const data = snapshot.docs[0].data() as any;
  const storage = getStorage();
  const imageUrl = await getDownloadURL(ref(storage, data.image_path));

  return {
    id: data.id,
    image_path: imageUrl,
  };
}

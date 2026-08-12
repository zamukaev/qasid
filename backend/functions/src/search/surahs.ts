import {onRequest} from "firebase-functions/v2/https";
import {admin} from "../lib/firebase";
import {
  MAX_BATCH_SIZE,
  MAX_SCANNED_DOCS,
  getSingleQueryValue,
  normalizeText,
  parseNumber,
  parsePageSize,
} from "./shared";

type SearchSourceType = "reciter" | "collection";

type SurahCursor = {
  id: string;
  surah_number?: number;
  order?: number;
};

const matchesSurahSearch = (
  data: admin.firestore.DocumentData,
  search: string,
): boolean => {
  if (!search) {
    return true;
  }
  const surahNumber = String(data.surah_number ?? "");
  const paddedSurahNumber = surahNumber.padStart(3, "0");
  const isNumberSearch = /^\d+$/.test(search);
  if (isNumberSearch) {
    return surahNumber === search || paddedSurahNumber === search;
  }
  return (
    normalizeText(data.name_en).includes(search) ||
    normalizeText(data.name_ar).includes(search) ||
    normalizeText(data.transliteration).includes(search)
  );
};

const createSurahQuery = ({
  sourceType,
  target,
  limitCount,
  cursor,
}: {
  sourceType: SearchSourceType;
  target: string;
  limitCount: number;
  cursor?: SurahCursor;
}): admin.firestore.Query => {
  let query: admin.firestore.Query;
  if (sourceType === "collection") {
    query = admin
      .firestore()
      .collection(target)
      .where("is_active", "==", true)
      .orderBy("order")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(limitCount);
    if (cursor?.id && cursor.order !== undefined) {
      query = query.startAfter(cursor.order, cursor.id);
    }
    return query;
  }

  query = admin
    .firestore()
    .collection("reciters")
    .doc(target)
    .collection("surahs")
    .orderBy("surah_number")
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(limitCount);
  if (cursor?.id && cursor.surah_number !== undefined) {
    query = query.startAfter(cursor.surah_number, cursor.id);
  }
  return query;
};

const mapSurah = (
  doc: admin.firestore.QueryDocumentSnapshot,
): Record<string, unknown> => {
  const data = doc.data();
  return {
    id: doc.id,
    title_en: data.title_en ?? "",
    title_ar: data.title_ar ?? "",
    audio_path: data.audio_path ?? "",
    surah_number: data.surah_number ?? 0,
    name_en: data.name_en ?? "",
    name_ar: data.name_ar ?? "",
    transliteration: data.transliteration ?? "",
    image_path: data.image_path ?? "",
    order: data.order,
    tags: data.tags ?? [],
    is_active: data.is_active ?? false,
    description: data.description ?? "",
  };
};

export const searchSurahs = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  try {
    const search = normalizeText(getSingleQueryValue(req.query.search));
    const target = getSingleQueryValue(req.query.target);
    const sourceTypeParam = getSingleQueryValue(req.query.sourceType);
    const sourceType: SearchSourceType =
      sourceTypeParam === "collection" ? "collection" : "reciter";
    const pageSize = parsePageSize(getSingleQueryValue(req.query.pageSize));
    const cursorId = getSingleQueryValue(req.query.cursorId);
    const cursorSurahNumber = parseNumber(
      getSingleQueryValue(req.query.cursorSurahNumber),
    );
    const cursorOrder = parseNumber(
      getSingleQueryValue(req.query.cursorOrder),
    );

    if (!target) {
      res.status(400).json({error: "Missing target"});
      return;
    }

    let query = createSurahQuery({
      sourceType,
      target,
      limitCount: MAX_BATCH_SIZE,
      cursor: cursorId ?
        {
          id: cursorId,
          surah_number: cursorSurahNumber,
          order: cursorOrder,
        } :
        undefined,
    });

    const surahs: Record<string, unknown>[] = [];
    let scannedDocs = 0;
    let lastVisible: admin.firestore.QueryDocumentSnapshot | undefined;
    let hasMore = false;

    while (surahs.length < pageSize && scannedDocs < MAX_SCANNED_DOCS) {
      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      for (const doc of snapshot.docs) {
        scannedDocs += 1;
        lastVisible = doc;
        if (!matchesSurahSearch(doc.data(), search)) {
          continue;
        }
        surahs.push(mapSurah(doc));
        if (surahs.length === pageSize) {
          break;
        }
      }

      if (surahs.length === pageSize) {
        const followUpQuery = createSurahQuery({
          sourceType,
          target,
          limitCount: 1,
          cursor: sourceType === "collection" ?
            {
              id: lastVisible?.id ?? "",
              order: Number(lastVisible?.get("order") ?? 0),
            } :
            {
              id: lastVisible?.id ?? "",
              surah_number: Number(lastVisible?.get("surah_number") ?? 0),
            },
        });
        const followUpSnapshot = await followUpQuery.get();
        hasMore = !followUpSnapshot.empty;
        break;
      }

      const nextStartAfter = snapshot.docs[snapshot.docs.length - 1];
      query = createSurahQuery({
        sourceType,
        target,
        limitCount: MAX_BATCH_SIZE,
        cursor: sourceType === "collection" ?
          {
            id: nextStartAfter.id,
            order: Number(nextStartAfter.get("order") ?? 0),
          } :
          {
            id: nextStartAfter.id,
            surah_number: Number(nextStartAfter.get("surah_number") ?? 0),
          },
      });
    }

    const nextCursor: SurahCursor | undefined =
      hasMore && lastVisible ?
        sourceType === "collection" ?
          {
            id: lastVisible.id,
            order: Number(lastVisible.get("order") ?? 0),
          } :
          {
            id: lastVisible.id,
            surah_number: Number(lastVisible.get("surah_number") ?? 0),
          } :
        undefined;

    res.status(200).json({surahs, nextCursor});
  } catch (error) {
    console.error("searchSurahs failed", error);
    res.status(500).json({error: "Failed to load surahs"});
  }
});

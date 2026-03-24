import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

type ReciterCursor = {
  id: string;
  name_en: string;
};

type SurahCursor = {
  id: string;
  surah_number?: number;
  order?: number;
};

type SearchSourceType = "reciter" | "collection";

const DEFAULT_PAGE_SIZE = 24;
const MAX_BATCH_SIZE = 50;
const MAX_SCANNED_DOCS = 500;

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getSingleQueryValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
};

const parsePageSize = (value: string | undefined) => {
  const parsed = Number(value ?? DEFAULT_PAGE_SIZE);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.floor(parsed), MAX_BATCH_SIZE);
};

const parseNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const matchesSurahSearch = (
  data: admin.firestore.DocumentData,
  search: string,
) => {
  if (!search) {
    return true;
  }

  const surahNumber = String(data.surah_number ?? "");
  const paddedSurahNumber = surahNumber.padStart(3, "0");

  return (
    normalizeText(data.title_en).includes(search) ||
    normalizeText(data.title_ar).includes(search) ||
    surahNumber.includes(search) ||
    paddedSurahNumber.includes(search)
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
}) => {
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

const mapSurah = (doc: admin.firestore.QueryDocumentSnapshot) => {
  const data = doc.data();

  return {
    id: doc.id,
    title_en: data.title_en ?? "",
    title_ar: data.title_ar ?? "",
    audio_path: data.audio_path ?? "",
    surah_number: data.surah_number ?? 0,
    name_en: data.name_en ?? "",
    name_ar: data.name_ar ?? "",
    image_path: data.image_path ?? "",
    order: data.order,
    tags: data.tags ?? [],
    is_active: data.is_active ?? false,
    description: data.description ?? "",
  };
};

export const searchReciters = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const search = normalizeText(getSingleQueryValue(req.query.search));
    const pageSize = parsePageSize(getSingleQueryValue(req.query.pageSize));
    const cursorId = getSingleQueryValue(req.query.cursorId);
    const cursorNameEn = getSingleQueryValue(req.query.cursorNameEn);

    let query: admin.firestore.Query = admin
      .firestore()
      .collection("reciters")
      .orderBy("name_en")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(MAX_BATCH_SIZE);

    if (cursorId && cursorNameEn) {
      query = query.startAfter(cursorNameEn, cursorId);
    }

    const reciters: Array<Record<string, unknown>> = [];
    let scannedDocs = 0;
    let lastVisible: admin.firestore.QueryDocumentSnapshot | undefined;
    let hasMore = false;

    while (reciters.length < pageSize && scannedDocs < MAX_SCANNED_DOCS) {
      const snapshot = await query.get();

      if (snapshot.empty) {
        break;
      }

      for (const doc of snapshot.docs) {
        scannedDocs += 1;
        lastVisible = doc;

        const data = doc.data();
        const matches =
          !search ||
          normalizeText(data.name_en).includes(search) ||
          normalizeText(data.name_ar).includes(search);

        if (!matches) {
          continue;
        }

        reciters.push({
          id: doc.id,
          name_en: data.name_en ?? "",
          name_ar: data.name_ar ?? "",
          image_path: data.image_path ?? "",
          is_active: data.is_active ?? false,
          desc: data.desc ?? "",
        });

        if (reciters.length === pageSize) {
          break;
        }
      }

      if (reciters.length === pageSize) {
        const followUpQuery = admin
          .firestore()
          .collection("reciters")
          .orderBy("name_en")
          .orderBy(admin.firestore.FieldPath.documentId())
          .startAfter(lastVisible?.get("name_en"), lastVisible?.id)
          .limit(1);
        const followUpSnapshot = await followUpQuery.get();
        hasMore = !followUpSnapshot.empty;
        break;
      }

      const nextStartAfter = snapshot.docs[snapshot.docs.length - 1];
      query = admin
        .firestore()
        .collection("reciters")
        .orderBy("name_en")
        .orderBy(admin.firestore.FieldPath.documentId())
        .startAfter(nextStartAfter.get("name_en"), nextStartAfter.id)
        .limit(MAX_BATCH_SIZE);
    }

    const nextCursor: ReciterCursor | undefined =
      hasMore && lastVisible ?
        {
          id: lastVisible.id,
          name_en: String(lastVisible.get("name_en") ?? ""),
        } :
        undefined;

    res.status(200).json({
      reciters,
      nextCursor,
    });
  } catch (error) {
    console.error("searchReciters failed", error);
    res.status(500).json({ error: "Failed to load reciters" });
  }
});

export const searchSurahs = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
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
    const cursorOrder = parseNumber(getSingleQueryValue(req.query.cursorOrder));

    if (!target) {
      res.status(400).json({ error: "Missing target" });
      return;
    }

    let query = createSurahQuery({
      sourceType,
      target,
      limitCount: MAX_BATCH_SIZE,
      cursor:
        cursorId ?
          {
            id: cursorId,
            surah_number: cursorSurahNumber,
            order: cursorOrder,
          }
        : undefined,
    });

    const surahs: Array<Record<string, unknown>> = [];
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
          cursor:
            sourceType === "collection" ?
              {
                id: lastVisible?.id ?? "",
                order: Number(lastVisible?.get("order") ?? 0),
              }
            : {
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
        cursor:
          sourceType === "collection" ?
            {
              id: nextStartAfter.id,
              order: Number(nextStartAfter.get("order") ?? 0),
            }
          : {
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
          }
        : {
            id: lastVisible.id,
            surah_number: Number(lastVisible.get("surah_number") ?? 0),
          }
      : undefined;

    res.status(200).json({
      surahs,
      nextCursor,
    });
  } catch (error) {
    console.error("searchSurahs failed", error);
    res.status(500).json({ error: "Failed to load surahs" });
  }
});

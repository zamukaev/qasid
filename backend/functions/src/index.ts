import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";

setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();

type ReciterCursor = {
  id: string;
  name_en: string;
};

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

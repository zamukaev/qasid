import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onRequest} from "firebase-functions/v2/https";

setGlobalOptions({maxInstances: 10});

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

const getPlaybackScoreIncrement = (eventType: unknown) => {
  switch (eventType) {
  case "completed":
    return 5;
  case "qualified":
    return 2;
  case "started":
    return 1;
  default:
    return 0;
  }
};

const getTimestampDate = (value: unknown) => {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }

  return new Date();
};

const getPlaybackLockId = ({
  userId,
  reciterId,
  surahId,
  eventType,
  createdAt,
}: {
  userId: string;
  reciterId: string;
  surahId: string;
  eventType: string;
  createdAt: unknown;
}) => {
  const createdAtDate = getTimestampDate(createdAt);
  const bucketMinute = Math.floor(createdAtDate.getUTCMinutes() / 30) * 30;
  const bucketKey = [
    createdAtDate.getUTCFullYear(),
    String(createdAtDate.getUTCMonth() + 1).padStart(2, "0"),
    String(createdAtDate.getUTCDate()).padStart(2, "0"),
    String(createdAtDate.getUTCHours()).padStart(2, "0"),
    String(bucketMinute).padStart(2, "0"),
  ].join("");

  return [userId, reciterId, surahId, eventType, bucketKey].join("_");
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

export const searchReciters = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
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
    res.status(500).json({error: "Failed to load reciters"});
  }
});

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
    const cursorOrder = parseNumber(getSingleQueryValue(req.query.cursorOrder));

    if (!target) {
      res.status(400).json({error: "Missing target"});
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
          } :
          undefined,
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
        cursor:
          sourceType === "collection" ?
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

    res.status(200).json({
      surahs,
      nextCursor,
    });
  } catch (error) {
    console.error("searchSurahs failed", error);
    res.status(500).json({error: "Failed to load surahs"});
  }
});

export const onArtistPlaybackCreated = onDocumentCreated(
  "artist_plays/{playId}",
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const data = snapshot.data();
    const artistId = typeof data.artistId === "string" ? data.artistId : "";
    const nasheedId = typeof data.nasheedId === "string" ? data.nasheedId : "";
    const userId = typeof data.userId === "string" ? data.userId : "";
    const eventType = data.eventType;
    const scoreIncrement = getPlaybackScoreIncrement(eventType);

    if (!artistId || !nasheedId || !userId || scoreIncrement === 0) {
      console.warn("Skipping artist playback event with invalid payload", {
        playId: snapshot.id,
        artistId,
        nasheedId,
        userId,
        eventType,
      });
      return;
    }

    const artistRef = admin.firestore().collection("artists").doc(artistId);
    const lockId = getPlaybackLockId({
      userId,
      reciterId: artistId,
      surahId: nasheedId,
      eventType,
      createdAt: data.createdAt,
    });
    const lockRef = admin
      .firestore()
      .collection("artist_playback_locks")
      .doc(lockId);

    await admin.firestore().runTransaction(async (transaction) => {
      const lockSnapshot = await transaction.get(lockRef);

      if (lockSnapshot.exists) {
        return;
      }

      transaction.set(
        artistRef,
        {
          popularity_score: admin.firestore.FieldValue.increment(
            scoreIncrement,
          ),
          play_count: admin.firestore.FieldValue.increment(
            eventType === "started" ? 1 : 0,
          ),
          qualified_play_count: admin.firestore.FieldValue.increment(
            eventType === "qualified" ? 1 : 0,
          ),
          completed_play_count: admin.firestore.FieldValue.increment(
            eventType === "completed" ? 1 : 0,
          ),
        },
        {merge: true},
      );

      transaction.set(lockRef, {
        playId: snapshot.id,
        artistId,
        nasheedId,
        userId,
        eventType,
        createdAt:
          data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },
);

export const onReciterPlaybackCreated = onDocumentCreated(
  "reciter_plays/{playId}",
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const data = snapshot.data();
    const reciterId = typeof data.reciterId === "string" ? data.reciterId : "";
    const surahId = typeof data.surahId === "string" ? data.surahId : "";
    const userId = typeof data.userId === "string" ? data.userId : "";
    const eventType = data.eventType;
    const scoreIncrement = getPlaybackScoreIncrement(eventType);

    if (!reciterId || !surahId || !userId || scoreIncrement === 0) {
      console.warn("Skipping reciter playback event with invalid payload", {
        playId: snapshot.id,
        reciterId,
        surahId,
        userId,
        eventType,
      });
      return;
    }

    const reciterRef = admin.firestore().collection("reciters").doc(reciterId);
    const lockId = getPlaybackLockId({
      userId,
      reciterId,
      surahId,
      eventType,
      createdAt: data.createdAt,
    });
    const lockRef = admin
      .firestore()
      .collection("reciter_playback_locks")
      .doc(lockId);

    await admin.firestore().runTransaction(async (transaction) => {
      const lockSnapshot = await transaction.get(lockRef);

      if (lockSnapshot.exists) {
        return;
      }

      transaction.set(
        reciterRef,
        {
          popularity_score: admin.firestore.FieldValue.increment(
            scoreIncrement,
          ),
          play_count: admin.firestore.FieldValue.increment(
            eventType === "started" ? 1 : 0,
          ),
          qualified_play_count: admin.firestore.FieldValue.increment(
            eventType === "qualified" ? 1 : 0,
          ),
          completed_play_count: admin.firestore.FieldValue.increment(
            eventType === "completed" ? 1 : 0,
          ),
        },
        {merge: true},
      );

      transaction.set(lockRef, {
        playId: snapshot.id,
        reciterId,
        surahId,
        userId,
        eventType,
        createdAt:
          data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  },
);

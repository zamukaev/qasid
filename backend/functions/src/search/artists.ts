import {onRequest} from "firebase-functions/v2/https";
import {admin} from "../lib/firebase";
import {
  MAX_BATCH_SIZE,
  MAX_SCANNED_DOCS,
  getSingleQueryValue,
  normalizeText,
  parsePageSize,
} from "./shared";

type ArtistCursor = {
  id: string;
  name_en: string;
};

const artistsQuery = () =>
  admin
    .firestore()
    .collection("artists")
    .orderBy("name_en")
    .orderBy(admin.firestore.FieldPath.documentId());

export const searchArtists = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  try {
    const search = normalizeText(getSingleQueryValue(req.query.search));
    const pageSize = parsePageSize(getSingleQueryValue(req.query.pageSize));
    const cursorId = getSingleQueryValue(req.query.cursorId);
    const cursorNameEn = getSingleQueryValue(req.query.cursorNameEn);

    let query = artistsQuery().limit(MAX_BATCH_SIZE);

    if (cursorId && cursorNameEn) {
      query = artistsQuery()
        .startAfter(cursorNameEn, cursorId)
        .limit(MAX_BATCH_SIZE);
    }

    const artists: Record<string, unknown>[] = [];
    let scannedDocs = 0;
    let lastVisible: admin.firestore.QueryDocumentSnapshot | undefined;
    let hasMore = false;

    while (artists.length < pageSize && scannedDocs < MAX_SCANNED_DOCS) {
      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      for (const doc of snapshot.docs) {
        scannedDocs += 1;
        lastVisible = doc;
        const data = doc.data();
        // is_active is filtered here rather than with a where() clause so the
        // query needs no composite index — same trade-off as searchReciters,
        // and it matches the client's Firestore fallback, which only ever
        // lists active artists.
        const matches =
          data.is_active === true &&
          (!search ||
            normalizeText(data.name_en).includes(search) ||
            normalizeText(data.name_ar).includes(search));
        if (!matches) {
          continue;
        }
        artists.push({
          id: doc.id,
          name_en: data.name_en ?? "",
          name_ar: data.name_ar ?? "",
          image_path: data.image_path ?? "",
          is_active: data.is_active ?? false,
          is_known: data.is_known ?? false,
          desc: data.desc ?? "",
          language: data.language ?? "",
          nasheed_count: data.nasheed_count ?? 0,
          play_count: data.play_count ?? 0,
          popularity_score: data.popularity_score ?? 0,
        });
        if (artists.length === pageSize) {
          break;
        }
      }

      if (artists.length === pageSize) {
        const followUpSnapshot = await artistsQuery()
          .startAfter(lastVisible?.get("name_en"), lastVisible?.id)
          .limit(1)
          .get();
        hasMore = !followUpSnapshot.empty;
        break;
      }

      const nextStartAfter = snapshot.docs[snapshot.docs.length - 1];
      query = artistsQuery()
        .startAfter(nextStartAfter.get("name_en"), nextStartAfter.id)
        .limit(MAX_BATCH_SIZE);
    }

    const nextCursor: ArtistCursor | undefined =
      hasMore && lastVisible ?
        {
          id: lastVisible.id,
          name_en: String(lastVisible.get("name_en") ?? ""),
        } :
        undefined;

    res.status(200).json({artists, nextCursor});
  } catch (error) {
    console.error("searchArtists failed", error);
    res.status(500).json({error: "Failed to load artists"});
  }
});

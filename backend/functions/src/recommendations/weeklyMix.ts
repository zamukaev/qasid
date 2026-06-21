import {onRequest} from "firebase-functions/v2/https";
import {admin, db} from "../lib/firebase";
import {getPlaybackScoreIncrement} from "../lib/scoring";
import {RecommendedTrack, toRecommendedTrack} from "../lib/recommendations";

const PLAYS_WINDOW = 100;
const MIX_SIZE = 30;
const TOP_ARTISTS = 8;
const TOP_MOODS = 3;
const POOL_PER_SOURCE = 60;

const incr = (map: Map<string, number>, key: string, by: number) => {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
};

const topKeys = (map: Map<string, number>, limit: number): string[] =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);

// Verify the Firebase ID token from the Authorization header and return uid.
const verifyCaller = async (
  authorization: string | undefined,
): Promise<string | null> => {
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const token = authorization.slice("Bearer ".length);
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    console.warn("generateWeeklyMix token verification failed", error);
    return null;
  }
};

const buildMix = async (uid: string): Promise<RecommendedTrack[]> => {
  const firestore = db();
  const [playsSnap, favsSnap] = await Promise.all([
    firestore
      .collection("artist_plays")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(PLAYS_WINDOW)
      .get(),
    firestore
      .collection("user_favorites")
      .doc(uid)
      .collection("nasheeds")
      .limit(200)
      .get(),
  ]);

  // Weight artists by engagement and collect the distinct nasheeds played.
  const artistWeights = new Map<string, number>();
  const playedNasheedIds = new Set<string>();
  for (const doc of playsSnap.docs) {
    const data = doc.data();
    const weight = getPlaybackScoreIncrement(data.eventType);
    if (typeof data.artistId === "string") {
      incr(artistWeights, data.artistId, weight);
    }
    if (typeof data.nasheedId === "string") {
      playedNasheedIds.add(data.nasheedId);
    }
  }

  // Mood preference comes from favorites (moods are denormalized there) plus
  // the moods of recently played nasheeds.
  const moodWeights = new Map<string, number>();
  for (const doc of favsSnap.docs) {
    const moods = doc.data().moods;
    if (Array.isArray(moods)) {
      for (const m of moods) incr(moodWeights, String(m), 2);
    }
  }
  if (playedNasheedIds.size > 0) {
    const refs = [...playedNasheedIds]
      .slice(0, 100)
      .map((id) => firestore.collection("nasheeds").doc(id));
    const playedDocs = await firestore.getAll(...refs);
    for (const snap of playedDocs) {
      const moods = snap.data()?.moods;
      if (Array.isArray(moods)) {
        for (const m of moods) incr(moodWeights, String(m), 1);
      }
    }
  }

  const topArtistIds = topKeys(artistWeights, TOP_ARTISTS);
  const topMoods = topKeys(moodWeights, TOP_MOODS);

  // Gather candidates from three sources in parallel.
  const queries: Promise<admin.firestore.QuerySnapshot>[] = [];
  if (topArtistIds.length > 0) {
    queries.push(
      firestore
        .collection("nasheeds")
        .where("artist_id", "in", topArtistIds.slice(0, 10))
        .orderBy("popularity_score", "desc")
        .limit(POOL_PER_SOURCE)
        .get(),
    );
  }
  if (topMoods.length > 0) {
    queries.push(
      firestore
        .collection("nasheeds")
        .where("moods", "array-contains-any", topMoods)
        .orderBy("popularity_score", "desc")
        .limit(POOL_PER_SOURCE)
        .get(),
    );
  }
  // Discovery: globally popular tracks.
  queries.push(
    firestore
      .collection("nasheeds")
      .orderBy("popularity_score", "desc")
      .limit(POOL_PER_SOURCE)
      .get(),
  );
  const snaps = await Promise.all(queries);

  // Determine max popularity for normalization.
  let maxPopularity = 1;
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const pop = Number(doc.data().popularity_score ?? 0);
      if (pop > maxPopularity) maxPopularity = pop;
    }
  }

  // Score and dedup candidates.
  const candidates = new Map<string, {track: RecommendedTrack; score: number}>();
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      if (candidates.has(doc.id)) continue;
      const track = toRecommendedTrack(doc);
      if (!track) continue;
      const data = doc.data();
      const artistMatch = topArtistIds.includes(track.artist_id) ? 3 : 0;
      const trackMoods = Array.isArray(data.moods) ? data.moods : [];
      const moodMatch = trackMoods.some((m: string) => topMoods.includes(m)) ?
        2 :
        0;
      const popularity =
        Number(data.popularity_score ?? 0) / maxPopularity;
      // Slightly down-weight already-played tracks to favor discovery.
      const familiarity = playedNasheedIds.has(doc.id) ? -0.5 : 0;
      const jitter = Math.random() * 0.5;
      candidates.set(doc.id, {
        track,
        score: artistMatch + moodMatch + popularity + familiarity + jitter,
      });
    }
  }

  const tracks = [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MIX_SIZE)
    .map((c) => c.track);

  await firestore
    .collection("user_recommendations")
    .doc(uid)
    .set(
      {
        uid,
        weekly_mix: {
          tracks,
          track_count: tracks.length,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          seed: {top_artist_ids: topArtistIds, top_moods: topMoods},
        },
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );

  return tracks;
};

// Builds a personalized 30-track mix from the caller's last 100 plays,
// favorites, favorite artists and favorite moods, blended with discovery.
// Writes user_recommendations/{uid}.weekly_mix and returns it. Authenticated
// via a Firebase ID token in the Authorization header (no callable SDK
// dependency, consistent with the search endpoints).
export const generateWeeklyMix = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }

  const uid = await verifyCaller(req.headers.authorization);
  if (!uid) {
    res.status(401).json({error: "Sign in required"});
    return;
  }

  try {
    const tracks = await buildMix(uid);
    res.status(200).json({track_count: tracks.length, tracks});
  } catch (error) {
    console.error("generateWeeklyMix failed", error);
    res.status(500).json({error: "Failed to generate weekly mix"});
  }
});

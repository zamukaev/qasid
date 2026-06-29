import {onSchedule} from "firebase-functions/v2/scheduler";
import {admin, db} from "../lib/firebase";
import {getPlaybackScoreIncrement, getTimestampDate} from "../lib/scoring";
import {
  GENERATED_PLAYLIST_META,
  RecommendedTrack,
  resolveTracks,
  toRecommendedTrack,
} from "../lib/recommendations";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const TRENDING_LIMIT = 50;
const TOP_LIMIT = 100;
const MOOD_LIMIT = 50;

// Linear time-decay: a play at the start of the window is worth `weight`,
// fading to ~0 at the window edge. Keeps "trending" biased toward recency.
const decay = (ageMs: number, windowMs: number): number =>
  Math.max(0, 1 - ageMs / windowMs);

const addWeighted = (map: Map<string, number>, id: string, value: number) => {
  map.set(id, (map.get(id) ?? 0) + value);
};

const topIds = (map: Map<string, number>, limit: number): string[] =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

interface TrendingMaps {
  today: Map<string, number>;
  week: Map<string, number>;
}

// Aggregate the last 7 days of artist_plays into today / week trending maps.
const aggregateTrending = async (now: number): Promise<TrendingMaps> => {
  const firestore = db();
  const cutoff = admin.firestore.Timestamp.fromMillis(now - WEEK_MS);
  const snapshot = await firestore
    .collection("artist_plays")
    .where("createdAt", ">=", cutoff)
    .get();

  const acc: TrendingMaps = {today: new Map(), week: new Map()};
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const nasheedId = typeof data.nasheedId === "string" ? data.nasheedId : "";
    const weight = getPlaybackScoreIncrement(data.eventType);
    if (!nasheedId || weight === 0) continue;
    const ageMs = now - getTimestampDate(data.createdAt).getTime();
    if (ageMs < 0) continue;
    addWeighted(acc.week, nasheedId, weight * decay(ageMs, WEEK_MS));
    if (ageMs <= DAY_MS) {
      addWeighted(acc.today, nasheedId, weight * decay(ageMs, DAY_MS));
    }
  }
  return acc;
};

const fetchTopTracks = async (limit: number): Promise<RecommendedTrack[]> => {
  const snapshot = await db()
    .collection("nasheeds")
    .orderBy("popularity_score", "desc")
    .limit(limit)
    .get();
  return snapshot.docs
    .map((doc) => toRecommendedTrack(doc))
    .filter((t): t is RecommendedTrack => !!t);
};

const fetchMoodTracks = async (
  mood: string,
  limit: number,
): Promise<RecommendedTrack[]> => {
  const snapshot = await db()
    .collection("nasheeds")
    .where("moods", "array-contains", mood)
    .orderBy("popularity_score", "desc")
    .limit(limit)
    .get();
  return snapshot.docs
    .map((doc) => toRecommendedTrack(doc))
    .filter((t): t is RecommendedTrack => !!t);
};

const writePlaylist = async (key: string, tracks: RecommendedTrack[]) => {
  const meta = GENERATED_PLAYLIST_META.find((m) => m.key === key);
  if (!meta) return;
  await db()
    .collection("generated_playlists")
    .doc(key)
    .set(
      {
        key: meta.key,
        type: meta.type,
        name_en: meta.name_en,
        name_ar: meta.name_ar,
        desc: meta.desc,
        period: meta.period ?? null,
        tracks,
        track_count: tracks.length,
        is_active: true,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
};

// Persist the 7-day trending weight onto each nasheed as `trending_score`.
const persistTrendingScores = async (week: Map<string, number>) => {
  const firestore = db();
  const entries = [...week.entries()];
  const chunkSize = 400;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = firestore.batch();
    for (const [id, score] of entries.slice(i, i + chunkSize)) {
      batch.set(
        firestore.collection("nasheeds").doc(id),
        {trending_score: score},
        {merge: true},
      );
    }
    await batch.commit();
  }
};

/**
 * Runs daily: recomputes trending scores and regenerates all global playlists
 * (Trending Today/Week, Top 100, and the four mood playlists).
 */
export const dailyRecommendationJob = onSchedule(
  "every 24 hours",
  async () => {
    const now = Date.now();
    const trending = await aggregateTrending(now);
    await persistTrendingScores(trending.week);

    const [todayTracks, weekTracks, topTracks] = await Promise.all([
      resolveTracks(topIds(trending.today, TRENDING_LIMIT)),
      resolveTracks(topIds(trending.week, TRENDING_LIMIT)),
      fetchTopTracks(TOP_LIMIT),
    ]);

    await Promise.all([
      writePlaylist("trending_today", todayTracks),
      writePlaylist("trending_week", weekTracks),
      writePlaylist("top_100", topTracks),
    ]);

    const moodMetas = GENERATED_PLAYLIST_META.filter(
      (m) => m.type === "mood" && m.mood,
    );
    await Promise.all(
      moodMetas.map(async (meta) => {
        const tracks = await fetchMoodTracks(meta.mood as string, MOOD_LIMIT);
        await writePlaylist(meta.key, tracks);
      }),
    );

    console.log("dailyRecommendationJob complete", {
      trending_today: todayTracks.length,
      trending_week: weekTracks.length,
      top_100: topTracks.length,
      moods: moodMetas.length,
    });
  },
);

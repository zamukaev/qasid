import {admin} from "./firebase";

export type PlaybackEventType = "started" | "qualified" | "completed";

// Engagement weights shared by the playback triggers and the recommendation
// aggregation. A completed listen counts far more than a bare start.
export const getPlaybackScoreIncrement = (eventType: unknown): number => {
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

export const getTimestampDate = (value: unknown): Date => {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }
  return new Date();
};

// Deduplication lock id: one event per (user, content, sub-content, eventType)
// per 30-minute UTC bucket. Field names stay generic so both the artist and
// reciter triggers can reuse it.
export const getPlaybackLockId = ({
  userId,
  reciterId,
  surahId,
  eventType,
  createdAt,
}: {
  userId: string;
  reciterId: string;
  surahId: string;
  eventType: unknown;
  createdAt: unknown;
}): string => {
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

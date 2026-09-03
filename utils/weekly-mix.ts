// The mix is called "weekly", so a stored mix is served for a week before the
// home screen asks the backend for a fresh one.
export const WEEKLY_MIX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// A generation attempt that failed (offline, function down) must not be retried
// on every app start; this is the floor between two attempts.
export const WEEKLY_MIX_RETRY_MIN_MS = 6 * 60 * 60 * 1000;

// A missing timestamp counts as stale: an unresolved server timestamp means the
// write never completed, so there is nothing worth keeping.
export const isWeeklyMixStale = (
  generatedAt: number | null,
  now: number,
): boolean => generatedAt === null || now - generatedAt >= WEEKLY_MIX_TTL_MS;

import { useEffect, useRef, useState } from "react";
import { peekStorageUrl, resolveOptionalStorageUrl } from "../services/storage";

// Resolutions are applied in batches so a 100-track list produces a handful of
// renders instead of one per resolved URL.
const FLUSH_BATCH_SIZE = 8;
const FLUSH_INTERVAL_MS = 120;

const seedFromCache = (
  paths: readonly (string | null | undefined)[],
): Map<string, string> => {
  const seeded = new Map<string, string>();
  for (const path of paths) {
    const cached = peekStorageUrl(path);
    if (path && cached) seeded.set(path, cached);
  }
  return seeded;
};

/**
 * Resolves a list of Firebase Storage paths to download URLs without blocking
 * the caller's first render.
 *
 * Anything already in the in-memory cache is seeded synchronously, so a
 * revisited screen shows its artwork on the first frame; the rest fill in
 * progressively. Resolution order follows the input, and the shared semaphore
 * in `services/storage` caps concurrency, so on-screen rows resolve first.
 *
 * `paths` must be referentially stable (memoize it) — a new array identity
 * restarts resolution.
 */
export const useProgressiveStorageUrls = (
  paths: readonly (string | null | undefined)[],
): ReadonlyMap<string, string> => {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() =>
    seedFromCache(paths),
  );
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = (generationRef.current += 1);
    const isCurrent = () => generationRef.current === generation;

    const seeded = seedFromCache(paths);
    setUrls(seeded);

    const pending = [
      ...new Set(paths.filter((p): p is string => !!p && !seeded.has(p))),
    ];
    if (pending.length === 0) return;

    let buffer = new Map<string, string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (buffer.size === 0 || !isCurrent()) return;
      const batch = buffer;
      buffer = new Map();
      setUrls((prev) => new Map([...prev, ...batch]));
    };

    const record = (path: string, url: string) => {
      if (!isCurrent()) return;
      buffer.set(path, url);
      if (buffer.size >= FLUSH_BATCH_SIZE) {
        flush();
      } else if (!flushTimer) {
        flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
      }
    };

    void Promise.all(
      pending.map(async (path) => {
        const url = await resolveOptionalStorageUrl(path);
        if (url) record(path, url);
      }),
    ).then(flush);

    return () => {
      generationRef.current += 1;
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [paths]);

  return urls;
};

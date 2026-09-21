import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import { Track } from "../context/AudioPlayerContext";
import {
  deleteDownload,
  downloadTrack,
  getDownloadedIds,
} from "../services/download-service";
import { useIsPremium, useUserStore } from "../stores/userStore";

// Three at a time: enough to keep the connection busy without starving the
// Storage URL resolutions that playback needs at the same time.
const MAX_CONCURRENT_DOWNLOADS = 3;

export type CollectionDownloadStatus =
  | "idle"
  | "partial"
  | "downloading"
  | "downloaded";

export type CollectionDownload = {
  status: CollectionDownloadStatus;
  /** 0..1 across the whole collection, not within one track. */
  progress: number;
  downloadedCount: number;
  total: number;
  /** How many are still missing — what a download would actually fetch. */
  pendingCount: number;
  /** False until RevenueCat has answered. The sheet says so rather than
   *  guessing, which would show a paying user the paywall on a cold start. */
  planResolved: boolean;
  isPremium: boolean;
  /**
   * Starts straight away. Confirming and the paywall live in
   * `CollectionDownloadSheet`, so this must only be called once the user has
   * agreed there.
   */
  startDownload: () => void;
  cancel: () => void;
  removeAll: () => void;
};

/**
 * `useDownload` for a whole collection: the reciter's surahs, an artist's
 * nasheeds, a playlist. Tracks must carry raw Firebase Storage paths as `uri`
 * and the same ids the playback queue uses, or the downloaded files will never
 * be found again when the collection is played.
 */
export function useCollectionDownload(
  tracks: readonly Track[],
): CollectionDownload {
  const isPremium = useIsPremium();
  const planResolved = useUserStore((s) => s.planResolved);

  const [downloadedIds, setDownloadedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Bumped by every start and every cancel. A worker keeps the id it started
  // with and stops as soon as it stops matching, so cancelling a run cannot be
  // undone by the next one starting.
  const runIdRef = useRef(0);

  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks]);
  // The list's identity changes whenever the parent rebuilds the array; its
  // contents usually do not. Re-reading the status keys off the contents.
  const trackIdKey = trackIds.join("|");
  const trackIdsRef = useRef(trackIds);
  trackIdsRef.current = trackIds;

  const refreshStatus = useCallback(async () => {
    const ids = await getDownloadedIds(trackIdsRef.current);
    if (!mountedRef.current) return;
    setDownloadedIds(ids);
  }, [trackIdKey]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const total = tracks.length;
  const downloadedCount = running ? completed : downloadedIds.size;

  const status: CollectionDownloadStatus = running
    ? "downloading"
    : total > 0 && downloadedIds.size >= total
      ? "downloaded"
      : downloadedIds.size > 0
        ? "partial"
        : "idle";

  const progress = total === 0 ? 0 : downloadedCount / total;

  const runPool = useCallback(
    async (pending: Track[], alreadyDone: number, runId: number) => {
      const queue = [...pending];
      let done = alreadyDone;
      let failed = 0;

      const isCurrent = () => mountedRef.current && runIdRef.current === runId;

      const worker = async () => {
        while (isCurrent()) {
          const track = queue.shift();
          if (!track) return;
          try {
            await downloadTrack(track);
          } catch (error) {
            // One unresolvable track must not take the whole run down; the
            // count is reported once at the end instead of alerting per track.
            failed += 1;
            console.warn(`Could not download ${track.id}`, error);
          }
          done += 1;
          if (isCurrent()) setCompleted(done);
        }
      };

      await Promise.all(
        Array.from({
          length: Math.min(MAX_CONCURRENT_DOWNLOADS, queue.length),
        }).map(() => worker()),
      );

      if (!isCurrent()) return;
      setRunning(false);
      await refreshStatus();

      if (failed > 0 && isCurrent()) {
        Alert.alert(
          "Download incomplete",
          `${failed} of ${pending.length} tracks could not be downloaded. Check your connection and try again.`,
        );
      }
    },
    [refreshStatus],
  );

  const pending = useMemo(
    () => tracks.filter((t) => !downloadedIds.has(t.id)),
    [tracks, downloadedIds],
  );

  const startDownload = useCallback(() => {
    if (running || pending.length === 0) return;
    const runId = ++runIdRef.current;
    setCompleted(downloadedIds.size);
    setRunning(true);
    void runPool(pending, downloadedIds.size, runId);
  }, [running, pending, downloadedIds, runPool]);

  const cancel = useCallback(() => {
    // Orphans the running workers: transfers already in flight finish on their
    // own, nothing new is started, and re-reading picks up whatever landed.
    runIdRef.current += 1;
    setRunning(false);
    void refreshStatus();
  }, [refreshStatus]);

  const removeAll = useCallback(() => {
    if (downloadedIds.size === 0) return;
    void (async () => {
      for (const id of downloadedIds) {
        await deleteDownload(id);
      }
      await refreshStatus();
    })();
  }, [downloadedIds, refreshStatus]);

  return {
    status,
    progress,
    downloadedCount,
    total,
    pendingCount: pending.length,
    planResolved,
    isPremium,
    startDownload,
    cancel,
    removeAll,
  };
}

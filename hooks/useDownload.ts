import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useIsPremium, useUserStore } from "../stores/userStore";
import {
  getLocalPath,
  downloadTrack,
  deleteDownload,
} from "../services/download-service";
import { Track } from "../context/AudioPlayerContext";

export type DownloadStatus = "idle" | "downloading" | "downloaded";

export function useDownload(track: Track) {
  const planResolved = useUserStore((s) => s.planResolved);
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const isPremium = useIsPremium();
  useEffect(() => {
    let cancelled = false;
    getLocalPath(track.id).then((path) => {
      if (!cancelled) setStatus(path ? "downloaded" : "idle");
    });
    return () => {
      cancelled = true;
    };
  }, [track.id]);

  const download = useCallback(async () => {
    // The upgrade prompt is a sheet the caller owns — see PremiumRequiredSheet.
    // These two only keep a mis-wired caller from downloading for free.
    if (!planResolved || !isPremium) return;

    if (status === "downloading" || status === "downloaded") return;

    setStatus("downloading");
    setProgress(0);
    try {
      await downloadTrack(track, setProgress);
      setStatus("downloaded");
    } catch (e) {
      console.error("Download failed", e);
      setStatus("idle");
      Alert.alert(
        "Download Failed",
        "Could not download the track. Please check your connection and try again.",
      );
    }
  }, [planResolved, isPremium, status, track]);

  const remove = useCallback(async () => {
    await deleteDownload(track.id);
    setStatus("idle");
    setProgress(0);
  }, [track.id]);

  return { status, progress, download, remove, isPremium, planResolved };
}

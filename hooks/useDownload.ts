import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useUserStore } from "../stores/userStore";
import {
  getLocalPath,
  downloadTrack,
  deleteDownload,
} from "../services/download-service";
import { Track } from "../context/AudioPlayerContext";

export type DownloadStatus = "idle" | "downloading" | "downloaded";

export function useDownload(track: Track) {
  const { currentPlan } = useUserStore();
  const router = useRouter();
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [progress, setProgress] = useState(0);

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
    if (currentPlan === "free") {
      Alert.alert(
        "Premium Required",
        "Offline listening is a premium feature. Upgrade to download tracks for offline playback.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade",
            onPress: () => router.push("/settings/premium"),
          },
        ],
      );
      return;
    }

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
  }, [currentPlan, status, track, router]);

  const remove = useCallback(async () => {
    await deleteDownload(track.id);
    setStatus("idle");
    setProgress(0);
  }, [track.id]);

  return { status, progress, download, remove };
}

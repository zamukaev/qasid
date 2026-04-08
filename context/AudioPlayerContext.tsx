import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import TrackPlayer, {
  Event,
  State,
  Capability,
  AppKilledPlaybackBehavior,
  IOSCategory,
  IOSCategoryOptions,
  RepeatMode as RNTPRepeatMode,
  useProgress,
  usePlaybackState,
  useTrackPlayerEvents,
} from "react-native-track-player";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp } from "@react-native-firebase/app";
import { getStorage, ref, getDownloadURL } from "@react-native-firebase/storage";

type PlayerViewMode = "hidden" | "mini" | "full";
type RepeatMode = "sequential" | "shuffle" | "repeat-one";

type Track = {
  id: string;
  title: string;
  artist?: string;
  artworkUri?: any;
  surahNumber?: number;
  uri: any;
};

type TrackProgressEntry = {
  positionMillis: number;
  durationMillis: number;
};

type TrackProgressMap = Record<string, TrackProgressEntry>;

type AudioPlayerContextValue = {
  currentTrack: Track | null;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  listenedMillis: number;
  didJustFinish: boolean;
  viewMode: PlayerViewMode;
  queue: Track[];
  repeatMode: RepeatMode;
  playTrack: (track: Track, startPositionMillis?: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  setViewMode: (mode: PlayerViewMode) => void;
  setQueue: (tracks: Track[]) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  progressMap: TrackProgressMap;
  clearProgress: (trackId: string) => Promise<void>;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(
  undefined,
);

const PROGRESS_STORAGE_KEY = "@qasid-reciter-progress";

async function resolveTrackUrl(uri: any): Promise<string> {
  if (!uri) return uri;
  const raw = typeof uri === "object" && uri.uri !== undefined ? uri.uri : uri;
  if (
    typeof raw === "string" &&
    !raw.startsWith("http") &&
    !raw.startsWith("file")
  ) {
    const storage = getStorage(getApp());
    return await getDownloadURL(ref(storage, raw));
  }
  return raw;
}

/** Convert our Track + a resolved URL into an RNTP-compatible track object. */
function toRNTPTrack(track: Track, resolvedUrl: string) {
  return {
    id: track.id,
    url: resolvedUrl,
    title: track.title,
    artist: track.artist ?? "",
    artwork:
      track.artworkUri != null
        ? typeof track.artworkUri === "object" && track.artworkUri.uri
          ? track.artworkUri.uri
          : track.artworkUri
        : undefined,
  };
}

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [listenedMillis, setListenedMillis] = useState(0);
  const [didJustFinish, setDidJustFinish] = useState(false);
  const [viewMode, setViewMode] = useState<PlayerViewMode>("hidden");
  const [queue, setQueueState] = useState<Track[]>([]);
  const queueRef = useRef<Track[]>([]);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>("sequential");
  const repeatModeRef = useRef<RepeatMode>("sequential");
  const [progressMap, setProgressMap] = useState<TrackProgressMap>({});
  const lastPersistRef = useRef(0);
  const listenedMillisRef = useRef(0);
  const lastReportedPositionRef = useRef(0);
  const hasFinishedRef = useRef(false);

  // RNTP reactive hooks
  const progress = useProgress(250);
  const playbackState = usePlaybackState();
  const isPlayingRaw =
    playbackState.state === State.Playing ||
    playbackState.state === State.Buffering ||
    playbackState.state === State.Loading;

  // Debounce isPlaying to suppress rapid state oscillations during track
  // loading (reset → add → skip → play emits multiple intermediate events).
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isPlayingDebounceRef.current) clearTimeout(isPlayingDebounceRef.current);
    isPlayingDebounceRef.current = setTimeout(() => {
      setIsPlaying(isPlayingRaw);
    }, 150);
    return () => {
      if (isPlayingDebounceRef.current) clearTimeout(isPlayingDebounceRef.current);
    };
  }, [isPlayingRaw]);

  useTrackPlayerEvents([Event.PlaybackState], (event) => {
    if (event.state === State.Error) {
      console.warn("TrackPlayer playback error state", event.error);
    }
  });

  useTrackPlayerEvents([Event.PlaybackError], (event) => {
    console.warn("TrackPlayer playback error", event.code, event.message);
  });

  useTrackPlayerEvents([Event.RemoteDuck], async (event) => {
    console.info("TrackPlayer remote duck event", event);

    if (event.permanent) {
      await TrackPlayer.stop();
      return;
    }

    if (event.paused) {
      await TrackPlayer.pause();
      return;
    }

    await TrackPlayer.play();
  });

  // ── Setup TrackPlayer once ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await TrackPlayer.setupPlayer({
          iosCategory: IOSCategory.Playback,
          // AllowBluetoothA2DP + AllowAirPlay are compatible with Playback category.
          // AllowBluetooth (hands-free) requires playAndRecord — must NOT be used here.
          iosCategoryOptions: [
            IOSCategoryOptions.AllowBluetoothA2DP,
            IOSCategoryOptions.AllowAirPlay,
          ],
          autoHandleInterruptions: true,
        });
      } catch {
        // already initialized — continue to updateOptions
      }

      if (!mounted) return;

      try {
        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior.ContinuePlayback,
          },
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
          ],
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
          ],
        });
      } catch (e) {
        console.error("TrackPlayer updateOptions failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Sync RNTP progress → state ───────────────────────────────────────────
  useEffect(() => {
    const posMs = Math.max(0, Math.floor(progress.position * 1000));
    const durMs = Math.max(0, Math.floor(progress.duration * 1000));
    setPositionMillis(posMs);
    setDurationMillis(durMs);

    if (isPlayingRaw) {
      const delta = posMs - lastReportedPositionRef.current;
      if (delta > 0) {
        listenedMillisRef.current += Math.min(delta, 2000);
        setListenedMillis(listenedMillisRef.current);
      }
    }
    lastReportedPositionRef.current = posMs;
  }, [progress, isPlayingRaw]);

  // ── Load / persist progress map ──────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(PROGRESS_STORAGE_KEY)
      .then((s) => s && setProgressMap(JSON.parse(s)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(progressMap),
    ).catch(() => {});
  }, [progressMap]);

  // ── Sync mutable refs ────────────────────────────────────────────────────
  // NOTE: currentTrackRef and queueRef are ALSO updated synchronously inside
  // their respective callbacks so that callers see the latest value immediately
  // without waiting for a React render + useEffect cycle.
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // ── Sync RepeatMode → RNTP native repeat ─────────────────────────────────
  useEffect(() => {
    const sync = async () => {
      try {
        switch (repeatMode) {
          case "repeat-one":
            await TrackPlayer.setRepeatMode(RNTPRepeatMode.Track);
            break;
          case "shuffle":
            // Use Queue loop; queue is in shuffled order when mode is set.
            await TrackPlayer.setRepeatMode(RNTPRepeatMode.Queue);
            break;
          case "sequential":
            await TrackPlayer.setRepeatMode(RNTPRepeatMode.Off);
            break;
        }
      } catch {}
    };
    sync();
  }, [repeatMode]);

  // ── Persist playback position ────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack || !durationMillis) return;
    const now = Date.now();
    const ratio = positionMillis / durationMillis;

    if (ratio >= 0.98) {
      setProgressMap((prev) => {
        if (!prev[currentTrack.id]) return prev;
        const next = { ...prev };
        delete next[currentTrack.id];
        return next;
      });
      lastPersistRef.current = now;
      return;
    }

    if (positionMillis > 0 && now - lastPersistRef.current > 2500) {
      setProgressMap((prev) => ({
        ...prev,
        [currentTrack.id]: { positionMillis, durationMillis },
      }));
      lastPersistRef.current = now;
    }
  }, [currentTrack, positionMillis, durationMillis]);

  // ── setQueue ─────────────────────────────────────────────────────────────
  // Updates ref synchronously so that playTrack (called right after setQueue
  // without await) can read the latest queue immediately.
  const setQueue = useCallback((tracks: Track[]) => {
    queueRef.current = tracks;
    setQueueState(tracks);
  }, []);

  // ── setRepeatMode ────────────────────────────────────────────────────────
  const setRepeatMode = useCallback((mode: RepeatMode) => {
    repeatModeRef.current = mode;
    setRepeatModeState(mode);
  }, []);

  // ── Core playback helpers ─────────────────────────────────────────────────
  const pause = useCallback(async () => {
    await TrackPlayer.pause();
  }, []);

  const resume = useCallback(async () => {
    await TrackPlayer.play();
  }, []);

  // ── playTrack ─────────────────────────────────────────────────────────────
  // Loads the ENTIRE queue into RNTP (resolving all Firebase Storage URLs in
  // parallel), then skips to the requested track. This ensures that
  // skipToNext / skipToPrevious in PlaybackService work natively from the
  // lock screen and Bluetooth controls.
  const playTrack = useCallback(
    async (track: Track, startPositionMillis?: number) => {
      hasFinishedRef.current = false;
      listenedMillisRef.current = 0;
      lastReportedPositionRef.current = startPositionMillis ?? 0;
      setListenedMillis(0);
      setDidJustFinish(false);

      try {
        // Resolve the tapped track URL first (fast path — often already HTTP).
        const url = await resolveTrackUrl(track.uri);

        // Read the queue that was set synchronously by setQueue.
        const currentQueue = queueRef.current;

        // Resolve all queue URLs in parallel BEFORE resetting RNTP.
        // This keeps the previous track playing during URL resolution so there
        // is no audible gap or spurious "paused" state while fetching Firebase
        // Storage URLs.
        let resolvedItems: ReturnType<typeof toRNTPTrack>[] | null = null;
        if (currentQueue.length > 0) {
          resolvedItems = await Promise.all(
            currentQueue.map(async (t) => {
              const tUrl =
                t.id === track.id ? url : await resolveTrackUrl(t.uri);
              return toRNTPTrack(t, tUrl);
            }),
          );
        }

        // Reset RNTP queue only after all URLs are ready — minimises the
        // window between reset() and play() to just add() + skip().
        await TrackPlayer.reset();

        if (resolvedItems) {
          await TrackPlayer.add(resolvedItems);

          // Skip to the tapped track (RNTP starts at index 0 after add).
          const idx = resolvedItems.findIndex((t) => t.id === track.id);
          if (idx > 0) {
            await TrackPlayer.skip(idx);
          }
        } else {
          // No queue — play standalone.
          await TrackPlayer.add(toRNTPTrack(track, url));
        }

        if (startPositionMillis && startPositionMillis > 0) {
          await TrackPlayer.seekTo(startPositionMillis / 1000);
        }

        await TrackPlayer.play();

        // Update React state — also caught by PlaybackActiveTrackChanged, but
        // setting here avoids a render delay.
        currentTrackRef.current = track;
        setCurrentTrack(track);
        setViewMode((prev) => (prev === "full" ? "full" : "mini"));
      } catch (error) {
        console.error("Error playing track:", error);
      }
    },
    [],
  );

  // ── PlaybackActiveTrackChanged ────────────────────────────────────────────
  // Fires when RNTP moves to a different track — both from natural end-of-track
  // auto-advance and from remote control skip (lock screen, Bluetooth).
  // This is the KEY listener that makes background controls update the UI.
  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], (event) => {
    if (event.track != null && event.lastTrack != null) {
      // A track just finished and RNTP auto-advanced (or remote skip happened).
      // Set didJustFinish BEFORE updating currentTrack so the reciter screen's
      // completion tracking fires while currentTrack is still the OLD track.
      setDidJustFinish(true);

      setTimeout(() => {
        setDidJustFinish(false);

        const found = queueRef.current.find(
          (t) => t.id === (event.track as any)?.id,
        );
        if (found) {
          hasFinishedRef.current = false;
          listenedMillisRef.current = 0;
          lastReportedPositionRef.current = 0;
          setListenedMillis(0);
          currentTrackRef.current = found;
          setCurrentTrack(found);
          setViewMode((prev) => (prev === "full" ? "full" : "mini"));
        }
      }, 80);
    } else if (event.track != null && event.lastTrack == null) {
      // New track loaded after reset (explicit playTrack call).
      // playTrack already calls setCurrentTrack, but sync here as a safety net
      // (e.g., if someone calls TrackPlayer.reset() + add() + skip() externally).
      const found = queueRef.current.find(
        (t) => t.id === (event.track as any)?.id,
      );
      if (found && found.id !== currentTrackRef.current?.id) {
        currentTrackRef.current = found;
        setCurrentTrack(found);
        setViewMode((prev) => (prev === "full" ? "full" : "mini"));
      }
    }
  });

  // ── PlaybackQueueEnded ────────────────────────────────────────────────────
  // Fires when the entire queue finishes with RepeatMode.Off (sequential mode
  // reaching the last track). RepeatMode.Track and RepeatMode.Queue never fire
  // this event so repeat-one and shuffle are handled natively by RNTP.
  useTrackPlayerEvents([Event.PlaybackQueueEnded], () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    setDidJustFinish(true);
    setViewMode("mini");
    setTimeout(() => {
      hasFinishedRef.current = false;
      setDidJustFinish(false);
    }, 200);
  });

  // ── Next / Prev ───────────────────────────────────────────────────────────
  // For UI buttons. Remote controls are handled natively in PlaybackService.
  const next = useCallback(async () => {
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;

    if (repeatModeRef.current === "shuffle") {
      const available = currentQueue.filter((t) => t.id !== track.id);
      if (available.length > 0) {
        await playTrack(available[Math.floor(Math.random() * available.length)]);
      }
      return;
    }

    const idx = currentQueue.findIndex((t) => t.id === track.id);
    if (idx !== -1 && idx + 1 < currentQueue.length) {
      try {
        // Use RNTP native skip — queue is already loaded.
        await TrackPlayer.skipToNext();
        await TrackPlayer.play();
      } catch {
        // Fallback: queue not loaded yet, use playTrack (will load queue).
        await playTrack(currentQueue[idx + 1]);
      }
    }
  }, [playTrack]);

  const prev = useCallback(async () => {
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;

    if (repeatModeRef.current === "shuffle") {
      const available = currentQueue.filter((t) => t.id !== track.id);
      if (available.length > 0) {
        await playTrack(available[Math.floor(Math.random() * available.length)]);
      }
      return;
    }

    const idx = currentQueue.findIndex((t) => t.id === track.id);
    const prevIdx = (idx - 1 + currentQueue.length) % currentQueue.length;
    try {
      await TrackPlayer.skipToPrevious();
      await TrackPlayer.play();
    } catch {
      await playTrack(currentQueue[prevIdx]);
    }
  }, [playTrack]);

  // ── Toggle play/pause ─────────────────────────────────────────────────────
  const togglePlayPause = useCallback(async () => {
    if (
      playbackState.state === State.Playing ||
      playbackState.state === State.Buffering ||
      playbackState.state === State.Loading
    ) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, [playbackState.state]);

  const seekTo = useCallback(async (millis: number) => {
    await TrackPlayer.seekTo(millis / 1000);
  }, []);

  const clearProgress = useCallback(async (trackId: string) => {
    setProgressMap((prev) => {
      if (!prev[trackId]) return prev;
      const updated = { ...prev };
      delete updated[trackId];
      return updated;
    });
    try {
      const stored = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      if (parsed[trackId]) {
        delete parsed[trackId];
        await AsyncStorage.setItem(
          PROGRESS_STORAGE_KEY,
          JSON.stringify(parsed),
        );
      }
    } catch {}
  }, []);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      isPlaying,
      positionMillis,
      durationMillis,
      listenedMillis,
      didJustFinish,
      viewMode,
      queue,
      repeatMode,
      playTrack,
      togglePlayPause,
      pause,
      resume,
      seekTo,
      setViewMode,
      setQueue,
      setRepeatMode,
      next,
      prev,
      progressMap,
      clearProgress,
    }),
    [
      currentTrack,
      isPlaying,
      positionMillis,
      durationMillis,
      listenedMillis,
      didJustFinish,
      viewMode,
      queue,
      repeatMode,
      playTrack,
      togglePlayPause,
      pause,
      resume,
      seekTo,
      setQueue,
      setRepeatMode,
      next,
      prev,
      progressMap,
      clearProgress,
    ],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx)
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}

export type { Track };

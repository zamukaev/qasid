import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";

type PlayerViewMode = "hidden" | "mini" | "full";
type RepeatMode = "sequential" | "shuffle" | "repeat-one";

type Track = {
  id: string;
  title: string;
  artist?: string;
  artworkUri?: any;
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

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const playerRef = useRef<any>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [viewMode, setViewMode] = useState<PlayerViewMode>("hidden");
  const [queue, setQueue] = useState<Track[]>([]);
  const queueRef = useRef<Track[]>([]);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("sequential");
  const repeatModeRef = useRef<RepeatMode>("sequential");
  const [progressMap, setProgressMap] = useState<TrackProgressMap>({});
  const lastPersistRef = useRef(0);
  const hasFinishedRef = useRef(false);
  const statusListenerRef = useRef<any>(null);

  const PROGRESS_STORAGE_KEY = "@qasid-reciter-progress";

  useEffect(() => {
    setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
    });
  }, []);

  const unload = useCallback(() => {
    if (playerRef.current) {
      try {
        if (statusListenerRef.current) {
          statusListenerRef.current.remove();
          statusListenerRef.current = null;
        }
        playerRef.current.pause();
        playerRef.current.remove();
      } catch {}
      playerRef.current = null;
    }
  }, []);

  const onStatusUpdate = useCallback(async (status: any) => {
    if (status.isLoaded) {
      setIsPlaying(status.playing);
      setPositionMillis(status.currentTime * 1000);
      setDurationMillis(status.duration * 1000);

      // Handle track finish
      if (status.didJustFinish && !hasFinishedRef.current) {
        hasFinishedRef.current = true;
        setTimeout(async () => {
          await handleTrackFinish();
          hasFinishedRef.current = false;
        }, 100);
      }
    }
  }, []);
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const stored = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
        if (stored) {
          setProgressMap(JSON.parse(stored));
        }
      } catch (error) {
        console.warn("Failed to load progress map", error);
      }
    };
    loadProgress();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(progressMap),
    ).catch((error) => console.warn("Failed to persist progress map", error));
  }, [progressMap]);

  useEffect(() => {
    if (!currentTrack) return;
    if (!durationMillis) return;
    const progressRatio = durationMillis ? positionMillis / durationMillis : 0;
    const trackId = currentTrack.id;
    const now = Date.now();

    if (progressRatio >= 0.98) {
      setProgressMap((prev) => {
        if (!prev[trackId]) return prev;
        const updated = { ...prev };
        delete updated[trackId];
        return updated;
      });
      lastPersistRef.current = now;
      return;
    }

    if (
      positionMillis > 0 &&
      durationMillis > 0 &&
      now - lastPersistRef.current > 2500
    ) {
      setProgressMap((prev) => ({
        ...prev,
        [trackId]: {
          positionMillis,
          durationMillis,
        },
      }));
      lastPersistRef.current = now;
    }
  }, [currentTrack, positionMillis, durationMillis, isPlaying]);

  useEffect(() => {
    return () => {
      unload();
    };
  }, [unload]);

  // Синхронизируем repeatMode с ref
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Синхронизируем currentTrack с ref
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Синхронизируем queue с ref
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

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
    } catch (error) {
      console.warn("Failed to clear progress entry", error);
    }
  }, []);

  const pause = useCallback(async () => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
  }, []);

  const handleTrackFinish = useCallback(async () => {
    const finishedTrack = currentTrackRef.current;
    const currentRepeatMode = repeatModeRef.current;
    const currentQueue = queueRef.current;

    if (!finishedTrack || currentQueue.length === 0) {
      await pause();
      setViewMode("mini");
      return;
    }

    if (currentRepeatMode === "repeat-one") {
      // Replay the same track
      if (playerRef.current) {
        playerRef.current.seekTo(0);
        playerRef.current.play();
      }
    } else if (currentRepeatMode === "shuffle") {
      const availableTracks = currentQueue.filter(
        (t) => t.id !== finishedTrack.id,
      );
      const trackToPlay =
        availableTracks.length > 0
          ? availableTracks[Math.floor(Math.random() * availableTracks.length)]
          : finishedTrack;

      await playTrack(trackToPlay);
    } else {
      // Sequential mode
      const idx = currentQueue.findIndex((t) => t.id === finishedTrack.id);
      const nextIdx = idx + 1;
      if (nextIdx < currentQueue.length) {
        const nextTrack = currentQueue[nextIdx];
        await playTrack(nextTrack);
      } else {
        await pause();
        setViewMode("mini");
      }
    }
  }, [pause]);

  const playTrack = useCallback(
    async (track: Track, startPositionMillis?: number) => {
      unload();
      hasFinishedRef.current = false;
      try {
        let source = track.uri;
        if (
          source &&
          source.uri &&
          typeof source.uri === "string" &&
          !source.uri.startsWith("http") &&
          !source.uri.startsWith("file")
        ) {
          try {
            const storage = getStorage();
            const url = await getDownloadURL(ref(storage, source.uri));
            source = { uri: url };
          } catch (e) {
            console.error(
              "Failed to resolve firebase path in AudioPlayerContext",
              e,
            );
          }
        }

        const player = createAudioPlayer(source);
        playerRef.current = player;

        if (startPositionMillis && startPositionMillis > 0) {
          player.seekTo(startPositionMillis / 1000);
        }

        // Subscribe to playback status updates
        const unsubscribe = player.addListener(
          "playbackStatusUpdate",
          (status: any) => {
            onStatusUpdate(status);
          },
        );
        statusListenerRef.current = unsubscribe;

        player.play();
        setCurrentTrack(track);
        setViewMode((prevMode) => (prevMode === "full" ? "full" : "mini"));
      } catch (error) {
        console.error("Error playing track:", error);
      }
    },
    [unload, onStatusUpdate],
  );

  const togglePlayPause = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;

    try {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.error("Error toggling play/pause:", error);
    }
  }, []);

  const resume = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;

    try {
      player.play();
    } catch (error) {
      console.error("Error resuming playback:", error);
    }
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(millis / 1000);
    }
  }, []);

  const next = useCallback(async () => {
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    const currentRepeatMode = repeatModeRef.current;

    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;

    let nextTrack: Track | null = null;

    if (currentRepeatMode === "shuffle") {
      const availableTracks = currentQueue.filter((t) => t.id !== track.id);
      if (availableTracks.length > 0) {
        nextTrack =
          availableTracks[Math.floor(Math.random() * availableTracks.length)];
      } else {
        nextTrack = track;
      }
    } else {
      const idx = currentQueue.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        const nextIdx = idx + 1;
        if (nextIdx < currentQueue.length) {
          nextTrack = currentQueue[nextIdx];
        }
      }
    }

    if (nextTrack) {
      await playTrack(nextTrack);
    }
  }, [playTrack]);

  const prev = useCallback(async () => {
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    const currentRepeatMode = repeatModeRef.current;

    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;

    let prevTrack: Track | null = null;

    if (currentRepeatMode === "shuffle") {
      const availableTracks = currentQueue.filter((t) => t.id !== track.id);
      if (availableTracks.length > 0) {
        prevTrack =
          availableTracks[Math.floor(Math.random() * availableTracks.length)];
      } else {
        prevTrack = track;
      }
    } else {
      const idx = currentQueue.findIndex((t) => t.id === track.id);
      const prevIdx = (idx - 1 + currentQueue.length) % currentQueue.length;
      prevTrack = currentQueue[prevIdx];
    }

    if (prevTrack) {
      await playTrack(prevTrack);
    }
  }, [playTrack]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      isPlaying,
      positionMillis,
      durationMillis,
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

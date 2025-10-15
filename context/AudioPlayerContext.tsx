import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

type PlayerViewMode = "hidden" | "mini" | "full";

type Track = {
  id: string;
  title: string;
  artist?: string;
  artworkUri?: any;
  uri: any;
};

type AudioPlayerContextValue = {
  currentTrack: Track | null;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  viewMode: PlayerViewMode;
  queue: Track[];
  playTrack: (track: Track) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  setViewMode: (mode: PlayerViewMode) => void;
  setQueue: (tracks: Track[]) => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(
  undefined
);

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [viewMode, setViewMode] = useState<PlayerViewMode>("hidden");
  const [queue, setQueue] = useState<Track[]>([]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  const unload = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current.setOnPlaybackStatusUpdate(null);
      soundRef.current = null;
    }
  }, []);

  const onStatusUpdate = useCallback((status: any) => {
    if (!status) return;
    if (status.isLoaded) {
      setIsPlaying(Boolean(status.isPlaying));
      setPositionMillis(status.positionMillis ?? 0);
      setDurationMillis(status.durationMillis ?? 0);
    }
  }, []);

  const playTrack = useCallback(
    async (track: Track) => {
      await unload();
      const { sound } = await Audio.Sound.createAsync(
        track.uri,
        { shouldPlay: true },
        onStatusUpdate
      );
      soundRef.current = sound;
      setCurrentTrack(track);
      setViewMode("mini");
    },
    [onStatusUpdate, unload]
  );

  const togglePlayPause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }, []);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
    }
  }, []);

  const resume = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
    }
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(millis);
    }
  }, []);

  const next = useCallback(async () => {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (idx + 1) % queue.length;
    await playTrack(queue[nextIdx]);
  }, [currentTrack, queue, playTrack]);

  const prev = useCallback(async () => {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + queue.length) % queue.length;
    await playTrack(queue[prevIdx]);
  }, [currentTrack, queue, playTrack]);

  useEffect(() => {
    return () => {
      unload();
    };
  }, [unload]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      isPlaying,
      positionMillis,
      durationMillis,
      viewMode,
      queue,
      playTrack,
      togglePlayPause,
      pause,
      resume,
      seekTo,
      setViewMode,
      setQueue,
      next,
      prev,
    }),
    [
      currentTrack,
      isPlaying,
      positionMillis,
      durationMillis,
      viewMode,
      queue,
      playTrack,
      togglePlayPause,
      pause,
      resume,
      seekTo,
      setViewMode,
      setQueue,
      next,
      prev,
    ]
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

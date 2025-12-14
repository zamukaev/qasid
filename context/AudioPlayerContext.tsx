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
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  undefined
);

export function AudioPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
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

  const PROGRESS_STORAGE_KEY = "@qasid-reciter-progress";

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

  const onStatusUpdate = useCallback(
    async (status: any) => {
      if (!status) return;
      if (status.isLoaded) {
        setIsPlaying(Boolean(status.isPlaying));
        setPositionMillis(status.positionMillis ?? 0);
        setDurationMillis(status.durationMillis ?? 0);

        // Обработка окончания трека
        if (status.didJustFinish && !hasFinishedRef.current) {
          hasFinishedRef.current = true;
          
          // Небольшая задержка перед переходом на следующий трек
          setTimeout(async () => {
            // Используем актуальные значения из ref, чтобы гарантировать правильные данные
            const finishedTrack = currentTrackRef.current;
            const currentRepeatMode = repeatModeRef.current;
            const currentQueue = queueRef.current;
            
            if (currentRepeatMode === "repeat-one") {
              // Повторяем трек, который только что закончился
              if (finishedTrack) {
                await playTrack(finishedTrack);
              }
            } else if (currentRepeatMode === "shuffle") {
              // Случайный трек
              if (finishedTrack && currentQueue.length > 0) {
                const availableTracks = currentQueue.filter((t) => t.id !== finishedTrack.id);
                if (availableTracks.length > 0) {
                  const randomTrack =
                    availableTracks[
                      Math.floor(Math.random() * availableTracks.length)
                    ];
                  await playTrack(randomTrack);
                } else {
                  // Если остался только один трек, повторяем его
                  await playTrack(finishedTrack);
                }
              }
            } else {
              // Sequential - следующий трек по порядку
              await next();
            }
            hasFinishedRef.current = false;
          }, 100);
        }
      }
    },
    [playTrack, next]
  );

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
    AsyncStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressMap)).catch(
      (error) => console.warn("Failed to persist progress map", error)
    );
  }, [progressMap]);

  useEffect(() => {
    if (!currentTrack) return;
    if (!durationMillis) return;
    const progressRatio = durationMillis
      ? positionMillis / durationMillis
      : 0;
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
          JSON.stringify(parsed)
        );
      }
    } catch (error) {
      console.warn("Failed to clear progress entry", error);
    }
  }, []);

  const playTrack = useCallback(
    async (track: Track, startPositionMillis?: number) => {
      await unload();
      hasFinishedRef.current = false;
      const initialStatus: any = {
        shouldPlay: true,
      };
      if (startPositionMillis && startPositionMillis > 0) {
        initialStatus.positionMillis = startPositionMillis;
      }
      const { sound } = await Audio.Sound.createAsync(
        track.uri,
        initialStatus,
        onStatusUpdate
      );
      soundRef.current = sound;
      setCurrentTrack(track);
      // Сохраняем текущий режим просмотра, если он "full", иначе устанавливаем "mini"
      setViewMode((prevMode) => (prevMode === "full" ? "full" : "mini"));
    },
    [onStatusUpdate, unload]
  );

  const togglePlayPause = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    
    const status = await sound.getStatusAsync();
    const track = currentTrackRef.current;
    const currentRepeatMode = repeatModeRef.current;
    const currentQueue = queueRef.current;
    
    // Если трек закончился или не загружен, перезапускаем его или переходим на следующий
    if (!status.isLoaded || (status.isLoaded && status.didJustFinish)) {
      if (!track) return;
      hasFinishedRef.current = false;
      
      if (currentRepeatMode === "repeat-one") {
        await playTrack(track);
      } else if (currentRepeatMode === "shuffle") {
        if (currentQueue.length > 0) {
          const availableTracks = currentQueue.filter((t) => t.id !== track.id);
          if (availableTracks.length > 0) {
            const randomTrack =
              availableTracks[Math.floor(Math.random() * availableTracks.length)];
            await playTrack(randomTrack);
          } else {
            await playTrack(track);
          }
        }
      } else {
        // Sequential - следующий трек
        await next();
      }
      return;
    }
    
    if (status.isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  }, [playTrack, next]);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
    }
  }, []);

  const resume = useCallback(async () => {
    const sound = soundRef.current;
    if (!sound) return;
    
    const status = await sound.getStatusAsync();
    
    // Если трек закончился, переходим на следующий или перезапускаем в зависимости от режима
    if (status.isLoaded && status.didJustFinish) {
      hasFinishedRef.current = false;
      const track = currentTrackRef.current;
      const currentRepeatMode = repeatModeRef.current;
      const currentQueue = queueRef.current;
      
      if (currentRepeatMode === "repeat-one") {
        if (track) {
          await playTrack(track);
        }
      } else if (currentRepeatMode === "shuffle") {
        if (track && currentQueue.length > 0) {
          const availableTracks = currentQueue.filter((t) => t.id !== track.id);
          if (availableTracks.length > 0) {
            const randomTrack =
              availableTracks[Math.floor(Math.random() * availableTracks.length)];
            await playTrack(randomTrack);
          } else {
            await playTrack(track);
          }
        }
      } else {
        // Sequential - следующий трек (или перезапуск последнего)
        await next();
      }
      return;
    }
    
    // Обычное возобновление воспроизведения
    await sound.playAsync();
  }, [playTrack, next]);

  const seekTo = useCallback(async (millis: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(millis);
    }
  }, []);

  const next = useCallback(async () => {
    // Используем refs для получения актуальных значений
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    const currentRepeatMode = repeatModeRef.current;
    
    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;
    
    if (currentRepeatMode === "shuffle") {
      const availableTracks = currentQueue.filter((t) => t.id !== track.id);
      if (availableTracks.length > 0) {
        const randomTrack =
          availableTracks[Math.floor(Math.random() * availableTracks.length)];
        await playTrack(randomTrack);
      } else {
        await playTrack(track);
      }
    } else {
      // Sequential режим
      const idx = currentQueue.findIndex((t) => t.id === track.id);
      if (idx === -1) return; // Трек не найден в очереди
      const nextIdx = idx + 1;
      if (nextIdx < currentQueue.length) {
        await playTrack(currentQueue[nextIdx]);
      }
      // Если это последний трек, просто останавливаем воспроизведение (не перезапускаем)
    }
  }, [playTrack]);

  const prev = useCallback(async () => {
    if (!currentTrack || queue.length === 0) return;
    hasFinishedRef.current = false;
    if (repeatMode === "shuffle") {
      const availableTracks = queue.filter((t) => t.id !== currentTrack.id);
      if (availableTracks.length > 0) {
        const randomTrack =
          availableTracks[Math.floor(Math.random() * availableTracks.length)];
        await playTrack(randomTrack);
      } else {
        await playTrack(currentTrack);
      }
    } else {
      const idx = queue.findIndex((t) => t.id === currentTrack.id);
      const prevIdx = (idx - 1 + queue.length) % queue.length;
      await playTrack(queue[prevIdx]);
    }
  }, [currentTrack, queue, repeatMode, playTrack]);

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

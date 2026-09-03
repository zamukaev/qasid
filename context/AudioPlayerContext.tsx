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
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocalPath } from "../services/download-service";
import {
  invalidateStorageUrl,
  resolveStorageUrlStrict,
} from "../services/storage";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  noteQualifiedListen,
  QUALIFIED_LISTEN_MS,
} from "../services/review-service";

type PlayerViewMode = "hidden" | "mini" | "full";

// Listed at runtime as well as in the type so the persisted value can be
// validated on read — a stale or corrupted entry must never become a mode.
const REPEAT_MODES = ["sequential", "shuffle", "repeat-one"] as const;
type RepeatMode = (typeof REPEAT_MODES)[number];

function isRepeatMode(value: unknown): value is RepeatMode {
  return REPEAT_MODES.includes(value as RepeatMode);
}

type Track = {
  id: string;
  title: string;
  artist?: string;
  artworkUri?: any;
  surahNumber?: number;
  isNasheed?: boolean;
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
  viewMode: PlayerViewMode;
  queue: Track[];
  repeatMode: RepeatMode;
  embeddedArtwork: string | null;
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
  clearPlayback: () => Promise<void>;
  /** Non-reactive read of the latest position/duration — for on-demand checks
   *  (e.g. "did this track finish?") that shouldn't subscribe to the 4x/s
   *  progress ticks. Use `useAudioProgress()` instead if you need to render
   *  a live-updating position/duration (e.g. a progress bar). */
  getPlaybackSnapshot: () => { positionMillis: number; durationMillis: number };
};

// High-frequency fields (~4x/s while playing) live in a separate context so
// that consumers which only need currentTrack/isPlaying/queue/etc. (e.g. a
// screen rendering a long list) don't re-render on every progress tick.
// Only mount a `useAudioProgress()` consumer where you actually render a
// live position/duration (progress bars, sliders).
type AudioProgressContextValue = {
  positionMillis: number;
  durationMillis: number;
  listenedMillis: number;
  didJustFinish: boolean;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(
  undefined,
);

const AudioProgressContext = createContext<
  AudioProgressContextValue | undefined
>(undefined);

const PROGRESS_STORAGE_KEY = "@qasid-reciter-progress";
const REPEAT_MODE_STORAGE_KEY = "@qasid-repeat-mode";

// How many queue entries are resolved and loaded into RNTP before playback
// starts. Enough to cover an immediate lock-screen skip; the rest is appended
// in the background. See playTrack.
const QUEUE_PRIMING_WINDOW = 5;

async function resolveTrackUrl(uri: any, trackId?: string): Promise<string> {
  if (!uri) return uri;
  const raw = typeof uri === "object" && uri.uri !== undefined ? uri.uri : uri;
  if (
    typeof raw === "string" &&
    !raw.startsWith("http") &&
    !raw.startsWith("file")
  ) {
    if (trackId) {
      const local = await getLocalPath(trackId);
      if (local) return local;
    }
    return await resolveStorageUrlStrict(raw);
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
  const [embeddedArtwork, setEmbeddedArtwork] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<TrackProgressMap>({});
  const lastPersistRef = useRef(0);
  const listenedMillisRef = useRef(0);
  const lastReportedPositionRef = useRef(0);
  const latestDurationRef = useRef(0);
  const hasFinishedRef = useRef(false);
  // Aborts a background queue load whose playTrack call has been superseded.
  const playGenerationRef = useRef(0);

  // Tracks foreground/background so we can stop the periodic AsyncStorage
  // writes + high-frequency setState churn while the app is suspended. iOS can
  // terminate a backgrounded app (0xdead10cc) if it holds a file lock across the
  // suspension boundary — continuous progress persistence is exactly that risk.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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
  const isPlayingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    if (isPlayingDebounceRef.current)
      clearTimeout(isPlayingDebounceRef.current);
    isPlayingDebounceRef.current = setTimeout(() => {
      setIsPlaying(isPlayingRaw);
    }, 150);
    return () => {
      if (isPlayingDebounceRef.current)
        clearTimeout(isPlayingDebounceRef.current);
    };
  }, [isPlayingRaw]);

  useEffect(() => {
    if (isPlaying) {
      void activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    return () => {
      deactivateKeepAwake();
    };
  }, [isPlaying]);

  useTrackPlayerEvents([Event.PlaybackState], (event) => {
    console.info(
      `[AUDIO] state=${event.state} appState=${appStateRef.current} @ ${new Date().toISOString()}`,
    );
    if (event.state === State.Error) {
      console.warn("TrackPlayer playback error state", event.error);
    }
  });

  useTrackPlayerEvents([Event.PlaybackError], (event) => {
    console.warn("TrackPlayer playback error", event.code, event.message);
    // The cached download URL may be the reason — drop it so the next attempt
    // re-resolves. No-ops for local files and already-http sources.
    const uri = currentTrackRef.current?.uri;
    const raw = typeof uri === "object" && uri?.uri !== undefined ? uri.uri : uri;
    if (typeof raw === "string" && !raw.startsWith("file")) {
      invalidateStorageUrl(raw);
    }
  });

  useTrackPlayerEvents([Event.MetadataCommonReceived], (event) => {
    const uri = event.metadata?.artworkUri;
    if (uri) setEmbeddedArtwork(uri);
  });

  useTrackPlayerEvents([Event.RemoteDuck], async (event) => {
    console.info("TrackPlayer remote duck event", event);

    // NOTE: `autoHandleInterruptions: true` already pauses/resumes on
    // interruptions, so this handler only needs to be non-destructive. Use
    // pause() (never stop()) — stop() tears down the queue and hides the mini
    // player, which previously made playback "disappear" on a permanent
    // interruption. pause() keeps the track loaded so it can resume.
    if (event.permanent || event.paused) {
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
          // Buffer configuration to prevent audio artifacts
          minBuffer: 15, // Minimum buffer before playback starts (seconds)
          maxBuffer: 50, // Maximum buffer size (seconds)
          playBuffer: 2.5, // Buffer needed to resume after buffering (seconds)
          backBuffer: 10, // Buffer behind current position (seconds)
        });
        console.info("[AUDIO] setupPlayer OK — iosCategory=Playback applied");
      } catch (e) {
        // Could be "already initialized" (harmless) OR a real config failure
        // that leaves the default audio category → background gets suspended.
        console.warn("[AUDIO] setupPlayer threw:", e);
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

      // Restore the persisted repeat mode only once the player is up: the
      // effect that mirrors repeatMode onto RNTP swallows its errors, so
      // hydrating earlier could leave the native repeat mode unset until the
      // user toggled it by hand.
      //
      // The ref is set alongside the state because next / prev / the
      // queue-ended handler read repeatModeRef only — state alone would show
      // the right icon while auto-advance still behaved as "sequential".
      try {
        const stored = await AsyncStorage.getItem(REPEAT_MODE_STORAGE_KEY);
        if (!mounted || !isRepeatMode(stored)) return;
        repeatModeRef.current = stored;
        setRepeatModeState(stored);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ── Sync RNTP progress → state ───────────────────────────────────────────
  // While backgrounded we keep RNTP playing natively but skip the React setState
  // calls. This freezes the deps of the persistence effect below (so it stops
  // writing to AsyncStorage every 2.5s) and removes the 4×/s render churn. The
  // refs are still updated every tick so the final flush on background-entry and
  // the foreground re-sync both have the latest position/duration.
  useEffect(() => {
    const posMs = Math.max(0, Math.floor(progress.position * 1000));
    const durMs = Math.max(0, Math.floor(progress.duration * 1000));
    latestDurationRef.current = durMs;

    const isActive = appStateRef.current === "active";
    if (isActive) {
      setPositionMillis(posMs);
      setDurationMillis(durMs);
    }

    if (isPlayingRaw) {
      const delta = posMs - lastReportedPositionRef.current;
      if (delta > 0) {
        listenedMillisRef.current += Math.min(delta, 2000);
        if (isActive) setListenedMillis(listenedMillisRef.current);

        // Feed the store-review engagement counter. Covers quran and nasheeds,
        // manual plays and auto-advance alike; noteQualifiedListen dedupes per
        // track, so calling it on every subsequent tick is a no-op.
        if (
          listenedMillisRef.current >= QUALIFIED_LISTEN_MS &&
          currentTrackRef.current
        ) {
          noteQualifiedListen(currentTrackRef.current.id);
        }
      }
    }
    lastReportedPositionRef.current = posMs;
  }, [progress, isPlayingRaw]);

  // ── Track AppState + flush progress once on background-entry ──────────────
  // The periodic persistence below is foreground-only, so we save the current
  // position exactly once when leaving the foreground. This is a single write at
  // a safe moment (the "change" event fires before iOS suspends), not the
  // continuous 2.5s write loop that risks a 0xdead10cc termination.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === "active" && next !== "active") {
        const track = currentTrackRef.current;
        const pos = lastReportedPositionRef.current;
        const dur = latestDurationRef.current;
        if (!track || !dur || pos <= 0) return;
        if (pos / dur >= 0.98) return;
        setProgressMap((prevMap) => ({
          ...prevMap,
          [track.id]: { positionMillis: pos, durationMillis: dur },
        }));
        lastPersistRef.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

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
    // Foreground-only: in the background the final flush above already saved the
    // position, and we must not keep writing to AsyncStorage across suspension.
    if (appStateRef.current !== "active") return;
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
  // Persisted here rather than in an effect on [repeatMode]: such an effect
  // fires on the first render and would write the "sequential" default over the
  // stored value before the hydration read in the setup effect resolves.
  const setRepeatMode = useCallback((mode: RepeatMode) => {
    repeatModeRef.current = mode;
    setRepeatModeState(mode);
    AsyncStorage.setItem(REPEAT_MODE_STORAGE_KEY, mode).catch(() => {});
  }, []);

  // ── Core playback helpers ─────────────────────────────────────────────────
  const pause = useCallback(async () => {
    await TrackPlayer.pause();
  }, []);

  const resume = useCallback(async () => {
    await TrackPlayer.play();
  }, []);

  // ── playTrack ─────────────────────────────────────────────────────────────
  // Loads the ENTIRE queue into RNTP, then skips to the requested track, so
  // that skipToNext / skipToPrevious in PlaybackService work natively from the
  // lock screen and Bluetooth controls.
  //
  // Queue entries carry raw Firebase Storage paths, so resolving all of them up
  // front would mean up to 100 round-trips between the tap and the first note.
  // Instead the queue is loaded in two phases: enough tracks to start playing
  // and cover an immediate skip, then the rest appended in the background.
  const playTrack = useCallback(
    async (track: Track, startPositionMillis?: number) => {
      hasFinishedRef.current = false;
      listenedMillisRef.current = 0;
      lastReportedPositionRef.current = startPositionMillis ?? 0;
      setListenedMillis(0);
      setDidJustFinish(false);
      setEmbeddedArtwork(null);

      const generation = ++playGenerationRef.current;

      try {
        // Resolve the tapped track URL first (fast path — often already HTTP).
        const url = await resolveTrackUrl(track.uri, track.id);

        // Read the queue that was set synchronously by setQueue, rotated so the
        // tapped track sits at index 0. This prevents RNTP from briefly
        // activating track 0 before skip().
        const currentQueue = queueRef.current;
        const tappedIndex = currentQueue.findIndex((t) => t.id === track.id);
        const rotatedQueue =
          tappedIndex > 0
            ? [
                ...currentQueue.slice(tappedIndex),
                ...currentQueue.slice(0, tappedIndex),
              ]
            : currentQueue;

        const resolveQueueItem = async (t: Track) => {
          const tUrl =
            t.id === track.id ? url : await resolveTrackUrl(t.uri, t.id);
          return toRNTPTrack(t, tUrl);
        };

        // Phase 1 — resolve only the priming window before touching RNTP, so
        // the previous track keeps playing throughout and there is no audible
        // gap or spurious "paused" state.
        const primed = rotatedQueue.slice(0, QUEUE_PRIMING_WINDOW);
        const primedItems =
          primed.length > 0
            ? await Promise.all(primed.map(resolveQueueItem))
            : [toRNTPTrack(track, url)];

        // A newer playTrack won while we were resolving.
        if (generation !== playGenerationRef.current) return;

        // Reset RNTP queue only after the priming URLs are ready — minimises
        // the window between reset() and play() to just add() + skip().
        await TrackPlayer.reset();
        await TrackPlayer.add(primedItems);

        if (startPositionMillis && startPositionMillis > 0) {
          await TrackPlayer.seekTo(startPositionMillis / 1000);
        }

        await TrackPlayer.play();

        // Update React state — also caught by PlaybackActiveTrackChanged, but
        // setting here avoids a render delay.
        currentTrackRef.current = track;
        setCurrentTrack(track);
        setViewMode((prev) => (prev === "full" ? "full" : "mini"));

        // Phase 2 — append the remainder in the background. next()/prev() read
        // queueRef rather than the RNTP queue, so JS-side skipping is unaffected
        // while this drains; only a lock-screen skip past the priming window
        // inside this brief gap would notice.
        const remainder = rotatedQueue.slice(QUEUE_PRIMING_WINDOW);
        if (remainder.length > 0) {
          void (async () => {
            try {
              const rest = await Promise.all(remainder.map(resolveQueueItem));
              if (generation !== playGenerationRef.current) return;
              await TrackPlayer.add(rest);
            } catch (error) {
              console.warn("Failed to load the rest of the queue", error);
            }
          })();
        }
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
  // Always use playTrack to re-rotate the queue correctly.
  // Remote controls in PlaybackService use RNTP's rotated queue directly.
  const next = useCallback(async () => {
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;

    if (repeatModeRef.current === "shuffle") {
      const available = currentQueue.filter((t) => t.id !== track.id);
      if (available.length > 0) {
        await playTrack(
          available[Math.floor(Math.random() * available.length)],
        );
      }
      return;
    }

    const idx = currentQueue.findIndex((t) => t.id === track.id);
    if (idx !== -1 && idx + 1 < currentQueue.length) {
      await playTrack(currentQueue[idx + 1]);
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
        await playTrack(
          available[Math.floor(Math.random() * available.length)],
        );
      }
      return;
    }

    const idx = currentQueue.findIndex((t) => t.id === track.id);
    if (idx > 0) {
      await playTrack(currentQueue[idx - 1]);
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

  // ── clearPlayback ─────────────────────────────────────────────────────────
  // Fully tears down playback: reset() stops audio, clears the RNTP queue and
  // removes the native lock-screen / notification mini player (iOS Now Playing
  // + Android media notification). React state is cleared too so the in-app
  // NowPlayingBar (which renders only when currentTrack != null) disappears.
  // Used by the free-tier nasheed background gate.
  const clearPlayback = useCallback(async () => {
    await TrackPlayer.reset();
    currentTrackRef.current = null;
    queueRef.current = [];
    setCurrentTrack(null);
    setQueueState([]);
    setViewMode("hidden");
    setPositionMillis(0);
    setDurationMillis(0);
  }, []);

  // Reads the refs kept up to date every tick (see the progress-sync effect
  // above) without subscribing to the fast-changing state — safe to call
  // on-demand (e.g. from a tap handler) without pulling the caller into the
  // 4x/s progress churn.
  const getPlaybackSnapshot = useCallback(
    () => ({
      positionMillis: lastReportedPositionRef.current,
      durationMillis: latestDurationRef.current,
    }),
    [],
  );

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack,
      isPlaying,
      viewMode,
      queue,
      repeatMode,
      embeddedArtwork,
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
      clearPlayback,
      getPlaybackSnapshot,
    }),
    [
      currentTrack,
      isPlaying,
      viewMode,
      queue,
      repeatMode,
      embeddedArtwork,
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
      clearPlayback,
      getPlaybackSnapshot,
    ],
  );

  const progressValue = useMemo<AudioProgressContextValue>(
    () => ({ positionMillis, durationMillis, listenedMillis, didJustFinish }),
    [positionMillis, durationMillis, listenedMillis, didJustFinish],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      <AudioProgressContext.Provider value={progressValue}>
        {children}
      </AudioProgressContext.Provider>
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx)
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}

/** Live position/duration/listened-time, ticking ~4x/s while playing. Only
 *  use this in components that render a live progress bar/slider — anything
 *  else should use `useAudioPlayer().getPlaybackSnapshot()` instead so it
 *  doesn't re-render on every tick. */
export function useAudioProgress() {
  const ctx = useContext(AudioProgressContext);
  if (!ctx)
    throw new Error("useAudioProgress must be used within AudioPlayerProvider");
  return ctx;
}

export type { Track, PlayerViewMode };

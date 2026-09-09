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
  /** Set when a tapped track's audio could not be resolved, so the UI can tell
   *  the user instead of leaving the tap looking ignored. */
  playbackError: string | null;
  clearPlaybackError: () => void;
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

type RNTPTrack = ReturnType<typeof toRNTPTrack>;

/** Fisher-Yates on a copy — the source order has to survive shuffling, since
 *  switching back to sequential is restored from it. */
function shuffled(tracks: readonly Track[]): Track[] {
  const result = [...tracks];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Puts `leadId` at the head and shuffles the rest. The head matters: the queue
 * is reordered around the track that is already playing, which stays untouched
 * so the audio never stops.
 */
function shuffledLeadingWith(
  tracks: readonly Track[],
  leadId: string | undefined,
): Track[] {
  const lead = tracks.find((t) => t.id === leadId);
  if (!lead) return shuffled(tracks);
  return [lead, ...shuffled(tracks.filter((t) => t.id !== lead.id))];
}

/** Rotates `tracks` so `leadId` leads, the same rotation playTrack applies when
 *  it loads a queue — used to restore sequential order from the current track
 *  rather than from the top of the list. */
function rotatedTo(
  tracks: readonly Track[],
  leadId: string | undefined,
): Track[] {
  const index = tracks.findIndex((t) => t.id === leadId);
  if (index <= 0) return [...tracks];
  return [...tracks.slice(index), ...tracks.slice(0, index)];
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
  // The PLAYBACK order: shuffled while shuffle is on, and always a mirror of
  // the order loaded into RNTP.
  const queueRef = useRef<Track[]>([]);
  // The order the screen handed over. Shuffling is not reversible, so restoring
  // sequential order has to read from here.
  const sourceQueueRef = useRef<Track[]>([]);
  // playTrack's phase 2, so a reorder can wait for the queue to finish loading
  // instead of racing the remainder being appended in the old order.
  const queueDrainRef = useRef<Promise<void> | null>(null);
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
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  // Tracks whose Storage path demonstrably does not resolve (deleted object,
  // a surah seeded ahead of its upload). Remembered for the session so the
  // queue rebuild and next/prev skip them instead of failing on them again.
  const unavailableIdsRef = useRef<Set<string>>(new Set());

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
    const raw =
      typeof uri === "object" && uri?.uri !== undefined ? uri.uri : uri;
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
            // The queue itself is shuffled (see setRepeatMode), so looping it
            // is what keeps playback going in shuffled order.
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
    sourceQueueRef.current = tracks;
    // A queue handed over while shuffle is already on must arrive shuffled —
    // otherwise the first queue of a session would play in order.
    const ordered =
      repeatModeRef.current === "shuffle"
        ? shuffledLeadingWith(tracks, currentTrackRef.current?.id)
        : tracks;
    queueRef.current = ordered;
    setQueueState(ordered);
  }, []);

  // ── Reordering the live queue ────────────────────────────────────────────
  // Rewrites the RNTP queue to `ordered` without touching the track that is
  // playing: it stays at index 0 while everything else is removed and re-added
  // behind it, so the audio never stops. Already-resolved RNTP entries are
  // reused, so no Storage URL is resolved a second time.
  const applyPlaybackOrder = useCallback(async (ordered: Track[]) => {
    if (ordered.length === 0) return;
    queueRef.current = ordered;
    setQueueState(ordered);

    try {
      // Reordering mid-load would race playTrack's background remainder, which
      // appends in the order that was current when it started.
      await queueDrainRef.current;
    } catch {}

    try {
      const nativeQueue = await TrackPlayer.getQueue();
      const activeIndex = await TrackPlayer.getActiveTrackIndex();
      if (nativeQueue.length === 0 || activeIndex == null) return;

      const activeId = String(nativeQueue[activeIndex]?.id ?? "");
      const byId = new Map(
        nativeQueue.map((item) => [String(item.id), item] as const),
      );

      const rest = ordered
        .filter((t) => t.id !== activeId)
        .map((t) => byId.get(t.id))
        .filter((item): item is (typeof nativeQueue)[number] => item != null);

      const removable = nativeQueue
        .map((_, index) => index)
        .filter((index) => index !== activeIndex);

      if (removable.length > 0) await TrackPlayer.remove(removable);
      if (rest.length > 0) await TrackPlayer.add(rest);
    } catch (error) {
      console.warn("Failed to reorder the playback queue", error);
    }
  }, []);

  // ── setRepeatMode ────────────────────────────────────────────────────────
  // Persisted here rather than in an effect on [repeatMode]: such an effect
  // fires on the first render and would write the "sequential" default over the
  // stored value before the hydration read in the setup effect resolves.
  const setRepeatMode = useCallback(
    (mode: RepeatMode) => {
      const previous = repeatModeRef.current;
      repeatModeRef.current = mode;
      setRepeatModeState(mode);
      AsyncStorage.setItem(REPEAT_MODE_STORAGE_KEY, mode).catch(() => {});

      if (mode === previous) return;

      // Shuffle has to reach the NATIVE queue, not just next()/prev(): CarPlay,
      // the lock screen, Bluetooth controls and RNTP's own end-of-track advance
      // all walk that queue and never call into React. Reordering it here is
      // what makes those paths shuffle too — without it, only the in-app
      // buttons shuffled and everything else played straight through.
      if (mode === "shuffle") {
        void applyPlaybackOrder(
          shuffledLeadingWith(
            sourceQueueRef.current,
            currentTrackRef.current?.id,
          ),
        );
      } else if (previous === "shuffle") {
        // Back to the order the screen gave us, continuing from the track that
        // is playing rather than jumping back to the top of the list.
        void applyPlaybackOrder(
          rotatedTo(sourceQueueRef.current, currentTrackRef.current?.id),
        );
      }
    },
    [applyPlaybackOrder],
  );

  // ── Core playback helpers ─────────────────────────────────────────────────
  const pause = useCallback(async () => {
    await TrackPlayer.pause();
  }, []);

  const resume = useCallback(async () => {
    await TrackPlayer.play();
  }, []);

  const clearPlaybackError = useCallback(() => setPlaybackError(null), []);

  const markUnavailable = useCallback((trackId: string, error: unknown) => {
    unavailableIdsRef.current.add(trackId);
    console.warn(`Track ${trackId} could not be resolved`, error);
  }, []);

  // Walks the queue from `fromIndex` in `step` direction and returns the first
  // track whose audio has not already failed to resolve.
  const findPlayable = useCallback(
    (tracks: Track[], fromIndex: number, step: number): Track | null => {
      for (let i = fromIndex; i >= 0 && i < tracks.length; i += step) {
        if (!unavailableIdsRef.current.has(tracks[i].id)) return tracks[i];
      }
      return null;
    },
    [],
  );

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

      // The tapped track is the one thing that is not optional: if its URL does
      // not resolve there is nothing to play, so bail out before reset() and
      // leave whatever is currently playing untouched.
      let url: string;
      try {
        url = await resolveTrackUrl(track.uri, track.id);
        // An explicit tap re-tries a track that failed earlier, so a transient
        // failure does not exile it for the rest of the session.
        unavailableIdsRef.current.delete(track.id);
      } catch (error) {
        markUnavailable(track.id, error);
        setPlaybackError("This track is unavailable right now.");
        return;
      }

      try {
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

        // A neighbour that fails to resolve is dropped from the queue rather
        // than rejecting the whole batch — one object missing from Storage used
        // to take playback down for every track around it.
        const resolveQueueItem = async (
          t: Track,
        ): Promise<RNTPTrack | null> => {
          if (t.id !== track.id && unavailableIdsRef.current.has(t.id)) {
            return null;
          }
          try {
            const tUrl =
              t.id === track.id ? url : await resolveTrackUrl(t.uri, t.id);
            return toRNTPTrack(t, tUrl);
          } catch (error) {
            markUnavailable(t.id, error);
            return null;
          }
        };

        // Phase 1 — resolve only the priming window before touching RNTP, so
        // the previous track keeps playing throughout and there is no audible
        // gap or spurious "paused" state.
        const primed = rotatedQueue.slice(0, QUEUE_PRIMING_WINDOW);
        const resolved = (
          await Promise.all(primed.map(resolveQueueItem))
        ).filter((item): item is RNTPTrack => item !== null);

        // The tapped track resolved above, so it is missing here only when it
        // was not part of the queue at all — then it leads on its own.
        const primedItems =
          resolved[0]?.id === track.id
            ? resolved
            : [toRNTPTrack(track, url), ...resolved];

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
          // Published on the ref so a queue reorder can await it — shuffling
          // half a queue would leave the remainder appended in the old order.
          queueDrainRef.current = (async () => {
            try {
              const rest = (
                await Promise.all(remainder.map(resolveQueueItem))
              ).filter((item): item is RNTPTrack => item !== null);
              if (generation !== playGenerationRef.current) return;
              if (rest.length > 0) await TrackPlayer.add(rest);
            } catch (error) {
              console.warn("Failed to load the rest of the queue", error);
            }
          })();
        } else {
          queueDrainRef.current = null;
        }
      } catch (error) {
        console.error("Error playing track:", error);
      }
    },
    [markUnavailable],
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
  // Both walk queueRef, which holds the playback order — already shuffled when
  // shuffle is on. Remote controls (CarPlay, lock screen, Bluetooth) walk the
  // native RNTP queue, which carries that same order, so an in-app skip and a
  // steering-wheel skip land on the same track. Picking a random track here
  // instead would only shuffle the in-app buttons.
  const next = useCallback(async () => {
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;

    const idx = currentQueue.findIndex((t) => t.id === track.id);
    if (idx === -1) return;
    // Shuffle runs on RepeatMode.Queue, so the native queue never ends — it
    // wraps. The button has to wrap too, or it dead-ends on the last track
    // while the same queue keeps rolling on the lock screen.
    const target =
      findPlayable(currentQueue, idx + 1, 1) ??
      (repeatModeRef.current === "shuffle"
        ? findPlayable(currentQueue, 0, 1)
        : null);
    if (target && target.id !== track.id) await playTrack(target);
  }, [playTrack, findPlayable]);

  const prev = useCallback(async () => {
    const track = currentTrackRef.current;
    const currentQueue = queueRef.current;
    if (!track || currentQueue.length === 0) return;
    hasFinishedRef.current = false;

    const idx = currentQueue.findIndex((t) => t.id === track.id);
    if (idx === -1) return;
    const target = findPlayable(currentQueue, idx - 1, -1);
    if (target) await playTrack(target);
  }, [playTrack, findPlayable]);

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
    sourceQueueRef.current = [];
    queueDrainRef.current = null;
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
      playbackError,
      clearPlaybackError,
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
      playbackError,
      clearPlaybackError,
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageSourcePropType } from "react-native";

import { useAudioPlayer } from "../context/AudioPlayerContext";
import { resolveStorageUrlPrioritized } from "../services/storage";
import { useIsPremium } from "../stores/userStore";
import { NasheedTrackMeta } from "../utils/nasheedTrack";
import { pickRandom } from "../utils/random";
import { markManualPlay, useNasheedLimit } from "./useNasheedLimit";

interface Options<T extends NasheedTrackMeta> {
  tracks: readonly T[];
  /** Queue ids are `${trackPrefix}-${track.id}`; also marks the list as active. */
  trackPrefix: string;
  /** Artwork handed to the player for a track. */
  artworkFor: (track: T) => string | ImageSourcePropType;
}

/**
 * Plays a list of nasheeds: the whole list goes into the queue starting at
 * the tapped track, a free user's queue is capped at their plays left, and a
 * free user without plays left gets the premium gate instead.
 *
 * `onPlay`, `playAll` and `playShuffled` are stable, so memoized rows and
 * headers do not re-render when playback state changes.
 */
export function useCollectionPlayback<T extends NasheedTrackMeta>({
  tracks,
  trackPrefix,
  artworkFor,
}: Options<T>) {
  const isPremium = useIsPremium();
  const { canPlay, increment, playsLeft } = useNasheedLimit();
  const [gateVisible, setGateVisible] = useState(false);
  const pendingPlayIdRef = useRef(0);

  const { playTrack, setQueue, currentTrack, pause, resume, isPlaying } =
    useAudioPlayer();

  // Rebuilt per track list rather than per play tap.
  const playableTracks = useMemo(
    () => tracks.filter((item) => !!item.audioPath),
    [tracks],
  );

  const handlePlay = async (track: T) => {
    if (!track.audioPath) return;
    const trackId = `${trackPrefix}-${track.id}`;

    if (currentTrack?.id === trackId) {
      isPlaying ? await pause() : await resume();
      return;
    }

    if (!canPlay(isPremium)) {
      setGateVisible(true);
      return;
    }

    // Jumps the resolution queue so a play tap never waits behind the
    // background artwork resolutions.
    const playId = ++pendingPlayIdRef.current;
    let audioUrl: string;
    try {
      audioUrl = await resolveStorageUrlPrioritized(track.audioPath);
    } catch {
      return;
    }
    // A newer tap won while we were resolving.
    if (playId !== pendingPlayIdRef.current) return;

    // Only after a successful resolve — otherwise a network blip burns one of
    // a free user's daily plays.
    if (!isPremium) await increment();

    const allQueueTracks = playableTracks.map((item) => ({
      id: `${trackPrefix}-${item.id}`,
      title: item.title,
      artist: item.artist,
      artworkUri: artworkFor(item),
      isNasheed: true,
      // Raw paths are fine here: playTrack resolves them lazily, and that path
      // also honours locally downloaded files.
      uri: { uri: item.audioPath as string },
    }));

    const selectedIndex = allQueueTracks.findIndex((t) => t.id === trackId);
    const queueTracks = isPremium
      ? allQueueTracks
      : allQueueTracks.slice(
          Math.max(0, selectedIndex),
          Math.max(0, selectedIndex) + playsLeft,
        );
    setQueue(queueTracks);

    markManualPlay();
    await playTrack({
      id: trackId,
      title: track.title,
      artist: track.artist,
      artworkUri: artworkFor(track),
      isNasheed: true,
      uri: { uri: audioUrl },
    });
  };

  // handlePlay closes over tracks, playsLeft, isPremium and playback state, so
  // it cannot be a stable useCallback. Callers instead get stable wrappers
  // that read the latest version through a ref.
  const handlePlayRef = useRef(handlePlay);
  const playableTracksRef = useRef(playableTracks);
  useEffect(() => {
    handlePlayRef.current = handlePlay;
    playableTracksRef.current = playableTracks;
  });

  const onPlay = useCallback((nasheedId: string) => {
    const track = playableTracksRef.current.find((t) => t.id === nasheedId);
    if (track) void handlePlayRef.current(track);
  }, []);

  const playAll = useCallback(() => {
    const first = playableTracksRef.current[0];
    if (first) void handlePlayRef.current(first);
  }, []);

  const playShuffled = useCallback(() => {
    const track = pickRandom(playableTracksRef.current);
    if (track) void handlePlayRef.current(track);
  }, []);

  const closeGate = useCallback(() => setGateVisible(false), []);

  return {
    playableTracks,
    onPlay,
    playAll,
    playShuffled,
    gateVisible,
    closeGate,
    playsLeft,
  };
}

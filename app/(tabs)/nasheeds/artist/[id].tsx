import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GOLD } from "../../../../constants/colors";
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import {
  NasheedArtist,
  Nasheed,
  NasheedCursor,
} from "../../../../types/nasheed";
import PlaceholderAvatar from "../../../../assets/images/avatar.webp";
import {
  useAudioPlayer,
  useAudioProgress,
} from "../../../../context/AudioPlayerContext";
import {
  SharedCard,
  SharedCardSkeleton,
  ShowError,
  ReciterHeaderSkeleton,
} from "../../../../components";
import { DownloadButton } from "../../../../components/DownloadButton";
import { FavoriteButton } from "../../../../components/FavoriteButton";
import { PremiumGateModal } from "../../../../components/PremiumGateModal";
// TEMP admin curation hotfix — remove with PlaylistPickerModal.
import { AdminPlaylistButton } from "../../../../components/AdminPlaylistButton";
import { PlaylistPickerModal } from "../../../../components/PlaylistPickerModal";
import {
  PlayButton,
  PlayButtonVariant,
} from "../../../../components/PlayButton";
import {
  fetchArtistById,
  fetchArtistNasheeds,
  trackArtistPlayback,
} from "../../../../services/nasheeds-service";
import { addRecentArtist } from "../../../../services/recents-service";
import {
  markManualPlay,
  useNasheedLimit,
} from "../../../../hooks/useNasheedLimit";
import { useIsPremium } from "../../../../stores/userStore";
import { resolveStorageUrlPrioritized } from "../../../../services/storage";
import { useProgressiveStorageUrls } from "../../../../hooks/useProgressiveStorageUrls";

const SCROLL_TO_TOP_THRESHOLD_PX = 400;
const SCROLL_EVENT_THROTTLE_MS = 32;

interface NasheedItem {
  id: string;
  title: string;
  audioUrl: string | null;
  imagePath: string | null;
  raw: Nasheed;
}

// Neither storage path is resolved here — artists can have many paginated
// nasheeds, so eagerly resolving every URL per page would be wasteful. Audio
// resolves lazily on play (see resolveAudioUrl below); artwork resolves
// progressively after the page has painted.
const normalizeNasheeds = (items: Nasheed[]): NasheedItem[] =>
  items.map((item) => ({
    id: item.id,
    title: item.title_en,
    audioUrl: item.audio_path ?? null,
    imagePath: item.image_path ?? null,
    raw: item,
  }));

/**
 * Isolated so the ~4x/s `listenedMillis` progress ticks only re-render this
 * (invisible) tracker, not the parent screen with its full nasheed list.
 * Keyed by `artist.id` in the parent so its tracking-state ref resets per artist.
 */
function ArtistPlaybackTracker({
  artistId,
  currentTrackId,
}: {
  artistId?: string;
  currentTrackId?: string;
}) {
  const { listenedMillis, didJustFinish } = useAudioProgress();
  const trackingStateRef = useRef<
    Record<string, { started: boolean; qualified: boolean; completed: boolean }>
  >({});

  useEffect(() => {
    if (!artistId || !currentTrackId) return;

    const prefix = `${artistId}-`;
    if (!currentTrackId.startsWith(prefix)) return;

    const nasheedId = currentTrackId.slice(prefix.length);
    if (!nasheedId) return;

    const state = trackingStateRef.current[currentTrackId] ?? {
      started: false,
      qualified: false,
      completed: false,
    };

    const track = async (eventType: "started" | "qualified" | "completed") => {
      try {
        await trackArtistPlayback({
          artistId,
          nasheedId,
          eventType,
          playedSeconds: Math.floor(listenedMillis / 1000),
        });
      } catch (e) {
        console.warn("Failed to track artist playback", e);
      }
    };

    if (!state.started && listenedMillis >= 10000) {
      state.started = true;
      trackingStateRef.current[currentTrackId] = state;
      void track("started");
    }

    if (!state.qualified && listenedMillis >= 30000) {
      state.qualified = true;
      trackingStateRef.current[currentTrackId] = state;
      void track("qualified");
    }

    if (!state.completed && didJustFinish) {
      state.completed = true;
      trackingStateRef.current[currentTrackId] = state;
      void track("completed");
    }
  }, [artistId, currentTrackId, didJustFinish, listenedMillis]);

  return null;
}

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();

  const isPremium = useIsPremium();
  const { canPlay, increment, playsLeft } = useNasheedLimit();
  const [gateVisible, setGateVisible] = useState(false);
  // TEMP admin curation hotfix — remove with PlaylistPickerModal.
  const [playlistTarget, setPlaylistTarget] = useState<Nasheed | null>(null);

  const [artist, setArtist] = useState<NasheedArtist | null>(null);
  const [nasheeds, setNasheeds] = useState<NasheedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCursor, setLastCursor] = useState<NasheedCursor | undefined>(
    undefined,
  );
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const isMountedRef = useRef(true);
  const pendingPlayIdRef = useRef(0);
  const showScrollToTopRef = useRef(false);

  // Artwork resolves after the page has painted, never before it.
  const imagePaths = useMemo(
    () => nasheeds.map((n) => n.imagePath),
    [nasheeds],
  );
  const imageUrls = useProgressiveStorageUrls(imagePaths);
  const artworkFor = (item: NasheedItem) =>
    item.imagePath ? imageUrls.get(item.imagePath) : undefined;

  const {
    playTrack,
    setQueue,
    currentTrack,
    pause,
    resume,
    isPlaying,
    viewMode,
  } = useAudioPlayer();

  const contentBottomPadding = viewMode === "hidden" ? 32 : 128;

  // A play tap must not queue behind background image resolutions.
  const resolveAudioUrl = (audioPath: string): Promise<string> =>
    resolveStorageUrlPrioritized(audioPath);

  const loadArtist = async () => {
    if (!id) {
      setError("Artist not specified.");
      return;
    }
    if (!artist) setLoading(true);
    try {
      const [artistData, { nasheeds: nasheedData, nextCursor }] =
        await Promise.all([fetchArtistById(id), fetchArtistNasheeds(id)]);
      if (!isMountedRef.current) return;

      if (!artistData) {
        setError("Artist not found.");
        return;
      }

      setArtist(artistData);
      void addRecentArtist(artistData);
      setNasheeds(normalizeNasheeds(nasheedData));
      setLastCursor(nextCursor);
      setHasMore(!!nextCursor);
      setError(null);
    } catch (e) {
      if (isMountedRef.current) {
        console.error("Error loading artist data:", e);
        setError(
          e instanceof Error ? e.message : "Unable to load artist data.",
        );
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadArtist();
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !id) return;
    setLoadingMore(true);
    try {
      const { nasheeds: more, nextCursor } = await fetchArtistNasheeds(
        id,
        20,
        lastCursor,
      );
      const existingIds = new Set(nasheeds.map((n) => n.id));
      const normalized = normalizeNasheeds(more);
      const fresh = normalized.filter((n) => !existingIds.has(n.id));
      setNasheeds((prev) => [...prev, ...fresh]);
      setLastCursor(nextCursor);
      setHasMore(!!nextCursor);
    } catch (e) {
      console.error("Error loading more nasheeds:", e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePlayNasheed = async (nasheed: NasheedItem) => {
    if (!artist || !nasheed.audioUrl) return;

    const trackId = `${artist.id}-${nasheed.id}`;

    if (currentTrack?.id === trackId) {
      isPlaying ? await pause() : await resume();
      return;
    }

    if (!canPlay(isPremium)) {
      setGateVisible(true);
      return;
    }

    // Cancel any previous in-flight play request for this screen.
    const playId = ++pendingPlayIdRef.current;

    let audioUrl = nasheed.audioUrl;
    try {
      audioUrl = await resolveAudioUrl(audioUrl);
    } catch (e) {
      console.error("Failed to resolve audio URL", e);
      return;
    }

    // A newer tap arrived while we were resolving — discard this stale request.
    if (playId !== pendingPlayIdRef.current) return;

    if (!isPremium) await increment();

    const artworkUri = artist.image_path?.startsWith("http")
      ? artist.image_path
      : PlaceholderAvatar;

    const allQueueTracks = nasheeds
      .filter((item) => !!item.audioUrl)
      .map((item) => ({
        id: `${artist.id}-${item.id}`,
        title: item.title,
        artist: artist.name_en,
        artworkUri: artworkFor(item) ?? artworkUri,
        isNasheed: true,
        uri: { uri: item.audioUrl as string },
      }));

    // For free users, cap the queue at playsLeft tracks from the tapped position.
    // This prevents RNTP from ever loading the track beyond the daily limit.
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
      title: nasheed.title,
      artist: artist.name_en,
      artworkUri: artworkFor(nasheed) ?? artworkUri,
      isNasheed: true,
      uri: { uri: audioUrl },
    });
  };

  const handlePlayAll = async () => {
    const first = nasheeds.find((n) => n.audioUrl);
    if (first) await handlePlayNasheed(first);
  };

  // TEMP admin curation hotfix — remove with PlaylistPickerModal.
  // `raw` is replaced rather than mutated so the memoized row re-renders and
  // the plus icon picks up its new filled/outline state.
  const handlePlaylistChange = (
    nasheedId: string,
    playlistId: string | null,
  ) => {
    setNasheeds((prev) =>
      prev.map((n) =>
        n.id === nasheedId
          ? { ...n, raw: { ...n.raw, playlist_id: playlistId } }
          : n,
      ),
    );
    setPlaylistTarget((current) =>
      current && current.id === nasheedId
        ? { ...current, playlist_id: playlistId }
        : current,
    );
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Only setState when the flag actually flips — this fires on every scroll
    // frame otherwise, re-rendering the whole nasheed list.
    const next =
      (event.nativeEvent.contentOffset?.y ?? 0) > SCROLL_TO_TOP_THRESHOLD_PX;
    if (next !== showScrollToTopRef.current) {
      showScrollToTopRef.current = next;
      setShowScrollToTop(next);
    }

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 50 &&
      hasMore &&
      !loadingMore
    ) {
      loadMore();
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: artist?.name_en ?? "Artist" });
  }, [navigation, artist?.name_en]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadArtist();
  }, [id]);

  if (error) return <ShowError message={error} />;
  if (!artist && !loading)
    return <ShowError message="Artist data is not available." />;

  const isArtistPlaying =
    isPlaying && !!currentTrack?.id.startsWith(`${artist?.id}-`);

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ArtistPlaybackTracker
        key={artist?.id}
        artistId={artist?.id}
        currentTrackId={currentTrack?.id}
      />
      <PremiumGateModal
        visible={gateVisible}
        playsLeft={playsLeft}
        onClose={() => setGateVisible(false)}
      />
      {/* TEMP admin curation hotfix — remove with PlaylistPickerModal. */}
      <PlaylistPickerModal
        visible={!!playlistTarget}
        nasheed={playlistTarget}
        onClose={() => setPlaylistTarget(null)}
        onPlaylistChange={handlePlaylistChange}
      />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        onScroll={handleScroll}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={GOLD}
            colors={[GOLD]}
          />
        }
      >
        {loading ? (
          <ReciterHeaderSkeleton />
        ) : (
          <View className="px-5 pt-6">
            <View className="flex-row items-center">
              <View
                className=" mr-4"
                style={{
                  shadowColor: GOLD,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                }}
              >
                <Image
                  source={
                    artist?.image_path
                      ? { uri: artist.image_path }
                      : PlaceholderAvatar
                  }
                  className="h-40 w-40 rounded-xl border border-qasid-gold/20"
                />
              </View>
              <View className="flex-1">
                <Text className="text-2xl text-qasid-white font-bold mb-1">
                  {artist?.name_en}
                </Text>
              </View>
            </View>
            {artist?.desc && (
              <View className="mt-6">
                <Text className="text-l text-qasid-white  mb-1">
                  {artist?.desc}
                </Text>
              </View>
            )}
            <View className="mt-6">
              <PlayButton
                handlePlayAll={handlePlayAll}
                label="Play"
                kind={PlayButtonVariant.PRIMARY}
                isPlaying={isArtistPlaying}
              />
            </View>
          </View>
        )}

        <View className="mt-8 px-5">
          <View className="mb-4">
            <Text className="text-qasid-white text-xl font-semibold">
              Nasheeds
            </Text>
          </View>

          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <View key={`skeleton-${i}`} className="mb-1">
                <SharedCardSkeleton />
              </View>
            ))
          ) : (
            <>
              {nasheeds.map((nasheed) => {
                const trackId = `${artist?.id}-${nasheed.id}`;
                const isActive = currentTrack?.id === trackId;
                return (
                  <SharedCard
                    className="mb-1"
                    key={nasheed.id}
                    handlePlayTrack={() => handlePlayNasheed(nasheed)}
                    isPlaying={isPlaying && isActive}
                    isPaused={isActive}
                    title={nasheed.title}
                    image={artworkFor(nasheed)}
                    subtitle={artist?.name_en ?? ""}
                    track={{
                      id: trackId,
                      title: nasheed.title,
                      artist: artist?.name_en,
                      uri: nasheed.audioUrl,
                    }}
                    rightAction={
                      <View className="flex-row items-center">
                        {/* TEMP admin curation hotfix — remove with PlaylistPickerModal. */}
                        <AdminPlaylistButton
                          nasheed={nasheed.raw}
                          onPress={setPlaylistTarget}
                        />
                        <FavoriteButton nasheed={nasheed.raw} />
                        {nasheed.audioUrl ? (
                          <DownloadButton
                            track={{
                              id: trackId,
                              title: nasheed.title,
                              artist: artist?.name_en,
                              isNasheed: true,
                              uri: nasheed.audioUrl,
                            }}
                          />
                        ) : null}
                      </View>
                    }
                  />
                );
              })}

              {nasheeds.length === 0 && !loading && (
                <Text className="text-qasid-white/70 text-base">
                  No nasheeds available for this artist yet.
                </Text>
              )}

              {loadingMore && (
                <>
                  <SharedCardSkeleton />
                  <SharedCardSkeleton />
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() =>
          scrollViewRef.current?.scrollTo({ y: 0, animated: true })
        }
        activeOpacity={0.8}
        disabled={!showScrollToTop}
        style={{
          position: "absolute",
          right: 20,
          bottom: viewMode === "hidden" ? 40 : 128,
          backgroundColor: "rgba(201, 168, 76, 0.7)",
          borderRadius: 999,
          width: 52,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          opacity: showScrollToTop ? 1 : 0,
        }}
      >
        <Ionicons name="arrow-up" size={20} color="#090A07" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GOLD } from "../constants/colors";
import PlaceholderAvatar from "../assets/images/avatar.webp";
import { Nasheed } from "../types/nasheed";
import { NasheedTrackMeta } from "../utils/nasheedTrack";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useImageLoadState } from "../hooks/useImageLoadState";
import { useProgressiveStorageUrls } from "../hooks/useProgressiveStorageUrls";
import { resolveStorageUrlPrioritized } from "../services/storage";
import SharedCardSkeleton from "./SharedCardSkeleton";
import ShowError from "./ShowError";
import ReciterHeaderSkeleton from "./ReciterHeaderSkeleton";
import ImageShimmerOverlay from "./ImageShimmerOverlay";
import { PremiumGateModal } from "./PremiumGateModal";
import { PlayButton, PlayButtonVariant } from "./PlayButton";
import { TrackCollectionRow } from "./TrackCollectionRow";
import { markManualPlay, useNasheedLimit } from "../hooks/useNasheedLimit";
import { useIsPremium } from "../stores/userStore";

export interface CollectionTrack extends NasheedTrackMeta {
  nasheed: Nasheed;
}

const SKELETON_ROW_COUNT = 8;
const SCROLL_TO_TOP_THRESHOLD_PX = 400;
const SCROLL_EVENT_THROTTLE_MS = 32;

// Roughly one viewport plus a row, so the first commit stays small.
const INITIAL_ROWS_TO_RENDER = 12;
const ROWS_PER_RENDER_BATCH = 10;
const CELL_BATCHING_PERIOD_MS = 50;
// Default is 21 viewports of retained rows; 7 keeps ~5x less mounted.
const LIST_WINDOW_SIZE = 7;

const keyExtractor = (track: CollectionTrack) => track.id;

interface Props {
  title: string;
  subtitle?: string;
  description?: string;
  headerImagePath?: string;
  trackPrefix: string;
  tracks: CollectionTrack[];
  loading: boolean;
  error?: string | null;
  emptyMessage?: string;
  showFavorites?: boolean;
  favoriteIds?: Set<string>;
  onRefresh?: () => Promise<void>;
}

export function TrackCollectionScreen({
  title,
  subtitle,
  description,
  headerImagePath,
  trackPrefix,
  tracks,
  loading,
  error,
  emptyMessage = "No nasheeds here yet.",
  showFavorites = true,
  favoriteIds,
  onRefresh,
}: Props) {
  const isPremium = useIsPremium();
  const { canPlay, increment, playsLeft } = useNasheedLimit();
  const [gateVisible, setGateVisible] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const listRef = useRef<FlatList<CollectionTrack> | null>(null);
  const pendingPlayIdRef = useRef(0);
  const showScrollToTopRef = useRef(false);

  const {
    playTrack,
    setQueue,
    currentTrack,
    pause,
    resume,
    isPlaying,
    viewMode,
  } = useAudioPlayer();

  const {
    source: headerImageSource,
    showSkeleton: headerImageLoading,
    onLoad: onHeaderImageLoad,
    onError: onHeaderImageError,
  } = useImageLoadState(headerImagePath);

  // Artwork resolves after the list has painted, never before it.
  const imagePaths = useMemo(() => tracks.map((t) => t.imagePath), [tracks]);
  const imageUrls = useProgressiveStorageUrls(imagePaths);

  const fallbackArt = headerImagePath?.startsWith("http")
    ? headerImagePath
    : PlaceholderAvatar;

  const artworkFor = (track: CollectionTrack) =>
    (track.imagePath ? imageUrls.get(track.imagePath) : undefined) ??
    fallbackArt;

  // Rebuilt per track list rather than per play tap.
  const playableTracks = useMemo(
    () => tracks.filter((item) => !!item.audioPath),
    [tracks],
  );

  const handlePlay = async (track: CollectionTrack) => {
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
    // background artwork resolutions kicked off above.
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
  // it cannot be a stable useCallback. Rows and the memoized header instead get
  // stable wrappers that read the latest version through a ref.
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

  const handlePlayAll = useCallback(() => {
    const first = playableTracksRef.current[0];
    if (first) void handlePlayRef.current(first);
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next =
        (event.nativeEvent.contentOffset?.y ?? 0) > SCROLL_TO_TOP_THRESHOLD_PX;
      if (next === showScrollToTopRef.current) return;
      showScrollToTopRef.current = next;
      setShowScrollToTop(next);
    },
    [],
  );

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const isCollectionPlaying =
    isPlaying && !!currentTrack?.id.startsWith(trackPrefix);

  // A memoized element, not an inline component: an inline component's identity
  // changes every render and would remount the header image on every state
  // change, flickering the artwork.
  const listHeader = useMemo(
    () => (
      <>
        {loading ? (
          <ReciterHeaderSkeleton />
        ) : (
          <View className="pt-6">
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
                  source={headerImageSource}
                  onLoad={onHeaderImageLoad}
                  onError={onHeaderImageError}
                  className="h-40 w-40 rounded-xl border border-qasid-gold/20"
                />
                <ImageShimmerOverlay
                  visible={headerImageLoading}
                  rounded="xl"
                />
              </View>
              <View className="flex-1">
                <Text className="text-2xl text-qasid-white font-bold mb-1">
                  {title}
                </Text>
                <Text className="text-sm text-qasid-white/70">
                  {subtitle ?? `${tracks.length} Nasheeds`}
                </Text>
              </View>
            </View>
            {!!description && (
              <View className="mt-6">
                <Text className="text-l text-qasid-white mb-1">
                  {description}
                </Text>
              </View>
            )}
            <View className="mt-6">
              <PlayButton
                handlePlayAll={handlePlayAll}
                label="Play"
                kind={PlayButtonVariant.PRIMARY}
                isPlaying={isCollectionPlaying}
              />
            </View>
          </View>
        )}

        <View className="mt-8 mb-4">
          <Text className="text-qasid-white text-xl font-semibold">
            Nasheeds
          </Text>
        </View>
      </>
    ),
    [
      loading,
      headerImageSource,
      headerImageLoading,
      onHeaderImageLoad,
      onHeaderImageError,
      title,
      subtitle,
      description,
      tracks.length,
      isCollectionPlaying,
      handlePlayAll,
    ],
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View>
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <View key={`skeleton-${i}`} className="mb-1">
              <SharedCardSkeleton />
            </View>
          ))}
        </View>
      );
    }
    return (
      <Text className="text-qasid-white/70 text-base">{emptyMessage}</Text>
    );
  }, [loading, emptyMessage]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CollectionTrack>) => {
      const trackId = `${trackPrefix}-${item.id}`;
      const isActive = currentTrack?.id === trackId;
      return (
        <TrackCollectionRow
          trackId={trackId}
          nasheedId={item.id}
          title={item.title}
          artist={item.artist}
          audioPath={item.audioPath}
          imageUrl={item.imagePath ? imageUrls.get(item.imagePath) : undefined}
          isActive={isActive}
          // Scoped to this row so toggling playback only re-renders the two
          // rows whose state actually changed, not the whole list.
          isPlaying={isPlaying && isActive}
          isFavorite={!!favoriteIds?.has(item.id)}
          showFavorites={showFavorites}
          nasheed={item.nasheed}
          onPlay={onPlay}
        />
      );
    },
    [
      trackPrefix,
      imageUrls,
      currentTrack?.id,
      isPlaying,
      favoriteIds,
      showFavorites,
      onPlay,
    ],
  );

  if (error) return <ShowError message={error} />;

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <PremiumGateModal
        visible={gateVisible}
        playsLeft={playsLeft}
        onClose={() => setGateVisible(false)}
      />
      <FlatList
        ref={listRef}
        data={loading ? [] : tracks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: viewMode === "hidden" ? 32 : 128,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
        initialNumToRender={INITIAL_ROWS_TO_RENDER}
        maxToRenderPerBatch={ROWS_PER_RENDER_BATCH}
        updateCellsBatchingPeriod={CELL_BATCHING_PERIOD_MS}
        windowSize={LIST_WINDOW_SIZE}
        // SharedCard is absolutely-positioned gradients inside an
        // overflow-hidden container — exactly the shape iOS blanks out.
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={GOLD}
              colors={[GOLD]}
            />
          ) : undefined
        }
      />

      <TouchableOpacity
        onPress={() =>
          listRef.current?.scrollToOffset({ offset: 0, animated: true })
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

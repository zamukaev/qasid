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

import { Playlist, Nasheed } from "../../../../types/nasheed";
import PlaceholderAvatar from "../../../../assets/images/avatar.webp";
import { useAudioPlayer } from "../../../../context/AudioPlayerContext";
import { useImageLoadState } from "../../../../hooks/useImageLoadState";
import {
  SharedCard,
  SharedCardSkeleton,
  ShowError,
  ReciterHeaderSkeleton,
  ImageShimmerOverlay,
} from "../../../../components";
import { PremiumGateModal } from "../../../../components/PremiumGateModal";
import {
  PlayButton,
  PlayButtonVariant,
} from "../../../../components/PlayButton";
import {
  fetchPlaylistById,
  fetchNasheedsForPlaylist,
} from "../../../../services/playlists-service";
import {
  markManualPlay,
  useNasheedLimit,
} from "../../../../hooks/useNasheedLimit";
import { useIsPremium } from "../../../../stores/userStore";
import { toNasheedTrackMeta } from "../../../../utils/nasheedTrack";
import { useProgressiveStorageUrls } from "../../../../hooks/useProgressiveStorageUrls";
import { resolveStorageUrlPrioritized } from "../../../../services/storage";

const SCROLL_TO_TOP_THRESHOLD_PX = 400;
const SCROLL_EVENT_THROTTLE_MS = 32;

interface NasheedItem {
  id: string;
  title: string;
  /** Raw Storage path (or http URL) — resolved on play. */
  audioPath: string | null;
  /** Raw Storage path (or http URL) — resolved progressively after paint. */
  imagePath: string | null;
}

// Synchronous: storage paths stay raw so the list paints immediately.
const normalizeNasheeds = (items: Nasheed[]): NasheedItem[] =>
  items.map((item) => {
    const { id, title, audioPath, imagePath } = toNasheedTrackMeta(item);
    return { id, title, audioPath, imagePath };
  });

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();

  const isPremium = useIsPremium();
  const { canPlay, increment, playsLeft } = useNasheedLimit();
  const [gateVisible, setGateVisible] = useState(false);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [nasheeds, setNasheeds] = useState<NasheedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const isMountedRef = useRef(true);
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

  const trackPrefix = `playlist-${id}`;

  // Artwork resolves after the list has painted, never before it.
  const imagePaths = useMemo(
    () => nasheeds.map((n) => n.imagePath),
    [nasheeds],
  );
  const imageUrls = useProgressiveStorageUrls(imagePaths);
  const artworkFor = (item: NasheedItem) =>
    item.imagePath ? imageUrls.get(item.imagePath) : undefined;

  const {
    source: playlistImageSource,
    showSkeleton: playlistImageLoading,
    onLoad: onPlaylistImageLoad,
    onError: onPlaylistImageError,
  } = useImageLoadState(playlist?.image_path);

  const loadPlaylist = async () => {
    if (!id) {
      setError("Playlist not specified.");
      return;
    }
    if (!playlist) setLoading(true);
    try {
      const [playlistData, nasheedData] = await Promise.all([
        fetchPlaylistById(id),
        fetchNasheedsForPlaylist(id),
      ]);
      if (!isMountedRef.current) return;

      if (!playlistData) {
        setError("Playlist not found.");
        return;
      }

      setPlaylist(playlistData);
      setNasheeds(normalizeNasheeds(nasheedData));
      setError(null);
    } catch (e) {
      if (isMountedRef.current) {
        console.error("Error loading playlist:", e);
        setError(
          e instanceof Error ? e.message : "Unable to load playlist data.",
        );
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPlaylist();
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  };

  const handlePlayNasheed = async (nasheed: NasheedItem) => {
    if (!playlist || !nasheed.audioPath) return;

    const trackId = `${trackPrefix}-${nasheed.id}`;

    if (currentTrack?.id === trackId) {
      isPlaying ? await pause() : await resume();
      return;
    }

    if (!canPlay(isPremium)) {
      setGateVisible(true);
      return;
    }

    // Jumps the resolution queue so a play tap never waits behind background
    // artwork resolutions.
    const playId = ++pendingPlayIdRef.current;
    let audioUrl: string;
    try {
      audioUrl = await resolveStorageUrlPrioritized(nasheed.audioPath);
    } catch {
      return;
    }
    // A newer tap won while we were resolving.
    if (playId !== pendingPlayIdRef.current) return;

    // Only after a successful resolve — otherwise a network blip burns one of
    // a free user's daily plays.
    if (!isPremium) {
      await increment();
    }

    const artworkUri = playlist.image_path?.startsWith("http")
      ? playlist.image_path
      : PlaceholderAvatar;

    const allQueueTracks = nasheeds
      .filter((item) => !!item.audioPath)
      .map((item) => ({
        id: `${trackPrefix}-${item.id}`,
        title: item.title,
        artist: playlist.name_en,
        artworkUri: artworkFor(item) ?? artworkUri,
        isNasheed: true,
        // Raw paths are fine: playTrack resolves them lazily, and that path
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
      title: nasheed.title,
      artist: playlist.name_en,
      artworkUri: artworkFor(nasheed) ?? artworkUri,
      isNasheed: true,
      uri: { uri: audioUrl },
    });
  };

  const handlePlayAll = async () => {
    const first = nasheeds.find((n) => n.audioPath);
    if (first) await handlePlayNasheed(first);
  };

  // Only setState when the flag actually flips — this fires on every scroll
  // frame otherwise, re-rendering the whole list.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next =
      (event.nativeEvent.contentOffset?.y ?? 0) > SCROLL_TO_TOP_THRESHOLD_PX;
    if (next === showScrollToTopRef.current) return;
    showScrollToTopRef.current = next;
    setShowScrollToTop(next);
  };

  useLayoutEffect(() => {
    navigation.setOptions({ title: playlist?.name_en ?? "Playlist" });
  }, [navigation, playlist?.name_en]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadPlaylist();
  }, [id]);

  if (error) return <ShowError message={error} />;
  if (!playlist && !loading)
    return <ShowError message="Playlist data is not available." />;

  const isPlaylistPlaying =
    isPlaying && !!currentTrack?.id.startsWith(trackPrefix);

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <PremiumGateModal
        visible={gateVisible}
        playsLeft={playsLeft}
        onClose={() => setGateVisible(false)}
      />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{
          paddingBottom: viewMode === "hidden" ? 32 : 128,
        }}
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
                className="mr-4 overflow-hidden rounded-xl"
                style={{
                  shadowColor: GOLD,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                }}
              >
                <Image
                  source={playlistImageSource}
                  onLoad={onPlaylistImageLoad}
                  onError={onPlaylistImageError}
                  className="h-40 w-40 rounded-xl border border-qasid-gold/30"
                />
                <ImageShimmerOverlay
                  visible={playlistImageLoading}
                  rounded="xl"
                />
              </View>
              <View className="flex-1">
                <Text className="text-2xl text-qasid-white font-bold mb-1">
                  {playlist?.name_en}
                </Text>
                <Text className="text-sm text-qasid-white/70">
                  {nasheeds.length} Nasheeds
                </Text>
              </View>
            </View>
            {playlist?.desc && (
              <View className="mt-6">
                <Text className="text-l text-qasid-white mb-1">
                  {playlist.desc}
                </Text>
              </View>
            )}
            <View className="mt-6">
              <PlayButton
                handlePlayAll={handlePlayAll}
                label="Play"
                kind={PlayButtonVariant.PRIMARY}
                isPlaying={isPlaylistPlaying}
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
                const trackId = `${trackPrefix}-${nasheed.id}`;
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
                    subtitle={playlist?.name_en ?? ""}
                    track={{
                      id: trackId,
                      title: nasheed.title,
                      artist: playlist?.name_en,
                      uri: nasheed.audioPath,
                    }}
                  />
                );
              })}

              {nasheeds.length === 0 && !loading && (
                <Text className="text-qasid-white/70 text-base">
                  No nasheeds in this playlist yet.
                </Text>
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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getApp } from "@react-native-firebase/app";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import {
  Image,
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
import { useAudioPlayer } from "../../../../context/AudioPlayerContext";
import {
  SharedCard,
  SharedCardSkeleton,
  ShowError,
  ReciterHeaderSkeleton,
} from "../../../../components";
import {
  PlayButton,
  PlayButtonVariant,
} from "../../../../components/PlayButton";
import {
  fetchArtistById,
  fetchArtistNasheeds,
  trackArtistPlayback,
} from "../../../../services/nasheeds-service";

interface NasheedItem {
  id: string;
  title: string;
  audioUrl: string | null;
  imageUrl: string | null;
}

const normalizeNasheeds = (items: Nasheed[]): NasheedItem[] =>
  items.map((item) => ({
    id: item.id,
    title: item.title_en,
    audioUrl: item.audio_path ?? null,
    imageUrl: item.image_path ?? null,
  }));

export default function ArtistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();

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

  const scrollViewRef = useRef<ScrollView | null>(null);
  const isMountedRef = useRef(true);
  const pendingPlayIdRef = useRef(0);

  const {
    playTrack,
    setQueue,
    currentTrack,
    pause,
    resume,
    isPlaying,
    viewMode,
    listenedMillis,
    didJustFinish,
  } = useAudioPlayer();

  const playbackTrackingRef = useRef<
    Record<string, { started: boolean; qualified: boolean; completed: boolean }>
  >({});

  useEffect(() => {
    if (!artist?.id || !currentTrack?.id) return;

    const prefix = `${artist.id}-`;
    if (!currentTrack.id.startsWith(prefix)) return;

    const nasheedId = currentTrack.id.slice(prefix.length);
    if (!nasheedId) return;

    const state = playbackTrackingRef.current[currentTrack.id] ?? {
      started: false,
      qualified: false,
      completed: false,
    };

    const track = async (eventType: "started" | "qualified" | "completed") => {
      try {
        await trackArtistPlayback({
          artistId: artist.id,
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
      playbackTrackingRef.current[currentTrack.id] = state;
      void track("started");
    }

    if (!state.qualified && listenedMillis >= 30000) {
      state.qualified = true;
      playbackTrackingRef.current[currentTrack.id] = state;
      void track("qualified");
    }

    if (!state.completed && didJustFinish) {
      state.completed = true;
      playbackTrackingRef.current[currentTrack.id] = state;
      void track("completed");
    }
  }, [artist?.id, currentTrack?.id, didJustFinish, listenedMillis]);

  const contentBottomPadding = viewMode === "hidden" ? 32 : 128;

  const resolveAudioUrl = async (audioPath: string): Promise<string> => {
    if (audioPath.startsWith("http")) return audioPath;
    return getDownloadURL(ref(getStorage(getApp()), audioPath));
  };

  const loadArtist = async () => {
    if (!id) {
      setError("Artist not specified.");
      return;
    }
    setLoading(true);
    try {
      const [artistData, { nasheeds: nasheedData, nextCursor }] =
        await Promise.all([fetchArtistById(id), fetchArtistNasheeds(id)]);

      if (!isMountedRef.current) return;

      if (!artistData) {
        setError("Artist not found.");
        return;
      }

      setArtist(artistData);
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

  const loadMore = async () => {
    if (loadingMore || !hasMore || !id) return;
    setLoadingMore(true);
    try {
      const { nasheeds: more, nextCursor } = await fetchArtistNasheeds(
        id,
        20,
        lastCursor,
      );
      setNasheeds((prev) => [...prev, ...normalizeNasheeds(more)]);
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

    const artworkUri = artist.image_path?.startsWith("http")
      ? artist.image_path
      : PlaceholderAvatar;

    const queueTracks = nasheeds
      .filter((item) => !!item.audioUrl)
      .map((item) => ({
        id: `${artist.id}-${item.id}`,
        title: item.title,
        artist: artist.name_en,
        artworkUri: item.imageUrl ?? artworkUri,
        uri: { uri: item.audioUrl as string },
      }));
    setQueue(queueTracks);

    await playTrack({
      id: trackId,
      title: nasheed.title,
      artist: artist.name_en,
      artworkUri: nasheed.imageUrl ?? artworkUri,
      uri: { uri: audioUrl },
    });
  };

  const handlePlayAll = async () => {
    const first = nasheeds.find((n) => n.audioUrl);
    if (first) await handlePlayNasheed(first);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset?.y ?? 0;
    setShowScrollToTop(offsetY > 400);

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
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {loading ? (
          <ReciterHeaderSkeleton />
        ) : (
          <View className="px-5 pt-6">
            <View className="flex-row items-center">
              <View
                className="rounded-full mr-4"
                style={{
                  shadowColor: "#E7C11C",
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
                  className="h-24 w-24 rounded-full border border-qasid-gold/30"
                />
              </View>
              <View className="flex-1">
                <Text className="text-2xl text-qasid-white font-bold mb-1">
                  {artist?.name_en}
                </Text>
                {!!artist?.nasheed_count && (
                  <View className="flex-row items-center gap-2">
                    <FontAwesome6 name="list-ul" size={12} color="#E7C11C" />
                    <Text className="text-sm text-qasid-white/70">
                      {artist.nasheed_count} Nasheeds
                    </Text>
                  </View>
                )}
              </View>
            </View>

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
                    image={nasheed.imageUrl ?? undefined}
                    subtitle={artist?.name_en ?? ""}
                    track={{
                      id: trackId,
                      title: nasheed.title,
                      artist: artist?.name_en,
                      uri: nasheed.audioUrl,
                    }}
                  />
                );
              })}

              {nasheeds.length === 0 && !loading && (
                <Text className="text-qasid-white/70 text-base">
                  No nasheeds available for this artist yet.
                </Text>
              )}

              {loadingMore && (
                <Text className="text-qasid-gold text-sm text-center py-4">
                  Loading more...
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
          backgroundColor: "rgba(231, 193, 28, 0.7)",
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

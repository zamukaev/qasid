import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GOLD } from "../../../../constants/colors";
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

import { Playlist, Nasheed } from "../../../../types/nasheed";
import PlaceholderAvatar from "../../../../assets/images/avatar.webp";
import { useAudioPlayer } from "../../../../context/AudioPlayerContext";
import { useReciterImageSource } from "../../../../hooks/useReciterImageSource";
import {
  SharedCard,
  SharedCardSkeleton,
  ShowError,
  ReciterHeaderSkeleton,
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
import { markManualPlay, useNasheedLimit } from "../../../../hooks/useNasheedLimit";
import { useUserStore } from "../../../../stores/userStore";

interface NasheedItem {
  id: string;
  title: string;
  audioUrl: string | null;
  imageUrl: string | null;
}

const resolveStorageUrl = async (path: string): Promise<string> => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  try {
    return await getDownloadURL(ref(getStorage(getApp()), path));
  } catch {
    return path;
  }
};

const normalizeNasheeds = async (items: Nasheed[]): Promise<NasheedItem[]> =>
  Promise.all(
    items.map(async (item) => ({
      id: item.id,
      title: item.title_en,
      audioUrl: item.audio_path
        ? await resolveStorageUrl(item.audio_path)
        : null,
      imageUrl: item.image_path
        ? await resolveStorageUrl(item.image_path)
        : null,
    })),
  );

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();

  const { currentPlan } = useUserStore();
  const { canPlay, increment, playsLeft } = useNasheedLimit();
  const [gateVisible, setGateVisible] = useState(false);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [nasheeds, setNasheeds] = useState<NasheedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  } = useAudioPlayer();

  const trackPrefix = `playlist-${id}`;
  const playlistImageSource = useReciterImageSource(playlist?.image_path);

  const loadPlaylist = async () => {
    if (!id) {
      setError("Playlist not specified.");
      return;
    }
    setLoading(true);
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
      setNasheeds(await normalizeNasheeds(nasheedData));
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

  const handlePlayNasheed = async (nasheed: NasheedItem) => {
    if (!playlist || !nasheed.audioUrl) return;

    const trackId = `${trackPrefix}-${nasheed.id}`;

    if (currentTrack?.id === trackId) {
      isPlaying ? await pause() : await resume();
      return;
    }

    if (!canPlay(currentPlan !== "free")) {
      setGateVisible(true);
      return;
    }

    const playId = ++pendingPlayIdRef.current;
    if (playId !== pendingPlayIdRef.current) return;

    await increment();

    const artworkUri = playlist.image_path?.startsWith("http")
      ? playlist.image_path
      : PlaceholderAvatar;

    const isPremium = currentPlan !== "free";
    const allQueueTracks = nasheeds
      .filter((item) => !!item.audioUrl)
      .map((item) => ({
        id: `${trackPrefix}-${item.id}`,
        title: item.title,
        artist: playlist.name_en,
        artworkUri: item.imageUrl ?? artworkUri,
        isNasheed: true,
        uri: { uri: item.audioUrl as string },
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
      artworkUri: nasheed.imageUrl ?? artworkUri,
      isNasheed: true,
      uri: { uri: nasheed.audioUrl as string },
    });
  };

  const handlePlayAll = async () => {
    const first = nasheeds.find((n) => n.audioUrl);
    if (first) await handlePlayNasheed(first);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset?.y ?? 0;
    setShowScrollToTop(offsetY > 400);
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
        scrollEventThrottle={16}
      >
        {loading ? (
          <ReciterHeaderSkeleton />
        ) : (
          <View className="px-5 pt-6">
            <View className="flex-row items-center">
              <View
                className="mr-4"
                style={{
                  shadowColor: GOLD,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                }}
              >
                <Image
                  source={playlistImageSource}
                  className="h-28 w-28 rounded-xl border border-qasid-gold/30"
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
                    image={nasheed.imageUrl ?? undefined}
                    subtitle={playlist?.name_en ?? ""}
                    track={{
                      id: trackId,
                      title: nasheed.title,
                      artist: playlist?.name_en,
                      uri: nasheed.audioUrl,
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

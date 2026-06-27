import { useRef, useState } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GOLD } from "../constants/colors";
import PlaceholderAvatar from "../assets/images/avatar.webp";
import { Nasheed } from "../types/nasheed";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useReciterImageSource } from "../hooks/useReciterImageSource";
import { SharedCard } from "./SharedCard";
import SharedCardSkeleton from "./SharedCardSkeleton";
import ShowError from "./ShowError";
import ReciterHeaderSkeleton from "./ReciterHeaderSkeleton";
import { FavoriteButton } from "./FavoriteButton";
import { PremiumGateModal } from "./PremiumGateModal";
import { PlayButton, PlayButtonVariant } from "./PlayButton";
import { markManualPlay, useNasheedLimit } from "../hooks/useNasheedLimit";
import { useIsPremium } from "../stores/userStore";

export interface CollectionTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string | null;
  imageUrl: string | null;
  nasheed: Nasheed;
}

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
}: Props) {
  const isPremium = useIsPremium();
  const { canPlay, increment, playsLeft } = useNasheedLimit();
  const [gateVisible, setGateVisible] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
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

  const headerImageSource = useReciterImageSource(headerImagePath);

  const handlePlay = async (track: CollectionTrack) => {
    if (!track.audioUrl) return;
    const trackId = `${trackPrefix}-${track.id}`;

    if (currentTrack?.id === trackId) {
      isPlaying ? await pause() : await resume();
      return;
    }

    if (!canPlay(isPremium)) {
      setGateVisible(true);
      return;
    }

    const playId = ++pendingPlayIdRef.current;
    if (playId !== pendingPlayIdRef.current) return;

    if (!isPremium) await increment();

    const fallbackArt = headerImagePath?.startsWith("http")
      ? headerImagePath
      : PlaceholderAvatar;

    const allQueueTracks = tracks
      .filter((item) => !!item.audioUrl)
      .map((item) => ({
        id: `${trackPrefix}-${item.id}`,
        title: item.title,
        artist: item.artist,
        artworkUri: item.imageUrl ?? fallbackArt,
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
      title: track.title,
      artist: track.artist,
      artworkUri: track.imageUrl ?? fallbackArt,
      isNasheed: true,
      uri: { uri: track.audioUrl as string },
    });
  };

  const handlePlayAll = async () => {
    const first = tracks.find((t) => t.audioUrl);
    if (first) await handlePlay(first);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset?.y ?? 0;
    setShowScrollToTop(offsetY > 400);
  };

  if (error) return <ShowError message={error} />;

  const isCollectionPlaying =
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
                  source={headerImageSource}
                  className="h-28 w-28 rounded-xl border border-qasid-gold/30"
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
              {tracks.map((track) => {
                const trackId = `${trackPrefix}-${track.id}`;
                const isActive = currentTrack?.id === trackId;
                return (
                  <SharedCard
                    className="mb-1"
                    key={track.id}
                    handlePlayTrack={() => handlePlay(track)}
                    isPlaying={isPlaying && isActive}
                    isPaused={isActive}
                    title={track.title}
                    image={track.imageUrl ?? undefined}
                    subtitle={track.artist}
                    track={{
                      id: trackId,
                      title: track.title,
                      artist: track.artist,
                      uri: track.audioUrl,
                    }}
                    rightAction={
                      showFavorites ? (
                        <FavoriteButton
                          nasheed={track.nasheed}
                          initialFavorite={favoriteIds?.has(track.id)}
                        />
                      ) : undefined
                    }
                  />
                );
              })}

              {tracks.length === 0 && !loading && (
                <Text className="text-qasid-white/70 text-base">
                  {emptyMessage}
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
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

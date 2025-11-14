import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { axiosInstance } from "../../../../services/api-service";
import { Reciter } from "../../../../types/quran";
import { SURAH_METADATA } from "../../../../constants/surahMetadata";

import PlaceholderAvatar from "../../../../assets/reciters/mishary-rashid.jpg";
import { useAudioPlayer } from "../../../../context/AudioPlayerContext";

interface SurahListItem {
  id: number;
  englishName: string;
  arabicName: string;
  audioUrl: string | null;
}

const mockDescription =
  "One of the most inspiring reciters of our time, known for a warm tone and precise tajweed. Perfect both for focused listening and daily remembrance.";

const formatMillis = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default function ReciterDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const {
    playTrack,
    setQueue,
    currentTrack,
    pause,
    resume,
    seekTo,
    isPlaying,
    viewMode,
    progressMap,
  } = useAudioPlayer();

  useEffect(() => {
    if (!id) {
      setError("Reciter is not specified.");
      return;
    }

    const fetchReciter = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(
          `/reciters?language=eng&reciter=${id}`
        );
        const fetchedReciter: Reciter | undefined =
          response.data?.reciters?.[0];
        if (!fetchedReciter) {
          setError("Reciter was not found.");
          setReciter(null);
          return;
        }
        setReciter({
          ...fetchedReciter,
          photo_url: fetchedReciter.photo_url ?? "",
        });
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load the reciter data."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReciter();
  }, [id]);

  const primaryMoshaf = reciter?.moshaf?.[0];

  const surahItems: SurahListItem[] = useMemo(() => {
    if (!primaryMoshaf?.surah_list || !primaryMoshaf.server) {
      return [];
    }

    return primaryMoshaf.surah_list
      .split(",")
      .map((surahIdString) => parseInt(surahIdString.trim(), 10))
      .filter((surahId) => !Number.isNaN(surahId))
      .map((surahId) => {
        const metadata = SURAH_METADATA.find((item) => item.id === surahId);
        const paddedId = surahId.toString().padStart(3, "0");
        return {
          id: surahId,
          englishName: metadata
            ? metadata.englishName
            : `Surah ${surahId.toString().padStart(3, "0")}`,
          arabicName: metadata ? metadata.arabicName : "",
          audioUrl: `${primaryMoshaf.server}${paddedId}.mp3`,
        };
      });
  }, [primaryMoshaf]);

  const filteredSurahItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return surahItems;
    }
    const query = searchQuery.trim().toLowerCase();
    return surahItems.filter((item) => {
      if (item.englishName.toLowerCase().includes(query)) {
        return true;
      }
      if (item.arabicName && item.arabicName.toLowerCase().includes(query)) {
        return true;
      }
      return item.id.toString().padStart(3, "0").includes(query);
    });
  }, [searchQuery, surahItems]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: reciter?.name ?? "Reciter",
    });
  }, [navigation, reciter?.name]);

  useEffect(() => {
    if (!reciter) return;
    const queueTracks = surahItems
      .filter((item) => !!item.audioUrl)
      .map((item) => ({
        id: `${reciter.id}-${item.id}`,
        title: item.englishName,
        artist: reciter.name,
        uri: { uri: item.audioUrl as string },
      }));
    setQueue(queueTracks);
  }, [reciter, setQueue, surahItems]);

  useEffect(() => {
    setSearchQuery("");
  }, [reciter?.id]);

  const handlePlaySurah = async (surah: SurahListItem) => {
    if (!reciter || !surah.audioUrl) return;
    const trackId = `${reciter.id}-${surah.id}`;
    setPendingTrackId(trackId);
    const savedProgress = progressMap[trackId];
    const hasSavedPosition =
      savedProgress &&
      savedProgress.positionMillis > 0 &&
      savedProgress.durationMillis > 0 &&
      savedProgress.positionMillis <
        savedProgress.durationMillis - 5000; /* leave 5s margin */
    const resumePosition = hasSavedPosition
      ? savedProgress.positionMillis
      : undefined;
    if (currentTrack?.id === trackId) {
      try {
        if (isPlaying) {
          await pause();
        } else {
          if (resumePosition) {
            await seekTo(resumePosition);
          }
          await resume();
        }
      } finally {
        setPendingTrackId(null);
      }
      return;
    }
    const track = {
      id: trackId,
      title: surah.englishName,
      artist: reciter.name,
      uri: { uri: surah.audioUrl },
    };
    try {
      await playTrack(track, resumePosition);
    } finally {
      setPendingTrackId(null);
    }
  };

  const handlePlayAll = async () => {
    if (filteredSurahItems.length === 0 || !reciter) return;
    const first = filteredSurahItems.find((item) => item.audioUrl);
    if (!first) return;
    await handlePlaySurah(first);
  };

  const handleShuffle = async () => {
    if (filteredSurahItems.length === 0 || !reciter) return;
    const playable = filteredSurahItems.filter((item) => item.audioUrl);
    if (playable.length === 0) return;
    const random = playable[Math.floor(Math.random() * playable.length)];
    await handlePlaySurah(random);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset?.y ?? 0;
    setShowScrollToTop(offsetY > 600);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black">
        <ActivityIndicator size="small" color="#E7C11C" />
        <Text className="text-qasid-gold mt-3">Loading reciter…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black px-6">
        <Text className="text-qasid-gold text-center text-base">{error}</Text>
      </SafeAreaView>
    );
  }

  if (!reciter) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-qasid-black px-6">
        <Text className="text-qasid-gold text-center text-base">
          Reciter data is not available.
        </Text>
      </SafeAreaView>
    );
  }

  const contentBottomPadding = viewMode === "hidden" ? 32 : 100;

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <View className="px-4 py-3 bg-qasid-black border-b border-qasid-gray/30">
        <View className="flex-row items-center bg-qasid-gray/50 rounded-xl px-4 py-3">
          <Ionicons
            name="search"
            size={20}
            color="#9CA3AF"
            style={{ marginRight: 8 }}
          />
          <TextInput
            className="flex-1 text-qasid-white text-base"
            placeholder="Surah Name or Number"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
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
                source={PlaceholderAvatar}
                className="h-24 w-24 rounded-full border border-qasid-gold/30"
              />
            </View>
            <View className="flex-1">
              <Text className="text-2xl text-qasid-white font-bold mb-1">
                {reciter.name}
              </Text>
              <Text className="text-sm text-qasid-gold/80">
                {primaryMoshaf?.name ?? "Murattal Recitation"}
              </Text>
              {!!primaryMoshaf?.surah_total && (
                <Text className="text-xs text-qasid-white/60 mt-2">
                  Surahs recorded: {primaryMoshaf.surah_total}
                </Text>
              )}
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-qasid-white/80 leading-6 text-base">
              {mockDescription}
            </Text>
          </View>

          <View className="flex-row mt-6">
            <Pressable
              className="flex-1 bg-qasid-gold rounded-2xl py-3 mr-3 items-center justify-center"
              onPress={handlePlayAll}
            >
              <Text className="text-qasid-black font-semibold text-base">
                Play
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 border border-qasid-gold/60 rounded-2xl py-3 items-center justify-center flex-row"
              onPress={handleShuffle}
            >
              <Ionicons
                name="shuffle-outline"
                size={18}
                color="#E7C11C"
                style={{ marginRight: 6 }}
              />
              <Text className="text-qasid-white font-semibold text-base">
                Shuffle
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-8 px-5">
          <View className="mb-4">
            <Text className="text-qasid-white text-xl font-semibold">
              Surah list
            </Text>
          </View>

          {filteredSurahItems.map((surah) => {
            const trackKey = `${reciter.id}-${surah.id}`;
            const isActive = currentTrack?.id === trackKey;
            const isPending = pendingTrackId === trackKey;
            const progressEntry = progressMap[trackKey];
            const hasSavedProgress =
              progressEntry &&
              progressEntry.positionMillis > 0 &&
              progressEntry.durationMillis > 0 &&
              progressEntry.positionMillis <
                progressEntry.durationMillis - 5000;
            const progressPercent = hasSavedProgress
              ? Math.min(
                  99,
                  Math.round(
                    (progressEntry.positionMillis /
                      progressEntry.durationMillis) *
                      100
                  )
                )
              : 0;
            const resumeMillis =
              hasSavedProgress && progressEntry
                ? progressEntry.positionMillis
                : 0;
            return (
              <Pressable
                key={surah.id}
                onPress={() => handlePlaySurah(surah)}
                disabled={isPending}
                className="flex-row items-center px-4 py-3 mb-3 rounded-2xl border border-qasid-gold/15 bg-qasid-gray/30 relative overflow-hidden"
              >
                {isPending && (
                  <View className="absolute inset-0 bg-qasid-black/60 items-center justify-center z-10">
                    <ActivityIndicator size="small" color="#E7C11C" />
                  </View>
                )}
                <View className="h-10 w-10 rounded-full bg-qasid-gray/50 items-center justify-center mr-3">
                  {isActive ? (
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        handlePlaySurah(surah);
                      }}
                      className="h-full w-full items-center justify-center"
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={20}
                        color="#E7C11C"
                      />
                    </Pressable>
                  ) : (
                    <Text className="text-qasid-gold font-semibold">
                      {surah.id.toString()}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-qasid-white font-semibold text-base">
                    {surah.englishName}
                  </Text>
                  {surah.arabicName ? (
                    <Text className="text-qasid-gold/80 text-sm">
                      {surah.arabicName}
                    </Text>
                  ) : null}
                  {hasSavedProgress ? (
                    <View className="flex-row items-center mt-2">
                      <View className="flex-row items-center bg-qasid-gold/15 border border-qasid-gold/30 rounded-full px-3 py-1">
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color="#E7C11C"
                          style={{ marginRight: 6 }}
                        />
                        <Text className="text-qasid-gold text-xs font-medium">
                          In progress · {progressPercent}%
                        </Text>
                        <Text className="text-qasid-white/60 text-xs ml-2">
                          Resume {formatMillis(resumeMillis)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          {filteredSurahItems.length === 0 && (
            <Text className="text-qasid-white/70 text-base">
              There are no recordings available for this reciter yet.
            </Text>
          )}
        </View>
      </ScrollView>
      <TouchableOpacity
        onPress={scrollToTop}
        activeOpacity={0.8}
        disabled={!showScrollToTop}
        style={{
          position: "absolute",
          right: 20,
          bottom: viewMode === "hidden" ? 40 : 100,
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

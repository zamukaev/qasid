import { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Image,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from "react-native";

import {
  Loader,
  ShowError,
  SharedCard,
  SharedCardSkeleton,
  BannerSkeleton,
  MoodChipSkeleton,
} from "../../../components";
import { useAudioPlayer, Track } from "../../../context/AudioPlayerContext";
import Audio from "../../../assets/al_qawlu_sawarim.mp3";

import Banner from "../../../assets/images/night_moon_banner_long.webp";
import { PlayButton, PlayButtonVariant } from "../../../components/PlayButton";
import { MoodType, NasheedKind, Nasheed } from "../../../types/nasheed";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";
import {
  getAllNasheeds,
  getMoods,
  getNasheedsByMood,
} from "../../../services/nasheeds-service";
import {
  getDownloadURL,
  getStorage,
  ref,
} from "@react-native-firebase/storage";
export default function Nasheeds() {
  const {
    playTrack,
    pause,
    resume,
    viewMode,
    isPlaying,
    currentTrack,
    setQueue,
    seekTo,
    progressMap,
    positionMillis,
    durationMillis,
  } = useAudioPlayer();
  const [moods, setMoods] = useState<MoodType[]>([]);
  const [moodsLoading, setMoodsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<MoodType | null>(null);
  const [nasheeds, setNasheeds] = useState<Nasheed[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const contentBottomPadding = viewMode === "hidden" ? 32 : 100;

  // Animation values
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const chipScale = useRef(new Animated.Value(1)).current;

  const handlePlayNasheed = async (nasheed: Nasheed) => {
    if (!nasheed.audio_path) return;

    let audioUrl = nasheed.audio_path;
    if (!audioUrl.startsWith("http")) {
      try {
        const storage = getStorage();
        audioUrl = await getDownloadURL(ref(storage, audioUrl));
      } catch (e) {
        setError("Unable to load audio URL.");
        console.error("Failed to resolve audio URL", e);
        return;
      }
    }

    const trackId = nasheed.id;
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

    // If track is already active
    if (currentTrack?.id === trackId) {
      if (isPlaying) {
        // If playing, pause
        await pause();
      } else {
        // If not playing, check if track has finished
        const isFinished =
          (durationMillis > 0 &&
            positionMillis > 0 &&
            positionMillis >= durationMillis - 100) ||
          (savedProgress &&
            savedProgress.durationMillis > 0 &&
            savedProgress.positionMillis >= savedProgress.durationMillis - 100);

        if (isFinished && !hasSavedPosition) {
          // Track finished and no saved position - restart from beginning
          setPendingTrackId(trackId);
          const track = {
            id: trackId,
            title: nasheed.title_en,
            artist: nasheed.title_ar || "Nasheed",
            uri: { uri: audioUrl },
          };
          try {
            await playTrack(track);
          } finally {
            setPendingTrackId(null);
          }
        } else {
          // Track not finished or has saved position - resume
          if (resumePosition) {
            await seekTo(resumePosition);
          }
          await resume();
        }
      }
      return;
    }

    // For new track, show loader
    setPendingTrackId(trackId);

    // Set queue with all nasheeds
    const queueTracks = nasheeds
      .filter((item) => !!item.audio_path)
      .map((item) => ({
        id: item.id,
        title: item.title_en,
        artist: item.title_ar || "Nasheed",
        uri: { uri: item.audio_path },
      }));
    setQueue(queueTracks);

    const track = {
      id: trackId,
      title: nasheed.title_en,
      artist: nasheed.title_ar || "Nasheed",
      uri: { uri: audioUrl },
    };
    try {
      await playTrack(track, resumePosition);
    } finally {
      setPendingTrackId(null);
    }
  };

  const handlePlayAll = async () => {
    if (nasheeds.length === 0) return;

    // Always start with the first nasheed
    const first = nasheeds.find((item) => item.audio_path);
    if (!first) return;
    await handlePlayNasheed(first);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !activeMood) return;
    setLoadingMore(true);
    try {
      let newNasheeds, nextCursor;

      if (activeMood.kind === "all") {
        // Load all nasheeds
        const result = await getAllNasheeds(20, lastDoc);
        newNasheeds = result.nasheeds;
        nextCursor = result.nextCursor;
      } else {
        // Load nasheeds by specific mood
        const result = await getNasheedsByMood(activeMood.kind, 20, lastDoc);
        newNasheeds = result.nasheeds;
        nextCursor = result.nextCursor;
      }

      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);

      if (newNasheeds.length > 0) {
        setNasheeds((prev) => [...prev, ...newNasheeds]);
      }
    } catch (error) {
      setError("Unable to load more nasheeds.");
      console.error("Error loading more nasheeds:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const onMoodChange = (mood: MoodType) => {
    // Animate chip press
    Animated.sequence([
      Animated.timing(chipScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(chipScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate title change
    Animated.sequence([
      Animated.timing(titleOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setActiveMood(mood);

    // Load nasheeds based on mood
    if (mood.kind === "all") {
      loadAllNasheeds();
    } else {
      loadNasheedsByMood(mood.kind);
    }
  };

  const loadNasheedsByMood = async (moodKind: NasheedKind) => {
    try {
      setLoading(true);
      // Fetch nasheeds by mood from your service
      const { nasheeds, nextCursor } = await getNasheedsByMood(moodKind);
      setNasheeds(nasheeds);
      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);
      setLoading(false);
    } catch (err) {
      console.error("Error loading nasheeds by mood:", err);
      setError("Failed to load nasheeds. Please try again.");
      setLoading(false);
    }
  };

  const loadAllNasheeds = async () => {
    try {
      setLoading(true);
      // Fetch all nasheeds from your service
      const { nasheeds, nextCursor } = await getAllNasheeds();
      setNasheeds(nasheeds);
      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);
      setLoading(false);
    } catch (err) {
      console.error("Error loading all nasheeds:", err);
      setError("Failed to load nasheeds. Please try again.");
      setLoading(false);
    }
  };

  const loadMoods = async () => {
    try {
      setMoodsLoading(true);
      const fetchedMoods = await getMoods();
      setMoods(fetchedMoods);
      setMoodsLoading(false);
    } catch (err) {
      console.error("Error loading moods:", err);
      setError("Failed to load moods. Please try again.");
      setMoodsLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;

    if (isCloseToBottom && hasMore && !loadingMore) {
      loadMore();
    }
  };

  useEffect(() => {
    loadMoods();
  }, []);

  useEffect(() => {
    if (moods.length > 0 && !activeMood) {
      const firstMood = moods[0];
      setActiveMood(firstMood);

      // Load nasheeds based on the first mood's kind
      if (firstMood.kind === "all") {
        loadAllNasheeds();
      } else {
        loadNasheedsByMood(firstMood.kind);
      }
    }
  }, [moods]);

  if (error) {
    return <ShowError message={error} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-qasid-black ">
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {loading && nasheeds.length === 0 ? (
          <BannerSkeleton />
        ) : (
          <View className="w-full h-56  overflow-hidden bg-qasid-card relative mb-4 rounded-2xl">
            <Image
              source={Banner}
              className="absolute inset-0 w-full h-full"
              resizeMode="cover"
            />
            <View className="absolute inset-0 bg-black/30" />
            <View className="absolute inset-0 items-center justify-center px-4">
              <Animated.View
                style={{ opacity: titleOpacity, alignItems: "center" }}
              >
                <Text className="text-qasid-white text-3xl font-bold text-center">
                  {activeMood?.title || "All Nasheeds"}
                </Text>
                <Text className="text-qasid-white/70 text-sm mt-2 text-center">
                  {activeMood?.subtitle || "Explore all collections"}
                </Text>
              </Animated.View>
            </View>
            <PlayButton
              clasName="absolute bottom-4 w-1/2 left-1/4"
              handlePlayAll={handlePlayAll}
              label="Play All"
              kind={PlayButtonVariant.SECONDARY}
              isPlaying={isPlaying}
            />
          </View>
        )}

        <View className="px-4 py-4 space-y-6">
          {/* Mood Chips */}
          <View className="-mx-4">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {moodsLoading || (loading && moods.length === 0)
                ? Array.from({ length: 5 }).map((_, index) => (
                    <MoodChipSkeleton key={`mood-skeleton-${index}`} />
                  ))
                : moods.map((mood) => (
                    <Animated.View
                      key={mood.id}
                      style={{ transform: [{ scale: chipScale }] }}
                    >
                      <TouchableOpacity
                        onPress={() => onMoodChange(mood)}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          borderRadius: 10,
                          borderWidth: 1,
                          backgroundColor:
                            activeMood?.id === mood.id
                              ? "rgba(231, 193, 28, 0.1)"
                              : "rgba(20, 20, 22, 0.85)",
                          borderColor:
                            activeMood?.id === mood.id
                              ? "#E7C11C"
                              : "rgba(255, 255, 255, 0.05)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "500",
                            textTransform: "capitalize",
                            color:
                              activeMood?.id === mood.id
                                ? "#E7C11C"
                                : "#a1a1aa",
                          }}
                        >
                          {mood.title}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
            </ScrollView>
          </View>

          {/* Nasheeds List */}
          <View className="mt-10 space-y-4">
            {loading && nasheeds.length === 0
              ? // Show skeleton loaders while loading
                Array.from({ length: 6 }).map((_, index) => (
                  <View key={`skeleton-${index}`} className="mb-4">
                    <SharedCardSkeleton />
                  </View>
                ))
              : nasheeds.map((nasheed) => {
                  const nasheedTrack = {
                    id: nasheed.id,
                    title: nasheed.title_en,
                    artist: nasheed.title_ar || "Nasheed",
                    uri: nasheed.audio_path,
                  };
                  return (
                    <View key={nasheed.id} className="mb-4">
                      <SharedCard
                        title={nasheed.title_en}
                        subtitle={nasheed.title_ar || "Nasheed"}
                        duration=""
                        track={nasheedTrack}
                        handlePlayTrack={() => handlePlayNasheed(nasheed)}
                        isPlaying={isPlaying && currentTrack?.id === nasheed.id}
                        isPaused={nasheedTrack.id === currentTrack?.id}
                      />
                    </View>
                  );
                })}

            {/* Loading More Indicator */}
            {loadingMore && (
              <View className="py-4">
                <ActivityIndicator size="small" color="#E7C11C" />
              </View>
            )}

            {/* No More Items */}
            {!hasMore && nasheeds.length > 0 && (
              <View className="py-4">
                <Text className="text-qasid-white/50 text-center text-sm">
                  No more nasheeds
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

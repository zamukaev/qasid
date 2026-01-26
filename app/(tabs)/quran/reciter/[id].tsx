import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "@react-native-firebase/storage";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { axiosInstance } from "../../../../services/api-service";
import { Reciter, Surah } from "../../../../types/quran";
import { SURAH_METADATA } from "../../../../constants/surahMetadata";

import PlaceholderAvatar from "../../../../assets/images/avatar.webp";
import { useAudioPlayer } from "../../../../context/AudioPlayerContext";
import {
  fetchBeautifulCollectionPage,
  fetchFeaturedSurahs,
  getFeaturedItemById,
  getRecitersImageById,
} from "../../../../services/featured-service";
import {
  Loader,
  Search,
  SharedCard,
  ShowError,
  SharedCardSkeleton,
  ReciterHeaderSkeleton,
} from "../../../../components";
import {
  PlayButton,
  PlayButtonVariant,
} from "../../../../components/PlayButton";

interface SurahListItem {
  id: number;
  reciter_name?: string;
  englishName: string;
  arabicName: string;
  audioUrl: string | null;
}

const mockDescription =
  "One of the most inspiring reciters of our time, known for a warm tone and precise tajweed. Perfect both for focused listening and daily remembrance.";

export default function ReciterDetailsScreen() {
  const { id, content_type, target } = useLocalSearchParams<{
    id?: string;
    content_type?: string;
    target?: string;
  }>();
  const navigation = useNavigation();
  const [reciter, setReciter] = useState<Reciter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [activeMood, setActiveMood] = useState<string>("All");
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
    repeatMode,
    setRepeatMode,
    next,
    positionMillis,
    durationMillis,
  } = useAudioPlayer();

  const getFeaturedCollection = async (
    content_type: string,
    target: string,
    id: string,
  ) => {
    try {
      setLoading(true);
      const data = await getFeaturedItemById(id);
      const { surahs: beautifulRecitations, nextCursor } =
        await fetchBeautifulCollectionPage(target);

      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);

      if (!data) {
        setError("Featured reciter was not found.");
        return;
      }
      if (beautifulRecitations.length === 0) {
        setError("No beautiful recitations found for this reciter.");
        return;
      }

      const moshaf = beautifulRecitations.map((item: any, index: number) => ({
        id: index,
        name: item.title_en,
        arabic_name: item.title_ar,
        reciter_name: item.name_en,
        server: item.audio_path ?? "",
        surah_list: item?.surah_number?.toString(),
        surah_total: beautifulRecitations.length,
        moshaf_type: 0,
        image_path: item?.image_path || "",
      }));

      setReciter({
        id: data.id,
        name: data.title_en,
        image_path: data.image_path,
        moshaf: moshaf,
        data: "",
        letter: "",
        arabic_name: data.title_ar,
        description: data.description,
      });
      setLoading(false);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load the reciter data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getFeaturedReciter = async (
    content_type: string,
    target: string,
    id: string,
  ) => {
    try {
      setLoading(true);
      const data = await getFeaturedItemById(id);
      const { surahs, nextCursor } = await fetchFeaturedSurahs(target);
      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);
      if (!surahs || surahs.length === 0) {
        setError("No surahs found for this reciter.");
        return;
      }
      if (!data) {
        setError("Featured reciter was not found.");
        return;
      }

      const moshaf = surahs.map((item: Surah, index: number) => ({
        id: index,
        name: item.title_en,
        arabic_name: item.title_ar,
        server: item.audio_path ?? "",
        surah_list: item?.surah_number?.toString(),
        surah_total: surahs.length,
        moshaf_type: 0,
      }));
      setReciter({
        id: data.id,
        name: data.title_en,
        image_path: data.image_path,
        moshaf: moshaf,
        data: "",
        letter: "",
        arabic_name: data.title_ar,
        description: data.description,
      });
      setLoading(false);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load the reciter data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !target) return;
    setLoadingMore(true);
    try {
      const { surahs: newItems, nextCursor } =
        content_type === "collection"
          ? await fetchBeautifulCollectionPage(target, 20, lastDoc)
          : await fetchFeaturedSurahs(target, 20, lastDoc);

      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);

      if (newItems.length > 0) {
        const newMoshaf = newItems.map((item: any, index: number) => ({
          id: (reciter?.moshaf.length || 0) + index,
          name: item.title_en,
          arabic_name: item.title_ar,
          reciter_name: item.name_en,
          server: item.audio_path ?? "",
          surah_list: item?.surah_number?.toString(),
          surah_total: newItems.length,
          moshaf_type: 0,
          image_path: item?.image_path || "",
        }));

        setReciter((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            moshaf: [...prev.moshaf, ...newMoshaf],
          };
        });
      }
    } catch (error) {
      setError("Unable to load more items.");
      console.error("Error loading more items:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchReciter = async () => {
    if (!id) {
      setError("Reciter is not specified.");
      return;
    }

    if (!!content_type && !!target) {
      if (content_type === "collection") {
        await getFeaturedCollection(content_type, target, id);
      }

      if (content_type === "reciter") {
        await getFeaturedReciter(content_type, target, id);
      }
      return;
    }

    try {
      setLoading(true);
      const response = await axiosInstance.get(
        `/reciters?language=eng&reciter=${id}`,
      );

      const fetchedReciter: Reciter = response.data.reciters[0];
      const reciterId: number = +fetchedReciter.id;

      if (!fetchedReciter) {
        setError("Reciter was not found.");
        setReciter(null);
        return;
      }

      const imagesResponse = await getRecitersImageById(reciterId);
      setReciter({
        ...fetchedReciter,
        image_path: imagesResponse?.image_path || "",
      });
      setLoading(false);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load the reciter data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReciter();
  }, [id]);

  const multipleMoshafsAvailable = reciter?.moshaf && reciter.moshaf.length > 1;

  const primaryMoshaf = reciter?.moshaf;

  const surahItems: SurahListItem[] = useMemo(() => {
    if (!multipleMoshafsAvailable) {
      const moshaf = reciter?.moshaf[0];
      if (!moshaf?.surah_list || !moshaf.server) {
        return [];
      }

      return moshaf.surah_list
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
            audioUrl: `${moshaf.server}${paddedId}.mp3`,
          };
        });
    }
    const surahList: SurahListItem[] = [];
    reciter?.moshaf.forEach((moshaf) => {
      if (!moshaf.surah_list || !moshaf.server) {
        return;
      }
      moshaf.surah_list
        .split(",")
        .map((surahIdString) => parseInt(surahIdString.trim(), 10))
        .filter((surahId) => !Number.isNaN(surahId))
        .forEach((surahId) => {
          if (!surahList.find((item) => item.id === surahId)) {
            const metadata = SURAH_METADATA.find((item) => item.id === surahId);
            const paddedId = surahId.toString().padStart(3, "0");
            surahList.push({
              id: surahId,
              reciter_name: moshaf.reciter_name,
              englishName: metadata
                ? metadata.englishName
                : `Surah ${surahId.toString().padStart(3, "0")}`,
              arabicName: metadata ? metadata.arabicName : "",
              audioUrl: moshaf.server,
            });
          }
        });
    });
    return surahList;
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
    setSearchQuery("");
  }, [reciter?.id]);

  const handlePlaySurah = async (surah: SurahListItem) => {
    if (!reciter || !surah.audioUrl) return;

    let audioUrl = surah.audioUrl;
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

    const trackId = `${reciter.id}-${surah.id}`;
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

    // Если трек уже активен
    if (currentTrack?.id === trackId) {
      if (isPlaying) {
        // Если играет, ставим на паузу
        await pause();
      } else {
        // Если не играет, проверяем, закончился ли трек
        // Проверяем через позицию: если позиция близка к концу или равна длительности
        const isFinished =
          (durationMillis > 0 &&
            positionMillis > 0 &&
            positionMillis >= durationMillis - 100) || // Трек закончился (текущая позиция)
          (savedProgress &&
            savedProgress.durationMillis > 0 &&
            savedProgress.positionMillis >= savedProgress.durationMillis - 100); // Или сохраненная позиция в конце

        if (isFinished && !hasSavedPosition) {
          // Трек закончился и нет сохраненной позиции - перезапускаем с начала
          // Это работает для всех треков, включая последний
          setPendingTrackId(trackId);
          const track = {
            id: trackId,
            title: surah.englishName,
            artist: reciter.name,
            uri: { uri: audioUrl },
          };
          try {
            await playTrack(track);
          } finally {
            setPendingTrackId(null);
          }
        } else {
          // Трек не закончился или есть сохраненная позиция - возобновляем
          if (resumePosition) {
            await seekTo(resumePosition);
          }
          await resume();
        }
      }
      return;
    }

    // Только для нового трека показываем лоадер
    setPendingTrackId(trackId);

    const queueTracks = surahItems
      .filter((item) => !!item.audioUrl)
      .map((item) => ({
        id: `${reciter.id}-${item.id}`,
        title: item.englishName,
        artist: reciter.name,
        uri: { uri: item.audioUrl as string },
      }));
    setQueue(queueTracks);

    const track = {
      id: trackId,
      title: surah.englishName,
      artist: reciter.name,
      uri: { uri: audioUrl },
    };
    try {
      await playTrack(track, resumePosition);
    } finally {
      setPendingTrackId(null);
    }
  };

  const handlePlayAll = async () => {
    if (filteredSurahItems.length === 0 || !reciter) return;

    // Всегда запускаем первый трек с начала
    const first = filteredSurahItems.find((item) => item.audioUrl);
    if (!first) return;
    await handlePlaySurah(first);
  };

  const handleRepeatModeChange = async (
    mode: "sequential" | "shuffle" | "repeat-one",
  ) => {
    const wasPlaying = isPlaying;
    const previousMode = repeatMode;

    // Если нажали на уже активный режим repeat-one, отключаем его (возвращаемся к sequential)
    if (mode === "repeat-one" && previousMode === "repeat-one") {
      setRepeatMode("sequential");
      return;
    }

    setRepeatMode(mode);

    // Если трек не играет, запускаем трек только для shuffle и repeat-one
    if (!currentTrack || !isPlaying) {
      if (filteredSurahItems.length === 0 || !reciter) return;

      if (mode === "shuffle") {
        // Для shuffle запускаем случайный трек
        const playable = filteredSurahItems.filter((item) => item.audioUrl);
        if (playable.length > 0) {
          const random = playable[Math.floor(Math.random() * playable.length)];
          await handlePlaySurah(random);
        }
      } else if (mode === "repeat-one") {
        // Для repeat-one запускаем первый трек
        const first = filteredSurahItems.find((item) => item.audioUrl);
        if (first) {
          await handlePlaySurah(first);
        }
      }
      // Для sequential не запускаем трек, только меняем режим
      return;
    }

    // Если трек уже играет и режим изменился, переключаем трек только для shuffle
    if (currentTrack && wasPlaying && previousMode !== mode && reciter) {
      // Проверяем, что текущий трек принадлежит этому чтецу
      const currentTrackReciterId = currentTrack.id.split("-")[0];
      if (currentTrackReciterId === reciter.id.toString()) {
        // Для sequential и repeat-one не переключаем трек, просто меняем режим
        if (mode === "sequential" || mode === "repeat-one") {
          return;
        }

        // Для shuffle переключаем на случайный трек
        if (mode === "shuffle") {
          const playable = filteredSurahItems.filter((item) => item.audioUrl);
          if (playable.length > 0) {
            const availableTracks = playable.filter(
              (item) => `${reciter.id}-${item.id}` !== currentTrack.id,
            );
            if (availableTracks.length > 0) {
              const random =
                availableTracks[
                  Math.floor(Math.random() * availableTracks.length)
                ];
              await handlePlaySurah(random);
            }
          }
        }
      }
    }
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset?.y ?? 0;
    setShowScrollToTop(offsetY > 600);

    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;

    if (isCloseToBottom && hasMore && !loadingMore) {
      loadMore();
    }
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  if (error) {
    return <ShowError message={error} />;
  }

  if (!reciter && !loading) {
    return <ShowError message="Reciter data is not available." />;
  }

  const contentBottomPadding = viewMode === "hidden" ? 32 : 100;

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <Search searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
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
                    reciter?.image_path
                      ? { uri: reciter.image_path }
                      : PlaceholderAvatar
                  }
                  className="h-24 w-24 rounded-full border border-qasid-gold/30"
                />
              </View>
              <View className="flex-1">
                <Text className="text-2xl text-qasid-white font-bold mb-1">
                  {reciter?.name}
                </Text>
                <Text className="text-sm text-qasid-gold/80">
                  {primaryMoshaf?.find((moshaf) => moshaf.id === reciter?.id)
                    ?.name ?? "Murattal Recitation"}
                </Text>
                {!!primaryMoshaf?.find((moshaf) => moshaf.id === reciter?.id)
                  ?.surah_total && (
                  <Text className="text-xs text-qasid-white/60 mt-2">
                    Surahs recorded:{" "}
                    {
                      primaryMoshaf.find((moshaf) => moshaf.id === reciter?.id)
                        ?.surah_total
                    }
                  </Text>
                )}
              </View>
            </View>

            <View className="mt-6">
              <Text
                numberOfLines={expandedDescription ? undefined : 3}
                className="text-qasid-white/80 leading-6 text-base"
              >
                {reciter?.description ?? mockDescription}
              </Text>
              {(reciter?.description ?? mockDescription).length > 150 && (
                <Pressable
                  onPress={() => setExpandedDescription(!expandedDescription)}
                  className="mt-2"
                >
                  <Text className="text-qasid-gold/80 text-sm font-semibold">
                    {expandedDescription ? "See less" : "See more"}
                  </Text>
                </Pressable>
              )}
            </View>

            <View className="mt-6">
              <PlayButton
                clasName="mb-4 mb-4"
                handlePlayAll={handlePlayAll}
                label="Play"
                kind={PlayButtonVariant.PRIMARY}
                isPlaying={isPlaying}
              />

              {/* Repeat Mode Controls */}
              <View className="flex-row items-center justify-between">
                <Pressable
                  onPress={() => handleRepeatModeChange("sequential")}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                    backgroundColor:
                      repeatMode === "sequential"
                        ? "rgba(231, 193, 28, 0.15)"
                        : "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor:
                      repeatMode === "sequential"
                        ? "rgba(231, 193, 28, 0.4)"
                        : "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="list-outline"
                      size={16}
                      color={
                        repeatMode === "sequential"
                          ? "#E7C11C"
                          : "rgba(255, 255, 255, 0.6)"
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "500",
                        color:
                          repeatMode === "sequential"
                            ? "#E7C11C"
                            : "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      Sequential
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => handleRepeatModeChange("shuffle")}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    marginHorizontal: 4,
                    backgroundColor:
                      repeatMode === "shuffle"
                        ? "rgba(231, 193, 28, 0.15)"
                        : "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor:
                      repeatMode === "shuffle"
                        ? "rgba(231, 193, 28, 0.4)"
                        : "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="shuffle-outline"
                      size={16}
                      color={
                        repeatMode === "shuffle"
                          ? "#E7C11C"
                          : "rgba(255, 255, 255, 0.6)"
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "500",
                        color:
                          repeatMode === "shuffle"
                            ? "#E7C11C"
                            : "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      Shuffle
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => handleRepeatModeChange("repeat-one")}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: 8,
                    backgroundColor:
                      repeatMode === "repeat-one"
                        ? "rgba(231, 193, 28, 0.15)"
                        : "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor:
                      repeatMode === "repeat-one"
                        ? "rgba(231, 193, 28, 0.4)"
                        : "rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="repeat-outline"
                      size={16}
                      color={
                        repeatMode === "repeat-one"
                          ? "#E7C11C"
                          : "rgba(255, 255, 255, 0.6)"
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "500",
                        color:
                          repeatMode === "repeat-one"
                            ? "#E7C11C"
                            : "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      Repeat
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View className="mt-8 px-5">
          <View className="mb-4">
            <Text className="text-qasid-white text-xl font-semibold">
              Surah list
            </Text>
          </View>

          {loading ? (
            // Show skeleton loaders while loading
            Array.from({ length: 8 }).map((_, index) => (
              <View key={`skeleton-${index}`} className="mb-1">
                <SharedCardSkeleton />
              </View>
            ))
          ) : (
            <>
              {filteredSurahItems.map((surah) => {
                const trackKey = `${reciter?.id}-${surah.id}`;
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
                          100,
                      ),
                    )
                  : 0;
                const resumeMillis =
                  hasSavedProgress && progressEntry
                    ? progressEntry.positionMillis
                    : 0;
                return (
                  <SharedCard
                    className="mb-1"
                    key={trackKey}
                    handlePlayTrack={() => handlePlaySurah(surah)}
                    isPlaying={isPlaying}
                    isPaused={isActive}
                    title={surah.englishName}
                    subtitle={surah.arabicName}
                    track={{
                      id: surah.id.toString(),
                      artist: surah?.reciter_name,
                      title: surah.englishName,
                      uri: surah.audioUrl,
                    }}
                  />
                );
              })}

              {filteredSurahItems.length === 0 && !loading && (
                <Text className="text-qasid-white/70 text-base">
                  There are no recordings available for this reciter yet.
                </Text>
              )}
            </>
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

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
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { createAudioPlayer } from "expo-audio";

import { FirebaseReciter } from "../../../../types/quran";

import PlaceholderAvatar from "../../../../assets/images/avatar.webp";
import { useAudioPlayer } from "../../../../context/AudioPlayerContext";
import { formatMillis } from "../../../../utils/formatMillis";
import {
  fetchBeautifulCollectionPage,
  fetchFilteredCollectionSurahs,
  fetchFeaturedSurahs,
  getFeaturedItemById,
} from "../../../../services/featured-service";
import { getSurahMetadata } from "../../../../constants/surahMetadata";
import {
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
import {
  fetchReciterById,
  fetchFilteredSurahs,
  fetchSurahs,
  trackReciterPlayback,
} from "../../../../services/quran-service";

interface SurahListItem {
  id: string;
  surahNumber: number;
  englishName: string;
  arabicName: string;
  reciterName?: string;
  audioUrl: string | null;
  imageUrl: string | null;
}

type SourceSurahItem = {
  id: string;
  title_en?: string;
  title_ar?: string;
  surah_number: number;
  audio_path?: string;
  name_en?: string;
  name_ar?: string;
  image_path?: string;
};

const normalizeSurahItems = (items: SourceSurahItem[]): SurahListItem[] =>
  items
    .filter((surah) => !!surah.surah_number)
    .map((surah) => {
      const metadata = getSurahMetadata(surah.surah_number);

      return {
        id: surah.id,
        surahNumber: surah.surah_number,
        englishName: `${metadata?.transliteration} ( ${metadata?.englishName} )`,
        arabicName: metadata?.arabicName ?? "",
        reciterName: surah.name_en?.trim() || undefined,
        audioUrl: surah.audio_path ?? null,
        imageUrl: surah.image_path ?? null,
      };
    });

export default function ReciterDetailsScreen() {
  const { id, content_type, target } = useLocalSearchParams<{
    id?: string;
    content_type?: string;
    target?: string;
  }>();
  const navigation = useNavigation();

  const [reciter, setReciter] = useState<FirebaseReciter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [durationMap, setDurationMap] = useState<Record<string, number>>({});
  const [surahs, setSurahs] = useState<SurahListItem[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const scrollViewRef = useRef<ScrollView | null>(null);
  const playbackTrackingRef = useRef<
    Record<
      string,
      {
        started: boolean;
        qualified: boolean;
        completed: boolean;
      }
    >
  >({});
  const durationMapRef = useRef<Record<string, number>>({});
  const durationInFlightRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
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
    positionMillis,
    durationMillis,
    listenedMillis,
    didJustFinish,
  } = useAudioPlayer();

  const contentBottomPadding = viewMode === "hidden" ? 32 : 128;
  const backendSearchQuery = debouncedSearchQuery.trim();

  const resolveAudioUrl = async (audioUrl: string) => {
    if (audioUrl.startsWith("http")) return audioUrl;
    const storage = getStorage(getApp());
    return getDownloadURL(ref(storage, audioUrl));
  };

  const getDurationMillis = async (audioUrl: string) => {
    return new Promise<number | null>((resolve) => {
      let settled = false;
      const player = createAudioPlayer({ uri: audioUrl });
      const cleanup = (listener?: { remove: () => void }) => {
        if (listener) listener.remove();
        try {
          player.pause();
        } catch {}
        try {
          player.remove();
        } catch {}
      };

      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(null);
      }, 5000);

      const listener = player.addListener(
        "playbackStatusUpdate",
        (status: any) => {
          if (settled) return;
          if (status?.isLoaded && status.duration > 0) {
            settled = true;
            clearTimeout(timeoutId);
            cleanup(listener);
            resolve(status.duration * 1000);
          }
        },
      );
    });
  };

  const loadDurationForTrack = async (
    trackKey: string,
    audioUrl?: string | null,
  ) => {
    if (!audioUrl) return;
    if (durationMapRef.current[trackKey]) return;
    if (durationInFlightRef.current.has(trackKey)) return;

    durationInFlightRef.current.add(trackKey);
    try {
      const resolvedUrl = await resolveAudioUrl(audioUrl);
      const duration = await getDurationMillis(resolvedUrl);
      if (!duration || duration <= 0) return;
      if (!isMountedRef.current) return;

      setDurationMap((prev) => {
        if (prev[trackKey]) return prev;
        const next = { ...prev, [trackKey]: duration };
        durationMapRef.current = next;
        return next;
      });
    } catch (durationError) {
      console.warn("Failed to load duration", durationError);
    } finally {
      durationInFlightRef.current.delete(trackKey);
    }
  };

  const getFeaturedCollection = async (
    target: string,
    id: string,
    requestId: number,
    showInitialLoader: boolean,
    search: string = "",
  ) => {
    try {
      if (showInitialLoader) {
        setLoading(true);
      } else {
        setSearchLoading(true);
      }
      const data = await getFeaturedItemById(id);
      const { surahs: beautifulRecitations, nextCursor } = search
        ? await fetchFilteredCollectionSurahs(target, search)
        : await fetchBeautifulCollectionPage(target);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);

      if (!data) {
        setError("Featured reciter was not found.");
        return;
      }

      setReciter({
        id: data.id,
        name_en: data.title_en,
        name_ar: data.title_ar,
        image_path: data.image_path,
        is_active: true,
        desc: data.description,
        surah_count: data.surah_count ?? beautifulRecitations?.length ?? 0,
      });
      setError(null);
      setSurahs(
        normalizeSurahItems(
          beautifulRecitations as unknown as SourceSurahItem[],
        ),
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load the reciter data.",
      );
    } finally {
      if (showInitialLoader) {
        setLoading(false);
      } else {
        setSearchLoading(false);
      }
    }
  };

  const getFeaturedReciter = async (
    target: string,
    id: string,
    requestId: number,
    showInitialLoader: boolean,
    search: string = "",
  ) => {
    try {
      if (showInitialLoader) {
        setLoading(true);
      } else {
        setSearchLoading(true);
      }
      const data = await getFeaturedItemById(id);
      const { surahs, nextCursor } = search
        ? await fetchFilteredSurahs(target, search)
        : await fetchFeaturedSurahs(target);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);
      if (!data) {
        setError("Featured reciter was not found.");
        return;
      }

      setReciter({
        id: data.id,
        name_en: data.title_en,
        name_ar: data.title_ar,
        image_path: data.image_path,
        is_active: true,
        desc: data.description,
        surah_count: data.surah_count ?? surahs?.length ?? 0,
      });
      setError(null);
      setSurahs(normalizeSurahItems(surahs as unknown as SourceSurahItem[]));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load the reciter data.",
      );
    } finally {
      if (showInitialLoader) {
        setLoading(false);
      } else {
        setSearchLoading(false);
      }
    }
  };

  const loadMore = async () => {
    const sourceTarget = target ?? id;
    if (loadingMore || !hasMore || !sourceTarget) return;
    setLoadingMore(true);
    try {
      const { surahs: newItems, nextCursor } =
        content_type === "collection"
          ? backendSearchQuery
            ? await fetchFilteredCollectionSurahs(
                sourceTarget,
                backendSearchQuery,
                20,
                lastDoc,
              )
            : await fetchBeautifulCollectionPage(sourceTarget, 20, lastDoc)
          : content_type === "reciter"
            ? backendSearchQuery
              ? await fetchFilteredSurahs(
                  sourceTarget,
                  backendSearchQuery,
                  20,
                  lastDoc,
                )
              : await fetchFeaturedSurahs(sourceTarget, 20, lastDoc)
            : backendSearchQuery
              ? await fetchFilteredSurahs(
                  sourceTarget,
                  backendSearchQuery,
                  20,
                  lastDoc,
                )
              : await fetchSurahs(sourceTarget, 20, lastDoc);

      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);

      if (newItems.length > 0) {
        setSurahs((prev) => [
          ...prev,
          ...normalizeSurahItems(newItems as unknown as SourceSurahItem[]),
        ]);
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

    const requestId = ++requestIdRef.current;
    const showInitialLoader = reciter?.id !== id && !backendSearchQuery;

    if (!!content_type && !!target) {
      if (content_type === "collection") {
        await getFeaturedCollection(
          target,
          id,
          requestId,
          showInitialLoader,
          backendSearchQuery,
        );
      }

      if (content_type === "reciter") {
        await getFeaturedReciter(
          target,
          id,
          requestId,
          showInitialLoader,
          backendSearchQuery,
        );
      }
      return;
    }

    try {
      if (showInitialLoader) {
        setLoading(true);
      } else {
        setSearchLoading(true);
      }
      const loadedReciter = reciter ?? (await fetchReciterById(id));
      const { surahs: loadedSurahs, nextCursor } = backendSearchQuery
        ? await fetchFilteredSurahs(id, backendSearchQuery)
        : await fetchSurahs(id);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setReciter(loadedReciter);
      setError(null);
      setSurahs(
        normalizeSurahItems(loadedSurahs as unknown as SourceSurahItem[]),
      );
      setLastDoc(nextCursor);
      setHasMore(!!nextCursor);
    } catch (fetchError) {
      console.error("Error fetching reciter data", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load the reciter data.",
      );
    } finally {
      if (showInitialLoader) {
        setLoading(false);
      } else {
        setSearchLoading(false);
      }
    }
  };

  const filteredSurahItems = surahs;

  const handlePlaySurah = async (surah: SurahListItem) => {
    if (!reciter || !surah.audioUrl) return;

    let audioUrl = surah.audioUrl;
    if (!audioUrl.startsWith("http")) {
      try {
        const storage = getStorage(getApp());
        audioUrl = await getDownloadURL(ref(storage, audioUrl));
      } catch (e) {
        setError("Unable to load audio URL.");
        console.error("Failed to resolve audio URL", e);
        return;
      }
    }

    const trackId = `${reciter.id}-${surah.surahNumber}`;
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
          const track = {
            id: trackId,
            title: surah.englishName,
            artist: surah.reciterName ?? reciter.name_en,
            artworkUri: surah.imageUrl ?? PlaceholderAvatar,
            uri: { uri: audioUrl },
          };
          await playTrack(track);
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

    const queueTracks = filteredSurahItems
      .filter((item) => !!item.audioUrl)
      .map((item) => ({
        id: `${reciter.id}-${item.surahNumber}`,
        title: item.englishName,
        artist: item.reciterName ?? reciter.name_en,
        artworkUri: item.imageUrl ?? PlaceholderAvatar,
        uri: { uri: item.audioUrl as string },
      }));
    setQueue(queueTracks);

    const track = {
      id: trackId,
      title: surah.englishName,
      artist: surah.reciterName ?? reciter.name_en,
      artworkUri: surah.imageUrl ?? PlaceholderAvatar,
      uri: { uri: audioUrl },
    };
    await playTrack(track, resumePosition);
  };

  const handlePlayAll = async () => {
    if (filteredSurahItems.length === 0 || !reciter) return;

    // Всегда запускаем первый трек с начала
    const first = filteredSurahItems.find((item) => item.audioUrl);
    if (!first) return;
    await handlePlaySurah(first);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: reciter?.name_en ?? "Reciter",
    });
  }, [navigation, reciter?.name_en]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setSearchQuery("");
    setDurationMap({});
    playbackTrackingRef.current = {};
    durationMapRef.current = {};
  }, [reciter?.id]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    fetchReciter();
  }, [id, content_type, target, debouncedSearchQuery]);

  useEffect(() => {
    if (loading || !reciter) return;
    const queue = filteredSurahItems
      .filter((item) => item.audioUrl)
      .map((item) => ({
        key: `${reciter?.id}-${item.surahNumber}`,
        url: item.audioUrl,
      }))
      .filter((item) => !durationMapRef.current[item.key]);

    if (queue.length === 0) return;

    const MAX_CONCURRENT = 3;
    let cancelled = false;

    const worker = async () => {
      while (!cancelled && queue.length > 0) {
        const nextItem = queue.shift();
        if (!nextItem) return;
        await loadDurationForTrack(nextItem.key, nextItem.url);
      }
    };

    void Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }).map(() =>
        worker(),
      ),
    );

    return () => {
      cancelled = true;
    };
  }, [filteredSurahItems, reciter, loading]);

  useEffect(() => {
    if (!reciter || content_type === "collection" || !currentTrack?.id) return;

    const trackPrefix = `${reciter.id}-`;
    if (!currentTrack.id.startsWith(trackPrefix)) return;

    const surahId = currentTrack.id.slice(trackPrefix.length);
    if (!surahId) return;

    const trackingState = playbackTrackingRef.current[currentTrack.id] ?? {
      started: false,
      qualified: false,
      completed: false,
    };

    const syncPlaybackEvent = async (
      eventType: "started" | "qualified" | "completed",
    ) => {
      try {
        await trackReciterPlayback({
          reciterId: reciter.id,
          surahId,
          eventType,
          playedSeconds: Math.floor(listenedMillis / 1000),
        });
      } catch (trackingError) {
        console.warn("Failed to track reciter playback", trackingError);
      }
    };

    if (!trackingState.started && listenedMillis >= 10000) {
      trackingState.started = true;
      playbackTrackingRef.current[currentTrack.id] = trackingState;
      void syncPlaybackEvent("started");
    }

    if (!trackingState.qualified && listenedMillis >= 30000) {
      trackingState.qualified = true;
      playbackTrackingRef.current[currentTrack.id] = trackingState;
      void syncPlaybackEvent("qualified");
    }

    if (!trackingState.completed && didJustFinish) {
      trackingState.completed = true;
      playbackTrackingRef.current[currentTrack.id] = trackingState;
      void syncPlaybackEvent("completed");
    }
  }, [content_type, currentTrack?.id, didJustFinish, listenedMillis, reciter]);

  if (error) {
    return <ShowError message={error} />;
  }

  if (!reciter && !loading) {
    return <ShowError message="Reciter data is not available." />;
  }

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
                  {reciter?.name_en}
                </Text>
              </View>
            </View>

            <View className="mt-6 w-full flex-row justify-evenly items-center">
              <View className="flex-row items-center gap-2">
                <Feather name="headphones" size={14} color="#E7C11C" />
                <Text className="text-m text-qasid-white">Clear Tajweed</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons
                  name="mosque"
                  size={14}
                  color="#E7C11C"
                />
                <Text className="text-m text-qasid-white">
                  Daily Reflection
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <FontAwesome6 name="list-ul" size={14} color="#E7C11C" />
                {reciter?.surah_count && (
                  <Text className="text-m text-qasid-white">
                    {reciter?.surah_count} Surahs
                  </Text>
                )}
              </View>
            </View>

            <View className="mt-6">
              <PlayButton
                clasName="mb-4 mb-4"
                handlePlayAll={handlePlayAll}
                label="Play"
                kind={PlayButtonVariant.PRIMARY}
                isPlaying={
                  isPlaying &&
                  currentTrack &&
                  currentTrack.id.startsWith(`${reciter?.id}-`)
                }
              />
            </View>
          </View>
        )}

        <View className="mt-8 px-5">
          <View className="mb-4">
            <Text className="text-qasid-white text-xl font-semibold">
              Surah list
            </Text>
          </View>

          {loading || searchLoading ? (
            // Show skeleton loaders while loading
            Array.from({ length: 8 }).map((_, index) => (
              <View key={`skeleton-${index}`} className="mb-1">
                <SharedCardSkeleton />
              </View>
            ))
          ) : (
            <>
              {filteredSurahItems.map((surah) => {
                const key = `${surah?.reciterName}-${surah.surahNumber}`;
                const trackKey = `${reciter?.id}-${surah.surahNumber}`;
                const isActive = currentTrack?.id === trackKey;
                const progressEntry = progressMap[trackKey];
                const knownDurationMillis =
                  durationMap[trackKey] ?? progressEntry?.durationMillis;
                const durationLabel = knownDurationMillis
                  ? formatMillis(knownDurationMillis)
                  : undefined;
                return (
                  <SharedCard
                    className="mb-1"
                    key={key}
                    handlePlayTrack={() => handlePlaySurah(surah)}
                    isPlaying={isPlaying && isActive}
                    isPaused={isActive}
                    title={surah.englishName}
                    order={surah.surahNumber}
                    image={surah.imageUrl ?? undefined}
                    subtitle={
                      content_type === "collection"
                        ? (surah.reciterName ?? surah.arabicName)
                        : surah.arabicName
                    }
                    duration={durationLabel}
                    track={{
                      id: trackKey,
                      surahNumber: surah.surahNumber,
                      artist: surah.reciterName ?? reciter?.name_en,
                      title: surah.englishName,
                      uri: surah.audioUrl,
                    }}
                  />
                );
              })}

              {filteredSurahItems.length === 0 &&
                !loading &&
                !searchLoading && (
                  <Text className="text-qasid-white/70 text-base">
                    {searchQuery.trim()
                      ? "No surahs found for this search."
                      : "There are no recordings available for this reciter yet."}
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

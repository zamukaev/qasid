import { useCallback, useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ShowError,
  ArtistRailSection,
  BrowseAllArtistsPreview,
  ContinueListeningBlock,
} from "../../../components";
import { GOLD } from "../../../constants/colors";
import {
  GeneratedPlaylist,
  NasheedArtist,
  Playlist,
} from "../../../types/nasheed";
import {
  fetchNasheedArtists,
  fetchPopularArtists,
  fetchNewArtists,
} from "../../../services/nasheeds-service";
import { fetchRecentArtists } from "../../../services/recents-service";
import { fetchPlaylists } from "../../../services/playlists-service";
import { fetchGeneratedPlaylists } from "../../../services/recommendations-service";

// Generated playlists carry a `key` (not `id`); ArtistRailSection only reads
// id/name_en/image_path, so a light projection is enough.
const toRailItem = (p: GeneratedPlaylist): Playlist =>
  ({
    id: p.key,
    name_en: p.name_en,
    name_ar: p.name_ar,
    desc: p.desc,
    image_path: p.image_path,
    is_active: p.is_active,
  }) as unknown as Playlist;

export default function Nasheeds() {
  const router = useRouter();
  const [popularArtists, setPopularArtists] = useState<NasheedArtist[]>([]);
  const [newArtists, setNewArtists] = useState<NasheedArtist[]>([]);
  const [allArtists, setAllArtists] = useState<NasheedArtist[]>([]);
  const [recentArtists, setRecentArtists] = useState<NasheedArtist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [generated, setGenerated] = useState<GeneratedPlaylist[]>([]);
  const [isLoadingGenerated, setIsLoadingGenerated] = useState(true);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [isLoadingNew, setIsLoadingNew] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadMain = useCallback(async () => {
    setIsLoadingMain(true);
    try {
      const [popular, all] = await Promise.all([
        fetchPopularArtists(),
        fetchNasheedArtists(),
      ]);
      setPopularArtists(popular);
      setAllArtists(all.artists);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      console.error("Error loading artists:", error);
    } finally {
      setIsLoadingMain(false);
    }
  }, []);

  const loadNew = useCallback(async () => {
    setIsLoadingNew(true);
    try {
      const artists = await fetchNewArtists(8);
      setNewArtists(artists);
    } catch (error) {
      console.error("Error loading new artists:", error);
    } finally {
      setIsLoadingNew(false);
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    setIsLoadingPlaylists(true);
    try {
      const data = await fetchPlaylists();
      setPlaylists(data);
    } catch (error) {
      console.error("Error loading playlists:", error);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }, []);

  const loadGenerated = useCallback(async () => {
    setIsLoadingGenerated(true);
    try {
      const data = await fetchGeneratedPlaylists();
      setGenerated(data);
    } catch (error) {
      console.error("Error loading generated playlists:", error);
    } finally {
      setIsLoadingGenerated(false);
    }
  }, []);

  const loadRecents = useCallback(async () => {
    try {
      const artists = await fetchRecentArtists();
      setRecentArtists(artists);
    } catch (error) {
      console.error("Error loading recent artists:", error);
    }
  }, []);

  useEffect(() => {
    void loadMain();
    void loadNew();
    void loadRecents();
    void loadPlaylists();
    void loadGenerated();
  }, [loadMain, loadNew, loadRecents, loadPlaylists, loadGenerated]);

  const trendingItems = generated
    .filter((p) => p.type === "trending")
    .map(toRailItem);
  const topItems = generated.filter((p) => p.type === "top").map(toRailItem);
  const moodItems = generated.filter((p) => p.type === "mood").map(toRailItem);

  const openGenerated = (id: string) =>
    router.push({
      pathname: "/(tabs)/nasheeds/generated/[key]",
      params: { key: id },
    });

  if (errorMessage) {
    return <ShowError message={errorMessage} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 44 }}
      >
        <ContinueListeningBlock variant="nasheeds" />

        <View className="flex-row px-4 mt-2" style={{ gap: 12 }}>
          <Pressable
            onPress={() => router.push("/(tabs)/nasheeds/mix")}
            className="flex-1 flex-row items-center rounded-2xl border border-qasid-gold/30 bg-qasid-gold/10 px-4 py-4 active:opacity-80"
          >
            <Ionicons name="sparkles" size={20} color={GOLD} />
            <Text className="ml-2 text-qasid-white font-semibold">
              Weekly Mix
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/nasheeds/favorites")}
            className="flex-1 flex-row items-center rounded-2xl border border-qasid-gold/30 bg-qasid-gold/10 px-4 py-4 active:opacity-80"
          >
            <Ionicons name="heart" size={20} color={GOLD} />
            <Text className="ml-2 text-qasid-white font-semibold">
              Favorites
            </Text>
          </Pressable>
        </View>

        {(isLoadingGenerated || trendingItems.length > 0) && (
          <ArtistRailSection
            large
            title="Trending"
            artists={trendingItems}
            isLoading={isLoadingGenerated}
            onPressItem={openGenerated}
          />
        )}
        {(isLoadingGenerated || topItems.length > 0) && (
          <ArtistRailSection
            large
            title="Top Charts"
            artists={topItems}
            isLoading={isLoadingGenerated}
            onPressItem={openGenerated}
          />
        )}
        {(isLoadingGenerated || moodItems.length > 0) && (
          <ArtistRailSection
            title="Moods"
            artists={moodItems}
            isLoading={isLoadingGenerated}
            onPressItem={openGenerated}
          />
        )}

        <ArtistRailSection
          large
          title="Featured Playlists"
          artists={playlists}
          isLoading={isLoadingPlaylists}
          onPressItem={(id) =>
            router.push({
              pathname: "/(tabs)/nasheeds/playlist/[id]",
              params: { id },
            })
          }
        />
        <ArtistRailSection title="Recently Visited" artists={recentArtists} />
        <ArtistRailSection
          title="Popular Artists"
          artists={popularArtists}
          isLoading={isLoadingMain}
          onPressSeeAll={() =>
            router.push({
              pathname: "/(tabs)/nasheeds/all-artists",
              params: { sort: "popular" },
            })
          }
        />
        <ArtistRailSection
          title="New Artists"
          circle
          artists={newArtists}
          isLoading={isLoadingNew}
          onPressSeeAll={() =>
            router.push({
              pathname: "/(tabs)/nasheeds/all-artists",
              params: { sort: "new" },
            })
          }
        />
        <BrowseAllArtistsPreview
          small
          artists={allArtists}
          isLoading={isLoadingMain}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

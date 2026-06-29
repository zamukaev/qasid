import { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ShowError,
  ArtistRailSection,
  BrowseAllArtistsPreview,
  ContinueListeningBlock,
} from "../../../components";
import { useAuth } from "../../../hooks/useAuth";
import {
  GeneratedPlaylist,
  NasheedArtist,
  Playlist,
} from "../../../types/nasheed";
import {
  fetchNasheedArtists,
  fetchPopularArtists,
  fetchNewArtists,
  fetchArtistImagePath,
} from "../../../services/nasheeds-service";
import { fetchRecentArtists } from "../../../services/recents-service";
import { fetchPlaylists } from "../../../services/playlists-service";
import {
  fetchGeneratedPlaylists,
  fetchWeeklyMix,
} from "../../../services/recommendations-service";
import { fetchFavoriteCovers } from "../../../services/favorites-service";

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
  const { user } = useAuth();
  const [popularArtists, setPopularArtists] = useState<NasheedArtist[]>([]);
  const [newArtists, setNewArtists] = useState<NasheedArtist[]>([]);
  const [allArtists, setAllArtists] = useState<NasheedArtist[]>([]);
  const [recentArtists, setRecentArtists] = useState<NasheedArtist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [generated, setGenerated] = useState<GeneratedPlaylist[]>([]);
  const [mixCovers, setMixCovers] = useState<string[]>([]);
  const [favCovers, setFavCovers] = useState<string[]>([]);
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

  // Cover art for the "For You" tiles. Best-effort: a gradient fallback is used
  // when either source is empty, so failures here are non-fatal. The weekly mix
  // is read from cache only (no generation) to keep the home load light.
  const loadForYouCovers = useCallback(async () => {
    try {
      const [mix, favs] = await Promise.all([
        fetchWeeklyMix(),
        fetchFavoriteCovers(),
      ]);
      const firstArtistId = mix?.tracks?.[0]?.artist_id ?? null;
      const mixArtistImage = firstArtistId
        ? await fetchArtistImagePath(firstArtistId)
        : null;
      setMixCovers(mixArtistImage ? [mixArtistImage] : []);
      setFavCovers(favs);
    } catch (error) {
      console.error("Error loading For You covers:", error);
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
    void loadForYouCovers();
  }, [
    loadMain,
    loadNew,
    loadRecents,
    loadPlaylists,
    loadGenerated,
    loadForYouCovers,
  ]);

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

  const firstName = user?.displayName?.trim().split(/\s+/)[0];
  const madeForTitle = firstName ? `Made for ${firstName}` : "Made for You";
  const forYouItems = [
    { id: "weekly-mix", name_en: "Weekly Mix", image_path: mixCovers[0] },
    { id: "favorites", name_en: "Favorites", image_path: favCovers[0] },
  ] as unknown as Playlist[];

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

        <ArtistRailSection
          large
          title={madeForTitle}
          artists={forYouItems}
          onPressItem={(id) =>
            router.push(
              id === "weekly-mix"
                ? "/(tabs)/nasheeds/mix"
                : "/(tabs)/nasheeds/favorites",
            )
          }
        />

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

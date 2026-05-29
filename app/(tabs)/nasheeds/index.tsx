import { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  ShowError,
  ArtistRailSection,
  BrowseAllArtistsPreview,
  ContinueListeningBlock,
} from "../../../components";
import { NasheedArtist, Playlist } from "../../../types/nasheed";
import {
  fetchNasheedArtists,
  fetchPopularArtists,
  fetchNewArtists,
} from "../../../services/nasheeds-service";
import { fetchRecentArtists } from "../../../services/recents-service";
import { fetchPlaylists } from "../../../services/playlists-service";

export default function Nasheeds() {
  const router = useRouter();
  const [popularArtists, setPopularArtists] = useState<NasheedArtist[]>([]);
  const [newArtists, setNewArtists] = useState<NasheedArtist[]>([]);
  const [allArtists, setAllArtists] = useState<NasheedArtist[]>([]);
  const [recentArtists, setRecentArtists] = useState<NasheedArtist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
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
  }, [loadMain, loadNew, loadRecents, loadPlaylists]);

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

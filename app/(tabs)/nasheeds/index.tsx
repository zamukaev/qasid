import { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  ShowError,
  ArtistRailSection,
  BrowseAllArtistsPreview,
  ContinueListeningBlock,
} from "../../../components";
import { NasheedArtist } from "../../../types/nasheed";
import {
  fetchNasheedArtists,
  fetchPopularArtists,
  fetchNewArtists,
} from "../../../services/nasheeds-service";

export default function Nasheeds() {
  const router = useRouter();
  const [popularArtists, setPopularArtists] = useState<NasheedArtist[]>([]);
  const [newArtists, setNewArtists] = useState<NasheedArtist[]>([]);
  const [allArtists, setAllArtists] = useState<NasheedArtist[]>([]);
  const [isLoadingMain, setIsLoadingMain] = useState(false);
  const [isLoadingNew, setIsLoadingNew] = useState(false);
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

  useEffect(() => {
    void loadMain();
    void loadNew();
  }, [loadMain, loadNew]);

  if (errorMessage) {
    return <ShowError message={errorMessage} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 44 }}
      >
        <ArtistRailSection
          title="Popular Artists"
          large
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
          artists={allArtists}
          isLoading={isLoadingMain}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

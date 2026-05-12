import { useCallback, useEffect, useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { FirebaseReciter } from "../../../types/quran";
import {
  BrowseAllRecitersPreview,
  ContinueListeningBlock,
  FeaturedList,
  ReciterRailSection,
  ShowError,
} from "../../../components";
import { loadFeaturedItems } from "../../../services/featured-service";
import { FeaturedItem } from "../../../types/featured";
import {
  fetchNewReciters,
  fetchPopularReciters,
  fetchReciters,
} from "../../../services/quran-service";
import { fetchRecentReciters } from "../../../services/recents-service";

export default function Quran() {
  const router = useRouter();
  const [allReciters, setAllReciters] = useState<FirebaseReciter[]>([]);
  const [popularReciters, setPopularReciters] = useState<FirebaseReciter[]>([]);
  const [newReciters, setNewReciters] = useState<FirebaseReciter[]>([]);
  const [recentReciters, setRecentReciters] = useState<FirebaseReciter[]>([]);
  const [featuredCollections, setFeaturedCollections] = useState<
    FeaturedItem[]
  >([]);
  const [isLoadingMainReciters, setIsLoadingMainReciters] = useState(false);
  const [isLoadingNewReciters, setIsLoadingNewReciters] = useState(false);
  const [isLoadingFeaturedCollections, setIsLoadingFeaturedCollections] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFeaturedCollections = useCallback(async () => {
    setIsLoadingFeaturedCollections(true);
    try {
      const items = await loadFeaturedItems();
      setFeaturedCollections(items);
    } catch (error) {
      console.error("Error loading featured items", error);
    } finally {
      setIsLoadingFeaturedCollections(false);
    }
  }, []);

  const loadMainReciters = useCallback(async () => {
    setIsLoadingMainReciters(true);
    try {
      const [allRecitersResponse, popularRecitersResponse] = await Promise.all([
        fetchReciters(),
        fetchPopularReciters(),
      ]);

      setAllReciters(allRecitersResponse.reciters);
      setPopularReciters(popularRecitersResponse);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      console.error("Error loading reciters", error);
    } finally {
      setIsLoadingMainReciters(false);
    }
  }, []);

  const loadNewReciters = useCallback(async () => {
    setIsLoadingNewReciters(true);
    try {
      const response = await fetchNewReciters(8);
      setNewReciters(response.reciters);
    } catch (error) {
      console.error("Error loading new reciters", error);
    } finally {
      setIsLoadingNewReciters(false);
    }
  }, []);

  const openPopularReciters = useCallback(() => {
    router.push({
      pathname: "/(tabs)/quran/all-reciters",
      params: { sort: "popular" },
    });
  }, [router]);

  const openNewReciters = useCallback(() => {
    router.push({
      pathname: "/(tabs)/quran/all-reciters",
      params: { sort: "new" },
    });
  }, [router]);

  const loadRecents = useCallback(async () => {
    try {
      const reciters = await fetchRecentReciters();
      setRecentReciters(reciters);
    } catch (error) {
      console.error("Error loading recent reciters:", error);
    }
  }, []);

  useEffect(() => {
    void loadMainReciters();
    void loadNewReciters();
    void loadFeaturedCollections();
    void loadRecents();
  }, [loadFeaturedCollections, loadMainReciters, loadNewReciters, loadRecents]);

  if (errorMessage) {
    return <ShowError message={errorMessage} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 44 }}
      >
        <ContinueListeningBlock />
        <FeaturedList
          featuredItems={featuredCollections}
          isLoading={isLoadingFeaturedCollections}
          title="Featured Collections"
        />
        <ReciterRailSection
          large
          title="Recently Visited"
          reciters={recentReciters}
        />
        <ReciterRailSection
          title="Popular Reciters"
          large
          reciters={popularReciters}
          isLoading={isLoadingMainReciters}
          onPressSeeAll={openPopularReciters}
        />
        <ReciterRailSection
          title="New Reciters"
          circle
          reciters={newReciters}
          isLoading={isLoadingNewReciters}
          onPressSeeAll={openNewReciters}
        />
        <BrowseAllRecitersPreview
          reciters={allReciters}
          isLoading={isLoadingMainReciters}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { GOLD } from "../../../constants/colors";
import {
  ShowError,
  ArtistRailSection,
  BrowseAllArtistsPreview,
  ContinueListeningBlock,
  PromoHomeBanner,
} from "../../../components";
import { useAuth } from "../../../hooks/useAuth";
import { useRequireAccount } from "../../../hooks/useRequireAccount";
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
import {
  ensureWeeklyMix,
  fetchGeneratedPlaylists,
} from "../../../services/recommendations-service";
import { fetchFirstFavorite } from "../../../services/favorites-service";
import { fetchCollections } from "../../../services/collections-service";
import {
  CollectionDoc,
  CollectionShelf,
  collectionCover,
  shelfCollections,
} from "../../../utils/collections";
import {
  cachedFirstTrackCover,
  firstTrackCovers,
} from "../../../utils/nasheedTrack";

// Generated playlists carry a `key` (not `id`); ArtistRailSection only reads
// id/name_en/image_path, so a light projection is enough. `coverOverride`
// is the first nasheed's artwork, shown instead of the playlist's own
// image_path.
const toRailItem = (p: GeneratedPlaylist, coverOverride?: string): Playlist =>
  ({
    id: p.key,
    name_en: p.name_en,
    name_ar: p.name_ar,
    desc: p.desc,
    image_path: coverOverride ?? p.image_path,
    is_active: p.is_active,
  }) as unknown as Playlist;

const toCollectionRailItems = (
  collections: readonly CollectionDoc[],
  shelf: CollectionShelf,
): Playlist[] =>
  shelfCollections(collections, shelf).map(
    (c) =>
      ({
        id: c.id,
        name_en: c.name_en,
        name_ar: c.name_ar,
        desc: c.desc,
        image_path: collectionCover(c),
        is_active: c.is_active,
      }) as unknown as Playlist,
  );

export default function Nasheeds() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isGuest, requireAccount } = useRequireAccount();
  const [popularArtists, setPopularArtists] = useState<NasheedArtist[]>([]);
  const [newArtists, setNewArtists] = useState<NasheedArtist[]>([]);
  const [allArtists, setAllArtists] = useState<NasheedArtist[]>([]);
  const [recentArtists, setRecentArtists] = useState<NasheedArtist[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [generated, setGenerated] = useState<GeneratedPlaylist[]>([]);
  const [collections, setCollections] = useState<CollectionDoc[]>([]);
  const [generatedCovers, setGeneratedCovers] = useState<
    Record<string, string>
  >({});
  const [mixCovers, setMixCovers] = useState<string[]>([]);
  const [favCovers, setFavCovers] = useState<string[]>([]);
  const [hasWeeklyMix, setHasWeeklyMix] = useState(false);
  const [hasFavorites, setHasFavorites] = useState(false);
  const [isLoadingForYou, setIsLoadingForYou] = useState(true);
  const [isLoadingGenerated, setIsLoadingGenerated] = useState(true);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [isLoadingMain, setIsLoadingMain] = useState(true);
  const [isLoadingNew, setIsLoadingNew] = useState(true);
  const [isLoadingRecents, setIsLoadingRecents] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Covers upgrade in the background; a newer load must win over a slower,
  // older one that resolves after it.
  const generatedLoadRef = useRef(0);
  const forYouLoadRef = useRef(0);

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

  const loadCollections = useCallback(async (force = false) => {
    setIsLoadingCollections(true);
    try {
      setCollections(await fetchCollections({ force }));
    } catch (error) {
      console.error("Error loading collections:", error);
    } finally {
      setIsLoadingCollections(false);
    }
  }, []);

  const loadGenerated = useCallback(async (force = false) => {
    const loadId = ++generatedLoadRef.current;
    setIsLoadingGenerated(true);
    try {
      const data = await fetchGeneratedPlaylists({ force });
      if (loadId !== generatedLoadRef.current) return;
      const lists = Object.fromEntries(data.map((p) => [p.key, p.tracks]));

      // Every generated playlist (trending, top, moods) shows its first
      // nasheed's artwork as the cover. Paint with what is already at hand,
      // then swap in the live artwork, read in one query, without blocking.
      setGenerated(data);
      setGeneratedCovers(
        Object.fromEntries(
          data.flatMap((p) => {
            const cover = cachedFirstTrackCover(p.tracks);
            return cover ? [[p.key, cover]] : [];
          }),
        ),
      );
      setIsLoadingGenerated(false);

      void firstTrackCovers(lists)
        .then((covers) => {
          if (loadId !== generatedLoadRef.current) return;
          setGeneratedCovers((prev) => ({ ...prev, ...covers }));
        })
        .catch((error) => {
          console.error("Error loading generated playlist covers:", error);
        });
    } catch (error) {
      console.error("Error loading generated playlists:", error);
    } finally {
      if (loadId === generatedLoadRef.current) setIsLoadingGenerated(false);
    }
  }, []);

  // Cover art for the "For You" tiles. Best-effort: a gradient fallback is used
  // when either source is empty, so failures here are non-fatal. `ensureWeeklyMix`
  // creates the mix on first visit and refreshes it once a week — nothing else in
  // the app ever generates one, so without this the tile could never appear.
  const loadForYouCovers = useCallback(
    async (force?: boolean) => {
      // Firebase restores the session asynchronously; running before that reads
      // a null uid and would silently leave the rail empty until a manual pull.
      if (authLoading) return;
      // Both sources are per-account, so guests skip the reads entirely.
      if (!user?.uid || isGuest) {
        setHasWeeklyMix(false);
        setHasFavorites(false);
        setIsLoadingForYou(false);
        return;
      }

      const loadId = ++forYouLoadRef.current;
      setIsLoadingForYou(true);
      try {
        const [mix, favs] = await Promise.all([
          ensureWeeklyMix({ force }),
          fetchFirstFavorite(),
        ]);
        if (loadId !== forYouLoadRef.current) return;
        const lists = {
          mix: mix?.tracks,
          favorites: favs.firstTrack ? [favs.firstTrack] : undefined,
        };
        const toCovers = (cover: string | undefined) => (cover ? [cover] : []);

        // Same as the generated rails: paint now, upgrade in one query.
        setMixCovers(toCovers(cachedFirstTrackCover(lists.mix)));
        setFavCovers(toCovers(cachedFirstTrackCover(lists.favorites)));
        setHasWeeklyMix((mix?.tracks?.length ?? 0) > 0);
        setHasFavorites(favs.hasFavorites);
        setIsLoadingForYou(false);

        void firstTrackCovers(lists)
          .then((covers) => {
            if (loadId !== forYouLoadRef.current) return;
            if (covers.mix) setMixCovers([covers.mix]);
            if (covers.favorites) setFavCovers([covers.favorites]);
          })
          .catch((error) => {
            console.error("Error loading For You covers:", error);
          });
      } catch (error) {
        console.error("Error loading For You:", error);
      } finally {
        if (loadId === forYouLoadRef.current) setIsLoadingForYou(false);
      }
    },
    [authLoading, user?.uid, isGuest],
  );

  const loadRecents = useCallback(async () => {
    if (isGuest) {
      setRecentArtists([]);
      setIsLoadingRecents(false);
      return;
    }
    setIsLoadingRecents(true);
    try {
      const artists = await fetchRecentArtists();
      setRecentArtists(artists);
    } catch (error) {
      console.error("Error loading recent artists:", error);
    } finally {
      setIsLoadingRecents(false);
    }
  }, [isGuest]);

  useEffect(() => {
    void loadMain();
    void loadNew();
    void loadRecents();
    void loadPlaylists();
    void loadGenerated();
    void loadCollections();
  }, [
    loadMain,
    loadNew,
    loadRecents,
    loadPlaylists,
    loadGenerated,
    loadCollections,
  ]);

  // Own effect: this is the only loader whose identity changes (it depends on
  // the restored session), and the rails above must not refetch when it does.
  useEffect(() => {
    void loadForYouCovers();
  }, [loadForYouCovers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadMain(),
        loadNew(),
        loadRecents(),
        loadPlaylists(),
        loadGenerated(true),
        loadCollections(true),
        loadForYouCovers(true),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    loadMain,
    loadNew,
    loadRecents,
    loadPlaylists,
    loadGenerated,
    loadCollections,
    loadForYouCovers,
  ]);

  const trendingItems = useMemo(
    () =>
      generated
        .filter((p) => p.type === "trending" && p.tracks?.length > 0)
        .map((p) => toRailItem(p, generatedCovers[p.key])),
    [generated, generatedCovers],
  );
  const topItems = useMemo(
    () =>
      generated
        .filter((p) => p.type === "top" && p.tracks?.length > 0)
        .map((p) => toRailItem(p, generatedCovers[p.key])),
    [generated, generatedCovers],
  );
  const moodItems = useMemo(
    () =>
      generated
        .filter((p) => p.type === "mood" && p.tracks?.length > 0)
        .map((p) => toRailItem(p, generatedCovers[p.key])),
    [generated, generatedCovers],
  );

  const collectionItems = useMemo(
    () => toCollectionRailItems(collections, "collections"),
    [collections],
  );
  const eraItems = useMemo(
    () => toCollectionRailItems(collections, "eras"),
    [collections],
  );

  const openCollection = (id: string) =>
    router.push({
      pathname: "/(tabs)/nasheeds/collection/[id]",
      params: { id },
    });

  const openGenerated = (id: string) =>
    router.push({
      pathname: "/(tabs)/nasheeds/generated/[key]",
      params: { key: id },
    });

  const firstName = user?.displayName?.trim().split(/\s+/)[0];
  const madeForTitle = firstName ? `Made for ${firstName}` : "Made for You";
  // Guests see both tiles as a teaser; tapping one opens the sign-in gate.
  const forYouItems = [
    (isGuest || hasWeeklyMix) && {
      id: "weekly-mix",
      name_en: "Weekly Mix",
      image_path: mixCovers[0],
    },
    (isGuest || hasFavorites) && {
      id: "favorites",
      name_en: "Favorites",
      image_path: favCovers[0],
    },
  ].filter(Boolean) as unknown as Playlist[];

  if (errorMessage) {
    return <ShowError message={errorMessage} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-qasid-black">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 44 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={GOLD}
            colors={[GOLD]}
          />
        }
      >
        <PromoHomeBanner />
        <ContinueListeningBlock variant="nasheeds" />

        {(isLoadingForYou || forYouItems.length > 0) && (
          <ArtistRailSection
            large
            fitWhole
            title={madeForTitle}
            artists={forYouItems}
            isLoading={isLoadingForYou}
            onPressItem={(id) => {
              const isMix = id === "weekly-mix";
              if (
                !requireAccount(
                  isMix ? "get your Weekly Mix" : "save favorites",
                )
              ) {
                return;
              }
              router.push(
                isMix ? "/(tabs)/nasheeds/mix" : "/(tabs)/nasheeds/favorites",
              );
            }}
          />
        )}

        {(isLoadingGenerated || trendingItems.length > 0) && (
          <ArtistRailSection
            large
            fitWhole
            title="Trending"
            artists={trendingItems}
            isLoading={isLoadingGenerated}
            onPressItem={openGenerated}
          />
        )}
        {(isLoadingGenerated || topItems.length > 0) && (
          <ArtistRailSection
            large
            fitWhole
            title="Top Charts"
            artists={topItems}
            isLoading={isLoadingGenerated}
            onPressItem={openGenerated}
          />
        )}
        {(isLoadingGenerated || moodItems.length > 0) && (
          <ArtistRailSection
            large
            fitWhole
            title="Moods"
            artists={moodItems}
            isLoading={isLoadingGenerated}
            onPressItem={openGenerated}
          />
        )}
        {(isLoadingCollections || collectionItems.length > 0) && (
          <ArtistRailSection
            large
            fitWhole
            title="Collections"
            artists={collectionItems}
            isLoading={isLoadingCollections}
            onPressItem={openCollection}
          />
        )}
        {(isLoadingCollections || eraItems.length > 0) && (
          <ArtistRailSection
            large
            fitWhole
            title="Through the Years"
            artists={eraItems}
            isLoading={isLoadingCollections}
            onPressItem={openCollection}
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
        {!isGuest && (
          <ArtistRailSection
            title="Recently Visited"
            artists={recentArtists}
            isLoading={isLoadingRecents}
          />
        )}
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
          artists={allArtists}
          isLoading={isLoadingMain}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

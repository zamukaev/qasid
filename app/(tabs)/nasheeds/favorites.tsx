import { useCallback, useEffect, useRef, useState } from "react";
import {
  CollectionTrack,
  TrackCollectionScreen,
} from "../../../components";
import { Nasheed } from "../../../types/nasheed";
import { fetchFavorites } from "../../../services/favorites-service";
import { fetchArtistImagePath } from "../../../services/nasheeds-service";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import { toNasheedTrackMeta } from "../../../utils/nasheedTrack";
import { useIsGuest } from "../../../stores/userStore";

// Synchronous: storage paths stay raw so the list paints immediately.
const toCollectionTrack = (nasheed: Nasheed): CollectionTrack => ({
  ...toNasheedTrackMeta(nasheed),
  nasheed,
});

export default function FavoritesScreen() {
  const isGuest = useIsGuest();
  const [tracks, setTracks] = useState<CollectionTrack[]>([]);
  const [headerImagePath, setHeaderImagePath] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    // Per-account data: a guest (e.g. arriving via a deep link) gets the
    // sign-in hint from the empty state instead of a failed request.
    if (isGuest) {
      setTracks([]);
      setLoading(false);
      return;
    }
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const favorites = await fetchFavorites();
      if (!isMountedRef.current) return;

      // Phase 1 — paint.
      setTracks(favorites.map(toCollectionTrack));
      setError(null);
      setLoading(false);

      // The hearts read the store, not this list, so a refresh here has to
      // refresh that too. Not seeded from `favorites`: that query is capped at
      // FAVORITES_LIMIT, which would drop ids for users past the cap.
      void useFavoritesStore
        .getState()
        .hydrate(true)
        .catch(() => {});

      // Phase 2 — header artwork, which must not gate the list.
      const firstArtistId = favorites[0]?.artist_id ?? null;
      const artistImage = firstArtistId
        ? await fetchArtistImagePath(firstArtistId)
        : null;
      if (!isMountedRef.current) return;
      setHeaderImagePath(artistImage ?? undefined);
    } catch (e) {
      if (isMountedRef.current) {
        console.error("Error loading favorites:", e);
        setError(
          e instanceof Error ? e.message : "Unable to load your favorites.",
        );
      }
    } finally {
      hasLoadedRef.current = true;
      if (isMountedRef.current) setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TrackCollectionScreen
      title="Your Favorites"
      subtitle={`${tracks.length} Nasheeds`}
      headerImagePath={headerImagePath}
      trackPrefix="favorites"
      tracks={tracks}
      loading={loading}
      error={error}
      emptyMessage={
        isGuest
          ? "Sign in to save and see your favorite nasheeds."
          : "You haven't favorited any nasheeds yet."
      }
      onRefresh={load}
    />
  );
}

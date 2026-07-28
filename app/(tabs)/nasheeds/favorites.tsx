import { useCallback, useEffect, useRef, useState } from "react";
import {
  CollectionTrack,
  TrackCollectionScreen,
} from "../../../components";
import { Nasheed } from "../../../types/nasheed";
import { fetchFavorites } from "../../../services/favorites-service";
import { fetchArtistImagePath } from "../../../services/nasheeds-service";
import { toNasheedTrackMeta } from "../../../utils/nasheedTrack";

// Synchronous: storage paths stay raw so the list paints immediately.
const toCollectionTrack = (nasheed: Nasheed): CollectionTrack => ({
  ...toNasheedTrackMeta(nasheed),
  nasheed,
});

export default function FavoritesScreen() {
  const [tracks, setTracks] = useState<CollectionTrack[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
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
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const favorites = await fetchFavorites();
      if (!isMountedRef.current) return;

      // Phase 1 — paint.
      setTracks(favorites.map(toCollectionTrack));
      setFavoriteIds(new Set(favorites.map((f) => f.id)));
      setError(null);
      setLoading(false);

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
  }, []);

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
      favoriteIds={favoriteIds}
      emptyMessage="You haven't favorited any nasheeds yet."
      onRefresh={load}
    />
  );
}

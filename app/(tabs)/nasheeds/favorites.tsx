import { useEffect, useRef, useState } from "react";
import {
  CollectionTrack,
  TrackCollectionScreen,
} from "../../../components";
import { Nasheed } from "../../../types/nasheed";
import { fetchFavorites } from "../../../services/favorites-service";
import { resolveStorageUrl } from "../../../services/storage";
import { fetchArtistImagePath } from "../../../services/nasheeds-service";

const toCollectionTrack = async (
  nasheed: Nasheed,
): Promise<CollectionTrack> => ({
  id: nasheed.id,
  title: nasheed.title_en,
  artist: nasheed.name_en,
  audioUrl: nasheed.audio_path
    ? await resolveStorageUrl(nasheed.audio_path)
    : null,
  imageUrl: nasheed.image_path
    ? await resolveStorageUrl(nasheed.image_path)
    : null,
  nasheed,
});

export default function FavoritesScreen() {
  const [tracks, setTracks] = useState<CollectionTrack[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [headerImagePath, setHeaderImagePath] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const favorites = await fetchFavorites();
        const firstArtistId = favorites[0]?.artist_id ?? null;
        const [normalized, artistImage] = await Promise.all([
          Promise.all(favorites.map(toCollectionTrack)),
          firstArtistId ? fetchArtistImagePath(firstArtistId) : Promise.resolve(null),
        ]);
        if (!isMountedRef.current) return;
        setTracks(normalized);
        setFavoriteIds(new Set(favorites.map((f) => f.id)));
        setHeaderImagePath(artistImage ?? undefined);
        setError(null);
      } catch (e) {
        if (isMountedRef.current) {
          console.error("Error loading favorites:", e);
          setError(
            e instanceof Error ? e.message : "Unable to load your favorites.",
          );
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };
    void load();
  }, []);

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
    />
  );
}

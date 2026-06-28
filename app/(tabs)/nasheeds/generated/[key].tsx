import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { CollectionTrack, TrackCollectionScreen } from "../../../../components";
import { GeneratedPlaylist, Mood, RecommendedTrack } from "../../../../types/nasheed";
import { fetchGeneratedPlaylistByKey } from "../../../../services/recommendations-service";
import { fetchFavoriteIds } from "../../../../services/favorites-service";
import { resolveStorageUrl } from "../../../../services/storage";

const toCollectionTrack = async (
  track: RecommendedTrack,
): Promise<CollectionTrack | null> => {
  try {
    const [audioUrl, imageUrl] = await Promise.all([
      track.audio_path
        ? resolveStorageUrl(track.audio_path)
        : Promise.resolve(null),
      track.image_path
        ? resolveStorageUrl(track.image_path)
        : Promise.resolve(null),
    ]);

    return {
      id: track.id,
      title: track.title_en,
      artist: track.name_en,
      audioUrl,
      imageUrl,
      nasheed: {
        id: track.id,
        name_en: track.name_en,
        title_en: track.title_en,
        audio_path: track.audio_path,
        image_path: track.image_path,
        artist_id: track.artist_id,
        moods: track.moods as Mood[],
      },
    };
  } catch (e) {
    console.error(
      `Failed to resolve storage URLs for track ${track.id}: ${track.audio_path}, ${track.image_path}`,
      e,
    );
    return null;
  }
};

export default function GeneratedPlaylistScreen() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  const [playlist, setPlaylist] = useState<GeneratedPlaylist | null>(null);
  const [tracks, setTracks] = useState<CollectionTrack[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
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
      if (!key) {
        setError("Playlist not specified.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchGeneratedPlaylistByKey(key);
        if (!data) {
          if (isMountedRef.current) setError("Playlist not found.");
          return;
        }
        const [rawNormalized, favIds] = await Promise.all([
          Promise.all((data.tracks ?? []).map(toCollectionTrack)),
          fetchFavoriteIds(),
        ]);
        const normalized = rawNormalized.filter(Boolean) as CollectionTrack[];
        if (!isMountedRef.current) return;
        setPlaylist(data);
        setTracks(normalized);
        setFavoriteIds(favIds);
        setError(null);
      } catch (e) {
        if (isMountedRef.current) {
          console.error("Error loading generated playlist:", e);
          setError(
            e instanceof Error ? e.message : "Unable to load playlist data.",
          );
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };
    void load();
  }, [key]);

  return (
    <TrackCollectionScreen
      title={playlist?.name_en ?? "Playlist"}
      subtitle={`${tracks.length} Nasheeds`}
      description={playlist?.desc}
      headerImagePath={playlist?.image_path}
      trackPrefix={`generated-${key}`}
      tracks={tracks}
      loading={loading}
      error={error}
      favoriteIds={favoriteIds}
    />
  );
}

import { useEffect, useRef, useState } from "react";
import {
  CollectionTrack,
  TrackCollectionScreen,
} from "../../../../components";
import { RecommendedTrack } from "../../../../types/nasheed";
import {
  fetchWeeklyMix,
  generateWeeklyMix,
} from "../../../../services/recommendations-service";
import { fetchFavoriteIds } from "../../../../services/favorites-service";
import { resolveStorageUrl } from "../../../../services/storage";

const toCollectionTrack = async (
  track: RecommendedTrack,
): Promise<CollectionTrack> => ({
  id: track.id,
  title: track.title_en,
  artist: track.name_en,
  audioUrl: track.audio_path ? await resolveStorageUrl(track.audio_path) : null,
  imageUrl: track.image_path ? await resolveStorageUrl(track.image_path) : null,
  nasheed: {
    id: track.id,
    name_en: track.name_en,
    title_en: track.title_en,
    audio_path: track.audio_path,
    image_path: track.image_path,
    artist_id: track.artist_id,
    moods: track.moods as any,
  },
});

export default function WeeklyMixScreen() {
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
      setLoading(true);
      try {
        // Prefer the cached mix; generate a fresh one if none exists yet.
        const cached = await fetchWeeklyMix();
        let raw: RecommendedTrack[] = cached?.tracks ?? [];
        if (raw.length === 0) {
          raw = await generateWeeklyMix();
        }
        const [normalized, favIds] = await Promise.all([
          Promise.all(raw.map(toCollectionTrack)),
          fetchFavoriteIds(),
        ]);
        if (!isMountedRef.current) return;
        setTracks(normalized);
        setFavoriteIds(favIds);
        setError(null);
      } catch (e) {
        if (isMountedRef.current) {
          console.error("Error loading weekly mix:", e);
          setError(
            e instanceof Error ? e.message : "Unable to load your weekly mix.",
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
      title="Your Weekly Mix"
      subtitle={`${tracks.length} Nasheeds`}
      description="A fresh personalized mix, updated for you."
      trackPrefix="weekly-mix"
      tracks={tracks}
      loading={loading}
      error={error}
      favoriteIds={favoriteIds}
      emptyMessage="Listen to a few nasheeds to build your weekly mix."
    />
  );
}

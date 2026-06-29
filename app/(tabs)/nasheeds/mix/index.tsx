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
import { fetchArtistImagePath } from "../../../../services/nasheeds-service";

const toCollectionTrack = async (
  track: RecommendedTrack,
): Promise<CollectionTrack | null> => {
  try {
    const [audioUrl, imageUrl] = await Promise.all([
      track.audio_path ? resolveStorageUrl(track.audio_path) : Promise.resolve(null),
      track.image_path ? resolveStorageUrl(track.image_path) : Promise.resolve(null),
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
        moods: track.moods as any,
      },
    };
  } catch {
    return null;
  }
};

export default function WeeklyMixScreen() {
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
        // Prefer the cached mix; generate a fresh one if none exists yet.
        const cached = await fetchWeeklyMix();
        let raw: RecommendedTrack[] = cached?.tracks ?? [];
        if (raw.length === 0) {
          raw = await generateWeeklyMix();
        }
        const firstArtistId = raw[0]?.artist_id ?? null;
        const [rawNormalized, favIds, artistImage] = await Promise.all([
          Promise.all(raw.map(toCollectionTrack)),
          fetchFavoriteIds(),
          firstArtistId ? fetchArtistImagePath(firstArtistId) : Promise.resolve(null),
        ]);
        const normalized = rawNormalized.filter(Boolean) as CollectionTrack[];
        if (!isMountedRef.current) return;
        setTracks(normalized);
        setFavoriteIds(favIds);
        setHeaderImagePath(artistImage ?? undefined);
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
      headerImagePath={headerImagePath}
      trackPrefix="weekly-mix"
      tracks={tracks}
      loading={loading}
      error={error}
      favoriteIds={favoriteIds}
      emptyMessage="Listen to a few nasheeds to build your weekly mix."
    />
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionTrack, TrackCollectionScreen } from "../../../../components";
import { Mood, RecommendedTrack } from "../../../../types/nasheed";
import { ensureWeeklyMix } from "../../../../services/recommendations-service";
import { fetchArtistImagePath } from "../../../../services/nasheeds-service";
import {
  enrichWithLiveImageAndAudio,
  toNasheedTrackMeta,
} from "../../../../utils/nasheedTrack";

// Synchronous: storage paths stay raw so the list paints immediately.
const toCollectionTrack = (track: RecommendedTrack): CollectionTrack => ({
  ...toNasheedTrackMeta(track),
  nasheed: {
    id: track.id,
    name_en: track.name_en,
    title_en: track.title_en,
    audio_path: track.audio_path,
    image_path: track.image_path,
    artist_id: track.artist_id,
    moods: track.moods as Mood[],
  },
});

export default function WeeklyMixScreen() {
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
    if (!hasLoadedRef.current) setLoading(true);
    try {
      // Shared with the home rail: serves the stored mix, generating or
      // refreshing it when it is missing or a week old.
      const mix = await ensureWeeklyMix();
      const raw: RecommendedTrack[] = mix?.tracks ?? [];
      const enriched = await enrichWithLiveImageAndAudio(raw);
      if (!isMountedRef.current) return;

      // Phase 1 — paint.
      setTracks(enriched.map(toCollectionTrack));
      setError(null);
      setLoading(false);

      // Phase 2 — extras, none of which gate the list.
      const firstArtistId = raw[0]?.artist_id ?? null;
      const artistImage = firstArtistId
        ? await fetchArtistImagePath(firstArtistId)
        : null;
      if (!isMountedRef.current) return;
      setHeaderImagePath(artistImage ?? undefined);
    } catch (e) {
      if (isMountedRef.current) {
        console.error("Error loading weekly mix:", e);
        setError(
          e instanceof Error ? e.message : "Unable to load your weekly mix.",
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
      title="Your Weekly Mix"
      subtitle={`${tracks.length} Nasheeds`}
      description="A fresh personalized mix, updated for you."
      headerImagePath={headerImagePath}
      trackPrefix="weekly-mix"
      tracks={tracks}
      loading={loading}
      error={error}
      emptyMessage="Listen to a few nasheeds to build your weekly mix."
      onRefresh={load}
    />
  );
}

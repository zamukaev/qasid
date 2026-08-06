import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { CollectionTrack, TrackCollectionScreen } from "../../../../components";
import {
  GeneratedPlaylist,
  Mood,
  RecommendedTrack,
} from "../../../../types/nasheed";
import { fetchGeneratedPlaylistByKey } from "../../../../services/recommendations-service";
import { fetchArtistImagePath } from "../../../../services/nasheeds-service";
import { toNasheedTrackMeta } from "../../../../utils/nasheedTrack";

// Synchronous by design: storage paths stay unresolved so the list can paint
// on the single Firestore read instead of waiting on ~200 network round-trips.
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

export default function GeneratedPlaylistScreen() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  const [playlist, setPlaylist] = useState<GeneratedPlaylist | null>(null);
  const [coverImagePath, setCoverImagePath] = useState<string | undefined>();
  const [tracks, setTracks] = useState<CollectionTrack[]>([]);
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

  const load = useCallback(
    async (force = false) => {
      if (!key) {
        setError("Playlist not specified.");
        setLoading(false);
        return;
      }
      if (!hasLoadedRef.current) setLoading(true);
      try {
        const data = await fetchGeneratedPlaylistByKey(key, { force });
        if (!data) {
          if (isMountedRef.current) setError("Playlist not found.");
          return;
        }
        if (!isMountedRef.current) return;

        // Phase 1 — paint. Nothing here touches the network: storage paths
        // stay raw, and artwork fills in progressively once the list is up.
        setPlaylist(data);
        setCoverImagePath(data.image_path);
        setTracks((data.tracks ?? []).map(toCollectionTrack));
        setError(null);
        setLoading(false);

        // Phase 2 — extras, none of which gate the list.
        // Trending/Top playlists show their first track's artist photo as
        // the header cover (moods keep their own image_path, unchanged).
        const artistId =
          data.type !== "mood" ? data.tracks?.[0]?.artist_id : undefined;
        const artistImagePath = artistId
          ? await fetchArtistImagePath(artistId)
          : null;
        if (!isMountedRef.current) return;
        if (artistImagePath) setCoverImagePath(artistImagePath);
      } catch (e) {
        if (isMountedRef.current) {
          console.error("Error loading generated playlist:", e);
          setError(
            e instanceof Error ? e.message : "Unable to load playlist data.",
          );
        }
      } finally {
        hasLoadedRef.current = true;
        if (isMountedRef.current) setLoading(false);
      }
    },
    [key],
  );

  const handleRefresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TrackCollectionScreen
      title={playlist?.name_en ?? "Playlist"}
      subtitle={`${tracks.length} Nasheeds`}
      description={playlist?.desc}
      headerImagePath={coverImagePath}
      trackPrefix={`generated-${key}`}
      tracks={tracks}
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
    />
  );
}

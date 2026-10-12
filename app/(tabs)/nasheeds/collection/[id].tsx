import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  CollectionTrack,
  TrackCollectionScreen,
  recommendedToCollectionTrack,
} from "../../../../components";
import { fetchCollectionById } from "../../../../services/collections-service";
import { CollectionDoc, collectionCover } from "../../../../utils/collections";

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [collection, setCollection] = useState<CollectionDoc | null>(null);
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
      if (!id) {
        setError("Collection not specified.");
        setLoading(false);
        return;
      }
      if (!hasLoadedRef.current) setLoading(true);
      try {
        const data = await fetchCollectionById(id, { force });
        if (!isMountedRef.current) return;
        if (!data) {
          setError("Collection not found.");
          return;
        }
        setCollection(data);
        setTracks(data.tracks.map(recommendedToCollectionTrack));
        setError(null);
      } catch (e) {
        if (isMountedRef.current) {
          console.error("Error loading collection:", e);
          setError(
            e instanceof Error ? e.message : "Unable to load collection data.",
          );
        }
      } finally {
        hasLoadedRef.current = true;
        if (isMountedRef.current) setLoading(false);
      }
    },
    [id],
  );

  const handleRefresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TrackCollectionScreen
      title={collection?.name_en ?? "Collection"}
      subtitle={`${tracks.length} Nasheeds`}
      description={collection?.desc}
      headerImagePath={collection ? collectionCover(collection) : undefined}
      trackPrefix={`collection-${id}`}
      tracks={tracks}
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
    />
  );
}

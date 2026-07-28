import { fetchNasheedsByIds } from "../services/nasheeds-service";

/**
 * A track reduced to what a collection list needs to render and to play.
 *
 * Both `*Path` fields hold either an http(s) URL or a raw Firebase Storage
 * path — deliberately unresolved. Images resolve progressively once the list
 * has painted (`useProgressiveStorageUrls`); audio resolves on play. Resolving
 * either up front is what made a 100-track playlist take seconds to open.
 */
export interface NasheedTrackMeta {
  id: string;
  title: string;
  artist: string;
  audioPath: string | null;
  imagePath: string | null;
}

export function toNasheedTrackMeta(item: {
  id: string;
  title_en: string;
  name_en: string;
  audio_path?: string | null;
  image_path?: string | null;
}): NasheedTrackMeta {
  return {
    id: item.id,
    title: item.title_en,
    artist: item.name_en,
    audioPath: item.audio_path ?? null,
    imagePath: item.image_path ?? null,
  };
}

// Overlays current image_path/audio_path from the live `nasheeds` collection
// onto a denormalized snapshot (e.g. a favorite or a cached weekly-mix track),
// which may have been copied before a photo existed and never refreshed since.
export async function enrichWithLiveImageAndAudio<
  T extends {
    id: string;
    image_path?: string | null;
    audio_path?: string | null;
  },
>(items: T[]): Promise<T[]> {
  const live = await fetchNasheedsByIds(items.map((item) => item.id));
  return items.map((item) => {
    const fresh = live.get(item.id);
    if (!fresh) return item;
    return {
      ...item,
      image_path: fresh.image_path || item.image_path,
      audio_path: fresh.audio_path || item.audio_path,
    };
  });
}

import {
  fetchArtistImagePath,
  fetchNasheedsByIds,
} from "../services/nasheeds-service";

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

export interface CoverSource {
  id: string;
  artist_id?: string | null;
  image_path?: string | null;
}

/**
 * Cover art for a nasheed whose image_path is already current: its own
 * artwork, else its artist's photo (for nasheeds that never got one).
 */
export async function trackCover(
  track: CoverSource | undefined,
): Promise<string | null> {
  if (!track) return null;
  if (track.image_path) return track.image_path;
  return track.artist_id ? fetchArtistImagePath(track.artist_id) : null;
}

// Resolved covers, by nasheed id. Artwork does not change within a session,
// and the same first nasheed is asked for by the home rail and again by its
// playlist screen.
const liveCoverCache = new Map<string, string | null>();

/**
 * A list's cover with no network: the cached live cover of its first nasheed,
 * else the artwork denormalized on the track. Paint with this, then upgrade
 * with firstTrackCovers.
 */
export function cachedFirstTrackCover(
  tracks: readonly CoverSource[] | undefined,
): string | undefined {
  const first = tracks?.[0];
  if (!first) return undefined;
  return liveCoverCache.get(first.id) || first.image_path || undefined;
}

/**
 * Covers for several lists at once, each taken from its first nasheed. The
 * live artwork is read in one batched query, since a denormalized track may
 * predate the nasheed's photo. Lists without a cover are left out.
 */
export async function firstTrackCovers(
  lists: Record<string, readonly CoverSource[] | undefined>,
): Promise<Record<string, string>> {
  const firsts = Object.entries(lists).flatMap(([key, tracks]) => {
    const first = tracks?.[0];
    return first ? [{ key, track: first }] : [];
  });
  const uncached = firsts
    .map(({ track }) => track)
    .filter((track) => !liveCoverCache.has(track.id));

  if (uncached.length > 0) {
    const live = await fetchNasheedsByIds([
      ...new Set(uncached.map((track) => track.id)),
    ]);
    await Promise.all(
      uncached.map(async (track) => {
        const cover = await trackCover({
          ...track,
          image_path: live.get(track.id)?.image_path || track.image_path,
        });
        liveCoverCache.set(track.id, cover);
      }),
    );
  }

  return Object.fromEntries(
    firsts.flatMap(({ key, track }) => {
      const cover = liveCoverCache.get(track.id);
      return cover ? [[key, cover]] : [];
    }),
  );
}

/** firstTrackCovers for a single list. */
export async function firstTrackCover(
  tracks: readonly CoverSource[] | undefined,
): Promise<string | null> {
  const { cover } = await firstTrackCovers({ cover: tracks });
  return cover ?? null;
}

import type { Mood, Nasheed } from "../types/nasheed";
import type {
  NasheedPlaylistTrackInput,
  SurahPlaylistTrackInput,
  UserPlaylistTrackInput,
} from "../types/userPlaylist";

/**
 * Pure rules for user playlists — no Firebase or React Native imports, so
 * `npm run check:playlists` can exercise them offline.
 */

/** A signed-in free user may keep this many playlists. */
export const FREE_PLAYLIST_LIMIT = 1;
/** Tracks per playlist for a free user. */
export const FREE_PLAYLIST_TRACK_LIMIT = 20;
/** Hard cap for everyone, keeps a playlist load a single bounded read. */
export const MAX_PLAYLIST_TRACKS = 200;
export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 200;
/** The collage is 2×2. */
export const COVER_COLLAGE_SIZE = 4;

export type PlaylistGate = "ok" | "premium" | "full";

/** Whether the user may create one more playlist. */
export function createGate({
  isPremium,
  playlistCount,
}: {
  isPremium: boolean;
  playlistCount: number;
}): PlaylistGate {
  if (isPremium) return "ok";
  return playlistCount < FREE_PLAYLIST_LIMIT ? "ok" : "premium";
}

/** Whether one more track fits into a playlist that holds `trackCount`. */
export function addGate({
  isPremium,
  trackCount,
}: {
  isPremium: boolean;
  trackCount: number;
}): PlaylistGate {
  if (trackCount >= MAX_PLAYLIST_TRACKS) return "full";
  if (!isPremium && trackCount >= FREE_PLAYLIST_TRACK_LIMIT) return "premium";
  return "ok";
}

/**
 * The track's doc id inside a playlist. Deterministic, so adding the same
 * track twice overwrites instead of duplicating, and membership is one `get`.
 */
export function trackKeyFor(item: UserPlaylistTrackInput): string {
  return item.kind === "nasheed"
    ? `n_${item.nasheed_id}`
    : `q_${item.reciter_id}_${item.surah_id}`;
}

export type TitleValidation =
  | { ok: true; title: string }
  | { ok: false; error: string };

/**
 * The name of a playlist created straight from a collection's "+": the
 * artist's, reciter's or collection's name, clipped to fit. Null when there is
 * no usable name, so the caller falls back to the form.
 */
export function collectionPlaylistTitle(
  raw: string | undefined,
): string | null {
  const title = (raw ?? "").trim().replace(/\s+/g, " ");
  return title ? title.slice(0, MAX_TITLE_LENGTH).trimEnd() : null;
}

export function validateTitle(raw: string): TitleValidation {
  const title = raw.trim().replace(/\s+/g, " ");
  if (!title) return { ok: false, error: "Give your playlist a name." };
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Keep the name under ${MAX_TITLE_LENGTH} characters.`,
    };
  }
  return { ok: true, title };
}

export function normalizeDescription(raw: string | undefined): string {
  return (raw ?? "").trim().slice(0, MAX_DESCRIPTION_LENGTH);
}

/** The first distinct artworks of `tracks` (in playlist order) for the collage. */
export function coverPathsFrom(
  tracks: readonly { image_path?: string }[],
): string[] {
  const covers: string[] = [];
  for (const track of tracks) {
    const path = track.image_path;
    if (!path || covers.includes(path)) continue;
    covers.push(path);
    if (covers.length === COVER_COLLAGE_SIZE) break;
  }
  return covers;
}

/** Covers after appending a track — new tracks go last, so only a gap fills. */
export function coverPathsAfterAdd(
  current: readonly string[],
  imagePath: string | undefined,
): string[] {
  return coverPathsFrom([
    ...current.map((path) => ({ image_path: path })),
    { image_path: imagePath },
  ]);
}

export function nasheedToPlaylistInput(
  nasheed: Pick<
    Nasheed,
    | "id"
    | "title_en"
    | "name_en"
    | "artist_id"
    | "audio_path"
    | "image_path"
    | "moods"
  >,
): UserPlaylistTrackInput {
  return {
    kind: "nasheed",
    nasheed_id: nasheed.id,
    title: nasheed.title_en ?? "",
    subtitle: nasheed.name_en ?? "",
    artist_id: nasheed.artist_id ?? "",
    audio_path: nasheed.audio_path ?? "",
    image_path: nasheed.image_path || undefined,
    moods: nasheed.moods ?? [],
  };
}

const MOODS: readonly Mood[] = ["calm", "motivational", "sleep", "focus"];
const isMood = (value: string): value is Mood =>
  (MOODS as readonly string[]).includes(value);

/**
 * The inverse of `nasheedToPlaylistInput`: what the `⋯` sheet's favorite and
 * share rows need, rebuilt from the fields a playlist track stores.
 */
export function playlistTrackToNasheed(
  track: NasheedPlaylistTrackInput,
): Nasheed {
  return {
    id: track.nasheed_id,
    title_en: track.title,
    name_en: track.subtitle,
    artist_id: track.artist_id,
    audio_path: track.audio_path,
    image_path: track.image_path ?? "",
    moods: (track.moods ?? []).filter(isMood),
  };
}

export function surahToPlaylistInput(surah: {
  reciterId: string;
  surahId: string;
  surahNumber: number;
  title: string;
  reciterName: string;
  audioPath: string;
  imagePath?: string | null;
}): SurahPlaylistTrackInput {
  return {
    kind: "surah",
    reciter_id: surah.reciterId,
    surah_id: surah.surahId,
    surah_number: surah.surahNumber,
    title: surah.title,
    subtitle: surah.reciterName,
    audio_path: surah.audioPath,
    image_path: surah.imagePath || undefined,
  };
}

/**
 * The queue a free user may start from a mixed playlist. Quran is unlimited,
 * nasheeds are not: at most `nasheedsLeft` of them stay in the queue (the
 * tapped track included), the rest are dropped so auto-advance cannot run
 * past the daily limit.
 */
export function capNasheedsInQueue<T>(
  queue: readonly T[],
  isNasheed: (track: T) => boolean,
  nasheedsLeft: number,
): T[] {
  let allowed = Math.max(0, nasheedsLeft);
  return queue.filter((track) => {
    if (!isNasheed(track)) return true;
    if (allowed === 0) return false;
    allowed -= 1;
    return true;
  });
}

/** `tracks` rotated so `index` leads — the order playback walks through. */
export function rotateFrom<T>(tracks: readonly T[], index: number): T[] {
  if (index <= 0) return [...tracks];
  return [...tracks.slice(index), ...tracks.slice(0, index)];
}

/** How many tracks one playlist may hold for this user. */
export function trackCapacity(isPremium: boolean): number {
  return isPremium ? MAX_PLAYLIST_TRACKS : FREE_PLAYLIST_TRACK_LIMIT;
}

export type BulkAddPlan = {
  /** New tracks that fit, in the given order. */
  toAdd: UserPlaylistTrackInput[];
  /** New tracks left out because the playlist would exceed `capacity`. */
  overflow: number;
};

/**
 * Adding a whole artist or reciter: tracks already in the playlist (or listed
 * twice) are skipped, and as many of the rest are taken as still fit.
 */
export function planBulkAdd({
  items,
  existingKeys,
  trackCount,
  capacity,
}: {
  items: readonly UserPlaylistTrackInput[];
  existingKeys: ReadonlySet<string>;
  trackCount: number;
  capacity: number;
}): BulkAddPlan {
  const seen = new Set(existingKeys);
  const fresh = items.filter((item) => {
    const key = trackKeyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const room = Math.max(0, capacity - trackCount);
  return {
    toAdd: fresh.slice(0, room),
    overflow: Math.max(0, fresh.length - room),
  };
}

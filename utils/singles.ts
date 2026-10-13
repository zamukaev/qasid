import type { Mood } from "../types/nasheed";
import { UNKNOWN_ARTIST_ID } from "./collections";

/**
 * Singles file (scripts/collections/singles.json) — pure rules, no Firebase.
 *
 * Seeds nasheeds whose artist is unknown or has only a few nasheeds. Those
 * artists are created hidden (`is_active: false`, `is_listed: false`): no
 * "new artist" push, absent from every artist list in 1.1.0 and 1.2.0, and
 * their tracks surface through the singles collection. Used by `npm run
 * seed:singles`, checked by `npm run check:collections`.
 */

const SLUG_ID_PATTERN = /^[a-z0-9_-]+$/;
const AUDIO_FILE_PATTERN = /^[^/]+\.(mp3|m4a)$/;
const IMAGE_FILE_PATTERN = /^[^/]+\.(webp|jpg|jpeg|png)$/;
const MOODS: readonly Mood[] = ["calm", "motivational", "sleep", "focus"];
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export interface SingleArtist {
  id: string;
  name_en: string;
  name_ar: string;
  /** File name under `avatars/` in Storage. */
  image: string;
  language: string;
}

export const UNKNOWN_ARTIST: SingleArtist = {
  id: UNKNOWN_ARTIST_ID,
  name_en: "Unknown Artist",
  name_ar: "منشد غير معروف",
  image: "unknown.webp",
  language: "ar",
};

export interface SingleTrack {
  nasheed_id: string;
  title_en: string;
  /** File name under `nasheeds/{artist id}/` in Storage. */
  audio: string;
  /** File name under `banners/{artist id}/` in Storage. */
  image: string;
  moods: Mood[];
  tags: string[];
  year?: number;
  artist: SingleArtist;
}

export const singleAudioPath = (t: SingleTrack): string =>
  `nasheeds/${t.artist.id}/${t.audio}`;
export const singleImagePath = (t: SingleTrack): string =>
  `banners/${t.artist.id}/${t.image}`;
export const artistImagePath = (a: SingleArtist): string => `avatars/${a.image}`;

/** Stable doc id from the artist and audio file, so a rerun updates instead of duplicating. */
export function singleNasheedId(artistId: string, audio: string): string {
  const stem = audio
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${artistId}_${stem}`;
}

/** The distinct artists of a file, in first-seen order. */
export function singleArtists(tracks: readonly SingleTrack[]): SingleArtist[] {
  const byId = new Map<string, SingleArtist>();
  for (const t of tracks) {
    if (!byId.has(t.artist.id)) byId.set(t.artist.id, t.artist);
  }
  return [...byId.values()];
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const nonEmpty = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";

function parseArtist(raw: unknown, errors: string[]): SingleArtist | null {
  if (raw === undefined) return UNKNOWN_ARTIST;
  if (!isRecord(raw)) {
    errors.push("artist must be an object, or left out for an unknown author");
    return null;
  }
  const before = errors.length;
  if (typeof raw.id !== "string" || !SLUG_ID_PATTERN.test(raw.id)) {
    errors.push("artist.id must match [a-z0-9_-]+");
  } else if (raw.id === UNKNOWN_ARTIST_ID) {
    errors.push(`leave artist out instead of using "${UNKNOWN_ARTIST_ID}"`);
  }
  if (!nonEmpty(raw.name_en)) errors.push("artist.name_en is required");
  if (raw.name_ar !== undefined && typeof raw.name_ar !== "string") {
    errors.push("artist.name_ar must be a string");
  }
  if (raw.image !== undefined && !(typeof raw.image === "string" && IMAGE_FILE_PATTERN.test(raw.image))) {
    errors.push("artist.image must be an image file name such as omar.webp");
  }
  if (errors.length > before) return null;
  const id = raw.id as string;
  return {
    id,
    name_en: (raw.name_en as string).trim(),
    name_ar: typeof raw.name_ar === "string" ? raw.name_ar.trim() : "",
    image: typeof raw.image === "string" ? raw.image : `${id}.webp`,
    language: typeof raw.language === "string" && raw.language !== "" ? raw.language : "ar",
  };
}

function parseTrack(raw: unknown, errors: string[]): SingleTrack | null {
  if (!isRecord(raw)) {
    errors.push("must be an object");
    return null;
  }
  const before = errors.length;
  if (!nonEmpty(raw.title_en)) errors.push("title_en is required");
  if (typeof raw.audio !== "string" || !AUDIO_FILE_PATTERN.test(raw.audio)) {
    errors.push("audio must be a file name such as ya_rasul_allah.mp3");
  }
  if (typeof raw.image !== "string" || !IMAGE_FILE_PATTERN.test(raw.image)) {
    errors.push("image must be a file name such as ya_rasul_allah.webp");
  }
  const moods = raw.moods ?? [];
  if (!Array.isArray(moods) || !moods.every((m) => MOODS.includes(m as Mood))) {
    errors.push(`moods must be an array of ${MOODS.join(", ")}`);
  }
  const tags = raw.tags ?? [];
  if (!Array.isArray(tags) || !tags.every(nonEmpty)) {
    errors.push("tags must be an array of non-empty strings");
  }
  const year = raw.year;
  if (
    year !== undefined &&
    !(typeof year === "number" && Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR)
  ) {
    errors.push(`year must be a year between ${MIN_YEAR} and ${MAX_YEAR}`);
  }
  const artist = parseArtist(raw.artist, errors);
  if (errors.length > before || !artist) return null;

  const audio = raw.audio as string;
  return {
    nasheed_id: singleNasheedId(artist.id, audio),
    title_en: (raw.title_en as string).trim(),
    audio,
    image: raw.image as string,
    moods: moods as Mood[],
    tags: (tags as string[]).map((t) => t.trim()),
    ...(typeof year === "number" ? { year } : {}),
    artist,
  };
}

/**
 * Validates the whole singles file. Every problem is reported, so a bad
 * entry never leaves half a batch seeded.
 */
export function parseSinglesFile(raw: unknown): ParseResult<SingleTrack[]> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, errors: ["the singles file must be a non-empty array"] };
  }
  const errors: string[] = [];
  const tracks: SingleTrack[] = [];

  raw.forEach((entry, index) => {
    const entryErrors: string[] = [];
    const track = parseTrack(entry, entryErrors);
    const label = isRecord(entry) && nonEmpty(entry.title_en) ? entry.title_en : `#${index}`;
    errors.push(...entryErrors.map((e) => `${label}: ${e}`));
    if (track) tracks.push(track);
  });

  const artistNames = new Map<string, string>();
  const nasheedIds = new Set<string>();
  for (const t of tracks) {
    const known = artistNames.get(t.artist.id);
    if (known !== undefined && known !== t.artist.name_en) {
      errors.push(`${t.title_en}: artist ${t.artist.id} is also named "${known}"`);
    }
    artistNames.set(t.artist.id, t.artist.name_en);
    if (nasheedIds.has(t.nasheed_id)) {
      errors.push(`${t.title_en}: ${t.audio} is listed twice for ${t.artist.id}`);
    }
    nasheedIds.add(t.nasheed_id);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: tracks };
}

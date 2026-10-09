import type { RecommendedTrack } from "../types/nasheed";

/**
 * Nasheed collections — pure rules, no Firebase access.
 *
 * A collection is defined in scripts/collections/collections.json and
 * materialized into Firestore `collections/{id}` by `npm run
 * collections:build`, which stores the resolved tracks on the doc so the app
 * can open a collection with a single read. Checked by `npm run
 * check:collections`.
 */

/** The shared artist that every nasheed of an unknown author belongs to. */
export const UNKNOWN_ARTIST_ID = "unknown";

/** Artists with fewer nasheeds than this are kept out of artist rails. */
export const MIN_LISTED_TRACKS = 3;

/** Keeps a materialized collection doc well under the Firestore size limit. */
export const MAX_COLLECTION_TRACKS = 200;

const COLLECTION_ID_PATTERN = /^[a-z0-9_]+$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export const COLLECTION_SHELVES = ["collections", "eras", "featured"] as const;
export type CollectionShelf = (typeof COLLECTION_SHELVES)[number];

export interface CollectionRule {
  /** Nasheeds whose artist is not listed (unknown author or few nasheeds). */
  unlisted_artists?: boolean;
  /** Nasheeds carrying at least one of these tags. */
  tags?: string[];
  year_from?: number;
  year_to?: number;
}

export type CollectionSource =
  | { type: "manual"; track_ids: string[] }
  | { type: "rule"; rule: CollectionRule }
  /**
   * Mirrors a curated playlist that still lives in `playlists` and
   * `nasheeds.playlist_id`, which the 1.1.0 app reads. Removed once that
   * version is gone.
   */
  | { type: "legacy_playlist"; playlist_id: string };

export interface CollectionDefinition {
  id: string;
  name_en: string;
  name_ar: string;
  desc: string;
  image_path: string;
  shelf: CollectionShelf;
  sort_order: number;
  is_active: boolean;
  source: CollectionSource;
}

/** The nasheed fields the resolver needs, as read from Firestore. */
export interface CollectionNasheed {
  id: string;
  title_en: string;
  artist_id: string;
  name_en: string;
  audio_path: string;
  image_path: string;
  moods: string[];
  tags: string[];
  year?: number;
  playlist_id?: string | null;
  popularity_score: number;
}

export function isArtistListed(artistId: string, trackCount: number): boolean {
  return artistId !== UNKNOWN_ARTIST_ID && trackCount >= MIN_LISTED_TRACKS;
}

/** Artist id → listed, for every artist id that appears on a nasheed or in `artistIds`. */
export function listedArtists(
  artistIds: readonly string[],
  nasheeds: readonly Pick<CollectionNasheed, "artist_id">[],
): Map<string, boolean> {
  const counts = new Map<string, number>(artistIds.map((id) => [id, 0]));
  for (const n of nasheeds) {
    counts.set(n.artist_id, (counts.get(n.artist_id) ?? 0) + 1);
  }
  return new Map(
    [...counts].map(([id, count]) => [id, isArtistListed(id, count)]),
  );
}

export function matchesRule(
  nasheed: CollectionNasheed,
  rule: CollectionRule,
  listed: ReadonlyMap<string, boolean>,
): boolean {
  if (rule.unlisted_artists && listed.get(nasheed.artist_id) !== false) {
    return false;
  }
  if (rule.tags && !rule.tags.some((tag) => nasheed.tags.includes(tag))) {
    return false;
  }
  if (rule.year_from !== undefined || rule.year_to !== undefined) {
    if (nasheed.year === undefined) return false;
    if (rule.year_from !== undefined && nasheed.year < rule.year_from) {
      return false;
    }
    if (rule.year_to !== undefined && nasheed.year > rule.year_to) {
      return false;
    }
  }
  return true;
}

// Byte-order comparison, matching Firestore's orderBy("title_en").
const byTitle = (a: CollectionNasheed, b: CollectionNasheed): number =>
  a.title_en < b.title_en ? -1 : a.title_en > b.title_en ? 1 : 0;

const byPopularity = (a: CollectionNasheed, b: CollectionNasheed): number =>
  b.popularity_score - a.popularity_score || byTitle(a, b);

export function toCollectionTrack(n: CollectionNasheed): RecommendedTrack {
  return {
    id: n.id,
    title_en: n.title_en,
    artist_id: n.artist_id,
    name_en: n.name_en,
    audio_path: n.audio_path,
    image_path: n.image_path,
    moods: n.moods,
  };
}

export interface ResolvedCollection {
  tracks: RecommendedTrack[];
  /** Manual track ids that match no playable nasheed. */
  missingIds: string[];
}

/**
 * Resolves a collection's tracks. Manual collections keep their own order,
 * legacy playlists sort by title like the 1.1.0 app does, rules sort by
 * popularity. Nasheeds without audio are never included.
 */
export function resolveCollection(
  source: CollectionSource,
  nasheeds: readonly CollectionNasheed[],
  listed: ReadonlyMap<string, boolean>,
): ResolvedCollection {
  const playable = nasheeds.filter((n) => n.audio_path !== "");
  let picked: CollectionNasheed[];
  let missingIds: string[] = [];

  switch (source.type) {
    case "manual": {
      const byId = new Map(playable.map((n) => [n.id, n]));
      const ids = [...new Set(source.track_ids)];
      missingIds = ids.filter((id) => !byId.has(id));
      picked = ids.flatMap((id) => byId.get(id) ?? []);
      break;
    }
    case "legacy_playlist":
      picked = playable
        .filter((n) => n.playlist_id === source.playlist_id)
        .sort(byTitle);
      break;
    case "rule":
      picked = playable
        .filter((n) => matchesRule(n, source.rule, listed))
        .sort(byPopularity);
      break;
  }

  return {
    tracks: picked.slice(0, MAX_COLLECTION_TRACKS).map(toCollectionTrack),
    missingIds,
  };
}

// ---------------------------------------------------------------------------
// Definition file validation

type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string" && x !== "");

const isYear = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= MIN_YEAR && v <= MAX_YEAR;

const isShelf = (v: unknown): v is CollectionShelf =>
  typeof v === "string" && (COLLECTION_SHELVES as readonly string[]).includes(v);

function parseRule(raw: unknown, errors: string[]): CollectionRule | null {
  if (!isRecord(raw)) {
    errors.push("source.rule must be an object");
    return null;
  }
  const rule: CollectionRule = {};
  if (raw.unlisted_artists !== undefined) {
    if (typeof raw.unlisted_artists !== "boolean") {
      errors.push("rule.unlisted_artists must be a boolean");
    } else if (raw.unlisted_artists) {
      rule.unlisted_artists = true;
    }
  }
  if (raw.tags !== undefined) {
    if (!isStringArray(raw.tags) || raw.tags.length === 0) {
      errors.push("rule.tags must be a non-empty array of strings");
    } else {
      rule.tags = raw.tags;
    }
  }
  for (const key of ["year_from", "year_to"] as const) {
    if (raw[key] === undefined) continue;
    const year = raw[key];
    if (!isYear(year)) {
      errors.push(`rule.${key} must be a year between ${MIN_YEAR} and ${MAX_YEAR}`);
    } else {
      rule[key] = year;
    }
  }
  if (
    rule.year_from !== undefined &&
    rule.year_to !== undefined &&
    rule.year_from > rule.year_to
  ) {
    errors.push("rule.year_from must not be after rule.year_to");
  }
  if (Object.keys(rule).length === 0) {
    errors.push("rule needs at least one condition, or it would match every nasheed");
  }
  return rule;
}

function parseSource(raw: unknown, errors: string[]): CollectionSource | null {
  if (!isRecord(raw)) {
    errors.push("source must be an object");
    return null;
  }
  switch (raw.type) {
    case "manual":
      if (!isStringArray(raw.track_ids) || raw.track_ids.length === 0) {
        errors.push("manual source needs a non-empty track_ids array");
        return null;
      }
      return { type: "manual", track_ids: raw.track_ids };
    case "legacy_playlist":
      if (typeof raw.playlist_id !== "string" || raw.playlist_id === "") {
        errors.push("legacy_playlist source needs a playlist_id");
        return null;
      }
      return { type: "legacy_playlist", playlist_id: raw.playlist_id };
    case "rule": {
      const rule = parseRule(raw.rule, errors);
      return rule ? { type: "rule", rule } : null;
    }
    default:
      errors.push('source.type must be "manual", "rule" or "legacy_playlist"');
      return null;
  }
}

function parseDefinition(raw: unknown, errors: string[]): CollectionDefinition | null {
  if (!isRecord(raw)) {
    errors.push("must be an object");
    return null;
  }
  const before = errors.length;
  const optionalString = (key: string): string => {
    const v = raw[key];
    if (v === undefined) return "";
    if (typeof v !== "string") errors.push(`${key} must be a string`);
    return typeof v === "string" ? v : "";
  };

  const id = raw.id;
  if (typeof id !== "string" || !COLLECTION_ID_PATTERN.test(id)) {
    errors.push("id must match [a-z0-9_]+");
  }
  if (typeof raw.name_en !== "string" || raw.name_en.trim() === "") {
    errors.push("name_en is required");
  }
  if (!isShelf(raw.shelf)) {
    errors.push(`shelf must be one of ${COLLECTION_SHELVES.join(", ")}`);
  }
  if (typeof raw.sort_order !== "number" || !Number.isFinite(raw.sort_order)) {
    errors.push("sort_order must be a number");
  }
  if (raw.is_active !== undefined && typeof raw.is_active !== "boolean") {
    errors.push("is_active must be a boolean");
  }
  const name_ar = optionalString("name_ar");
  const desc = optionalString("desc");
  const image_path = optionalString("image_path");
  const source = parseSource(raw.source, errors);

  if (errors.length > before || !source) return null;
  return {
    id: id as string,
    name_en: (raw.name_en as string).trim(),
    name_ar,
    desc,
    image_path,
    shelf: raw.shelf as CollectionShelf,
    sort_order: raw.sort_order as number,
    is_active: raw.is_active !== false,
    source,
  };
}

/** Validates the whole definitions file; every problem is reported, prefixed with its entry. */
export function parseCollectionDefinitions(
  raw: unknown,
): ParseResult<CollectionDefinition[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, errors: ["definitions must be an array"] };
  }
  const errors: string[] = [];
  const definitions: CollectionDefinition[] = [];
  const seen = new Set<string>();

  raw.forEach((entry, index) => {
    const entryErrors: string[] = [];
    const def = parseDefinition(entry, entryErrors);
    const label =
      isRecord(entry) && typeof entry.id === "string" ? entry.id : `#${index}`;
    errors.push(...entryErrors.map((e) => `${label}: ${e}`));
    if (!def) return;
    if (seen.has(def.id)) {
      errors.push(`${def.id}: duplicate id`);
      return;
    }
    seen.add(def.id);
    definitions.push(def);
  });

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: definitions };
}

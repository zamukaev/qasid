/**
 * Collection logic checks — pure, offline, no Firebase access.
 *
 * Covers artist listing, rule matching, track ordering and validation of
 * scripts/collections/collections.json, including the real file.
 *
 * Usage:
 *   npm run check:collections
 */

import * as fs from "fs";
import * as path from "path";
import {
  CollectionDoc,
  CollectionNasheed,
  MAX_COLLECTION_TRACKS,
  UNKNOWN_ARTIST_ID,
  collectionCover,
  isArtistListed,
  listedArtists,
  parseCollectionDefinitions,
  parseNasheedYears,
  resolveCollection,
  shelfCollections,
} from "../utils/collections";
import {
  UNKNOWN_ARTIST,
  parseSinglesFile,
  singleArtists,
  singleAudioPath,
  singleImagePath,
  singleNasheedId,
} from "../utils/singles";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson === expectedJson) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures++;
  console.error(
    `  FAIL ${label}\n       expected ${expectedJson}\n       got      ${actualJson}`,
  );
}

const nasheed = (
  id: string,
  overrides: Partial<CollectionNasheed> = {},
): CollectionNasheed => ({
  id,
  title_en: id,
  artist_id: "big",
  name_en: "Big Artist",
  audio_path: `nasheeds/${id}.mp3`,
  image_path: "",
  moods: [],
  tags: [],
  popularity_score: 0,
  ...overrides,
});

const ids = (source: Parameters<typeof resolveCollection>[0], list: CollectionNasheed[]) =>
  resolveCollection(source, list, listedArtists([], list)).tracks.map((t) => t.id);

// Artist listing
check("artist with 3 nasheeds is listed", isArtistListed("a", 3), true);
check("artist with 2 nasheeds is not listed", isArtistListed("a", 2), false);
check("unknown artist is never listed", isArtistListed(UNKNOWN_ARTIST_ID, 50), false);
check(
  "artist without nasheeds is counted as unlisted",
  [...listedArtists(["empty"], [])],
  [["empty", false]],
);

const catalog = [
  nasheed("b1", { title_en: "B", popularity_score: 5, tags: ["ramadan"], year: 2005 }),
  nasheed("b2", { title_en: "A", popularity_score: 9, year: 2025 }),
  nasheed("b3", { title_en: "C", popularity_score: 1, playlist_id: "night" }),
  nasheed("s1", { artist_id: "small", popularity_score: 3 }),
  nasheed("u1", { artist_id: UNKNOWN_ARTIST_ID, popularity_score: 7, tags: ["eid"] }),
  nasheed("silent", { artist_id: UNKNOWN_ARTIST_ID, audio_path: "" }),
];

// Rules
check(
  "singles rule picks unlisted artists by popularity",
  ids({ type: "rule", rule: { unlisted_artists: true } }, catalog),
  ["u1", "s1"],
);
check(
  "tags match any of the listed tags",
  ids({ type: "rule", rule: { tags: ["ramadan", "eid"] } }, catalog),
  ["u1", "b1"],
);
check(
  "year range is inclusive and skips nasheeds without a year",
  ids({ type: "rule", rule: { year_from: 2025, year_to: 2025 } }, catalog),
  ["b2"],
);
check(
  "open-ended year range",
  ids({ type: "rule", rule: { year_to: 2009 } }, catalog),
  ["b1"],
);
check(
  "conditions combine with AND",
  ids({ type: "rule", rule: { unlisted_artists: true, tags: ["ramadan"] } }, catalog),
  [],
);

// Other sources
check(
  "manual keeps its order, dedupes and drops silent tracks",
  ids({ type: "manual", track_ids: ["s1", "b1", "s1", "silent"] }, catalog),
  ["s1", "b1"],
);
check(
  "manual reports missing ids",
  resolveCollection(
    { type: "manual", track_ids: ["b1", "nope", "silent"] },
    catalog,
    new Map(),
  ).missingIds,
  ["nope", "silent"],
);
check(
  "legacy playlist mirrors playlist_id",
  ids({ type: "legacy_playlist", playlist_id: "night" }, catalog),
  ["b3"],
);
check(
  "tracks are capped",
  resolveCollection(
    { type: "rule", rule: { tags: ["x"] } },
    Array.from({ length: MAX_COLLECTION_TRACKS + 5 }, (_, i) =>
      nasheed(`n${i}`, { tags: ["x"] }),
    ),
    new Map(),
  ).tracks.length,
  MAX_COLLECTION_TRACKS,
);

// Home shelves
const doc = (id: string, overrides: Partial<CollectionDoc> = {}): CollectionDoc => {
  const { tracks } = resolveCollection(
    { type: "manual", track_ids: ["b1"] },
    catalog,
    new Map(),
  );
  return {
    id,
    name_en: id,
    name_ar: "",
    desc: "",
    image_path: "",
    shelf: "collections",
    sort_order: 0,
    is_active: true,
    tracks,
    track_count: tracks.length,
    ...overrides,
  };
};
check(
  "shelf keeps active, non-empty collections of that shelf in sort_order",
  shelfCollections(
    [
      doc("late", { sort_order: 20 }),
      doc("early", { sort_order: 10 }),
      doc("empty", { tracks: [], track_count: 0 }),
      doc("off", { is_active: false }),
      doc("era", { shelf: "eras" }),
    ],
    "collections",
  ).map((c) => c.id),
  ["early", "late"],
);
check(
  "cover falls back to the first track's image",
  [
    collectionCover(doc("own", { image_path: "own.webp" })),
    collectionCover({ ...doc("x"), tracks: [{ ...doc("x").tracks[0], image_path: "track.webp" }] }),
    collectionCover(doc("none", { tracks: [] })),
  ],
  ["own.webp", "track.webp", ""],
);

// Validation
const valid = {
  id: "retro",
  name_en: "Retro",
  shelf: "eras",
  sort_order: 1,
  source: { type: "rule", rule: { year_to: 2009 } },
};
const parsed = parseCollectionDefinitions([valid]);
check("valid definition parses with defaults", parsed.ok && parsed.value[0], {
  id: "retro",
  name_en: "Retro",
  name_ar: "",
  desc: "",
  image_path: "",
  shelf: "eras",
  sort_order: 1,
  is_active: true,
  source: { type: "rule", rule: { year_to: 2009 } },
});
check(
  "empty rule is rejected",
  parseCollectionDefinitions([{ ...valid, source: { type: "rule", rule: {} } }]),
  { ok: false, errors: ["retro: rule needs at least one condition, or it would match every nasheed"] },
);
check(
  "bad shelf, id and reversed years are all reported",
  parseCollectionDefinitions([
    { ...valid, id: "Bad Id", shelf: "hero", source: { type: "rule", rule: { year_from: 2020, year_to: 2010 } } },
  ]),
  {
    ok: false,
    errors: [
      "Bad Id: id must match [a-z0-9_]+",
      "Bad Id: shelf must be one of collections, eras, featured",
      "Bad Id: rule.year_from must not be after rule.year_to",
    ],
  },
);
check(
  "duplicate ids are rejected",
  parseCollectionDefinitions([valid, valid]),
  { ok: false, errors: ["retro: duplicate id"] },
);

// Years file
const years = parseNasheedYears([
  { id: "a", artist: "X", title: "Y", year: 2005 },
  { id: "b", year: null },
]);
check("years file parses, null clears", years.ok && [...years.value], [
  ["a", 2005],
  ["b", null],
]);
check(
  "bad years, missing ids and duplicates are all reported",
  parseNasheedYears([
    { id: "a", year: "2005" },
    { id: "b", year: 1850 },
    { year: 2000 },
    { id: "c", year: 2001 },
    { id: "c", year: 2002 },
    { id: "d" },
  ]),
  {
    ok: false,
    errors: [
      "a: year must be null or a year between 1900 and 2100",
      "b: year must be null or a year between 1900 and 2100",
      "#2: needs a string id",
      "c: listed twice",
      "d: year must be null or a year between 1900 and 2100",
    ],
  },
);

// Singles file
check(
  "nasheed id is stable and slug-safe",
  singleNasheedId("unknown", "Ya Rasul-Allah (Live).MP3"),
  "unknown_ya_rasul_allah_live",
);
const singles = parseSinglesFile([
  { title_en: " Ya Rasul Allah ", audio: "ya_rasul.mp3", image: "ya_rasul.webp", year: 2003 },
  {
    title_en: "Badr",
    audio: "badr.mp3",
    image: "badr.webp",
    moods: ["calm"],
    artist: { id: "omar", name_en: "Omar" },
  },
  {
    title_en: "Badr 2",
    audio: "badr2.mp3",
    image: "badr2.webp",
    artist: { id: "omar", name_en: "Omar" },
  },
]);
check(
  "no artist means the shared unknown artist",
  singles.ok && singles.value[0].artist,
  UNKNOWN_ARTIST,
);
check(
  "single track fields, paths and defaults",
  singles.ok && [
    singles.value[0].nasheed_id,
    singles.value[0].title_en,
    singles.value[0].year,
    singleAudioPath(singles.value[1]),
    singleImagePath(singles.value[1]),
    singles.value[1].artist.image,
    singles.value[1].artist.name_ar,
  ],
  ["unknown_ya_rasul", "Ya Rasul Allah", 2003, "nasheeds/omar/badr.mp3", "banners/omar/badr.webp", "omar.webp", ""],
);
check(
  "artists are deduplicated",
  singles.ok && singleArtists(singles.value).map((a) => a.id),
  ["unknown", "omar"],
);
check(
  "bad singles entries are all reported",
  parseSinglesFile([
    { title_en: "A", audio: "a.wav", image: "a.webp", moods: ["happy"] },
    { title_en: "B", audio: "b.mp3", image: "b.webp", artist: { id: "unknown", name_en: "X" } },
    { title_en: "C", audio: "c.mp3", image: "c.webp", artist: { id: "omar", name_en: "Omar" } },
    { title_en: "D", audio: "d.mp3", image: "d.webp", artist: { id: "omar", name_en: "Omar K" } },
    { title_en: "E", audio: "e.mp3", image: "e.webp" },
    { title_en: "E again", audio: "e.mp3", image: "e2.webp" },
  ]),
  {
    ok: false,
    errors: [
      "A: audio must be a file name such as ya_rasul_allah.mp3",
      "A: moods must be an array of calm, motivational, sleep, focus",
      'B: leave artist out instead of using "unknown"',
      'D: artist omar is also named "Omar"',
      "E again: e.mp3 is listed twice for unknown",
    ],
  },
);
check(
  "an empty singles file is rejected",
  parseSinglesFile([]),
  { ok: false, errors: ["the singles file must be a non-empty array"] },
);
const example = parseSinglesFile(
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "collections/singles.example.json"), "utf8"),
  ),
);
check("scripts/collections/singles.example.json is valid", example.ok || example.errors, true);

const realFile = parseCollectionDefinitions(
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "collections/collections.json"), "utf8"),
  ),
);
check("scripts/collections/collections.json is valid", realFile.ok || realFile.errors, true);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll collection checks passed.");

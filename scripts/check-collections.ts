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
  CollectionNasheed,
  MAX_COLLECTION_TRACKS,
  UNKNOWN_ARTIST_ID,
  isArtistListed,
  listedArtists,
  parseCollectionDefinitions,
  resolveCollection,
} from "../utils/collections";

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

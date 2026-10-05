/**
 * User playlist logic checks — pure, offline, no Firebase access.
 *
 * Covers the rules the app relies on to gate free users, deduplicate tracks,
 * keep the cover collage in sync and cap a free user's mixed queue.
 *
 * Usage:
 *   npm run check:playlists
 */

import {
  FREE_PLAYLIST_TRACK_LIMIT,
  MAX_PLAYLIST_TRACKS,
  MAX_TITLE_LENGTH,
  addGate,
  capNasheedsInQueue,
  collectionPlaylistTitle,
  coverPathsAfterAdd,
  coverPathsFrom,
  createGate,
  nasheedToPlaylistInput,
  planBulkAdd,
  rotateFrom,
  surahToPlaylistInput,
  trackCapacity,
  trackKeyFor,
  validateTitle,
} from "../utils/user-playlists";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson === expectedJson) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures++;
  console.error(`  FAIL ${label}\n       expected ${expectedJson}\n       got      ${actualJson}`);
}

// Gates
check("free user may create a first playlist", createGate({ isPremium: false, playlistCount: 0 }), "ok");
check("free user is upsold on the second", createGate({ isPremium: false, playlistCount: 1 }), "premium");
check("premium user creates freely", createGate({ isPremium: true, playlistCount: 25 }), "ok");
check("free track below limit", addGate({ isPremium: false, trackCount: FREE_PLAYLIST_TRACK_LIMIT - 1 }), "ok");
check("free track at limit", addGate({ isPremium: false, trackCount: FREE_PLAYLIST_TRACK_LIMIT }), "premium");
check("premium past free limit", addGate({ isPremium: true, trackCount: FREE_PLAYLIST_TRACK_LIMIT }), "ok");
check("hard cap applies to premium", addGate({ isPremium: true, trackCount: MAX_PLAYLIST_TRACKS }), "full");

// Track keys
const nasheed = nasheedToPlaylistInput({
  id: "abc",
  title_en: "Tala al Badru",
  name_en: "Artist",
  artist_id: "art1",
  audio_path: "nasheeds/abc.mp3",
  image_path: "",
});
const surah = surahToPlaylistInput({
  reciterId: "rec1",
  surahId: "s36",
  surahNumber: 36,
  title: "Ya-Sin",
  reciterName: "Reciter",
  audioPath: "quran/rec1/036.mp3",
  imagePath: null,
});
check("nasheed key", trackKeyFor(nasheed), "n_abc");
check("surah key", trackKeyFor(surah), "q_rec1_s36");
check("empty nasheed image is dropped", nasheed.image_path, undefined);
check("null surah image is dropped", surah.image_path, undefined);

// Bulk add
const nasheedN = (id: string) => nasheedToPlaylistInput({ id, title_en: id, name_en: "A", artist_id: "a", audio_path: `${id}.mp3`, image_path: "" });
const keys = (plan: ReturnType<typeof planBulkAdd>) => plan.toAdd.map(trackKeyFor);
const five = ["a", "b", "c", "d", "e"].map(nasheedN);
check("bulk skips existing and duplicates", keys(planBulkAdd({ items: [...five, nasheedN("a")], existingKeys: new Set(["n_b"]), trackCount: 1, capacity: 100 })), ["n_a", "n_c", "n_d", "n_e"]);
check("bulk fills only the free room", planBulkAdd({ items: five, existingKeys: new Set(), trackCount: FREE_PLAYLIST_TRACK_LIMIT - 2, capacity: trackCapacity(false) }).overflow, 3);
check("bulk into a full playlist adds nothing", planBulkAdd({ items: five, existingKeys: new Set(), trackCount: MAX_PLAYLIST_TRACKS, capacity: trackCapacity(true) }).toAdd.length, 0);
check("premium capacity", trackCapacity(true), MAX_PLAYLIST_TRACKS);

// Titles
check("title is trimmed and collapsed", validateTitle("  Night   Dhikr "), { ok: true, title: "Night Dhikr" });
check("blank title rejected", validateTitle("   ").ok, false);
check("long title rejected", validateTitle("x".repeat(MAX_TITLE_LENGTH + 1)).ok, false);
check("max title accepted", validateTitle("x".repeat(MAX_TITLE_LENGTH)).ok, true);
check("collection title is normalized", collectionPlaylistTitle("  Mishary   Alafasy "), "Mishary Alafasy");
check("collection title is clipped to fit", collectionPlaylistTitle("x".repeat(MAX_TITLE_LENGTH + 5))?.length, MAX_TITLE_LENGTH);
check("missing collection title falls back", collectionPlaylistTitle(undefined), null);
check("clipped collection title passes validation", validateTitle(collectionPlaylistTitle("x".repeat(MAX_TITLE_LENGTH + 5)) ?? "").ok, true);

// Covers
check("covers skip blanks and duplicates", coverPathsFrom([{ image_path: "a" }, {}, { image_path: "a" }, { image_path: "b" }]), ["a", "b"]);
check("covers stop at four", coverPathsFrom(["a", "b", "c", "d", "e"].map((p) => ({ image_path: p }))), ["a", "b", "c", "d"]);
check("add fills a gap", coverPathsAfterAdd(["a"], "b"), ["a", "b"]);
check("add keeps a full collage", coverPathsAfterAdd(["a", "b", "c", "d"], "e"), ["a", "b", "c", "d"]);
check("add without artwork is a no-op", coverPathsAfterAdd(["a"], undefined), ["a"]);

// Free-tier queue
type Q = { id: string; isNasheed: boolean };
const mixed: Q[] = [
  { id: "n1", isNasheed: true },
  { id: "q1", isNasheed: false },
  { id: "n2", isNasheed: true },
  { id: "n3", isNasheed: true },
  { id: "q2", isNasheed: false },
];
const ids = (queue: Q[]) => queue.map((t) => t.id);
check("quran stays, nasheeds capped", ids(capNasheedsInQueue(mixed, (t) => t.isNasheed, 2)), ["n1", "q1", "n2", "q2"]);
check("no nasheeds left keeps quran only", ids(capNasheedsInQueue(mixed, (t) => t.isNasheed, 0)), ["q1", "q2"]);
check("rotate leads with the tapped track", ids(rotateFrom(mixed, 2)), ["n2", "n3", "q2", "n1", "q1"]);
check("rotate from start is a copy", ids(rotateFrom(mixed, 0)), ids(mixed));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll user playlist checks passed");

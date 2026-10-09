/**
 * Seed Singles — nasheeds by unknown authors or artists with a few tracks
 *
 * Reads scripts/collections/singles.json (see utils/singles.ts), checks that
 * every audio and image file is in Storage, creates missing artists hidden
 * (`is_active: false`, `is_listed: false`, no `publishedAt`) and writes the
 * nasheeds. Then runs `npm run collections:build`, which puts them in the
 * "Singles & Rare Voices" collection.
 *
 * Hidden artists send no "new artist" push and stay out of every artist
 * list, in 1.1.0 too; their page still opens from the player. Existing
 * artists are never modified. A rerun updates the same nasheed docs and
 * keeps their play counters.
 *
 * Upload the files to Storage first:
 *   nasheeds/{artist id}/{audio}   banners/{artist id}/{image}
 *   avatars/{artist image}         (avatars/unknown.webp for unknown authors)
 *
 * Usage:
 *   npm run seed:singles -- --dry-run          — validate and show the plan
 *   npm run seed:singles                       — write, then build collections
 *   npm run seed:singles -- --file other.json  — use another file
 *
 * Requires scripts/serviceAccountKey.json (Firebase Admin key).
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import {
  SingleArtist,
  SingleTrack,
  artistImagePath,
  parseSinglesFile,
  singleArtists,
  singleAudioPath,
  singleImagePath,
} from "../utils/singles";
import { UNKNOWN_ARTIST_ID } from "../utils/collections";

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");
const DEFAULT_FILE = path.resolve(__dirname, "collections/singles.json");
const STORAGE_BUCKET = "qasid-fd80d.firebasestorage.app";
const MAX_BATCH_WRITES = 400;
const COUNTERS = [
  "popularity_score",
  "trending_score",
  "play_count",
  "qualified_play_count",
  "completed_play_count",
  "favorite_count",
] as const;
const ARTIST_COUNTERS = [
  "play_count",
  "qualified_play_count",
  "completed_play_count",
] as const;

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const filePath =
  fileIdx !== -1 && args[fileIdx + 1] ? path.resolve(args[fileIdx + 1]) : DEFAULT_FILE;
const dryRun = args.includes("--dry-run");
const relFile = path.relative(process.cwd(), filePath);

if (!fs.existsSync(filePath)) {
  console.error(`${relFile} not found.`);
  process.exit(1);
}
const parsed = parseSinglesFile(JSON.parse(fs.readFileSync(filePath, "utf8")));
if (!parsed.ok) {
  console.error(`Invalid ${relFile}:`);
  parsed.errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
const tracks = parsed.value;

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "Service account key not found at scripts/serviceAccountKey.json\n" +
      "Download it from Firebase console → Project Settings → Service accounts",
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")) as admin.ServiceAccount,
  ),
  projectId: "qasid-fd80d",
  storageBucket: STORAGE_BUCKET,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ---------------------------------------------------------------------------

async function missingStoragePaths(paths: readonly string[]): Promise<string[]> {
  const results = await Promise.all(
    [...new Set(paths)].map(async (p) => {
      const [exists] = await bucket.file(p).exists();
      return exists ? null : p;
    }),
  );
  return results.filter((p): p is string => p !== null);
}

function newArtistDoc(artist: SingleArtist): Record<string, unknown> {
  return {
    id: artist.id,
    name_en: artist.name_en,
    name_ar: artist.name_ar,
    image_path: artistImagePath(artist),
    desc: "",
    language: artist.language,
    is_known: artist.id !== UNKNOWN_ARTIST_ID,
    // Hidden on purpose: see the header. No publishedAt and no
    // popularity_score, so 1.1.0's New and Popular rails never order it in.
    is_active: false,
    is_listed: false,
    ...Object.fromEntries(ARTIST_COUNTERS.map((c) => [c, 0])),
    createdAt: admin.firestore.Timestamp.now(),
  };
}

function nasheedDoc(
  track: SingleTrack,
  artistName: string,
  existing: admin.firestore.DocumentData | undefined,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    id: track.nasheed_id,
    artist_id: track.artist.id,
    name_en: artistName,
    title_en: track.title_en,
    audio_path: singleAudioPath(track),
    image_path: singleImagePath(track),
    moods: track.moods,
    tags: track.tags,
  };
  if (track.year !== undefined) data.year = track.year;
  // Counters only when missing, so a rerun never wipes production metrics.
  for (const c of COUNTERS) {
    if (existing?.[c] === undefined) data[c] = 0;
  }
  return data;
}

async function main(): Promise<void> {
  const artists = singleArtists(tracks);
  const artistSnaps = await db.getAll(
    ...artists.map((a) => db.collection("artists").doc(a.id)),
  );
  const existingArtists = new Map(
    artistSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]),
  );
  const newArtists = artists.filter((a) => !existingArtists.has(a.id));

  const missing = await missingStoragePaths([
    ...tracks.flatMap((t) => [singleAudioPath(t), singleImagePath(t)]),
    ...newArtists.map(artistImagePath),
  ]);
  if (missing.length > 0) {
    console.error("Missing in Storage, nothing written:");
    missing.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }

  const nasheedSnaps = await db.getAll(
    ...tracks.map((t) => db.collection("nasheeds").doc(t.nasheed_id)),
  );
  const existingNasheeds = new Map(
    nasheedSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]),
  );

  console.log(`Artists (${artists.length}):`);
  for (const a of artists) {
    const existing = existingArtists.get(a.id);
    if (!existing) {
      console.log(`  new, hidden  ${a.id}  (${a.name_en})`);
    } else {
      const visibility = existing.is_active === false ? "hidden" : "visible";
      console.log(`  existing     ${a.id}  (${existing.name_en}, ${visibility}, left as is)`);
      if (existing.name_en !== a.name_en) {
        console.warn(`    ! file says "${a.name_en}"; nasheeds get "${existing.name_en}"`);
      }
    }
  }

  console.log(`\nNasheeds (${tracks.length}):`);
  for (const t of tracks) {
    const state = existingNasheeds.has(t.nasheed_id) ? "update" : "new   ";
    console.log(`  ${state} ${t.nasheed_id}  "${t.title_en}"${t.year ? ` (${t.year})` : ""}`);
  }

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }

  // Artists first, so a play can never land on a nasheed whose artist is
  // not yet marked unlisted.
  const artistBatch = db.batch();
  newArtists.forEach((a) =>
    artistBatch.create(db.collection("artists").doc(a.id), newArtistDoc(a)),
  );
  await artistBatch.commit();

  for (let i = 0; i < tracks.length; i += MAX_BATCH_WRITES) {
    const nasheedBatch = db.batch();
    for (const t of tracks.slice(i, i + MAX_BATCH_WRITES)) {
      const artistName =
        (existingArtists.get(t.artist.id)?.name_en as string | undefined)?.trim() ??
        t.artist.name_en;
      nasheedBatch.set(
        db.collection("nasheeds").doc(t.nasheed_id),
        nasheedDoc(t, artistName, existingNasheeds.get(t.nasheed_id)),
        { merge: true },
      );
    }
    await nasheedBatch.commit();
  }
  console.log(`\nWrote ${newArtists.length} artist(s) and ${tracks.length} nasheed(s).\n`);

  execSync("npm run -s collections:build", { stdio: "inherit" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Build Collections — materialize nasheed collections into Firestore
 *
 * Reads scripts/collections/collections.json, resolves every collection
 * against the current nasheeds (see utils/collections.ts) and writes
 * `collections/{id}` with its tracks denormalized, so the app opens a
 * collection with a single read. Also writes `is_listed` on every artist.
 *
 * Safe for the 1.1.0 app: it never reads `collections` or `is_listed`, and
 * this script does not touch `playlists` or `nasheeds.playlist_id`.
 *
 * A collection removed from the file is deactivated, not deleted. Rerun
 * after adding nasheeds, changing tags/years or editing the file.
 *
 * Usage:
 *   npm run collections:build               — write to Firestore
 *   npm run collections:build -- --dry-run  — print the result only
 *
 * Requires scripts/serviceAccountKey.json (Firebase Admin key).
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import {
  CollectionNasheed,
  listedArtists,
  parseCollectionDefinitions,
  resolveCollection,
} from "../utils/collections";

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");
const DEFINITIONS_PATH = path.resolve(__dirname, "collections/collections.json");
const MAX_BATCH_WRITES = 400;

const dryRun = process.argv.includes("--dry-run");

const definitionsResult = parseCollectionDefinitions(
  JSON.parse(fs.readFileSync(DEFINITIONS_PATH, "utf8")),
);
if (!definitionsResult.ok) {
  console.error("Invalid scripts/collections/collections.json:");
  definitionsResult.errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
const definitions = definitionsResult.value;

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
});

const db = admin.firestore();

// ---------------------------------------------------------------------------

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function toCollectionNasheed(
  snap: admin.firestore.QueryDocumentSnapshot,
): CollectionNasheed {
  const d = snap.data();
  return {
    id: snap.id,
    title_en: str(d.title_en),
    artist_id: str(d.artist_id),
    name_en: str(d.name_en),
    audio_path: str(d.audio_path),
    image_path: str(d.image_path),
    moods: Array.isArray(d.moods) ? d.moods.filter((m: unknown) => typeof m === "string") : [],
    tags: Array.isArray(d.tags) ? d.tags.filter((t: unknown) => typeof t === "string") : [],
    year: typeof d.year === "number" ? d.year : undefined,
    playlist_id: typeof d.playlist_id === "string" ? d.playlist_id : null,
    popularity_score: typeof d.popularity_score === "number" ? d.popularity_score : 0,
  };
}

type Write = (batch: admin.firestore.WriteBatch) => void;

async function commitAll(writes: Write[]): Promise<void> {
  for (let i = 0; i < writes.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    writes.slice(i, i + MAX_BATCH_WRITES).forEach((w) => w(batch));
    await batch.commit();
  }
}

async function main(): Promise<void> {
  const [artistSnap, nasheedSnap, existingSnap] = await Promise.all([
    db.collection("artists").get(),
    db.collection("nasheeds").get(),
    db.collection("collections").get(),
  ]);
  const nasheeds = nasheedSnap.docs.map(toCollectionNasheed);
  const artistIds = artistSnap.docs.map((d) => d.id);
  const listed = listedArtists(artistIds, nasheeds);
  const writes: Write[] = [];

  const orphanArtists = [...new Set(nasheeds.map((n) => n.artist_id))].filter(
    (id) => !artistIds.includes(id),
  );
  if (orphanArtists.length > 0) {
    console.warn(`! nasheeds point at missing artists: ${orphanArtists.join(", ")}`);
  }

  console.log(`Artists (${artistSnap.size}):`);
  for (const doc of artistSnap.docs) {
    const isListed = listed.get(doc.id) ?? false;
    const changed = doc.data().is_listed !== isListed;
    console.log(`  ${isListed ? "listed  " : "unlisted"} ${doc.id}${changed ? "  (updated)" : ""}`);
    if (changed) writes.push((b) => b.update(doc.ref, { is_listed: isListed }));
  }

  console.log(`\nCollections (${definitions.length}):`);
  for (const def of definitions) {
    const { tracks, missingIds } = resolveCollection(def.source, nasheeds, listed);
    console.log(`  ${def.id} [${def.shelf}] ${tracks.length} tracks${def.is_active ? "" : " (inactive)"}`);
    if (missingIds.length > 0) {
      console.warn(`    ! unknown or silent track ids: ${missingIds.join(", ")}`);
    }
    const ref = db.collection("collections").doc(def.id);
    writes.push((b) =>
      b.set(ref, {
        ...def,
        tracks,
        track_count: tracks.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }),
    );
  }

  const definedIds = new Set(definitions.map((d) => d.id));
  for (const doc of existingSnap.docs) {
    if (definedIds.has(doc.id) || doc.data().is_active === false) continue;
    console.log(`  ${doc.id} removed from the file → deactivated`);
    writes.push((b) => b.update(doc.ref, { is_active: false }));
  }

  if (dryRun) {
    console.log(`\nDry run: ${writes.length} write(s) skipped.`);
    return;
  }
  await commitAll(writes);
  console.log(`\nDone: ${writes.length} write(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

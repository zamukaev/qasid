/**
 * Refresh Generated Playlists — fix stale/wrong audio_path values
 *
 * Re-fetches current nasheed data from Firestore for every track already
 * stored in a generated_playlist doc, then overwrites the doc with fresh
 * track objects. The ranking order is preserved; tracks whose nasheed doc
 * no longer exists or has no audio_path are dropped.
 *
 * Usage:
 *   npm run refresh:playlists                    — refresh all playlists
 *   npm run refresh:playlists -- --key trending_week   — one playlist only
 *
 * Requires scripts/serviceAccountKey.json (Firebase Admin key).
 */

import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    "Service account key not found at scripts/serviceAccountKey.json\n" +
      "Download it from Firebase console → Project Settings → Service accounts",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: "qasid-fd80d",
});

const db = admin.firestore();

// ---------------------------------------------------------------------------

interface RefreshedTrack {
  id: string;
  title_en: string;
  artist_id: string;
  name_en: string;
  audio_path: string;
  image_path: string;
  moods: string[];
}

function toRefreshedTrack(
  snap: admin.firestore.DocumentSnapshot,
): RefreshedTrack | null {
  const data = snap.data();
  if (!data || !data.audio_path) return null;
  return {
    id: snap.id,
    title_en: typeof data.title_en === "string" ? data.title_en : "",
    artist_id: typeof data.artist_id === "string" ? data.artist_id : "",
    name_en: typeof data.name_en === "string" ? data.name_en : "",
    audio_path: data.audio_path,
    image_path: typeof data.image_path === "string" ? data.image_path : "",
    moods: Array.isArray(data.moods) ? data.moods : [],
  };
}

async function refreshPlaylist(key: string): Promise<void> {
  const playlistRef = db.collection("generated_playlists").doc(key);
  const playlistSnap = await playlistRef.get();

  if (!playlistSnap.exists) {
    console.log(`  [${key}] document not found — skipping`);
    return;
  }

  const playlistData = playlistSnap.data()!;
  const existingTracks: unknown[] = Array.isArray(playlistData.tracks)
    ? playlistData.tracks
    : [];

  if (existingTracks.length === 0) {
    console.log(`  [${key}] no tracks to refresh`);
    return;
  }

  // Extract IDs in order, deduplicating while preserving first-occurrence rank.
  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const t of existingTracks) {
    if (t && typeof t === "object" && "id" in t && typeof (t as { id: unknown }).id === "string") {
      const id = (t as { id: string }).id;
      if (!seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    }
  }

  // Batch-fetch from nasheeds collection (chunks of 100).
  const nasheedsCol = db.collection("nasheeds");
  const byId = new Map<string, RefreshedTrack>();
  const CHUNK = 100;

  for (let i = 0; i < orderedIds.length; i += CHUNK) {
    const chunk = orderedIds.slice(i, i + CHUNK);
    const refs = chunk.map((id) => nasheedsCol.doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      const track = toRefreshedTrack(snap);
      if (track) byId.set(snap.id, track);
    }
  }

  const refreshedTracks = orderedIds
    .map((id) => byId.get(id))
    .filter((t): t is RefreshedTrack => !!t);

  const dropped = orderedIds.length - refreshedTracks.length;

  await playlistRef.set(
    {
      tracks: refreshedTracks,
      track_count: refreshedTracks.length,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(
    `  [${key}] refreshed ${refreshedTracks.length} tracks` +
      (dropped > 0 ? ` (dropped ${dropped} with missing audio_path)` : ""),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const keyIdx = args.indexOf("--key");
  const targetKey = keyIdx !== -1 ? args[keyIdx + 1] : null;

  let keys: string[];

  if (targetKey) {
    keys = [targetKey];
  } else {
    const snap = await db.collection("generated_playlists").get();
    keys = snap.docs.map((d) => d.id);
    if (keys.length === 0) {
      console.log("No documents found in generated_playlists.");
      return;
    }
  }

  console.log(`Refreshing ${keys.length} playlist(s)...`);
  for (const key of keys) {
    await refreshPlaylist(key);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
